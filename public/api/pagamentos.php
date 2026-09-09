<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/env.php';

corsHeaders();
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

$db = getDb();

// Tenta autenticar via session token (fluxo normal)
$token       = $_SERVER['HTTP_X_SESSION_TOKEN'] ?? '';
$inscricaoId = null;
$sessionAuth = false;

if (!empty($token)) {
    $stmt = $db->prepare("SELECT email FROM sessions WHERE token = ? AND expires_at > datetime('now')");
    $stmt->execute([$token]);
    $session = $stmt->fetch();
    if ($session) {
        $stmt = $db->prepare("
            SELECT i.id as inscricao_id FROM inscricoes i
            JOIN pessoas p ON p.id = i.pessoa_id
            WHERE p.email = ? COLLATE NOCASE
            ORDER BY i.criado_em DESC LIMIT 1
        ");
        $stmt->execute([$session['email']]);
        $row = $stmt->fetch();
        if ($row) { $inscricaoId = (int)$row['inscricao_id']; $sessionAuth = true; }
    }
}

// GET via checkout_token (polling PIX pós-inscrição, sem sessão)
if ($_SERVER['REQUEST_METHOD'] === 'GET' && !$sessionAuth) {
    $ctk  = trim($_GET['checkout_token'] ?? '');
    $pgId = (int)($_GET['pagamento_id'] ?? 0);
    if ($ctk && $pgId) {
        $stmt = $db->prepare("SELECT id, tipo, status, valor, metodo, itens_json, criado_em, inscricao_id FROM pagamentos WHERE id = ? AND checkout_token = ?");
        $stmt->execute([$pgId, $ctk]);
        $pg = $stmt->fetch();
        if (!$pg) respondError('Pagamento não encontrado', 404);

        // Status consolidado: 'pago' apenas quando não restar nenhum pendente
        $stmt = $db->prepare("SELECT COUNT(*) FROM pagamentos WHERE inscricao_id = ? AND status = 'pendente'");
        $stmt->execute([$pg['inscricao_id']]);
        $pendentes = (int)$stmt->fetchColumn();
        $statusConsolidado = ($pendentes === 0) ? 'pago' : 'pendente';

        respond([[
            'id'        => (int)$pg['id'],
            'tipo'      => $pg['tipo'],
            'status'    => $statusConsolidado,
            'valor'     => (float)$pg['valor'],
            'metodo'    => $pg['metodo'],
            'itens'     => $pg['itens_json'] ? json_decode($pg['itens_json'], true) : null,
            'criado_em' => $pg['criado_em'],
        ]]);
    }
    respondError('Não autenticado', 401);
}

// ── GET — lista pagamentos ───────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $db->prepare("
        SELECT id, tipo, status, valor, metodo, itens_json, criado_em
        FROM pagamentos WHERE inscricao_id = ? ORDER BY criado_em ASC
    ");
    $stmt->execute([$inscricaoId]);
    $rows = $stmt->fetchAll();
    respond(array_map(fn($p) => [
        'id'        => (int)$p['id'],
        'tipo'      => $p['tipo'] ?? 'inscricao',
        'status'    => $p['status'],
        'valor'     => (float)$p['valor'],
        'metodo'    => $p['metodo'],
        'itens'     => $p['itens_json'] ? json_decode($p['itens_json'], true) : null,
        'criado_em' => $p['criado_em'],
    ], $rows));
}

