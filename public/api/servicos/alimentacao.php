<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../env.php';
require_once __DIR__ . '/../email.php';

// Constantes substituídas por variáveis lidas do banco (veja após $db = getDb())

corsHeaders();

// Adiciona DELETE aos headers permitidos
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');

// Autentica
$token = $_SERVER['HTTP_X_SESSION_TOKEN'] ?? '';
if (empty($token)) respondError('Não autenticado', 401);

$db = getDb();

$stmt = $db->prepare("SELECT email FROM sessions WHERE token = ? AND expires_at > datetime('now')");
$stmt->execute([$token]);
$session = $stmt->fetch();
if (!$session) respondError('Sessão inválida', 401);

// Carrega inscrição da pessoa
$stmt = $db->prepare("
    SELECT i.id as inscricao_id FROM inscricoes i
    JOIN pessoas p ON p.id = i.pessoa_id
    WHERE p.email = ? COLLATE NOCASE
    ORDER BY i.criado_em DESC LIMIT 1
");
$stmt->execute([$session['email']]);
$row = $stmt->fetch();
if (!$row) respondError('Nenhuma inscrição encontrada', 404);
$inscricaoId = (int)$row['inscricao_id'];

// Preços do banco (editáveis pelo admin)
$_P = getPrecos($db);
$VALOR_ALIM_COMPLETO = $_P['valor_alimentacao_completo'];
$VALOR_ALIM_ALMOCO   = $_P['valor_alimentacao_almoco'];
unset($_P);

// Verifica prazo
function verificaPrazoAlimentacao(): void {
    if (ALIMENTACAO_EDITAVEL_ATE !== null && date('Y-m-d') > ALIMENTACAO_EDITAVEL_ATE) {
        respondError('O prazo para alteração da alimentação encerrou em ' . ALIMENTACAO_EDITAVEL_ATE, 403);
    }
}

// ── GET — retorna seleção atual ─────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $db->prepare("SELECT dia, valor, COALESCE(pacote, 'completo') AS pacote FROM alimentacao WHERE inscricao_id = ? ORDER BY dia");
    $stmt->execute([$inscricaoId]);
    respond($stmt->fetchAll());
}

