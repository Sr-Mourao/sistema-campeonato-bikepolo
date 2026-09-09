<?php
/**
 * Consolidação somente leitura da memória esportiva do campeonato.
 *
 * A Primeira Fase vem do snapshot oficial congelado (com fallback para o mesmo
 * motor enquanto o fechamento ainda não aconteceu). A colocação final usa apenas
 * resultados persistidos da progressão e, nos níveis equivalentes, a posição
 * oficial obtida na Primeira Fase.
 */

function resultadosClassificacaoPrimeiraFase(PDO $db, int $torneioId): array
{
    $stmt = $db->prepare("SELECT dados, criado_em FROM torneio_snapshots WHERE torneio_id=? AND tipo='classificacao_congelada' ORDER BY id DESC LIMIT 1");
    $stmt->execute([$torneioId]);
    $snapshot = $stmt->fetch();
    if ($snapshot) {
        $dados = json_decode((string)$snapshot['dados'], true);
        if (is_array($dados['classificacao'] ?? null)) {
            return ['linhas' => $dados['classificacao'], 'origem' => 'snapshot_oficial', 'capturado_em' => $snapshot['criado_em']];
        }
    }
    return ['linhas' => calcularClassificacao($db, $torneioId), 'origem' => 'motor_oficial', 'capturado_em' => null];
}

function resultadosPerdedor(?array $jogo): ?int
{
    if (!$jogo || ($jogo['status'] ?? null) !== 'encerrado' || empty($jogo['vencedor_time_id'])) return null;
    $a = (int)($jogo['time_a_id'] ?? 0);
    $b = (int)($jogo['time_b_id'] ?? 0);
    $vencedor = (int)$jogo['vencedor_time_id'];
    if (!$a || !$b || !in_array($vencedor, [$a, $b], true)) return null;
    return $vencedor === $a ? $b : $a;
}

function resultadosOrdenarPorSeed(array $times, array $seedPorTime): array
{
    $times = array_values(array_unique(array_map('intval', array_filter($times))));
    usort($times, static fn(int $a, int $b): int => ($seedPorTime[$a] ?? PHP_INT_MAX) <=> ($seedPorTime[$b] ?? PHP_INT_MAX));
    return $times;
}

function resultadosLinhaFinal(int $posicao, int $timeId, string $etapa, string $explicacao, bool $porSeed = false): array
{
    return [
        'posicao' => $posicao,
        'time_id' => $timeId,
        'etapa_final' => $etapa,
        'explicacao' => $explicacao,
        'ordenado_por_classificacao_primeira_fase' => $porSeed,
    ];
}

/** Regra canônica 1º–13º, independente de campanha e da ordem operacional dos jogos. */
function resultadosClassificacaoFinalMisto(array $torneio, array $jogos, array $primeiraFase): array
{
    $porCodigo = [];
    foreach ($jogos as $jogo) $porCodigo[$jogo['codigo'] ?? ''] = $jogo;
    $seed = array_column($primeiraFase, 'posicao', 'time_id');
    $linhas = [];

    $campeao = resolverCampeaoOficial($torneio, $jogos);
    if ($campeao) {
        $decisao = isset($porCodigo['GF2']) ? $porCodigo['GF2'] : ($porCodigo['GF'] ?? null);
        $vice = resultadosPerdedor($decisao);
        $linhas[] = resultadosLinhaFinal(1, (int)$campeao['time_id'], 'Campeão', 'Venceu a decisão definitiva do campeonato.');
        if ($vice) $linhas[] = resultadosLinhaFinal(2, $vice, 'Vice-campeão', 'Chegou à decisão definitiva do campeonato.');
    }

    foreach ([['B6', 3, 'Final da Losers'], ['B5', 4, 'Losers — penúltima etapa']] as [$codigo, $posicao, $etapa]) {
        $timeId = resultadosPerdedor($porCodigo[$codigo] ?? null);
        if ($timeId) $linhas[] = resultadosLinhaFinal($posicao, $timeId, $etapa, "Eliminado em $codigo.");
    }

    $grupos = [
        [['B3', 'B4'], 5, 'Losers — etapa B3/B4'],
        [['B1', 'B2'], 7, 'Losers — etapa B1/B2'],
        [['REP-R4', 'REP-R5'], 9, 'Repescagem — etapa final'],
        [['REP-R1', 'REP-R2', 'REP-R3'], 11, 'Repescagem — etapa inicial'],
    ];
    foreach ($grupos as [$codigos, $inicio, $etapa]) {
        $eliminados = array_map(static fn(string $codigo): ?int => resultadosPerdedor($porCodigo[$codigo] ?? null), $codigos);
        if (count(array_filter($eliminados)) !== count($codigos)) continue;
        foreach (resultadosOrdenarPorSeed($eliminados, $seed) as $indice => $timeId) {
            $posicao = $inicio + $indice;
            $linhas[] = resultadosLinhaFinal(
                $posicao,
                $timeId,
                $etapa,
                'Entre equipes eliminadas nesta mesma etapa, possuía a ' . ($indice === 0 ? 'melhor' : ($indice === count($codigos) - 1 ? 'pior' : 'posição intermediária na')) . ' classificação da Primeira Fase.',
                true
            );
        }
    }
    usort($linhas, static fn(array $a, array $b): int => $a['posicao'] <=> $b['posicao']);
    return $linhas;
}

