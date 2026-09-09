<?php
require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/../midia/lib.php';
require_once __DIR__ . '/pessoas_lib.php';
adminGuard();

$db     = getDb();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $db->query("
        SELECT
            t.id, t.nome, t.categoria, t.codigo, t.logo_path, t.logo_origem, t.logo_atualizado_em, t.criado_em,
            COUNT(DISTINCT i.id) AS num_membros,
            SUM(CASE WHEN p.nacionalidade != 'brasileire' THEN 1 ELSE 0 END) AS num_estrangeiros,
            SUM(CASE WHEN i.latino = 1 THEN 1 ELSE 0 END) AS num_latinos
        FROM times t
        LEFT JOIN membros_time mt ON mt.time_id = t.id
        LEFT JOIN inscricoes i ON i.id = mt.inscricao_id AND i.status != 'cancelado'
        LEFT JOIN pessoas p ON p.id = i.pessoa_id
        GROUP BY t.id
        ORDER BY t.categoria, t.nome
    ");
    $times = $stmt->fetchAll();

    foreach ($times as &$time) {
        $stmt2 = $db->prepare("
            SELECT p.id AS pessoa_id, p.nome, p.nacionalidade, p.foto_path, p.foto_origem, p.foto_atualizado_em,
                   i.latino, i.status, i.id AS inscricao_id,
                   (SELECT GROUP_CONCAT(ic.categoria, ', ')
                    FROM inscricao_categorias ic WHERE ic.inscricao_id = i.id) AS categorias
            FROM membros_time mt
            JOIN inscricoes i ON i.id = mt.inscricao_id
            JOIN pessoas p ON p.id = i.pessoa_id
            WHERE mt.time_id = ? AND i.status != 'cancelado'
        ");
        $stmt2->execute([$time['id']]);
        $membros = $stmt2->fetchAll();
        foreach ($membros as &$m) {
            $m['foto_path'] = urlComCacheBust($m['foto_path'], $m['foto_atualizado_em']);
            unset($m['foto_atualizado_em']);
        }
        unset($m);
        $time['membros'] = $membros;
        $time['logo_path'] = urlComCacheBust($time['logo_path'], $time['logo_atualizado_em']);
        unset($time['logo_atualizado_em']);

        $alertas = [];
        $limite  = ($time['categoria'] === 'misto') ? 4 : 3;
        $minimo  = 3;

        if ((int)$time['num_membros'] < $minimo) {
            $alertas[] = ['tipo' => 'warning', 'msg' => 'Time incompleto (' . $time['num_membros'] . '/' . $minimo . ' mínimo)'];
        }
        if ((int)$time['num_membros'] > $limite) {
            $alertas[] = ['tipo' => 'error', 'msg' => 'Time com mais de ' . $limite . ' membros'];
        }
        if ((int)$time['num_estrangeiros'] > 1) {
            $alertas[] = ['tipo' => 'warning', 'msg' => 'Mais de 1 estrangeire (' . $time['num_estrangeiros'] . ')'];
        }

        $time['alertas']          = $alertas;
        $time['num_membros']      = (int)$time['num_membros'];
        $time['num_estrangeiros'] = (int)$time['num_estrangeiros'];
        $time['num_latinos']      = (int)$time['num_latinos'];
    }
    unset($time);

    // Atletas inscritos sem time, por categoria
    $sem_time = [];
    foreach (['misto', 'mtnb'] as $cat) {
        $s = $db->prepare("
            SELECT i.id AS inscricao_id, p.nome, p.email, i.status
            FROM inscricoes i
            JOIN pessoas p ON p.id = i.pessoa_id
            JOIN inscricao_categorias ic ON ic.inscricao_id = i.id AND ic.categoria = ?
            WHERE i.status != 'cancelado'
              AND NOT EXISTS (
                  SELECT 1 FROM membros_time mt
                  JOIN times t ON t.id = mt.time_id
                  WHERE mt.inscricao_id = i.id AND t.categoria = ?
              )
            ORDER BY p.nome
        ");
        $s->execute([$cat, $cat]);
        $sem_time[$cat] = $s->fetchAll();
    }

    respond(['times' => $times, 'sem_time' => $sem_time]);
}

if ($method === 'POST') {
    $body   = getBody();
    $action = $body['action'] ?? '';

    if ($action === 'renomear') {
        $time_id = (int)($body['time_id'] ?? 0);
        $nome    = trim((string)($body['nome'] ?? ''));

        if (!$time_id) respondError('time_id obrigatório');
        if ($nome === '') respondError('Nome não pode ficar vazio');
        if (mb_strlen($nome) > 80) respondError('Nome muito longo (máx. 80 caracteres)');

        $stmt = $db->prepare("SELECT id FROM times WHERE id = ?");
        $stmt->execute([$time_id]);
        if (!$stmt->fetch()) respondError('Time não encontrado', 404);

        $db->prepare("UPDATE times SET nome = ? WHERE id = ?")->execute([$nome, $time_id]);
        respond(['ok' => true, 'nome' => $nome]);
    }

    if ($action === 'renomear_atleta') {
        $pessoaId = (int)($body['pessoa_id'] ?? 0);
        try {
            $nome = renomearPessoa($db, $pessoaId, (string)($body['nome'] ?? ''));
        } catch (InvalidArgumentException $e) {
            respondError($e->getMessage(), 400);
        } catch (RuntimeException $e) {
            respondError($e->getMessage(), 404);
        }
        respond(['ok' => true, 'pessoa_id' => $pessoaId, 'nome' => $nome]);
    }

    if ($action === 'mover') {
        $inscricao_id = (int)($body['inscricao_id'] ?? 0);
        $de_time_id   = ($body['de_time_id']   !== null && $body['de_time_id']   !== '') ? (int)$body['de_time_id']   : null;
        $para_time_id = ($body['para_time_id'] !== null && $body['para_time_id'] !== '') ? (int)$body['para_time_id'] : null;

        if (!$inscricao_id) respondError('inscricao_id obrigatório');
        if ($de_time_id === $para_time_id) respond(['ok' => true]);

        // Remove do time de origem
        if ($de_time_id !== null) {
            $db->prepare("DELETE FROM membros_time WHERE time_id = ? AND inscricao_id = ?")
               ->execute([$de_time_id, $inscricao_id]);
        }

        // Adiciona ao time destino
        if ($para_time_id !== null) {
            $stmt = $db->prepare("SELECT id, categoria FROM times WHERE id = ?");
            $stmt->execute([$para_time_id]);
            $time = $stmt->fetch();
            if (!$time) respondError('Time destino não encontrado', 404);

            $limite = $time['categoria'] === 'misto' ? 4 : 3;
            $stmt = $db->prepare("
                SELECT COUNT(mt.id) AS cnt
                FROM membros_time mt
                JOIN inscricoes i ON i.id = mt.inscricao_id AND i.status != 'cancelado'
                WHERE mt.time_id = ?
            ");
            $stmt->execute([$para_time_id]);
            if ((int)$stmt->fetchColumn() >= $limite) respondError('Time já está completo', 400);

            $db->prepare("INSERT OR IGNORE INTO membros_time (time_id, inscricao_id) VALUES (?, ?)")
               ->execute([$para_time_id, $inscricao_id]);
        }

        respond(['ok' => true]);
    }

    respondError('Ação desconhecida');
}

respondError('Método não permitido', 405);
