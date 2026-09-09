<?php
/** Views públicas do torneio — somente leitura, sem autenticação. */
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/torneio/lib.php';
require_once __DIR__ . '/torneio/bracket.php';
require_once __DIR__ . '/torneio/resultados.php';
require_once __DIR__ . '/midia/lib.php';
corsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') respondError('Método não suportado', 405);

$db = getDb();

function torneioPublicoAtual(PDO $db, ?string $categoria): ?array {
    $sql = "SELECT * FROM torneios" . ($categoria ? " WHERE categoria = ?" : "") . " ORDER BY id DESC LIMIT 1";
    $stmt = $db->prepare($sql);
    $stmt->execute($categoria ? [$categoria] : []);
    $row = $stmt->fetch();
    return $row ?: null;
}

/** Remove colunas internas (id/fase_id/torneio_id) antes de devolver um jogo pro público. */
function sanitizarJogoPublico(array $j): array {
    unset($j['id'], $j['fase_id'], $j['torneio_id']);
    return $j;
}

/**
 * Converte as colunas cruas de logo (time_a_logo_path/time_a_logo_atualizado_em, idem b)
 * em `time_a_logo`/`time_b_logo` já cache-busted — usado pelo placar/broadcast (brasão dos
 * dois times). Puramente de apresentação: nenhuma lógica esportiva envolvida.
 */
function comLogosPublicos(array $j): array {
    $j['time_a_logo'] = urlComCacheBust($j['time_a_logo_path'] ?? null, $j['time_a_logo_atualizado_em'] ?? null);
    $j['time_b_logo'] = urlComCacheBust($j['time_b_logo_path'] ?? null, $j['time_b_logo_atualizado_em'] ?? null);
    unset($j['time_a_logo_path'], $j['time_a_logo_atualizado_em'], $j['time_b_logo_path'], $j['time_b_logo_atualizado_em']);
    return $j;
}

function comCampeaoPublico(?array $campeao): ?array {
    if (!$campeao) return null;
    $campeao['logo'] = urlComCacheBust($campeao['logo_path'] ?? null, $campeao['logo_atualizado_em'] ?? null);
    unset($campeao['logo_path'], $campeao['logo_atualizado_em']);
    return $campeao;
}

function comPodioPublico(array $podio): array {
    return array_map(static function (array $time): array {
        $time['logo'] = urlComCacheBust($time['logo_path'] ?? null, $time['logo_atualizado_em'] ?? null);
        unset($time['logo_path'], $time['logo_atualizado_em']);
        return $time;
    }, $podio);
}

/**
 * Últimos eventos (gol+falta) de UMA partida, enxuto pro feed/timeline público —
 * sem membro_id/elenco, sem nome de time (a posição esquerda/direita já indica o
 * time — ver seção 7 do brief de acabamento 3). Reusado pelas actions `eventos` e
 * `destaque` — nunca duplicar esta query.
 *
 * `event_id` (categoria+id da própria tabela de evento) é a chave estável pro front
 * detectar "evento novo" sem depender de índice de array (brief do placar broadcast,
 * seção 12) — nunca reaproveitar `quando` como chave (dois eventos podem colidir no
 * mesmo segundo). `foto_path` já sai cache-busted, pronta pro EventOverlay/GoalOverlay.
 */
function eventosRecentesDoJogo(PDO $db, int $jogoId, int $limite): array {
    $stmt = $db->prepare("
        SELECT categoria, id, tipo, atleta, time_id, quando, foto_path, foto_atualizado_em FROM (
            SELECT 'gol' AS categoria, ev.id, ev.tipo, p.nome AS atleta, ev.time_id, ev.criado_em AS quando, p.foto_path, p.foto_atualizado_em
            FROM torneio_eventos_gol ev
            LEFT JOIN membros_time mt ON mt.id = ev.membro_id
            LEFT JOIN inscricoes i ON i.id = mt.inscricao_id
            LEFT JOIN pessoas p ON p.id = i.pessoa_id
            WHERE ev.jogo_id = ? AND ev.removido = 0
            UNION ALL
            SELECT 'falta' AS categoria, ev.id, NULL AS tipo, p.nome AS atleta, ev.time_id, ev.criado_em AS quando, p.foto_path, p.foto_atualizado_em
            FROM torneio_eventos_falta ev
            LEFT JOIN membros_time mt ON mt.id = ev.membro_id
            LEFT JOIN inscricoes i ON i.id = mt.inscricao_id
            LEFT JOIN pessoas p ON p.id = i.pessoa_id
            WHERE ev.jogo_id = ? AND ev.removido = 0
        )
        ORDER BY quando DESC
        LIMIT ?
    ");
    $stmt->execute([$jogoId, $jogoId, $limite]);
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) {
        $r['event_id'] = $r['categoria'] . '-' . $r['id'];
        $r['foto_path'] = urlComCacheBust($r['foto_path'], $r['foto_atualizado_em']);
        unset($r['id'], $r['foto_atualizado_em']);
    }
    unset($r);
    return $rows;
}