/** Topologia real MTNB: perdedores de L1, L2 e LF ocupam 5º, 4º e 3º. */
function resultadosClassificacaoFinalMtnb(array $torneio, array $jogos, array $primeiraFase): array
{
    $porCodigo = [];
    foreach ($jogos as $jogo) $porCodigo[$jogo['codigo'] ?? ''] = $jogo;
    $linhas = [];
    $campeao = resolverCampeaoOficial($torneio, $jogos);
    if ($campeao) {
        $decisao = isset($porCodigo['GF2']) ? $porCodigo['GF2'] : ($porCodigo['GF'] ?? null);
        $vice = resultadosPerdedor($decisao);
        $linhas[] = resultadosLinhaFinal(1, (int)$campeao['time_id'], 'Campeão', 'Venceu a decisão definitiva do campeonato.');
        if ($vice) $linhas[] = resultadosLinhaFinal(2, $vice, 'Vice-campeão', 'Chegou à decisão definitiva do campeonato.');
    }
    foreach ([['LF', 3, 'Final da Losers'], ['L2', 4, 'Losers — segunda etapa'], ['L1', 5, 'Losers — primeira etapa']] as [$codigo, $posicao, $etapa]) {
        $timeId = resultadosPerdedor($porCodigo[$codigo] ?? null);
        if ($timeId) $linhas[] = resultadosLinhaFinal($posicao, $timeId, $etapa, "Eliminado em $codigo.");
    }
    usort($linhas, static fn(array $a, array $b): int => $a['posicao'] <=> $b['posicao']);
    return $linhas;
}

function resultadosGrupoFase(array $torneio, array $jogo): string
{
    $tipo = (string)($jogo['fase_tipo'] ?? '');
    if (in_array($tipo, ['swiss', 'equalizacao', 'round_robin'], true)) return 'primeira_fase';
    if ($tipo === 'repescagem') return 'repescagem';
    return 'double';
}

function resultadosNomeEtapa(array $jogo): string
{
    $tipo = (string)($jogo['fase_tipo'] ?? '');
    $codigo = (string)($jogo['codigo'] ?? '');
    if ($codigo === 'GF' || $codigo === 'GF2') return $codigo;
    if ($tipo === 'swiss') return 'Suíço';
    if ($tipo === 'equalizacao') return 'Equalização';
    if ($tipo === 'round_robin') return 'Round Robin';
    if ($tipo === 'repescagem') return 'Repescagem';
    return 'Double';
}

function resultadosStatsVazias(): array
{
    return ['j' => 0, 'v' => 0, 'e' => 0, 'd' => 0, 'gp' => 0, 'gc' => 0, 'sg' => 0, 'gols_normais' => 0, 'gols_outorgados' => 0, 'gols_contra' => 0, 'faltas' => 0, 'fair_play' => 0];
}

function resultadosSomarJogo(array &$stats, int $pro, int $contra): void
{
    $stats['j']++;
    $stats['gp'] += $pro;
    $stats['gc'] += $contra;
    if ($pro > $contra) $stats['v']++;
    elseif ($pro < $contra) $stats['d']++;
    else $stats['e']++;
    $stats['sg'] = $stats['gp'] - $stats['gc'];
}

