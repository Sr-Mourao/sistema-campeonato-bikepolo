<?php
/**
 * Sincronização do streaming (mesa ↔ overlays) persistida no SQLite.
 *
 * Toda a lógica fica aqui, sem efeitos colaterais de HTTP, para ser testada
 * em tests/streaming/ contra o banco em memória. O endpoint
 * public/api/streaming.php só traduz cada resultado em resposta HTTP.
 *
 * Contrato que importa preservar:
 * - O estado é guardado e devolvido como JSON CRU (string). Decodificar e
 *   recodificar trocaria objetos vazios {} por listas [] e quebraria o estado.
 * - Nenhuma função "engole" erro: falha de gravação vira exceção, e o endpoint
 *   responde 500. Nunca responder ok sem ter gravado.
 */

const STREAMING_PRESENCA_VIVO_MS = 7000;    // aparece na lista de conectados
const STREAMING_PRESENCA_EXPIRA_MS = 60000; // apagado do banco

function streamingNowMs(): int {
    return (int) round(microtime(true) * 1000);
}

/** Executa $fn dentro de BEGIN IMMEDIATE (trava de escrita já na abertura). */
function streamingTransacao(PDO $db, callable $fn): mixed {
    $db->exec('BEGIN IMMEDIATE');
    try {
        $out = $fn();
        $db->exec('COMMIT');
        return $out;
    } catch (\Throwable $e) {
        try { $db->exec('ROLLBACK'); } catch (\Throwable $ignored) {}
        throw $e;
    }
}

/** JSON cru guardado em `chave`, ou null se não houver linha. */
function streamingLer(PDO $db, string $chave): ?string {
    $stmt = $db->prepare('SELECT dados FROM streaming_kv WHERE chave = ?');
    $stmt->execute([$chave]);
    $dados = $stmt->fetchColumn();
    return $dados === false ? null : (string) $dados;
}