// ── POST — salva seleção (substitui) ────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verificaPrazoAlimentacao();

    if (getConfigGeral($db)['alimentacao_aberto'] !== '1') {
        respondError('A contratação de alimentação está temporariamente fechada.', 403);
    }

    // Alimentação já paga não pode ser editada nem recontratada
    $stmt = $db->prepare("SELECT id FROM pagamentos WHERE inscricao_id = ? AND tipo = 'alimentacao' AND status = 'pago' LIMIT 1");
    $stmt->execute([$inscricaoId]);
    if ($stmt->fetch()) {
        respondError('Sua alimentação já está paga e não pode ser alterada.', 409);
    }

    $body = getBody();
    $dias = $body['dias'] ?? [];

    // Valida: [{dia, pacote}]
    $pacote_labels = ['completo' => 'Pacote completo', 'almoco' => 'Apenas almoço'];
    $entries = [];
    foreach ($dias as $item) {
        $dia    = (int)($item['dia'] ?? 0);
        $pacote = in_array($item['pacote'] ?? '', ['completo', 'almoco']) ? $item['pacote'] : 'completo';
        if (!in_array($dia, [5, 6, 7])) continue;
        $valor_dia = $pacote === 'almoco' ? $VALOR_ALIM_ALMOCO : $VALOR_ALIM_COMPLETO;
        $entries[$dia] = ['pacote' => $pacote, 'valor' => $valor_dia];
    }

    $db->beginTransaction();
    try {
        // Cancela pagamento pendente (usuário alterou a seleção antes de pagar)
        $pgCancelado = null;
        $stmtPg = $db->prepare("SELECT id, tipo, status, valor, itens_json FROM pagamentos WHERE inscricao_id = ? AND tipo = 'alimentacao' AND status = 'pendente' LIMIT 1");
        $stmtPg->execute([$inscricaoId]);
        $pgPendente = $stmtPg->fetch();
        if ($pgPendente) {
            $db->prepare("UPDATE pagamentos SET status = 'cancelado', atualizado_em = datetime('now') WHERE id = ?")
               ->execute([$pgPendente['id']]);
            $pgCancelado = [
                'id'     => (int)$pgPendente['id'],
                'tipo'   => $pgPendente['tipo'],
                'status' => 'cancelado',
                'valor'  => (float)$pgPendente['valor'],
                'metodo' => null,
                'itens'  => $pgPendente['itens_json'] ? json_decode($pgPendente['itens_json'], true) : null,
            ];
        }

        // Remove seleção anterior
        $db->prepare("DELETE FROM alimentacao WHERE inscricao_id = ?")
           ->execute([$inscricaoId]);

        // Insere nova seleção
        $stmt = $db->prepare("INSERT INTO alimentacao (inscricao_id, dia, valor, pacote) VALUES (?, ?, ?, ?)");
        foreach ($entries as $dia => $entry) {
            $stmt->execute([$inscricaoId, $dia, $entry['valor'], $entry['pacote']]);
        }

        // Salva restrição alimentar como JSON estruturado
        $restricaoTipo = $body['restricaoTipo'] ?? null;
        $restricaoJson = null;
        if (!empty($restricaoTipo)) {
            $restricaoDescricao = trim($body['restricaoDescricao'] ?? '');
            $restricaoJson = json_encode(
                ['tipo' => $restricaoTipo, 'descricao' => $restricaoDescricao ?: null],
                JSON_UNESCAPED_UNICODE
            );
        }
        $db->prepare("UPDATE inscricoes SET restricao_alimentar = ?, atualizado_em = datetime('now') WHERE id = ?")
           ->execute([$restricaoJson, $inscricaoId]);

        $db->commit();

        // Notifica por email
        $stmtNome = $db->prepare("SELECT p.nome FROM pessoas p JOIN inscricoes i ON i.pessoa_id = p.id WHERE i.id = ?");
        $stmtNome->execute([$inscricaoId]);
        $nomeAtleta = (string)($stmtNome->fetchColumn() ?: '');
        if ($nomeAtleta) {
            $pacote_labels = ['completo' => 'Pacote completo', 'almoco' => 'Apenas almoço'];
            $linhas = [];
            foreach ($entries as $dia => $entry) {
                $label    = $pacote_labels[$entry['pacote']] ?? 'Pacote completo';
                $linhas[] = "Dia {$dia}/set — {$label} (R$ {$entry['valor']})";
            }
            $detalhes = empty($linhas) ? 'Nenhum dia selecionado.' : implode('<br>', $linhas);
            sendServiceUpdatedEmail($session['email'], $nomeAtleta, 'alimentação', $detalhes);
        }

        $stmt = $db->prepare("SELECT dia, valor, COALESCE(pacote, 'completo') AS pacote FROM alimentacao WHERE inscricao_id = ? ORDER BY dia");
        $stmt->execute([$inscricaoId]);
        $stmtR = $db->prepare("SELECT restricao_alimentar FROM inscricoes WHERE id = ?");
        $stmtR->execute([$inscricaoId]);
        $rawR = $stmtR->fetchColumn();
        $restricaoParsed = $rawR ? json_decode($rawR, true) : null;
        respond([
            'alimentacao'        => $stmt->fetchAll(),
            'restricao_alimentar'=> $restricaoParsed,
            'dias'               => array_keys($entries),
            'pagamento_cancelado'=> $pgCancelado,
        ]);

    } catch (\Exception $e) {
        $db->rollBack();
        respondError('Erro ao salvar: ' . $e->getMessage(), 500);
    }
}

// ── DELETE — remove toda alimentação ────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    verificaPrazoAlimentacao();

    $stmt = $db->prepare("SELECT id FROM pagamentos WHERE inscricao_id = ? AND tipo = 'alimentacao' AND status = 'pago' LIMIT 1");
    $stmt->execute([$inscricaoId]);
    if ($stmt->fetch()) {
        respondError('Sua alimentação já está paga e não pode ser alterada.', 409);
    }

    $db->prepare("DELETE FROM alimentacao WHERE inscricao_id = ?")
       ->execute([$inscricaoId]);

    respond(['success' => true]);
}

respondError('Método não suportado', 405);