function resultadosJogos(PDO $db, int $torneioId): array
{
    $stmt = $db->prepare("
        SELECT j.*, f.tipo AS fase_tipo, f.rodada AS fase_rodada, f.rotulo AS fase_rotulo,
               ta.nome AS time_a_nome, tb.nome AS time_b_nome,
               ta.logo_path AS time_a_logo_path, ta.logo_atualizado_em AS time_a_logo_atualizado_em,
               tb.logo_path AS time_b_logo_path, tb.logo_atualizado_em AS time_b_logo_atualizado_em
          FROM torneio_jogos j
          JOIN torneio_fases f ON f.id=j.fase_id
          LEFT JOIN times ta ON ta.id=j.time_a_id
          LEFT JOIN times tb ON tb.id=j.time_b_id
         WHERE j.torneio_id=?
         ORDER BY f.id, j.ordem, j.id
    ");
    $stmt->execute([$torneioId]);
    return $stmt->fetchAll();
}

function resultadosContagemEventos(PDO $db, int $torneioId, string $tabela, string $colunaTipo = ''): array
{
    $tipoSelect = $colunaTipo ? ", COALESCE(ev.$colunaTipo, 'normal') AS evento_tipo" : ", 'falta' AS evento_tipo";
    $stmt = $db->prepare("
        SELECT ev.time_id, f.tipo AS fase_tipo, j.codigo, COUNT(*) quantidade $tipoSelect
          FROM $tabela ev
          JOIN torneio_jogos j ON j.id=ev.jogo_id
          JOIN torneio_fases f ON f.id=j.fase_id
         WHERE ev.torneio_id=? AND ev.removido=0 AND j.status='encerrado' AND j.is_bye=0
         GROUP BY ev.time_id, f.tipo, j.codigo, evento_tipo
    ");
    $stmt->execute([$torneioId]);
    return $stmt->fetchAll();
}

function resultadosCampanhas(PDO $db, array $torneio, array $jogos, array $times): array
{
    $campanhas = [];
    foreach ($times as $timeId => $_) {
        $campanhas[$timeId] = [
            'primeira_fase' => resultadosStatsVazias(),
            'repescagem' => resultadosStatsVazias(),
            'double' => resultadosStatsVazias(),
            'total' => resultadosStatsVazias(),
            'fases_disputadas' => [],
            'jogos' => [],
        ];
    }
    foreach ($jogos as $jogo) {
        if (($jogo['status'] ?? null) !== 'encerrado' || (int)($jogo['is_bye'] ?? 0) === 1) continue;
        $a = (int)($jogo['time_a_id'] ?? 0); $b = (int)($jogo['time_b_id'] ?? 0);
        if (!$a || !$b || !isset($campanhas[$a], $campanhas[$b])) continue;
        $pa = (int)$jogo['placar_a']; $pb = (int)$jogo['placar_b'];
        $grupo = resultadosGrupoFase($torneio, $jogo);
        $etapa = resultadosNomeEtapa($jogo);
        foreach ([[$a, $b, $pa, $pb, 'a'], [$b, $a, $pb, $pa, 'b']] as [$timeId, $adversarioId, $pro, $contra, $lado]) {
            resultadosSomarJogo($campanhas[$timeId][$grupo], $pro, $contra);
            resultadosSomarJogo($campanhas[$timeId]['total'], $pro, $contra);
            if (!in_array($etapa, $campanhas[$timeId]['fases_disputadas'], true)) $campanhas[$timeId]['fases_disputadas'][] = $etapa;
            $outro = $lado === 'a' ? 'b' : 'a';
            $campanhas[$timeId]['jogos'][] = [
                'codigo' => $jogo['codigo'], 'fase' => $etapa, 'fase_tipo' => $jogo['fase_tipo'],
                'rodada' => $jogo['fase_rodada'], 'etapa' => $jogo['fase_rotulo'],
                'adversario_id' => $adversarioId, 'adversario' => $jogo["time_{$outro}_nome"],
                'adversario_logo' => urlComCacheBust($jogo["time_{$outro}_logo_path"] ?? null, $jogo["time_{$outro}_logo_atualizado_em"] ?? null),
                'gols_pro' => $pro, 'gols_contra' => $contra, 'placar' => "$pro × $contra",
                'resultado' => $pro > $contra ? 'V' : ($pro < $contra ? 'D' : 'E'),
                'data_hora' => $jogo['horario_inicio_real'] ?? $jogo['horario_previsto'] ?? $jogo['horario_fim_real'] ?? null,
            ];
        }
    }

    foreach (resultadosContagemEventos($db, (int)$torneio['id'], 'torneio_eventos_gol', 'tipo') as $evento) {
        $timeId = (int)$evento['time_id']; if (!isset($campanhas[$timeId])) continue;
        $grupo = resultadosGrupoFase($torneio, $evento);
        $campo = $evento['evento_tipo'] === 'sem_autoria' ? 'gols_outorgados' : ($evento['evento_tipo'] === 'gol_contra' ? 'gols_contra' : 'gols_normais');
        $campanhas[$timeId][$grupo][$campo] += (int)$evento['quantidade'];
        $campanhas[$timeId]['total'][$campo] += (int)$evento['quantidade'];
    }
    foreach (resultadosContagemEventos($db, (int)$torneio['id'], 'torneio_eventos_falta') as $evento) {
        $timeId = (int)$evento['time_id']; if (!isset($campanhas[$timeId])) continue;
        $grupo = resultadosGrupoFase($torneio, $evento);
        $quantidade = (int)$evento['quantidade'];
        $campanhas[$timeId][$grupo]['faltas'] += $quantidade;
        $campanhas[$timeId][$grupo]['fair_play'] += $quantidade;
        $campanhas[$timeId]['total']['faltas'] += $quantidade;
        $campanhas[$timeId]['total']['fair_play'] += $quantidade;
    }
    return $campanhas;
}

function resultadosDadosTimes(PDO $db, int $torneioId): array
{
    $stmt = $db->prepare("SELECT t.id,t.nome,t.logo_path,t.logo_atualizado_em FROM times t JOIN torneio_participantes tp ON tp.time_id=t.id WHERE tp.torneio_id=? AND tp.ativo=1");
    $stmt->execute([$torneioId]);
    $times = [];
    foreach ($stmt->fetchAll() as $time) {
        $timeId = (int)$time['id'];
        $times[$timeId] = ['time_id' => $timeId, 'nome' => $time['nome'], 'logo' => urlComCacheBust($time['logo_path'], $time['logo_atualizado_em']), 'elenco' => getElencoTime($db, $timeId)];
        foreach ($times[$timeId]['elenco'] as &$pessoa) {
            $pessoa['foto_path'] = urlComCacheBust($pessoa['foto_path'] ?? null, $pessoa['foto_atualizado_em'] ?? null);
            unset($pessoa['foto_atualizado_em']);
        }
        unset($pessoa);
    }
    return $times;
}

function resultadosAwardsPublicos(PDO $db, string $categoria): array
{
    require_once __DIR__ . '/../awards/lib.php';
    $comEscudo = static function (array $pessoa) use ($db, $categoria): array {
        $stmt = $db->prepare("
            SELECT t.logo_path, t.logo_atualizado_em
              FROM inscricoes i
              JOIN membros_time mt ON mt.inscricao_id = i.id
              JOIN times t ON t.id = mt.time_id AND LOWER(t.categoria) = ?
             WHERE i.pessoa_id = ? AND i.status != 'cancelado'
             ORDER BY mt.id
             LIMIT 1
        ");
        $stmt->execute([$categoria, (int)$pessoa['pessoa_id']]);
        $time = $stmt->fetch();
        $pessoa['time_logo'] = $time ? urlComCacheBust($time['logo_path'] ?? null, $time['logo_atualizado_em'] ?? null) : null;
        return $pessoa;
    };
    if ($categoria === 'mtnb') {
        $categorias = array_map(static function (array $award) use ($comEscudo): array {
            return [
                'codigo' => $award['codigo'], 'nome' => $award['nome'], 'descricao' => $award['descricao'],
                'vencedores' => array_map($comEscudo, $award['vencedores']), 'empate' => count($award['vencedores']) > 1,
                'origem' => 'cadastro_oficial',
            ];
        }, awardsMtnbListar($db, true));
        return ['status' => count($categorias) > 0 ? 'publicado' : 'sem_publicacao', 'categorias' => $categorias];
    }
    $status = awardsStatus($db);
    if ($status !== 'encerrada') return ['status' => $status, 'categorias' => []];
    $categorias = [];
    foreach (awardsApuracao($db) as $resultado) {
        $distribuicao = array_values(array_filter($resultado['ranking'], static fn(array $pessoa): bool => $pessoa['votos'] > 0));
        $distribuicao = array_map($comEscudo, $distribuicao);
        $vencedoresIds = array_flip(array_column($resultado['vencedores'], 'pessoa_id'));
        $categorias[] = [
            'codigo' => $resultado['codigo'], 'nome' => $resultado['nome'], 'descricao' => $resultado['descricao'],
            'vencedores' => array_values(array_filter($distribuicao, static fn(array $pessoa): bool => isset($vencedoresIds[$pessoa['pessoa_id']]))),
            'empate' => $resultado['empate'],
            'total_votos' => $resultado['total_votos'], 'maior_quantidade' => $resultado['maior_quantidade'], 'origem' => 'votacao_interna',
            'votacao' => ['total_votos_validos' => $resultado['total_votos'], 'distribuicao' => $distribuicao],
        ];
    }
    return ['status' => $status, 'categorias' => $categorias];
}

function consolidarResultadosPublicos(PDO $db, array $torneio): array
{
    $torneioId = (int)$torneio['id'];
    $categoria = strtolower((string)$torneio['categoria']);
    $primeira = resultadosClassificacaoPrimeiraFase($db, $torneioId);
    $times = resultadosDadosTimes($db, $torneioId);
    foreach ($primeira['linhas'] as &$linha) {
        $timeId = (int)$linha['time_id'];
        $linha['logo'] = $times[$timeId]['logo'] ?? null;
    }
    unset($linha);
    $jogos = resultadosJogos($db, $torneioId);
    $campanhas = resultadosCampanhas($db, $torneio, $jogos, $times);
    $final = $categoria === 'mtnb'
        ? resultadosClassificacaoFinalMtnb($torneio, $jogos, $primeira['linhas'])
        : resultadosClassificacaoFinalMisto($torneio, $jogos, $primeira['linhas']);
    $seedPorTime = array_column($primeira['linhas'], 'posicao', 'time_id');
    foreach ($final as &$linha) {
        $timeId = (int)$linha['time_id'];
        $linha = array_merge($linha, $times[$timeId] ?? [], [
            'posicao_primeira_fase' => (int)($seedPorTime[$timeId] ?? 0),
            'campanha' => $campanhas[$timeId] ?? null,
        ]);
    }
    unset($linha);
    foreach ($primeira['linhas'] as &$linha) {
        $timeId = (int)$linha['time_id'];
        $linha['jogos'] = array_values(array_filter($campanhas[$timeId]['jogos'] ?? [], static fn(array $j): bool => in_array($j['fase_tipo'], ['swiss', 'equalizacao', 'round_robin'], true)));
    }
    unset($linha);
    $esperado = $categoria === 'mtnb' ? 5 : 13;
    $payload = [
        'competicao' => [
            'id' => $torneioId, 'categoria' => $categoria, 'nome' => $torneio['nome'],
            'titulo_publico' => $categoria === 'mtnb' ? '4º Brasileiro MTNB' : '10º Brasileiro Misto',
            'estado' => $torneio['estado'], 'encerrado' => count($final) === $esperado,
        ],
        'campeao_definido' => resolverCampeaoOficial($torneio, $jogos) !== null,
        'classificacao_final_completa' => count($final) === $esperado,
        'classificacao_final' => $final,
        'primeira_fase' => [
            'classificacao' => $primeira['linhas'], 'origem' => $primeira['origem'],
            'capturado_em' => $primeira['capturado_em'],
            'criterios' => array_map(static fn(string $c): array => ['chave' => $c, 'label' => TORNEIO_CRITERIOS_LABEL[$c] ?? $c], getCriterios($db, $torneioId)),
        ],
        'campanhas' => array_values(array_map(static fn(array $time, int $timeId): array => array_merge($time, ['campanha' => $campanhas[$timeId]]), $times, array_keys($times))),
        'metadata' => [
            'regra_colocacao' => 'A etapa de eliminação define a colocação; em eliminações equivalentes, vale a melhor posição na classificação da Primeira Fase.',
            'campanha_reordena' => false, 'fair_play_representacao' => 'quantidade_de_faltas',
            'zona_classificatoria' => $categoria === 'misto' ? [
                'codigo' => 'G5', 'ate_posicao' => 5,
                'nome' => 'Zona classificatória para o 8º Campeonato Latinoamericano de Bike Polo no Peru',
                'url' => 'https://www.instagram.com/p/Dcw7EjpMHwt/',
            ] : null,
        ],
        'artilharia' => calcularArtilharia($db, $torneioId, 'torneio'),
        'fair_play_times' => calcularFairPlayTimes($db, $torneioId, 'torneio'),
    ];
    $payload['awards'] = resultadosAwardsPublicos($db, $categoria);
    return $payload;
}