function streamingGravar(PDO $db, string $chave, int $rev, string $dados, int $agoraMs): void {
    $db->prepare('
        INSERT INTO streaming_kv (chave, rev, dados, atualizado_ms) VALUES (?, ?, ?, ?)
        ON CONFLICT(chave) DO UPDATE SET rev = excluded.rev, dados = excluded.dados, atualizado_ms = excluded.atualizado_ms
    ')->execute([$chave, $rev, $dados, $agoraMs]);
}

/**
 * Grava o estado da mesa.
 * Retorna ['status' => 200|400|409, 'raw' => string JSON da resposta].
 * Em 409 o corpo é o estado atual do servidor (o cliente recarrega dele).
 * Erros de banco sobem como exceção.
 */
function streamingSalvarState(PDO $db, string $raw, ?int $agoraMs = null): array {
    // Decodifica como objeto: em modo associativo, {} viraria [] e seria confundido com lista
    $obj = json_decode($raw);
    if (!is_object($obj)) {
        return ['status' => 400, 'raw' => json_encode(['error' => 'JSON inválido: o estado precisa ser um objeto'], JSON_UNESCAPED_UNICODE)];
    }
    $agoraMs ??= streamingNowMs();
    $reqRev = isset($obj->rev) ? (int) $obj->rev : null;

    return streamingTransacao($db, function () use ($db, $raw, $reqRev, $agoraMs) {
        $stmt = $db->prepare("SELECT rev, dados FROM streaming_kv WHERE chave = 'state'");
        $stmt->execute();
        $atual = $stmt->fetch();

        // Mesma regra de conflito da versão em arquivo: só aceita rev maior que o atual
        if ($atual && $reqRev !== null) {
            $curRev = (int) $atual['rev'];
            if ($reqRev !== $curRev + 1 && $reqRev <= $curRev) {
                return ['status' => 409, 'raw' => (string) $atual['dados']];
            }
        }

        streamingGravar($db, 'state', $reqRev ?? 0, $raw, $agoraMs);
        return ['status' => 200, 'raw' => json_encode(['ok' => true])];
    });
}

/** Grava o catálogo de times (lista JSON). Sem controle de revisão, como antes. */
function streamingSalvarTeams(PDO $db, string $raw, ?int $agoraMs = null): array {
    $lista = json_decode($raw);
    if (!is_array($lista)) {
        return ['status' => 400, 'raw' => json_encode(['error' => 'JSON inválido: os times precisam ser uma lista'], JSON_UNESCAPED_UNICODE)];
    }
    $agoraMs ??= streamingNowMs();
    streamingTransacao($db, fn() => streamingGravar($db, 'teams', 0, $raw, $agoraMs));
    return ['status' => 200, 'raw' => json_encode(['ok' => true])];
}

/**
 * Registra o aparelho (se vier `id`), apaga os sumidos há mais de 60 s e
 * devolve os vistos nos últimos 7 s.
 */
function streamingHello(PDO $db, ?array $dispositivo, ?int $agoraMs = null): array {
    $agoraMs ??= streamingNowMs();
    streamingTransacao($db, function () use ($db, $dispositivo, $agoraMs) {
        if ($dispositivo && !empty($dispositivo['id'])) {
            $db->prepare('
                INSERT INTO streaming_presenca (id, name, role, seen_ms) VALUES (?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET name = excluded.name, role = excluded.role, seen_ms = excluded.seen_ms
            ')->execute([
                (string) $dispositivo['id'],
                (string) ($dispositivo['name'] ?? ''),
                (string) ($dispositivo['role'] ?? ''),
                $agoraMs,
            ]);
        }
        $db->prepare('DELETE FROM streaming_presenca WHERE seen_ms < ?')
           ->execute([$agoraMs - STREAMING_PRESENCA_EXPIRA_MS]);
    });

    $stmt = $db->prepare('SELECT id, name, role, seen_ms FROM streaming_presenca WHERE seen_ms > ? ORDER BY id');
    $stmt->execute([$agoraMs - STREAMING_PRESENCA_VIVO_MS]);
    return array_map(fn($r) => [
        'id' => $r['id'],
        'name' => $r['name'],
        'role' => $r['role'],
        'seen' => (int) $r['seen_ms'],
    ], $stmt->fetchAll());
}

/**
 * Importação única dos arquivos da versão antiga (data/streaming/*.json).
 * Só roda com a tabela vazia e só LÊ os arquivos (nunca apaga nem reescreve).
 */
function streamingImportarLegado(PDO $db, string $dirLegado, ?int $agoraMs = null): int {
    $vazia = (int) $db->query('SELECT COUNT(*) FROM streaming_kv')->fetchColumn() === 0;
    if (!$vazia) return 0;
    $agoraMs ??= streamingNowMs();

    $importados = 0;
    foreach (['state' => 'state.json', 'teams' => 'teams.json'] as $chave => $arquivo) {
        $caminho = rtrim($dirLegado, '/\\') . '/' . $arquivo;
        if (!is_file($caminho) || !is_readable($caminho)) continue;
        $raw = file_get_contents($caminho);
        if ($raw === false) continue;
        $obj = json_decode($raw);
        if ($chave === 'state' ? !is_object($obj) : !is_array($obj)) continue;
        $rev = ($chave === 'state' && isset($obj->rev)) ? (int) $obj->rev : 0;
        streamingTransacao($db, function () use ($db, $chave, $rev, $raw, $agoraMs) {
            // INSERT simples: se outra requisição importou antes, não sobrescreve
            $db->prepare('INSERT OR IGNORE INTO streaming_kv (chave, rev, dados, atualizado_ms) VALUES (?, ?, ?, ?)')
               ->execute([$chave, $rev, $raw, $agoraMs]);
        });
        $importados++;
    }
    return $importados;
}

/** Diagnóstico para o admin. Sem caminhos nem segredos. */
function streamingDiag(PDO $db, ?int $agoraMs = null): array {
    $agoraMs ??= streamingNowMs();
    $out = ['ok' => true, 'agora_ms' => $agoraMs, 'banco' => ['leitura' => false, 'gravacao' => false, 'erro' => null]];

    try {
        $stmt = $db->query("SELECT chave, rev, atualizado_ms FROM streaming_kv WHERE chave IN ('state', 'teams')");
        $linhas = [];
        foreach ($stmt->fetchAll() as $r) $linhas[$r['chave']] = $r;
        $out['banco']['leitura'] = true;

        $resumo = fn($r) => $r ? [
            'rev' => (int) $r['rev'],
            'atualizado_ms' => (int) $r['atualizado_ms'],
            'idade_s' => round(($agoraMs - (int) $r['atualizado_ms']) / 1000, 1),
        ] : null;
        $out['state'] = $resumo($linhas['state'] ?? null);
        $out['teams'] = $resumo($linhas['teams'] ?? null);

        $stmt = $db->prepare('SELECT COUNT(*) FROM streaming_presenca WHERE seen_ms > ?');
        $stmt->execute([$agoraMs - STREAMING_PRESENCA_VIVO_MS]);
        $out['dispositivos_vivos'] = (int) $stmt->fetchColumn();

        // Prova de escrita real: grava dentro de uma transação e desfaz
        $db->exec('BEGIN IMMEDIATE');
        try {
            $db->prepare("INSERT OR REPLACE INTO streaming_kv (chave, rev, dados, atualizado_ms) VALUES ('_diag', 0, '{}', ?)")
               ->execute([$agoraMs]);
            $out['banco']['gravacao'] = true;
        } finally {
            $db->exec('ROLLBACK');
        }
    } catch (\Throwable $e) {
        $out['ok'] = false;
        $out['banco']['erro'] = $e->getMessage();
    }
    return $out;
}
