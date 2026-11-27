<?php
require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/../email.php';
adminGuard();

$method = $_SERVER['REQUEST_METHOD'];

// ── GET: lista ou detalhe ──────────────────────────────────────────────────
if ($method === 'GET') {
    $db = getDb();
    $id = isset($_GET['id']) ? (int)$_GET['id'] : null;

    if ($id) {
        // Detalhe completo de uma inscrição
        $ins = $db->prepare("
            SELECT i.*, p.nome, p.email, p.telefone, p.ddi, p.genero, p.genero_descricao,
                   p.cidade, p.nacionalidade, c.nome AS clube
            FROM inscricoes i
            JOIN pessoas p ON p.id = i.pessoa_id
            LEFT JOIN clubes c ON c.id = p.clube_id
            WHERE i.id = ?
        ");
        $ins->execute([$id]);
        $inscricao = $ins->fetch();
        if (!$inscricao) respondError('Não encontrado', 404);

        $stmt = $db->prepare("SELECT * FROM inscricao_categorias WHERE inscricao_id = ?");
        $stmt->execute([$id]);
        $inscricao['categorias'] = $stmt->fetchAll();

        $stmt = $db->prepare("
            SELECT t.id, t.nome, t.categoria, t.codigo
            FROM times t
            JOIN membros_time mt ON mt.time_id = t.id
            WHERE mt.inscricao_id = ?
        ");
        $stmt->execute([$id]);
        $inscricao['times'] = $stmt->fetchAll();

        $stmt = $db->prepare("SELECT * FROM pagamentos WHERE inscricao_id = ? ORDER BY criado_em DESC");
        $stmt->execute([$id]);
        $inscricao['pagamentos'] = $stmt->fetchAll();

        $stmt = $db->prepare("SELECT * FROM alimentacao WHERE inscricao_id = ? ORDER BY dia");
        $stmt->execute([$id]);
        $inscricao['alimentacao'] = $stmt->fetchAll();

        $stmt = $db->prepare("SELECT * FROM alojamento WHERE inscricao_id = ? ORDER BY dia");
        $stmt->execute([$id]);
        $inscricao['alojamento'] = $stmt->fetchAll();

        $stmt = $db->prepare("SELECT * FROM observacoes WHERE inscricao_id = ? ORDER BY criado_em DESC");
        $stmt->execute([$id]);
        $inscricao['observacoes'] = $stmt->fetchAll();

        $stmt = $db->prepare("SELECT * FROM checkins WHERE inscricao_id = ?");
        $stmt->execute([$id]);
        $inscricao['checkin'] = $stmt->fetch() ?: null;

        respond($inscricao);
    }

    // Lista com filtros
    $where  = [];
    $params = [];

    if (!empty($_GET['status']) && $_GET['status'] !== 'todos') {
        $where[]  = 'i.status = ?';
        $params[] = $_GET['status'];
    } elseif (empty($_GET['status']) || $_GET['status'] === 'todos') {
        // Por padrão, não mostra cancelados — requer filtro explícito
        $where[] = "i.status != 'cancelado'";
    }
    if (!empty($_GET['categoria'])) {
        $where[]  = 'EXISTS (SELECT 1 FROM inscricao_categorias ic2 WHERE ic2.inscricao_id = i.id AND ic2.categoria = ?)';
        $params[] = $_GET['categoria'];
    }
    if (isset($_GET['latino']) && $_GET['latino'] !== '') {
        $where[]  = 'i.latino = ?';
        $params[] = (int)$_GET['latino'];
    }
    if (isset($_GET['acao_afirmativa']) && $_GET['acao_afirmativa'] !== '') {
        $where[]  = 'i.acao_afirmativa = ?';
        $params[] = (int)$_GET['acao_afirmativa'];
    }
    if (!empty($_GET['alojamento'])) {
        $where[] = 'EXISTS (SELECT 1 FROM alojamento al2 WHERE al2.inscricao_id = i.id)';
    }
    if (!empty($_GET['alimentacao'])) {
        $where[] = 'EXISTS (SELECT 1 FROM alimentacao a2 WHERE a2.inscricao_id = i.id)';
    }
    if (!empty($_GET['estrangeiro'])) {
        $where[]  = "p.nacionalidade != 'brasileire'";
    }
    if (!empty($_GET['busca'])) {
        $where[]  = "(p.nome LIKE ? OR p.email LIKE ? OR p.cidade LIKE ?)";
        $like     = '%' . $_GET['busca'] . '%';
        $params[] = $like;
        $params[] = $like;
        $params[] = $like;
    }

    $whereStr = implode(' AND ', $where);
    $stmt = $db->prepare("
        SELECT
            i.id, i.status, i.latino, i.acao_afirmativa, i.valor_total, i.criado_em, i.tipo_participacao,
            p.nome, p.email, p.cidade, p.nacionalidade,
            c.nome AS clube,
            (SELECT GROUP_CONCAT(ic.categoria, ', ') FROM inscricao_categorias ic WHERE ic.inscricao_id = i.id) AS categorias,
            (SELECT GROUP_CONCAT(t.nome, ', ') FROM times t JOIN membros_time mt ON mt.time_id = t.id WHERE mt.inscricao_id = i.id) AS times,
            (SELECT COUNT(*) FROM alimentacao a WHERE a.inscricao_id = i.id) AS tem_alimentacao,
            (SELECT COUNT(*) FROM alojamento al WHERE al.inscricao_id = i.id) AS tem_alojamento
        FROM inscricoes i
        JOIN pessoas p ON p.id = i.pessoa_id
        LEFT JOIN clubes c ON c.id = p.clube_id
        WHERE $whereStr
        ORDER BY i.criado_em DESC
        LIMIT 500
    ");
    $stmt->execute($params);
    respond($stmt->fetchAll());
}

// ── POST: ações ────────────────────────────────────────────────────────────
if ($method === 'POST') {
    $body   = getBody();
    $action = $body['action'] ?? '';
    $id     = (int)($body['id'] ?? 0);
    if (!$id && $action !== 'criar_atleta') respondError('ID obrigatório');

    if ($action === 'criar_atleta') {
        $nome = trim((string)($body['nome'] ?? ''));
        $email = strtolower(trim((string)($body['email'] ?? '')));
        $categoria = (string)($body['categoria'] ?? '');
        $db = null;
        try {
            if ($nome === '' || mb_strlen($nome) > 120) respondError('Informe um nome de até 120 caracteres.');
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) respondError('E-mail inválido.');
            if (!in_array($categoria, ['misto', 'mtnb'], true)) respondError('Categoria inválida.');

            $db = getDb();
            $stmt = $db->prepare('SELECT id FROM pessoas WHERE email=? COLLATE NOCASE');
            $stmt->execute([$email]);
            $pessoaId = $stmt->fetchColumn();
            if ($pessoaId) {
                $stmt = $db->prepare("SELECT id FROM inscricoes WHERE pessoa_id=? AND status!='cancelado' LIMIT 1");
                $stmt->execute([$pessoaId]);
                if ($stmt->fetchColumn()) respondError('Este e-mail já possui uma inscrição ativa.', 409);
            }

            $precos = getPrecos($db);
            $valor = (float)$precos[$categoria === 'misto' ? 'valor_misto' : 'valor_mtnb'];
            $db->beginTransaction();
            if (!$pessoaId) {
                $db->prepare('INSERT INTO pessoas (nome,email) VALUES (?,?)')->execute([$nome, $email]);
                $pessoaId = (int)$db->lastInsertId();
            } else {
                $db->prepare('UPDATE pessoas SET nome=? WHERE id=?')->execute([$nome, $pessoaId]);
            }

            $db->prepare("INSERT INTO inscricoes (pessoa_id,status,valor_total,tipo_participacao) VALUES (?,'aguardando_pagamento',?,'atleta')")
                ->execute([$pessoaId, $valor]);
            $inscricaoId = (int)$db->lastInsertId();
            $db->prepare('INSERT INTO inscricao_categorias (inscricao_id,categoria,valor) VALUES (?,?,?)')
                ->execute([$inscricaoId, $categoria, $valor]);

            $descricao = $categoria === 'misto' ? 'Brasileiro Misto' : 'Brasileiro MTNB';
            $itens = json_encode([['descricao' => $descricao, 'valor' => $valor]], JSON_UNESCAPED_UNICODE);
            $checkoutToken = bin2hex(random_bytes(24));
            $db->prepare("INSERT INTO pagamentos (inscricao_id,tipo,status,valor,itens_json,checkout_token) VALUES (?,'inscricao','pendente',?,?,?)")
                ->execute([$inscricaoId, $valor, $itens, $checkoutToken]);
            $db->commit();
        } catch (Throwable $e) {
            if ($db instanceof PDO && $db->inTransaction()) $db->rollBack();
            error_log('[admin criar_atleta] ' . $e->getMessage());
            respondError('Erro interno do servidor', 500);
        }

        respond(['ok' => true, 'inscricao_id' => $inscricaoId], 201);
    }

    $db = getDb();

    if ($action === 'gerar_codigo_atleta') {
        $stmt = $db->prepare('SELECT p.id, p.email FROM inscricoes i JOIN pessoas p ON p.id=i.pessoa_id WHERE i.id=?');
        $stmt->execute([$id]);
        $pessoa = $stmt->fetch();
        if (!$pessoa) respondError('Inscrição não encontrada', 404);

        $codigo = str_pad((string)random_int(0, 99999999), 8, '0', STR_PAD_LEFT);
        $hash = password_hash($codigo, PASSWORD_DEFAULT);
        $db->beginTransaction();
        try {
            $db->prepare("INSERT INTO athlete_access_codes (pessoa_id, code_hash, failed_attempts, locked_until, atualizado_em)
                VALUES (?, ?, 0, NULL, datetime('now'))
                ON CONFLICT(pessoa_id) DO UPDATE SET code_hash=excluded.code_hash, failed_attempts=0, locked_until=NULL, atualizado_em=datetime('now')")
                ->execute([$pessoa['id'], $hash]);
            // Redefinir o código revoga sessões e códigos antigos de e-mail dessa pessoa.
            $db->prepare('DELETE FROM sessions WHERE email=? COLLATE NOCASE')->execute([$pessoa['email']]);
            $db->prepare('UPDATE login_codes SET used=1 WHERE email=? COLLATE NOCASE')->execute([$pessoa['email']]);
            $db->commit();
        } catch (Throwable $e) {
            if ($db->inTransaction()) $db->rollBack();
            throw $e;
        }

        respond(['ok' => true, 'code' => $codigo]);
    }

    if ($action === 'marcar_pago_manual') {
        $pagamento_id = (int)($body['pagamento_id'] ?? 0);
        if (!$pagamento_id) respondError('pagamento_id obrigatório');

        // Garante que o pagamento pertence a esta inscrição
        $stmt = $db->prepare("SELECT id, tipo FROM pagamentos WHERE id = ? AND inscricao_id = ?");
        $stmt->execute([$pagamento_id, $id]);
        $pg = $stmt->fetch();
        if (!$pg) respondError('Pagamento não encontrado', 404);

        $db->prepare("UPDATE pagamentos SET status = 'pago', metodo = 'manual', atualizado_em = datetime('now') WHERE id = ?")
           ->execute([$pagamento_id]);
        lockAlojamentoAoPagar($db, $pagamento_id);

        // Pagamento esportivo ou completo → atualiza status da inscrição
        if (in_array($pg['tipo'], ['inscricao', 'completo'])) {
            $db->prepare("UPDATE inscricoes SET status = 'pago', atualizado_em = datetime('now') WHERE id = ?")
               ->execute([$id]);
        }

        $labels = ['inscricao' => 'inscrição', 'alimentacao' => 'alimentação', 'alojamento' => 'alojamento', 'alojamento_extra' => 'alojamento extra'];
        $label  = $labels[$pg['tipo']] ?? $pg['tipo'];
        _logObs($db, $id, "Pagamento de {$label} marcado como pago manualmente pelo admin", 'pagamento');
        respond(['ok' => true]);
    }

    if ($action === 'cancelar') {
        $stmtPessoa = $db->prepare("SELECT p.nome, p.email FROM inscricoes i JOIN pessoas p ON p.id = i.pessoa_id WHERE i.id = ?");
        $stmtPessoa->execute([$id]);
        $pessoaDados = $stmtPessoa->fetch() ?: [];

        // Coleta dados antes de cancelar para montar o log de ressarcimento
        $stmt = $db->prepare("SELECT tipo, metodo, status, valor FROM pagamentos WHERE inscricao_id = ?");
        $stmt->execute([$id]);
        $pagamentos = $stmt->fetchAll();

        $stmt = $db->prepare("SELECT dia, valor FROM alimentacao WHERE inscricao_id = ? ORDER BY dia");
        $stmt->execute([$id]);
        $alim_rows = $stmt->fetchAll();

        $stmt = $db->prepare("SELECT dia, valor FROM alojamento WHERE inscricao_id = ? ORDER BY dia");
        $stmt->execute([$id]);
        $aloj_rows = $stmt->fetchAll();

        // Calcula total efetivamente pago
        $total_ressarcir = 0.0;
        $linhas = ['Inscrição CANCELADA pelo admin.', ''];

        $pgs_pagos = array_filter($pagamentos, fn($p) => $p['status'] === 'pago');
        if ($pgs_pagos) {
            $linhas[] = 'Pagamentos confirmados (a ressarcir):';
            foreach ($pgs_pagos as $pg) {
                $via = $pg['metodo'] ? " via {$pg['metodo']}" : '';
                $val = 'R$ ' . number_format((float)$pg['valor'], 2, ',', '.');
                $linhas[] = "  • {$pg['tipo']}{$via}: {$val}";
                $total_ressarcir += (float)$pg['valor'];
            }
            $linhas[] = '';
        }

        if ($alim_rows) {
            $dias_str = implode(', ', array_column($alim_rows, 'dia'));
            $val_alim = array_sum(array_column($alim_rows, 'valor'));
            $linhas[] = 'Alimentação contratada — dias ' . $dias_str . '/set: R$ ' . number_format($val_alim, 2, ',', '.');
        }
        if ($aloj_rows) {
            $dias_str = implode(', ', array_column($aloj_rows, 'dia'));
            $val_aloj = array_sum(array_column($aloj_rows, 'valor'));
            $linhas[] = 'Alojamento contratado — dias ' . $dias_str . '/set: R$ ' . number_format($val_aloj, 2, ',', '.');
        }

        $linhas[] = '';
        if ($total_ressarcir > 0) {
            $linhas[] = 'TOTAL A RESSARCIR: R$ ' . number_format($total_ressarcir, 2, ',', '.');
        } else {
            $linhas[] = 'Sem pagamentos confirmados — sem ressarcimento necessário.';
        }

        // Persiste o cancelamento
        $db->prepare("UPDATE inscricoes SET status = 'cancelado', atualizado_em = datetime('now') WHERE id = ?")->execute([$id]);
        // Cancela pagamentos ainda pendentes (não toca nos 'pago' para preservar histórico)
        $db->prepare("UPDATE pagamentos SET status = 'cancelado', atualizado_em = datetime('now') WHERE inscricao_id = ? AND status = 'pendente'")->execute([$id]);

        _logObs($db, $id, implode("\n", $linhas), 'cancelamento');

        if (!empty($pessoaDados)) {
            sendCancellationEmail($pessoaDados['email'], $pessoaDados['nome'], $total_ressarcir > 0);
        }

        respond(['ok' => true]);
    }

    if ($action === 'reativar') {
        $db->prepare("UPDATE inscricoes SET status = 'aguardando_pagamento', atualizado_em = datetime('now') WHERE id = ?")->execute([$id]);
        _logObs($db, $id, 'Inscrição reativada pelo admin', 'status_change');
        respond(['ok' => true]);
    }

    if ($action === 'marcar_reembolsado') {
        $pagamento_id = (int)($body['pagamento_id'] ?? 0);
        if (!$pagamento_id) respondError('pagamento_id obrigatório');

        $stmt = $db->prepare("SELECT id, tipo, valor FROM pagamentos WHERE id = ? AND inscricao_id = ? AND status = 'pago' AND reembolsado = 0");
        $stmt->execute([$pagamento_id, $id]);
        $pg = $stmt->fetch();
        if (!$pg) respondError('Pagamento não encontrado ou já reembolsado', 404);

        $db->prepare("UPDATE pagamentos SET reembolsado = 1, atualizado_em = datetime('now') WHERE id = ?")
           ->execute([$pagamento_id]);

        $labels = ['inscricao' => 'inscrição', 'alimentacao' => 'alimentação', 'alojamento' => 'alojamento', 'alojamento_extra' => 'alojamento extra'];
        $label  = $labels[$pg['tipo']] ?? $pg['tipo'];
        $val    = 'R$ ' . number_format((float)$pg['valor'], 2, ',', '.');
        _logObs($db, $id, "Reembolso de {$label} ({$val}) marcado como realizado pelo admin", 'reembolso');
        respond(['ok' => true]);
    }

    if ($action === 'add_observacao') {
        $texto = trim($body['texto'] ?? '');
        if (!$texto) respondError('Texto obrigatório');
        _logObs($db, $id, $texto, 'manual');
        respond(['ok' => true]);
    }

    respondError('Ação desconhecida');
}

respondError('Método não permitido', 405);

function _logObs(PDO $db, int $inscricaoId, string $texto, string $tipo): void {
    $db->prepare("INSERT INTO observacoes (inscricao_id, texto, tipo) VALUES (?, ?, ?)")
       ->execute([$inscricaoId, $texto, $tipo]);
}
