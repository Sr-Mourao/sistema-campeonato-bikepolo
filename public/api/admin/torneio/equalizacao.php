<?php
/** Sugestão + confirmação da fase de Equalização. */
require_once __DIR__ . '/../middleware.php';
require_once __DIR__ . '/../../torneio/lib.php';
require_once __DIR__ . '/../../torneio/bracket.php';
adminGuard();

$db = getDb();
$method = $_SERVER['REQUEST_METHOD'];
$usuario = $_SESSION['admin_user'] ?? 'admin';

if ($method === 'GET') {
    $torneioId = (int)($_GET['torneio_id'] ?? 0);
    if (!$torneioId) respondError('torneio_id é obrigatório');
    try {
        respond(sugerirEqualizacao($db, $torneioId));
    } catch (\Throwable $e) {
        respondError($e->getMessage(), 400);
    }
}

if ($method === 'POST') {
    $body = getBody();
    $torneioId = (int)($body['torneio_id'] ?? 0);
    $pares = $body['pares'] ?? null;
    if (!$torneioId || !$pares) respondError('torneio_id e pares são obrigatórios');

    if (!getTorneio($db, $torneioId)) respondError('Torneio não encontrado', 404);

    try {
        $r = confirmarEqualizacao($db, $torneioId, $pares, $usuario);
        respond(['ok' => true] + $r);
    } catch (\Throwable $e) {
        respondError($e->getMessage(), 400);
    }
}

respondError('Método não permitido', 405);
