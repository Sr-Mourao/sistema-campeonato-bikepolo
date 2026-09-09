<?php
require_once __DIR__ . '/../middleware.php';
require_once __DIR__ . '/../../torneio/round_robin.php';
adminGuard();
$db = getDb();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') respondError('Método não permitido', 405);
$body = getBody();
$torneioId = (int)($body['torneio_id'] ?? 0);
if (!$torneioId || !getTorneio($db, $torneioId)) respondError('Torneio não encontrado', 404);
try {
    $r = gerarPrimeiraFaseRoundRobin($db, $torneioId, $_SESSION['admin_user'] ?? 'admin');
    respond(['ok' => true] + $r);
} catch (Throwable $e) { respondError($e->getMessage(), 400); }