// ── POST ────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = getBody();
    $acao = $body['acao'] ?? 'criar';

    // ── Simulação de pagamento (mockup) ──────────────────
    // ATENÇÃO: quita pagamentos SEM dinheiro nenhum. Existe só para testar o fluxo
    // de inscrição em desenvolvimento, quando não há credencial do Mercado Pago.
    // Fica DESLIGADO a menos que PAGAMENTO_MOCK esteja explicitamente ligado no env.
    if ($acao === 'simular_pago') {
        if (!defined('PAGAMENTO_MOCK') || !PAGAMENTO_MOCK) {
            respondError('Simulação de pagamento desabilitada.', 403);
        }
        $pgId = (int)($body['pagamento_id'] ?? 0);
        if (!$pgId) respondError('ID do pagamento é obrigatório');

        if (!$sessionAuth) {
            // Fluxo pós-inscrição: autentica via checkout_token e quita TODOS os
            // pagamentos pendentes da inscrição de uma só vez
            $checkoutToken = trim($body['checkout_token'] ?? '');
            if (empty($checkoutToken)) respondError('Não autenticado', 401);
            $stmt = $db->prepare("SELECT inscricao_id FROM pagamentos WHERE id = ? AND checkout_token = ?");
            $stmt->execute([$pgId, $checkoutToken]);
            $pgRow = $stmt->fetch();
            if (!$pgRow) respondError('Token de checkout inválido', 401);
            $stmtPend = $db->prepare("SELECT COUNT(*) FROM pagamentos WHERE inscricao_id = ? AND status = 'pendente'");
            $stmtPend->execute([$pgRow['inscricao_id']]);
            if ((int)$stmtPend->fetchColumn() === 0) respondError('Todos os pagamentos já foram processados', 400);
            $inscricaoId = (int)$pgRow['inscricao_id'];

            // Quita inscrição + alimentação + alojamento em uma tacada
            $stmtQuitados = $db->prepare("SELECT id, tipo FROM pagamentos WHERE inscricao_id=? AND status='pendente'");
            $stmtQuitados->execute([$inscricaoId]);
            $quitados = $stmtQuitados->fetchAll();

            $db->prepare("UPDATE pagamentos SET status='pago', metodo='mockup', atualizado_em=datetime('now') WHERE inscricao_id=? AND status='pendente'")
               ->execute([$inscricaoId]);
            $db->prepare("UPDATE inscricoes SET status='pago', atualizado_em=datetime('now') WHERE id=?")
               ->execute([$inscricaoId]);

            foreach ($quitados as $q) lockAlojamentoAoPagar($db, (int)$q['id']);

            $stmt = $db->prepare("SELECT id, tipo, status, valor, metodo, itens_json FROM pagamentos WHERE id=?");
            $stmt->execute([$pgId]);
            $pg = $stmt->fetch();
            respond([
                'id'     => (int)$pg['id'],
                'tipo'   => $pg['tipo'],
                'status' => $pg['status'],
                'valor'  => (float)$pg['valor'],
                'metodo' => $pg['metodo'],
                'itens'  => $pg['itens_json'] ? json_decode($pg['itens_json'], true) : null,
            ]);
        }

        // Fluxo via sessão (dashboard): paga apenas o pagamento específico
        $stmt = $db->prepare("SELECT id, inscricao_id FROM pagamentos WHERE id = ? AND inscricao_id = ? AND status = 'pendente'");
        $stmt->execute([$pgId, $inscricaoId]);
        if (!$stmt->fetch()) respondError('Pagamento não encontrado ou já processado', 404);

        $stmt = $db->prepare("SELECT tipo FROM pagamentos WHERE id = ? AND inscricao_id = ?");
        $stmt->execute([$pgId, $inscricaoId]);
        $pg = $stmt->fetch();
        $tipo = $pg['tipo'] ?? '';

        $db->prepare("UPDATE pagamentos SET status='pago', metodo='mockup', atualizado_em=datetime('now') WHERE id=?")
           ->execute([$pgId]);

        if (in_array($tipo, ['inscricao', 'completo'])) {
            $db->prepare("UPDATE inscricoes SET status='pago', atualizado_em=datetime('now') WHERE id=?")
               ->execute([$inscricaoId]);
        }
        lockAlojamentoAoPagar($db, $pgId);

        $stmt = $db->prepare("SELECT id, tipo, status, valor, metodo, itens_json FROM pagamentos WHERE id=?");
        $stmt->execute([$pgId]);
        $pg = $stmt->fetch();
        respond([
            'id'     => (int)$pg['id'],
            'tipo'   => $pg['tipo'],
            'status' => $pg['status'],
            'valor'  => (float)$pg['valor'],
            'metodo' => $pg['metodo'],
            'itens'  => $pg['itens_json'] ? json_decode($pg['itens_json'], true) : null,
        ]);
    }

    // Criação de pagamento de serviços requer session
    if (!$sessionAuth) respondError('Não autenticado', 401);

    // ── Criar pagamento de serviços ──────────────────────
    $tipo = $body['tipo'] ?? '';
    if (!in_array($tipo, ['alimentacao', 'alojamento'])) {
        respondError('Tipo inválido. Use: alimentacao ou alojamento');
    }

    // Alojamento vs alojamento extra: decidido só pelo backend, nunca pelo que o
    // frontend manda — se já existe algum dia travado (pago) para esta inscrição,
    // qualquer novo pagamento de alojamento é necessariamente "extra".
    $tipoReal = $tipo;
    if ($tipo === 'alojamento') {
        $stmt = $db->prepare("SELECT 1 FROM alojamento WHERE inscricao_id = ? AND pagamento_id IS NOT NULL LIMIT 1");
        $stmt->execute([$inscricaoId]);
        if ($stmt->fetch()) $tipoReal = 'alojamento_extra';
    }

    // Se já existe pagamento PENDENTE para este tipo, devolve ele (idempotente)
    $stmt = $db->prepare("
        SELECT id, tipo, status, valor, itens_json FROM pagamentos
        WHERE inscricao_id = ? AND tipo = ? AND status = 'pendente'
        ORDER BY criado_em DESC LIMIT 1
    ");
    $stmt->execute([$inscricaoId, $tipoReal]);
    $existente = $stmt->fetch();
    if ($existente) {
        respond([
            'id'    => (int)$existente['id'],
            'tipo'  => $existente['tipo'],
            'status'=> $existente['status'],
            'valor' => (float)$existente['valor'],
            'itens' => $existente['itens_json'] ? json_decode($existente['itens_json'], true) : null,
        ]);
    }

    // Bloqueia se já foi pago — não se aplica a alojamento_extra, que pode ter várias
    // rodadas (cada lote de dias extras vira um novo pagamento, cobrando só o que
    // ainda está solto — nunca um dia já travado).
    if ($tipoReal !== 'alojamento_extra') {
        $stmt = $db->prepare("
            SELECT id FROM pagamentos
            WHERE inscricao_id = ? AND tipo = ? AND status = 'pago'
            LIMIT 1
        ");
        $stmt->execute([$inscricaoId, $tipoReal]);
        if ($stmt->fetch()) {
            respondError('Este serviço já está pago.', 409);
        }
    }

    $itens = [];
    $valor = 0.0;

    if ($tipoReal === 'alimentacao') {
        $stmt = $db->prepare("SELECT dia, valor, COALESCE(pacote, 'completo') AS pacote FROM alimentacao WHERE inscricao_id = ? ORDER BY dia");
        $stmt->execute([$inscricaoId]);
        $pacote_labels = ['completo' => 'Pacote completo', 'almoco' => 'Apenas almoço'];
        foreach ($stmt->fetchAll() as $row) {
            $label = $pacote_labels[$row['pacote']] ?? 'Pacote completo';
            $itens[] = ['descricao' => "Alimentação dia {$row['dia']}/set — {$label}", 'valor' => (float)$row['valor']];
            $valor  += (float)$row['valor'];
        }
    } else {
        // Só cobra os dias ainda soltos — dias travados (já pagos) nunca são recobrados
        $stmt = $db->prepare("SELECT dia, valor FROM alojamento WHERE inscricao_id = ? AND pagamento_id IS NULL ORDER BY dia");
        $stmt->execute([$inscricaoId]);
        $prefixo = $tipoReal === 'alojamento_extra' ? 'Alojamento extra' : 'Alojamento';
        foreach ($stmt->fetchAll() as $row) {
            $itens[] = ['descricao' => "{$prefixo} dia {$row['dia']}/set", 'valor' => (float)$row['valor']];
            $valor  += (float)$row['valor'];
        }
    }

    if ($valor <= 0) respondError('Nenhum serviço selecionado para gerar pagamento');

    $stmt = $db->prepare("
        INSERT INTO pagamentos (inscricao_id, tipo, status, valor, itens_json)
        VALUES (?, ?, 'pendente', ?, ?)
    ");
    $stmt->execute([$inscricaoId, $tipoReal, $valor, json_encode($itens, JSON_UNESCAPED_UNICODE)]);
    $pgId = (int)$db->lastInsertId();

    $stmt = $db->prepare("SELECT id, tipo, status, valor, itens_json FROM pagamentos WHERE id=?");
    $stmt->execute([$pgId]);
    $pg = $stmt->fetch();
    respond([
        'id'    => (int)$pg['id'],
        'tipo'  => $pg['tipo'],
        'status'=> $pg['status'],
        'valor' => (float)$pg['valor'],
        'itens' => json_decode($pg['itens_json'], true),
    ], 201);
}

respondError('Método não suportado', 405);
