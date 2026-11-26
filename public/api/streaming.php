<?php
/**
 * Servidor de Sincronização de Streaming (Placar, Mesa e Overlays).
 *
 * Fornece sincronização de baixa latência compatível com AWS / Apache / Nginx / PHP:
 * - Leitura e gravação atômica do estado ao vivo (placar, relógio, lances)
 * - Concorrência otimista com controle de revisão (rev)
 * - Cabeçalho X-Server-Time para sincronização precisa de relógio
 * - Presença de dispositivos conectados (árbitro, overlays, observadores)
 */

require_once __DIR__ . '/db.php';

// Configura CORS e cabeçalhos para o OBS e dispositivos na rede
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Server-Time, Cache-Control, X-Session-Token');

$nowMs = round(microtime(true) * 1000);
header('X-Server-Time: ' . $nowMs);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$dataDir = __DIR__ . '/data/streaming';
if (!is_dir($dataDir)) {
    @mkdir($dataDir, 0755, true);
}

// Suporta tanto query parameter `action` quanto `PATH_INFO` (ex.: /api/streaming.php/state ou ?action=state)
$action = $_GET['action'] ?? '';
if (!$action && !empty($_SERVER['PATH_INFO'])) {
    $action = trim($_SERVER['PATH_INFO'], '/');
}
if (!$action) {
    $action = 'state';
}

$method = $_SERVER['REQUEST_METHOD'];

// ── PING ──
if ($action === 'ping') {
    respond(['ok' => true, 'time' => $nowMs]);
}

// ── HELLO (Presença de dispositivos) ──
if ($action === 'hello') {
    $presenceFile = $dataDir . '/presence.json';
    $presence = [];
    if (file_exists($presenceFile)) {
        $raw = @file_get_contents($presenceFile);
        $decoded = json_decode($raw ?: '', true);
        if (is_array($decoded)) $presence = $decoded;
    }

    if ($method === 'POST') {
        $body = getBody();
        if (!empty($body['id'])) {
            $id = (string)$body['id'];
            $presence[$id] = [
                'id'   => $id,
                'name' => (string)($body['name'] ?? ''),
                'role' => (string)($body['role'] ?? ''),
                'seen' => $nowMs,
            ];
        }
    }

    // Filtra dispositivos ativos nos últimos 7 segundos
    $alive = [];
    foreach ($presence as $k => $dev) {
        if ($nowMs - ($dev['seen'] ?? 0) < 7000) {
            $alive[$k] = $dev;
        }
    }

    @file_put_contents($presenceFile, json_encode($alive, JSON_UNESCAPED_UNICODE));
    respond(array_values($alive));
}

// ── STATE (Estado completo da mesa e overlay) ──
if ($action === 'state') {
    $stateFile = $dataDir . '/state.json';

    if ($method === 'GET') {
        if (!file_exists($stateFile)) {
            respond(null);
        }
        $raw = @file_get_contents($stateFile);
        $data = json_decode($raw ?: '', true);
        respond($data);
    }

    if ($method === 'POST') {
        $rawInput = file_get_contents('php://input');
        $obj = json_decode($rawInput ?: '', true);
        if (!is_array($obj)) {
            respondError('JSON inválido', 400);
        }

        // Concorrência otimista por revisão (rev)
        $curRev = null;
        if (file_exists($stateFile)) {
            $curRaw = @file_get_contents($stateFile);
            $curObj = json_decode($curRaw ?: '', true);
            if (is_array($curObj) && isset($curObj['rev'])) {
                $curRev = (int)$curObj['rev'];
            }
        }

        if ($curRev !== null && isset($obj['rev'])) {
            $reqRev = (int)$obj['rev'];
            if ($reqRev !== $curRev + 1 && $reqRev <= $curRev) {
                // Conflito de versão (alguém enviou uma revisão mais recente antes)
                http_response_code(409);
                echo $curRaw;
                exit;
            }
        }

        // Gravação atômica (.tmp seguido de rename)
        $tmp = $stateFile . '.tmp.' . uniqid('', true);
        if (@file_put_contents($tmp, $rawInput) !== false) {
            @rename($tmp, $stateFile);
        }

        respond(['ok' => true]);
    }

    respondError('Método não permitido', 405);
}

// ── TEAMS (Catálogo de times do streaming) ──
if ($action === 'teams') {
    $teamsFile = $dataDir . '/teams.json';

    if ($method === 'GET') {
        if (!file_exists($teamsFile)) {
            respond([]);
        }
        $raw = @file_get_contents($teamsFile);
        $data = json_decode($raw ?: '', true);
        respond(is_array($data) ? $data : []);
    }

    if ($method === 'POST') {
        $rawInput = file_get_contents('php://input');
        $tmp = $teamsFile . '.tmp.' . uniqid('', true);
        if (@file_put_contents($tmp, $rawInput) !== false) {
            @rename($tmp, $teamsFile);
        }
        respond(['ok' => true]);
    }

    respondError('Método não permitido', 405);
}

respondError('Ação desconhecida', 404);
