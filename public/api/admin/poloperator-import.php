<?php
/**
 * Importador de brasões/fotos do Poloperator pros registros internos (times/pessoas).
 * `GET action=preview` só calcula o matching e devolve o relatório — NUNCA baixa nem
 * grava nada. `POST action=importar` refaz o mesmo matching e baixa+grava só o que está
 * 'associado' (automático + confirmações manuais enviadas no body) — nunca "adivinha".
 */
require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/../midia/lib.php';
require_once __DIR__ . '/poloperator_import_lib.php';
require_once __DIR__ . '/../poloperator/lib.php';
adminGuard();

$db = getDb();

/** 'misto'|'mtnb' (categoria interna) → 'brasileiro'|'mtnb' (chave do Poloperator). */
function categoriaParaTorneioPoloperator(string $categoria): string {
    return $categoria === 'misto' ? 'brasileiro' : 'mtnb';
}

function timesInternosPorCategoria(PDO $db, string $categoria): array {
    $stmt = $db->prepare("SELECT id, nome, poloperator_id, logo_origem, logo_path FROM times WHERE categoria = ? ORDER BY nome");
    $stmt->execute([$categoria]);
    return $stmt->fetchAll();
}

/** Roster elegível de um time (mesmo filtro de sempre: inscrição cancelada nunca aparece). */
function rosterInternoDoTime(PDO $db, int $timeId): array {
    $stmt = $db->prepare("
        SELECT p.id, p.nome, p.poloperator_id, p.foto_origem, p.foto_path
        FROM membros_time mt
        JOIN inscricoes i ON i.id = mt.inscricao_id AND i.status != 'cancelado'
        JOIN pessoas p ON p.id = i.pessoa_id
        WHERE mt.time_id = ?
        ORDER BY p.nome
    ");
    $stmt->execute([$timeId]);
    return $stmt->fetchAll();
}

/**
 * Roda o matching completo (times + atletas por time associado) pra uma categoria.
 * $confirmacoes (opcional): ['times' => [poloperator_id => interno_id], 'atletas' => [poloperator_id => interno_id]]
 * — só usadas pra preencher o que ficou pendente/ambíguo, nunca pra sobrescrever match automático.
 */
function rodarMatching(PDO $db, string $categoria, array $confirmacoes = []): array {
    $torneioPoloperator = categoriaParaTorneioPoloperator($categoria);
    $dados = buscarTorneioPoloperator($torneioPoloperator);

    $timesInternos = timesInternosPorCategoria($db, $categoria);
    $timesInternosPorId = array_column($timesInternos, null, 'id');

    $matchesTimes = casarComInternos($dados['teams'], $timesInternos);
    $matchesTimes = aplicarConfirmacoesManuais($matchesTimes, $confirmacoes['times'] ?? [], $timesInternosPorId);

    $matchesAtletasPorTime = []; // interno_time_id => matches de atletas
    foreach ($matchesTimes as $mt) {
        if ($mt['status'] !== 'associado') continue;
        $timeInternoId = $mt['interno']['id'];
        $roster = rosterInternoDoTime($db, $timeInternoId);
        $rosterPorId = array_column($roster, null, 'id');
        $mAtletas = casarComInternos($mt['externo']['players'] ?? [], $roster, POLOPERATOR_APELIDOS[$torneioPoloperator] ?? []);
        $mAtletas = aplicarConfirmacoesManuais($mAtletas, $confirmacoes['atletas'] ?? [], $rosterPorId);
        $matchesAtletasPorTime[$timeInternoId] = ['time' => $mt['interno'], 'matches' => $mAtletas];
    }

    return ['times' => $matchesTimes, 'atletas_por_time' => $matchesAtletasPorTime];
}

/** Baixa um arquivo remoto pra um tmp local — só usado na importação real, nunca no preview. */
function baixarImagemTemporaria(string $url): string {
    if (!preg_match('#^https://#i', $url)) throw new RuntimeException('URL de imagem externa inválida.');
    $tmp = tempnam(sys_get_temp_dir(), 'poloimg_');
    $fp = fopen($tmp, 'wb');
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_FILE           => $fp,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_PROTOCOLS      => CURLPROTO_HTTPS,
        CURLOPT_MAXFILESIZE    => MIDIA_MAX_BYTES,
    ]);
    $ok   = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    fclose($fp);
    if (!$ok || $code !== 200) {
        @unlink($tmp);
        throw new RuntimeException("Falha ao baixar imagem externa (HTTP $code).");
    }
    return $tmp;
}

