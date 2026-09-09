<?php
/**
 * Log de auditoria + undo. Só oferece "desfazer" pra ações que sabemos reverter
 * com segurança (gol, falta, resultado de partida) — o resto (ex: rodada
 * confirmada) tem que ser corrigido manualmente e fica registrado no log, pra
 * nunca corromper silenciosamente uma fase já propagada (brief seção 11).
 */
require_once __DIR__ . '/../middleware.php';
require_once __DIR__ . '/../../torneio/lib.php';
require_once __DIR__ . '/../../torneio/sumula.php';
require_once __DIR__ . '/../../torneio/bracket.php';
adminGuard();

$db = getDb();
$method = $_SERVER['REQUEST_METHOD'];
$usuario = $_SESSION['admin_user'] ?? 'admin';

const ACOES_DESFAZIVEIS = ['registrar_gol', 'registrar_falta', 'atualizar_partida'];

if ($method === 'GET') {
    $torneioId = (int)($_GET['torneio_id'] ?? 0);
    if (!$torneioId) respondError('torneio_id é obrigatório');
    $limit = min(300, max(20, (int)($_GET['limit'] ?? 100)));

    $stmt = $db->prepare("SELECT * FROM torneio_audit_log WHERE torneio_id = ? ORDER BY id DESC LIMIT ?");
    $stmt->bindValue(1, $torneioId, PDO::PARAM_INT);
    $stmt->bindValue(2, $limit, PDO::PARAM_INT);
    $stmt->execute();
    $log = $stmt->fetchAll();
    foreach ($log as &$row) {
        $row['pode_desfazer'] = !$row['revertido'] && in_array($row['acao'], ACOES_DESFAZIVEIS, true);
        $row['estado_anterior'] = $row['estado_anterior'] ? json_decode($row['estado_anterior'], true) : null;
        $row['estado_novo'] = $row['estado_novo'] ? json_decode($row['estado_novo'], true) : null;
    }
    unset($row);

    $stmtSnap = $db->prepare("SELECT id, fase_id, tipo, criado_por, criado_em FROM torneio_snapshots WHERE torneio_id = ? ORDER BY id DESC LIMIT ?");
    $stmtSnap->bindValue(1, $torneioId, PDO::PARAM_INT);
    $stmtSnap->bindValue(2, $limit, PDO::PARAM_INT);
    $stmtSnap->execute();

    respond(['log' => $log, 'snapshots' => $stmtSnap->fetchAll()]);
}

if ($method === 'POST') {
    $body = getBody();
    $torneioId = (int)($body['torneio_id'] ?? 0);
    $auditId = (int)($body['audit_id'] ?? 0);
    if (!$torneioId || !$auditId) respondError('torneio_id e audit_id são obrigatórios');

    if (!getTorneio($db, $torneioId)) respondError('Torneio não encontrado', 404);

    $stmt = $db->prepare("SELECT * FROM torneio_audit_log WHERE id = ? AND torneio_id = ?");
    $stmt->execute([$auditId, $torneioId]);
    $entrada = $stmt->fetch();
    if (!$entrada) respondError('Entrada de auditoria não encontrada', 404);
    if ($entrada['revertido']) respondError('Esta ação já foi desfeita.');
    if (!in_array($entrada['acao'], ACOES_DESFAZIVEIS, true)) {
        respondError('Esta ação não pode ser desfeita automaticamente — corrija manualmente (o registro original continua no histórico).');
    }

    try {
        torneioTx($db, function (PDO $db) use ($entrada, $torneioId, $usuario) {
            if ($entrada['acao'] === 'registrar_gol') {
                removerEvento($db, $torneioId, 'gol', (int)$entrada['entidade_id'], $usuario);
            } elseif ($entrada['acao'] === 'registrar_falta') {
                removerEvento($db, $torneioId, 'falta', (int)$entrada['entidade_id'], $usuario);
            } elseif ($entrada['acao'] === 'atualizar_partida') {
                $anterior = json_decode($entrada['estado_anterior'], true);
                $deps = getDependentesResolvidos($db, $torneioId, jogoCodigoPorId($db, $torneioId, (int)$entrada['entidade_id']));
                atualizarPartida($db, $torneioId, (int)$entrada['entidade_id'], [
                    'status' => $anterior['status'] ?? 'agendado',
                    'placar_a' => $anterior['placar_a'] ?? null,
                    'placar_b' => $anterior['placar_b'] ?? null,
                    'motivo' => 'Desfeito a partir do log de auditoria #' . $entrada['id'] . (count($deps) ? ' — ATENÇÃO: jogos dependentes já haviam sido resolvidos e podem precisar de revisão manual: ' . implode(', ', array_column($deps, 'codigo')) : ''),
                ], $usuario);
            }

            $db->prepare("UPDATE torneio_audit_log SET revertido = 1, revertido_em = datetime('now'), revertido_por = ? WHERE id = ?")
               ->execute([$usuario, $entrada['id']]);
        });
        respond(['ok' => true]);
    } catch (\Throwable $e) {
        respondError($e->getMessage(), 400);
    }
}

respondError('Método não permitido', 405);

function jogoCodigoPorId(PDO $db, int $torneioId, int $jogoId): string {
    $stmt = $db->prepare("SELECT codigo FROM torneio_jogos WHERE id = ? AND torneio_id = ?");
    $stmt->execute([$jogoId, $torneioId]);
    return (string)$stmt->fetchColumn();
}
