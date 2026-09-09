<?php
/**
 * Simulação — opera sobre partidas reais do torneio normal, usando os mesmos
 * eventos/endpoints da súmula manual (ver public/api/torneio/simulator.php).
 * Não existe mais restrição de sandbox: qualquer partida real pode ser simulada,
 * exatamente como um operador faria na súmula.
 */
require_once __DIR__ . '/../middleware.php';
require_once __DIR__ . '/../../torneio/lib.php';
require_once __DIR__ . '/../../torneio/simulator.php';
adminGuard();

$db = getDb();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') respondError('Método não permitido', 405);

$body = getBody();
$action = $body['action'] ?? '';
$torneioId = (int)($body['torneio_id'] ?? 0);
$usuario = $_SESSION['admin_user'] ?? 'admin';

$torneio = getTorneio($db, $torneioId);
if (!$torneio) respondError('Torneio não encontrado', 404);

try {
    if ($action === 'partida') {
        $jogoId = (int)($body['jogo_id'] ?? 0);
        if (!$jogoId) respondError('jogo_id é obrigatório');
        $r = simularPartida($db, $torneioId, $jogoId, $usuario);
        respond(['ok' => true] + $r);
    }
    if ($action === 'fase') {
        $faseId = (int)($body['fase_id'] ?? 0);
        if (!$faseId) respondError('fase_id é obrigatório');
        $log = simularPartidasPendentes($db, $torneioId, $faseId, $usuario);
        respond(['ok' => true, 'log' => $log]);
    }
} catch (\Throwable $e) {
    respondError($e->getMessage(), 400);
}

respondError('Ação desconhecida');