function montarRelatorio(array $matching): array {
    $times = $matching['times'];
    $relatorioTimes = resumirMatches($times, 'logoPath');

    $todosAtletas = [];
    foreach ($matching['atletas_por_time'] as $grupo) $todosAtletas = array_merge($todosAtletas, $grupo['matches']);
    $relatorioAtletas = resumirMatches($todosAtletas, 'photoPath');

    $pendenciasTimes = array_values(array_filter($times, fn($m) => $m['status'] !== 'associado'));
    $pendenciasAtletas = [];
    foreach ($matching['atletas_por_time'] as $timeInternoId => $grupo) {
        foreach ($grupo['matches'] as $m) {
            if ($m['status'] !== 'associado') {
                $pendenciasAtletas[] = ['time_interno' => $grupo['time'], 'match' => $m];
            }
        }
    }

    return [
        'times' => $relatorioTimes,
        'atletas' => $relatorioAtletas,
        'pendencias_times' => $pendenciasTimes,
        'pendencias_atletas' => $pendenciasAtletas,
        'times_associados' => array_values(array_filter($times, fn($m) => $m['status'] === 'associado')),
        'atletas_por_time' => $matching['atletas_por_time'],
    ];
}

$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET' && ($_GET['action'] ?? '') === 'preview') {
        $categoria = $_GET['categoria'] ?? 'misto';
        if (!in_array($categoria, ['misto', 'mtnb'], true)) respondError('Categoria inválida');
        $matching = rodarMatching($db, $categoria);
        respond(montarRelatorio($matching));
    }

    if ($method === 'POST') {
        $body = getBody();
        $action = $body['action'] ?? '';
        if ($action === 'importar') {
            $categoria = $body['categoria'] ?? 'misto';
            if (!in_array($categoria, ['misto', 'mtnb'], true)) respondError('Categoria inválida');

            $confirmacoes = [
                'times' => $body['confirmacoes_times'] ?? [],     // {poloperator_id: interno_id}
                'atletas' => $body['confirmacoes_atletas'] ?? [], // {poloperator_id: interno_id}
            ];
            $matching = rodarMatching($db, $categoria, $confirmacoes);

            $importados = ['times' => [], 'atletas' => []];
            $erros = ['times' => [], 'atletas' => []];

            foreach ($matching['times'] as $m) {
                if ($m['status'] !== 'associado') continue;
                $timeId = (int)$m['interno']['id'];
                $poloId = $m['externo']['id'] ?? null;
                $logoUrl = $m['externo']['logoPath'] ?? null;
                try {
                    if ($logoUrl && $m['interno']['logo_origem'] !== 'manual') {
                        $tmp = baixarImagemTemporaria($logoUrl);
                        try {
                            $arquivo = validarImagemArquivo($tmp);
                            salvarImagemTime($db, $timeId, $arquivo, 'importado', $poloId);
                            $importados['times'][] = $timeId;
                        } finally {
                            @unlink($tmp);
                        }
                    } elseif ($poloId) {
                        // Sem logo externo, mas grava o poloperator_id pra próximas importações não dependerem do nome.
                        $db->prepare("UPDATE times SET poloperator_id = COALESCE(poloperator_id, ?) WHERE id = ?")->execute([$poloId, $timeId]);
                    }
                } catch (\Throwable $e) {
                    $erros['times'][] = ['time_id' => $timeId, 'erro' => $e->getMessage()];
                }
            }

            foreach ($matching['atletas_por_time'] as $grupo) {
                foreach ($grupo['matches'] as $m) {
                    if ($m['status'] !== 'associado') continue;
                    $pessoaId = (int)$m['interno']['id'];
                    $poloId = $m['externo']['id'] ?? null;
                    $fotoUrl = $m['externo']['photoPath'] ?? null;
                    try {
                        if ($fotoUrl && $m['interno']['foto_origem'] !== 'manual') {
                            $tmp = baixarImagemTemporaria($fotoUrl);
                            try {
                                $arquivo = validarImagemArquivo($tmp);
                                salvarFotoPessoa($db, $pessoaId, $arquivo, 'importado', $poloId);
                                $importados['atletas'][] = $pessoaId;
                            } finally {
                                @unlink($tmp);
                            }
                        } elseif ($poloId) {
                            $db->prepare("UPDATE pessoas SET poloperator_id = COALESCE(poloperator_id, ?) WHERE id = ?")->execute([$poloId, $pessoaId]);
                        }
                    } catch (\Throwable $e) {
                        $erros['atletas'][] = ['pessoa_id' => $pessoaId, 'erro' => $e->getMessage()];
                    }
                }
            }

            $relatorio = montarRelatorio($matching);
            $relatorio['importados'] = [
                'times' => count($importados['times']),
                'atletas' => count($importados['atletas']),
            ];
            $relatorio['erros'] = $erros;
            respond($relatorio);
        }

        respondError('Ação desconhecida');
    }
} catch (\InvalidArgumentException|\RuntimeException $e) {
    respondError($e->getMessage(), 400);
}

respondError('Método não suportado', 405);
