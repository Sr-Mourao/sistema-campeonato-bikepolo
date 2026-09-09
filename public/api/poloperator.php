<?php
// Proxy server-side pros dados públicos de equipes do Poloperator — a API deles não
// manda Access-Control-Allow-Origin, então um fetch direto do navegador seria bloqueado
// por CORS. Fetch/cache/parsing reais vivem em poloperator/lib.php (reaproveitado
// também pelo importador de mídia, admin/poloperator-import.php).
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/poloperator/lib.php';
corsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') respondError('Método não suportado', 405);

$torneio = $_GET['torneio'] ?? '';

try {
    respond(buscarTorneioPoloperator($torneio));
} catch (\InvalidArgumentException $e) {
    respondError($e->getMessage());
} catch (\RuntimeException $e) {
    respondError($e->getMessage(), 502, $e->getMessage());
}
