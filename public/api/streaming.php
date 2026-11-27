<?php
/**
 * Servidor de Sincronização de Streaming (Placar, Mesa e Overlays) — produção.
 *
 * Persiste no SQLite do evento (tabelas streaming_kv e streaming_presenca, ver
 * db.php). A lógica fica em streaming/lib.php; aqui só fica o HTTP.
 *
 * Contrato (o mesmo da versão antiga em arquivos):
 * - Ações por ?action= ou PATH_INFO (/api/streaming.php/state): ping, hello,
 *   state, teams e diag. Sem ação = state.
 * - state GET devolve o JSON cru gravado (ou null); POST aplica a concorrência
 *   otimista por `rev` e responde 409 com o estado atual em caso de conflito.
 * - Cabeçalho X-Server-Time em todas as respostas (sincronia de relógio).
 * - Qualquer falha de banco responde 500 com {"error": "..."}. Nunca {"ok":true}
 *   sem ter gravado.
 *
 * O servidor Python (scripts/servidor_streaming.py) continua existindo só para
 * o modo LAN/offline.
 */

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/streaming/lib.php';

// CORS para o OBS/Streamlabs e aparelhos na rede
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Server-Time, Cache-Control, X-Session-Token');
header('Access-Control-Expose-Headers: X-Server-Time');
header('X-Server-Time: ' . streamingNowMs());

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$action = $_GET['action'] ?? '';
if (!$action && !empty($_SERVER['PATH_INFO'])) {
    $action = trim($_SERVER['PATH_INFO'], '/');
}
if (!$action) {
    $action = 'state';
}
$method = $_SERVER['REQUEST_METHOD'];

/** Responde um JSON já serializado, sem decodificar/recodificar. */
function streamingResponderCru(string $raw, int $status = 200): void {
    http_response_code($status);
    echo $raw;
    exit;
}

if ($action === 'ping') {
    respond(['ok' => true, 'time' => streamingNowMs()]);
}

try {
    $db = getDb(); // falhas de abertura já respondem 500 com a mensagem
    // Vários aparelhos fazem polling a cada 1 s: quem encontrar o banco travado
    // espera até 3 s pela vez em vez de falhar com "database is locked".
    $db->exec('PRAGMA busy_timeout = 3000');
    streamingImportarLegado($db, __DIR__ . '/data/streaming');

    switch ($action) {
        case 'hello':
            $dispositivo = $method === 'POST' ? getBody() : null;
            respond(streamingHello($db, $dispositivo));

        case 'state':
            if ($method === 'GET') {
                streamingResponderCru(streamingLer($db, 'state') ?? 'null');
            }
            if ($method === 'POST') {
                $r = streamingSalvarState($db, (string) file_get_contents('php://input'));
                streamingResponderCru($r['raw'], $r['status']);
            }
            respondError('Método não permitido', 405);

        case 'teams':
            if ($method === 'GET') {
                streamingResponderCru(streamingLer($db, 'teams') ?? '[]');
            }
            if ($method === 'POST') {
                $r = streamingSalvarTeams($db, (string) file_get_contents('php://input'));
                streamingResponderCru($r['raw'], $r['status']);
            }
            respondError('Método não permitido', 405);

        case 'diag':
            if ($method !== 'GET') respondError('Método não permitido', 405);
            respond(streamingDiag($db));
    }
} catch (\Throwable $e) {
    error_log('[streaming] ' . $action . ': ' . $e->getMessage());
    respondError('Falha no servidor de streaming (' . $action . '): ' . $e->getMessage(), 500);
}

respondError('Ação desconhecida', 404);
