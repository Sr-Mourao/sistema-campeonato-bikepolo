<?php
/** Classificação, artilharia, fair play, faltas individuais — admin (mesmo motor do público). */
require_once __DIR__ . '/../middleware.php';
require_once __DIR__ . '/../../torneio/lib.php';
adminGuard();

$db = getDb();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') respondError('Método não permitido', 405);

$torneioId = (int)($_GET['torneio_id'] ?? 0);
if (!$torneioId) respondError('torneio_id é obrigatório');
$escopo = ($_GET['escopo'] ?? 'torneio') === 'classificatoria' ? 'classificatoria' : 'torneio';

try {
    respond([
        'classificacao'      => calcularClassificacao($db, $torneioId),
        'artilharia'         => calcularArtilharia($db, $torneioId, $escopo),
        'fair_play'          => calcularFairPlayTimes($db, $torneioId, $escopo),
        'faltas_individuais' => calcularFaltasIndividuais($db, $torneioId, $escopo),
        'criterios'          => getCriterios($db, $torneioId),
    ]);
} catch (\Throwable $e) {
    respondError($e->getMessage(), 400);
}
