<?php
/** Sugestão de pareamento suíço (side-effect free) + confirmação (persiste). */
require_once __DIR__ . '/../middleware.php';
require_once __DIR__ . '/../../torneio/lib.php';
require_once __DIR__ . '/../../torneio/swiss.php';
adminGuard();

$db = getDb();
$method = $_SERVER['REQUEST_METHOD'];
$usuario = $_SESSION['admin_user'] ?? 'admin';

function validarFormatoSwissAdmin(PDO $db, int $torneioId): void {
    $t = getTorneio($db, $torneioId);
    if (!$t) respondError('Torneio não encontrado', 404);
    if (formatoPrimeiraFase($t) !== 'swiss') respondError('Este torneio usa todos contra todos; pareamento suíço não está disponível.', 400);
}

if ($method === 'GET') {
    $torneioId = (int)($_GET['torneio_id'] ?? 0);
    $rodada = (int)($_GET['rodada'] ?? 0);
    if (!$torneioId || !$rodada) respondError('torneio_id e rodada são obrigatórios');
    validarFormatoSwissAdmin($db, $torneioId);

    $opts = [];
    if (!empty($_GET['modo'])) $opts['modo'] = $_GET['modo'];
    if (!empty($_GET['seed_prng'])) $opts['seed_prng'] = $_GET['seed_prng'];
    if (!empty($_GET['bye_time_id'])) $opts['bye_time_id'] = (int)$_GET['bye_time_id'];

    try {
        respond(sugerirPareamentoSwiss($db, $torneioId, $rodada, $opts));
    } catch (\Throwable $e) {
        respondError($e->getMessage(), 400);
    }
}

if ($method === 'POST') {
    $body = getBody();
    $torneioId = (int)($body['torneio_id'] ?? 0);
    $rodada = (int)($body['rodada'] ?? 0);
    $bye = $body['bye'] ?? null;
    $pares = $body['pares'] ?? null;
    if (!$torneioId || !$rodada || !$bye || !$pares) respondError('torneio_id, rodada, bye e pares são obrigatórios');
    validarFormatoSwissAdmin($db, $torneioId);

    if (!getTorneio($db, $torneioId)) respondError('Torneio não encontrado', 404);

    // Validação de segurança: nunca confia cegamente no pareamento editado pelo admin —
    // barra duplicidade de time e o bye aparecendo também pareado.
    $vistos = [];
    foreach ($pares as $par) {
        foreach ([$par['time_a_id'], $par['time_b_id']] as $tid) {
            if (in_array($tid, $vistos, true)) respondError("Time $tid aparece mais de uma vez no pareamento.");
            if ($tid === $bye['time_id']) respondError('O time do bye não pode também estar pareado.');
            $vistos[] = $tid;
        }
    }

    try {
        $r = confirmarRodadaSwiss($db, $torneioId, $rodada, $bye, $pares, $usuario);
        respond(['ok' => true] + $r);
    } catch (\Throwable $e) {
        respondError($e->getMessage(), 400);
    }
}

respondError('Método não permitido', 405);
