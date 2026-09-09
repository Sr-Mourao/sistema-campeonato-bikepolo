<?php
/** Súmula digital: elenco+eventos de uma partida, gol, falta, undo, atualizar placar/status. */
require_once __DIR__ . '/../middleware.php';
require_once __DIR__ . '/../../torneio/lib.php';
require_once __DIR__ . '/../../torneio/sumula.php';
adminGuard();

$db = getDb();
$method = $_SERVER['REQUEST_METHOD'];
$usuario = $_SESSION['admin_user'] ?? 'admin';

if ($method === 'GET') {
    $torneioId = (int)($_GET['torneio_id'] ?? 0);
    $jogoId = (int)($_GET['jogo_id'] ?? 0);
    if (!$torneioId || !$jogoId) respondError('torneio_id e jogo_id são obrigatórios');
    try {
        respond(getElencoPartida($db, $torneioId, $jogoId));
    } catch (\Throwable $e) {
        respondError($e->getMessage(), 400);
    }
}

if ($method === 'POST') {
    $body = getBody();
    $action = $body['action'] ?? '';
    $torneioId = (int)($body['torneio_id'] ?? 0);
    $jogoId = (int)($body['jogo_id'] ?? 0);
    if (!$torneioId) respondError('torneio_id é obrigatório');

    try {
        if ($action === 'gol') {
            $tipo = $body['tipo'] ?? 'normal';
            $membroId = isset($body['membro_id']) && $body['membro_id'] !== null ? (int)$body['membro_id'] : null;
            $r = registrarGol($db, $torneioId, $jogoId, (int)$body['time_id'], $membroId, $tipo, isset($body['minuto']) ? (int)$body['minuto'] : null, $usuario);
            respond(['ok' => true] + $r);
        }
        if ($action === 'falta') {
            if (empty($body['membro_id'])) respondError('Selecione o atleta que cometeu a falta.');
            $r = registrarFalta($db, $torneioId, $jogoId, (int)$body['time_id'], (int)$body['membro_id'], $usuario);
            respond(['ok' => true] + $r);
        }
        if ($action === 'remover_evento') {
            removerEvento($db, $torneioId, $body['tipo'], (int)$body['evento_id'], $usuario);
            respond(['ok' => true]);
        }
        if ($action === 'recalcular_placar') {
            respond(['ok' => true] + recalcularPlacarDeEventos($db, $torneioId, $jogoId));
        }
        if ($action === 'atualizar_partida') {
            $campos = $body['campos'] ?? [];
            $r = atualizarPartida($db, $torneioId, $jogoId, $campos, $usuario);
            respond(['ok' => true] + $r);
        }
    } catch (\Throwable $e) {
        respondError($e->getMessage(), 400);
    }

    respondError('Ação desconhecida');
}

respondError('Método não permitido', 405);