$categoria = $_GET['categoria'] ?? 'misto';
$torneioIdParam = isset($_GET['torneio_id']) ? (int)$_GET['torneio_id'] : null;

if ($torneioIdParam) {
    $torneio = getTorneio($db, $torneioIdParam);
    if (!$torneio) respondError('Torneio não encontrado', 404);
    if (strtolower((string)$torneio['categoria']) !== strtolower((string)$categoria)) respondError('Torneio não pertence à categoria solicitada', 404);
} else {
    $torneio = torneioPublicoAtual($db, $categoria);
    if (!$torneio) respondError('Nenhum torneio publicado ainda para esta categoria', 404);
}
$torneioId = (int)$torneio['id'];

$action = $_GET['action'] ?? 'resumo';

try {
    if ($action === 'resultados') {
        respond(consolidarResultadosPublicos($db, $torneio));
    }

    if ($action === 'resumo') {
        $stmt = $db->prepare("
            SELECT f.tipo, f.rodada, f.rotulo, f.estado,
                   CASE WHEN f.estado = 'confirmada'
                        AND COALESCE(SUM(CASE WHEN j.is_bye = 0 AND j.status NOT IN ('encerrado','wo','cancelado') THEN 1 ELSE 0 END), 0) = 0
                   THEN 1 ELSE 0 END AS completa
            FROM torneio_fases f
            LEFT JOIN torneio_jogos j ON j.fase_id = f.id
            WHERE f.torneio_id = ?
            GROUP BY f.id
            ORDER BY f.id
        ");
        $stmt->execute([$torneioId]);
        $fases = array_map(function ($f) { $f['completa'] = (bool)$f['completa']; return $f; }, $stmt->fetchAll());
        respond([
            'torneio' => [
                'id' => $torneio['id'], 'nome' => $torneio['nome'], 'categoria' => $torneio['categoria'], 'formato' => formatoDoTorneio($torneio),
                'estado' => $torneio['estado'], 'classificados_diretos' => (int)$torneio['classificados_diretos'],
                'vagas_repescagem' => (int)$torneio['vagas_repescagem'],
                'rodadas_swiss' => (int)$torneio['rodadas_swiss'],
                'pontos_vitoria' => (float)$torneio['pontos_vitoria'],
                'pontos_empate' => (float)$torneio['pontos_empate'],
                'pontos_derrota' => (float)$torneio['pontos_derrota'],
            ],
            'fases' => $fases,
            'criterios' => array_map(fn($c) => ['chave' => $c, 'label' => TORNEIO_CRITERIOS_LABEL[$c] ?? $c], getCriterios($db, $torneioId)),
        ]);
    }

    if ($action === 'classificacao') {
        $classificacao = calcularClassificacao($db, $torneioId);
        $logosStmt = $db->prepare("
            SELECT t.id, t.logo_path, t.logo_atualizado_em
            FROM times t JOIN torneio_participantes p ON p.time_id = t.id
            WHERE p.torneio_id = ? AND p.ativo = 1
        ");
        $logosStmt->execute([$torneioId]);
        $logos = [];
        foreach ($logosStmt->fetchAll() as $time) {
            $logos[(int)$time['id']] = urlComCacheBust($time['logo_path'], $time['logo_atualizado_em']);
        }
        foreach ($classificacao as &$row) {
            $row['classificado_direto'] = $row['posicao'] <= (int)$torneio['classificados_diretos'];
            $row['repescagem'] = !$row['classificado_direto'];
            $row['logo'] = $logos[(int)$row['time_id']] ?? null;
        }
        unset($row);
        respond(['classificacao' => $classificacao, 'criterios' => getCriterios($db, $torneioId)]);
    }

    if ($action === 'jogos') {
        $where = ['j.torneio_id = ?'];
        $params = [$torneioId];
        if (!empty($_GET['fase_tipo'])) { $where[] = 'f.tipo = ?'; $params[] = $_GET['fase_tipo']; }
        if (!empty($_GET['rodada']))    { $where[] = 'f.rodada = ?'; $params[] = (int)$_GET['rodada']; }
        if (!empty($_GET['codigo']))    { $where[] = 'j.codigo = ?'; $params[] = $_GET['codigo']; }
        $stmt = $db->prepare("
            SELECT j.codigo, j.bracket, j.ordem, j.status, j.placar_a, j.placar_b, j.is_bye, j.overtime,
                   j.horario_previsto, j.horario_inicio_real, j.horario_fim_real,
                   j.time_a_id, j.time_b_id, j.vencedor_time_id, j.time_a_origem, j.time_b_origem,
                   f.tipo AS fase_tipo, f.rodada AS fase_rodada, f.rotulo AS fase_rotulo,
                   ta.nome AS time_a_nome, tb.nome AS time_b_nome,
                   ta.logo_path AS time_a_logo_path, ta.logo_atualizado_em AS time_a_logo_atualizado_em,
                   tb.logo_path AS time_b_logo_path, tb.logo_atualizado_em AS time_b_logo_atualizado_em
            FROM torneio_jogos j
            JOIN torneio_fases f ON f.id = j.fase_id
            LEFT JOIN times ta ON ta.id = j.time_a_id
            LEFT JOIN times tb ON tb.id = j.time_b_id
            WHERE " . implode(' AND ', $where) . "
            ORDER BY f.id, j.ordem
        ");
        $stmt->execute($params);
        respond(['jogos' => array_map('comLogosPublicos', $stmt->fetchAll())]);
    }

    // Feed leve pro card "partida em andamento" da home pública/rota de placar — reusa os
    // mesmos eventos da súmula (gol/falta). Identifica a partida por `codigo` (nunca `id`)
    // pra não expor a chave interna.
    if ($action === 'eventos') {
        $codigo = $_GET['codigo'] ?? '';
        if (!$codigo) respondError('codigo é obrigatório');
        $limite = max(1, min(50, (int)($_GET['limite'] ?? 5)));

        $stmtJogo = $db->prepare("SELECT id FROM torneio_jogos WHERE torneio_id = ? AND codigo = ?");
        $stmtJogo->execute([$torneioId, $codigo]);
        $jogo = $stmtJogo->fetch();
        if (!$jogo) respondError('Partida não encontrada', 404);

        respond(['eventos' => eventosRecentesDoJogo($db, (int)$jogo['id'], $limite)]);
    }

    // Resolve qual partida deve estar em destaque agora (status > ordem — ver
    // resolverPartidaDestaque em lib.php) e devolve tudo que a home /torneio e a rota
    // /torneio/placar precisam num único request: jogo em destaque, seus eventos
    // recentes, últimos resultados e o próximo jogo agendado depois dele.
    if ($action === 'destaque') {
        $limiteEventos = max(1, min(20, (int)($_GET['limite_eventos'] ?? 5)));
        $limiteResultados = max(1, min(10, (int)($_GET['limite_resultados'] ?? 3)));

        $res = resolverPartidaDestaque($db, $torneioId);
        $jogo = $res['jogo'];

        $eventos = $jogo ? eventosRecentesDoJogo($db, (int)$jogo['id'], $limiteEventos) : [];

        $encerradas = array_values(array_filter($res['todas'], fn($j) => $j['status'] === 'encerrado'));
        usort($encerradas, fn($a, $b) => strcmp((string)($b['horario_fim_real'] ?? $b['atualizado_em']), (string)($a['horario_fim_real'] ?? $a['atualizado_em'])));
        $ultimosResultados = array_slice($encerradas, 0, $limiteResultados);

        $proximo = resolverProximoJogo($res['todas'], $jogo);

        respond([
            'jogo' => $jogo ? comLogosPublicos(sanitizarJogoPublico($jogo)) : null,
            'eventos' => $eventos,
            'ultimos_resultados' => array_map(fn($j) => comLogosPublicos(sanitizarJogoPublico($j)), $ultimosResultados),
            'proximo_jogo' => $proximo ? comLogosPublicos(sanitizarJogoPublico($proximo)) : null,
            'multiplas_em_andamento' => $res['multiplas_em_andamento'],
            'campeao' => comCampeaoPublico(resolverCampeaoOficial($torneio, $res['todas'])),
        ]);
    }

    if ($action === 'artilharia') {
        respond(['artilharia' => calcularArtilharia($db, $torneioId, $_GET['escopo'] ?? 'torneio')]);
    }

    if ($action === 'fairplay') {
        respond(['fair_play' => calcularFairPlayTimes($db, $torneioId, $_GET['escopo'] ?? 'torneio')]);
    }

    if ($action === 'faltas_individuais') {
        respond(['faltas_individuais' => calcularFaltasIndividuais($db, $torneioId, $_GET['escopo'] ?? 'torneio')]);
    }

    // Roster público de um time (seção 17-19 do brief de área pública) — elegibilidade
    // (inscrição cancelada nunca aparece) via getElencoTime(), mesmo filtro da súmula.
    // Leitura agregada dos Browser Sources. Não calcula progressão: entrega a
    // classificação canônica e as partidas/origens/vencedores já persistidos.
    if ($action === 'broadcast') {
        $classificacao = calcularClassificacao($db, $torneioId);
        $logosStmt = $db->prepare("SELECT t.id, t.logo_path, t.logo_atualizado_em FROM times t JOIN torneio_participantes p ON p.time_id = t.id WHERE p.torneio_id = ? AND p.ativo = 1");
        $logosStmt->execute([$torneioId]);
        $logos = [];
        foreach ($logosStmt->fetchAll() as $time) $logos[(int)$time['id']] = urlComCacheBust($time['logo_path'], $time['logo_atualizado_em']);
        foreach ($classificacao as &$row) {
            $row['classificado_direto'] = $row['posicao'] <= (int)$torneio['classificados_diretos'];
            $row['repescagem'] = !$row['classificado_direto'];
            $row['logo'] = $logos[(int)$row['time_id']] ?? null;
        }
        unset($row);

        $stmt = $db->prepare("
            SELECT j.codigo, j.bracket, j.ordem, j.status, j.placar_a, j.placar_b,
                   j.is_bye, j.bye_motivo, j.overtime, j.horario_previsto,
                   j.horario_inicio_real, j.horario_fim_real,
                   j.time_a_id, j.time_b_id, j.vencedor_time_id, j.time_a_origem, j.time_b_origem,
                   f.tipo AS fase_tipo, f.rodada AS fase_rodada, f.rotulo AS fase_rotulo,
                   ta.nome AS time_a_nome, tb.nome AS time_b_nome,
                   ta.logo_path AS time_a_logo_path, ta.logo_atualizado_em AS time_a_logo_atualizado_em,
                   tb.logo_path AS time_b_logo_path, tb.logo_atualizado_em AS time_b_logo_atualizado_em
            FROM torneio_jogos j JOIN torneio_fases f ON f.id = j.fase_id
            LEFT JOIN times ta ON ta.id = j.time_a_id LEFT JOIN times tb ON tb.id = j.time_b_id
            WHERE j.torneio_id = ? ORDER BY f.id, j.ordem
        ");
        $stmt->execute([$torneioId]);
        $jogosBrutos = $stmt->fetchAll();
        $campeao = comCampeaoPublico(resolverCampeaoOficial($torneio, $jogosBrutos));
        $jogos = array_map(fn($j) => comLogosPublicos(sanitizarJogoPublico($j)), $jogosBrutos);
        // Sequencia operacional da Primeira Fase para leitura do broadcast:
        // a Equalizacao sucede a ultima rodada suica.
        $rodadas = array_values(array_filter($jogos, fn($j) => in_array($j['fase_tipo'], ['swiss', 'round_robin', 'equalizacao'], true)));
        $repescagem = array_values(array_filter($jogos, fn($j) => $j['fase_tipo'] === 'repescagem'));
        $double = array_values(array_filter($jogos, fn($j) => $j['fase_tipo'] === 'double'));

        respond([
            'torneio' => ['id' => (int)$torneio['id'], 'nome' => $torneio['nome'], 'categoria' => $torneio['categoria'], 'formato' => formatoDoTorneio($torneio), 'estado' => $torneio['estado'], 'classificados_diretos' => (int)$torneio['classificados_diretos'], 'vagas_repescagem' => (int)$torneio['vagas_repescagem']],
            'classificacao' => $classificacao, 'rodadas' => $rodadas,
            'repescagem' => $repescagem, 'double' => $double, 'campeao' => $campeao,
        ]);
    }

    if ($action === 'podio') {
        if (strtolower((string)$torneio['categoria']) !== 'misto') respondError('Pódio de premiação disponível somente para o Brasileiro Misto', 404);
        $stmt = $db->prepare("
            SELECT j.codigo, j.status, j.time_a_id, j.time_b_id, j.vencedor_time_id,
                   ta.nome AS time_a_nome, tb.nome AS time_b_nome,
                   ta.logo_path AS time_a_logo_path, ta.logo_atualizado_em AS time_a_logo_atualizado_em,
                   tb.logo_path AS time_b_logo_path, tb.logo_atualizado_em AS time_b_logo_atualizado_em
            FROM torneio_jogos j
            LEFT JOIN times ta ON ta.id = j.time_a_id
            LEFT JOIN times tb ON tb.id = j.time_b_id
            WHERE j.torneio_id = ? AND j.codigo IN ('B6', 'GF', 'GF2')
        ");
        $stmt->execute([$torneioId]);
        respond(['podio' => comPodioPublico(resolverPodioOficial($torneio, $stmt->fetchAll()))]);
    }

    if ($action === 'time') {
        $timeId = (int)($_GET['time_id'] ?? 0);
        if (!$timeId) respondError('time_id é obrigatório');
        $stmtTime = $db->prepare("SELECT t.id, t.nome, t.logo_path, t.logo_atualizado_em FROM times t JOIN torneio_participantes tp ON tp.time_id=t.id AND tp.ativo=1 WHERE t.id=? AND tp.torneio_id=?");
        $stmtTime->execute([$timeId, $torneioId]);
        $time = $stmtTime->fetch();
        if (!$time) respondError('Time não encontrado', 404);
        $time['logo_path'] = urlComCacheBust($time['logo_path'], $time['logo_atualizado_em']);
        unset($time['logo_atualizado_em']);

        $elenco = getElencoTime($db, $timeId);
        foreach ($elenco as &$membro) {
            $membro['foto_path'] = urlComCacheBust($membro['foto_path'], $membro['foto_atualizado_em']);
            unset($membro['foto_atualizado_em']);
        }
        unset($membro);

        respond(['time' => $time, 'elenco' => $elenco]);
    }

    if ($action === 'chaves') {
        $stmt = $db->prepare("
            SELECT j.codigo, j.bracket, j.ordem, j.status, j.placar_a, j.placar_b,
                   j.time_a_id, j.time_b_id, j.vencedor_time_id, j.time_a_origem, j.time_b_origem,
                   f.tipo AS fase_tipo, ta.nome AS time_a_nome, tb.nome AS time_b_nome
            FROM torneio_jogos j
            JOIN torneio_fases f ON f.id = j.fase_id
            LEFT JOIN times ta ON ta.id = j.time_a_id
            LEFT JOIN times tb ON tb.id = j.time_b_id
            WHERE j.torneio_id = ? AND f.tipo IN ('repescagem','double')
            ORDER BY f.tipo, j.ordem
        ");
        $stmt->execute([$torneioId]);
        $todos = $stmt->fetchAll();
        respond([
            'repescagem' => array_values(array_filter($todos, fn($r) => $r['fase_tipo'] === 'repescagem')),
            'double'     => array_values(array_filter($todos, fn($r) => $r['fase_tipo'] === 'double')),
        ]);
    }
} catch (\Throwable $e) {
    respondError('Erro ao carregar dados do torneio', 500, $e->getMessage());
}

respondError('Ação desconhecida');
