<?php
/**
 * Formato misto_round_robin_8 (2° Pior Campeonato de Bici Polo): todos contra todos
 * com 8 times (7 rodadas × 4 jogos) + Double Elimination de entrada direta 1×8, 2×7,
 * 3×6, 4×5. Sem Equalização e sem Repescagem.
 */

function montarPior8(PDO $db, bool $encerrar = true): array {
    $times = seedTimes($db, 8, 3, 'misto');
    $id = criarTorneioPreset($db, 'misto', 'teste');
    gerarPrimeiraFaseRoundRobin($db, $id, 'teste');
    if ($encerrar) encerrarPrimeiraFasePior8($db, $id);
    return [$id, $times];
}

/** Menor id sempre vence: ranking determinístico = ordem dos ids. Deixa $pular jogos abertos. */
function encerrarPrimeiraFasePior8(PDO $db, int $id, int $pular = 0): void {
    $stmt = $db->prepare("SELECT j.id, j.time_a_id, j.time_b_id FROM torneio_jogos j JOIN torneio_fases f ON f.id = j.fase_id WHERE j.torneio_id = ? AND f.tipo = 'round_robin' AND j.status = 'agendado' ORDER BY j.id");
    $stmt->execute([$id]);
    $jogos = $stmt->fetchAll();
    foreach (array_slice($jogos, 0, count($jogos) - $pular) as $j) {
        $aVence = (int)$j['time_a_id'] < (int)$j['time_b_id'];
        atualizarPartida($db, $id, (int)$j['id'], ['status' => 'encerrado', 'placar_a' => $aVence ? 3 : 1, 'placar_b' => $aVence ? 1 : 3], 'teste');
    }
}

/** Joga a Double até o fim; na GF o lado Losers vence para forçar a GF2. */
function jogarDoublePior8(PDO $db, int $id): void {
    for ($guarda = 0; $guarda < 30; $guarda++) {
        $stmt = $db->prepare("SELECT j.* FROM torneio_jogos j JOIN torneio_fases f ON f.id = j.fase_id WHERE j.torneio_id = ? AND f.tipo = 'double' AND j.status = 'agendado' AND j.time_a_id IS NOT NULL AND j.time_b_id IS NOT NULL ORDER BY j.ordem LIMIT 1");
        $stmt->execute([$id]);
        $j = $stmt->fetch();
        if (!$j) return;
        $ladoA = $j['codigo'] !== 'GF';
        atualizarPartida($db, $id, (int)$j['id'], ['status' => 'encerrado', 'placar_a' => $ladoA ? 4 : 0, 'placar_b' => $ladoA ? 0 : 4], 'teste');
    }
    throw new Exception('Double não terminou em 30 jogos');
}

function test_pior8_preset_formato_e_criterios(): void {
    $db = testDb(); seedTimes($db, 8, 1, 'misto');
    $id = criarTorneioPreset($db, 'misto', 'teste');
    $t = getTorneio($db, $id);
    assertEqualsT('misto_round_robin_8', $t['formato'], 'Criar Misto usa o formato de 8');
    assertEqualsT('pior_2026_round_robin_8', $t['preset'], 'slug do preset novo');
    assertEqualsT([3.0, 1.0, 0.0], [(float)$t['pontos_vitoria'], (float)$t['pontos_empate'], (float)$t['pontos_derrota']], 'pontuação 3/1/0');
    assertEqualsT(1, (int)$t['permite_empate_classificatoria'], 'empate permitido na 1ª fase');
    assertEqualsT(0, (int)$t['equalizacao_habilitada'], 'sem equalização');
    assertEqualsT(0, (int)$t['vagas_repescagem'], 'sem repescagem');
    assertEqualsT(['pontos', 'saldo', 'gols_pro', 'fair_play', 'gols_contra_menos', 'confronto_direto_grupo', 'sorteio'], getCriterios($db, $id), 'ordem dos critérios sem buchholz');
    assertFalse(formatoTemRepescagem($t), 'helper: sem repescagem');
    assertEqualsT(28, formatoInfo($t)['jogos_primeira_fase'], 'formatoInfo expõe 28 jogos');
    echo "OK: test_pior8_preset_formato_e_criterios\n";
}

function test_pior8_inscreve_somente_times_informados(): void {
    $db = testDb(); seedTimes($db, 13, 1, 'misto'); $oito = seedTimes($db, 8, 1, 'misto');
    $id = criarTorneioPreset($db, 'misto', 'teste', null, null, $oito);
    $ids = array_map(fn($p) => (int)$p['time_id'], getParticipantes($db, $id));
    sort($ids);
    assertEqualsT($oito, $ids, 'participantes = exatamente os 8 informados');
    echo "OK: test_pior8_inscreve_somente_times_informados\n";
}

function test_pior8_calendario_sem_repeticao_sem_folga(): void {
    $db = testDb(); [$id, $times] = montarPior8($db, false);
    $stmt = $db->prepare("SELECT j.*, f.rodada, f.rotulo, f.conta_classificacao FROM torneio_jogos j JOIN torneio_fases f ON f.id = j.fase_id WHERE j.torneio_id = ? ORDER BY f.rodada, j.ordem");
    $stmt->execute([$id]); $jogos = $stmt->fetchAll();
    assertEqualsT(28, count($jogos), 'todos contra todos de 8 = 28 jogos');
    $pares = []; $porTime = array_fill_keys($times, 0); $porRodada = [];
    foreach ($jogos as $j) {
        assertEqualsT(0, (int)$j['is_bye'], 'nenhuma folga/bye persistida');
        assertNotNullT($j['time_a_id'], 'time A definido'); assertNotNullT($j['time_b_id'], 'time B definido');
        assertEqualsT(1, (int)$j['conta_classificacao'], 'rodadas contam para a classificação');
        $par = [(int)$j['time_a_id'], (int)$j['time_b_id']]; sort($par); $pares[] = implode('-', $par);
        $porTime[$par[0]]++; $porTime[$par[1]]++;
        $porRodada[(int)$j['rodada']][] = $j;
    }
    assertEqualsT(28, count(array_unique($pares)), 'nenhum confronto se repete');
    foreach ($porTime as $n) assertEqualsT(7, $n, 'cada time joga 7 vezes');
    assertEqualsT(range(1, 7), array_keys($porRodada), '7 rodadas numeradas 1..7');
    foreach ($porRodada as $r => $lista) {
        assertEqualsT(4, count($lista), "rodada $r tem 4 jogos");
        $noRodada = [];
        foreach ($lista as $j) { $noRodada[] = (int)$j['time_a_id']; $noRodada[] = (int)$j['time_b_id']; }
        assertEqualsT(8, count(array_unique($noRodada)), "rodada $r: cada time joga uma vez");
        assertTrue(str_contains($lista[0]['rotulo'], "Rodada $r"), "rótulo da rodada $r");
    }
    assertEqualsT('PRIMEIRA_FASE', getTorneio($db, $id)['estado'], 'estado após gerar');
    assertThrowsT(fn() => gerarPrimeiraFaseRoundRobin($db, $id, 'teste'), 'não gera a 1ª fase duas vezes');
    echo "OK: test_pior8_calendario_sem_repeticao_sem_folga\n";
}

function test_pior8_exige_exatamente_8_times(): void {
    $db = testDb(); seedTimes($db, 7, 1, 'misto');
    $id = criarTorneioPreset($db, 'misto', 'teste');
    assertThrowsT(fn() => gerarPrimeiraFaseRoundRobin($db, $id, 'teste'), 'recusa com 7 times');
    echo "OK: test_pior8_exige_exatamente_8_times\n";
}

function test_pior8_fechamento_exige_28_jogos_encerrados(): void {
    $db = testDb(); [$id] = montarPior8($db, false);
    encerrarPrimeiraFasePior8($db, $id, 1);
    assertThrowsT(fn() => fecharClassificacao($db, $id, 'teste'), 'com 27 de 28 não fecha');
    assertThrowsT(fn() => gerarDouble($db, $id, 'teste'), 'Double não sai antes de fechar');
    encerrarPrimeiraFasePior8($db, $id);
    $class = fecharClassificacao($db, $id, 'teste');
    assertEqualsT(8, count($class), 'classificação com 8');
    assertEqualsT('CLASSIFICACAO_FECHADA', getTorneio($db, $id)['estado'], 'estado fechado');
    echo "OK: test_pior8_fechamento_exige_28_jogos_encerrados\n";
}

function test_pior8_double_seeds_1x8_2x7_3x6_4x5(): void {
    $db = testDb(); [$id, $times] = montarPior8($db, true);
    $class = fecharClassificacao($db, $id, 'teste');
    assertEqualsT($times, array_map(fn($r) => (int)$r['time_id'], $class), 'menor id vence tudo → seeds na ordem dos ids');
    gerarDouble($db, $id, 'teste');
    $seed = fn(int $p) => (int)$class[$p - 1]['time_id'];
    foreach (['QD' => [1, 8], 'QC' => [2, 7], 'QB' => [3, 6], 'QA' => [4, 5]] as $codigo => [$a, $b]) {
        $j = jogoPorCodigo($db, $id, $codigo);
        assertEqualsT($seed($a), (int)$j['time_a_id'], "$codigo lado A = {$a}º");
        assertEqualsT($seed($b), (int)$j['time_b_id'], "$codigo lado B = {$b}º");
    }
    $stmt = $db->prepare("SELECT codigo FROM torneio_jogos WHERE torneio_id=? AND fase_id=(SELECT id FROM torneio_fases WHERE torneio_id=? AND tipo='double') ORDER BY ordem");
    $stmt->execute([$id, $id]);
    assertEqualsT(['QA','QB','QC','QD','B1','B2','SF1','SF2','B3','B4','FA','B5','B6','GF'], array_column($stmt->fetchAll(), 'codigo'), 'mesma estrutura/ordem da Double de 8');
    assertEqualsT('DOUBLE', getTorneio($db, $id)['estado'], 'estado DOUBLE');
    assertThrowsT(fn() => gerarDouble($db, $id, 'teste'), 'não gera a Double duas vezes');
    echo "OK: test_pior8_double_seeds_1x8_2x7_3x6_4x5\n";
}

function test_pior8_propagacao_ate_gf_e_gf2(): void {
    $db = testDb(); [$id] = montarPior8($db, true);
    fecharClassificacao($db, $id, 'teste'); gerarDouble($db, $id, 'teste');
    jogarDoublePior8($db, $id);
    $gf = jogoPorCodigo($db, $id, 'GF'); $gf2 = jogoPorCodigo($db, $id, 'GF2');
    assertEqualsT('encerrado', $gf['status'], 'GF jogada');
    assertTrue($gf2 !== false, 'GF2 criada quando o lado Losers vence a GF');
    assertEqualsT('encerrado', $gf2['status'], 'GF2 jogada');
    foreach (['SF1','SF2','FA','B1','B2','B3','B4','B5','B6'] as $c) {
        $j = jogoPorCodigo($db, $id, $c);
        assertTrue($j['time_a_id'] !== null && $j['time_b_id'] !== null, "$c recebeu os dois times pela propagação");
    }
    $stmt = $db->prepare("SELECT j.*, ta.nome time_a_nome, tb.nome time_b_nome FROM torneio_jogos j LEFT JOIN times ta ON ta.id=j.time_a_id LEFT JOIN times tb ON tb.id=j.time_b_id WHERE j.torneio_id=?");
    $stmt->execute([$id]);
    $campeao = resolverCampeaoOficial(getTorneio($db, $id), $stmt->fetchAll());
    assertEqualsT((int)$gf2['vencedor_time_id'], (int)$campeao['time_id'], 'campeão = vencedor da GF2');
    echo "OK: test_pior8_propagacao_ate_gf_e_gf2\n";
}

function test_pior8_recusa_repescagem_e_equalizacao(): void {
    $db = testDb(); [$id] = montarPior8($db, true);
    fecharClassificacao($db, $id, 'teste');
    assertThrowsT(fn() => gerarRepescagem($db, $id, 'teste'), 'gerarRepescagem recusa o formato de 8');
    assertThrowsT(fn() => sugerirEqualizacao($db, $id), 'equalização não existe no formato de 8');
    $n = $db->prepare("SELECT COUNT(*) FROM torneio_fases WHERE torneio_id=? AND tipo IN ('repescagem','equalizacao')");
    $n->execute([$id]);
    assertEqualsT(0, (int)$n->fetchColumn(), 'nenhuma fase de repescagem/equalização criada');
    echo "OK: test_pior8_recusa_repescagem_e_equalizacao\n";
}

function test_pior8_classificacao_so_conta_primeira_fase(): void {
    $db = testDb(); [$id] = montarPior8($db, true);
    $antes = fecharClassificacao($db, $id, 'teste');
    gerarDouble($db, $id, 'teste');
    // Gols e faltas na Double não podem mexer em pontos, saldo, gols ou fair play da 1ª fase.
    $qa = jogoPorCodigo($db, $id, 'QA');
    $membro = primeiroMembroDoTime($db, (int)$qa['time_b_id']);
    registrarFalta($db, $id, (int)$qa['id'], (int)$qa['time_b_id'], $membro, 'teste');
    jogarDoublePior8($db, $id);
    $depois = calcularClassificacao($db, $id);
    $chave = fn(array $l) => array_map(fn($r) => [(int)$r['time_id'], $r['j'], $r['pontos'], $r['sg'], $r['gp'], $r['gc'], $r['faltas']], $l);
    assertEqualsT($chave($antes), $chave($depois), 'Double não entra na classificação da 1ª fase');
    foreach ($depois as $r) assertEqualsT(7, $r['j'], 'cada time conta só os 7 jogos da 1ª fase');
    echo "OK: test_pior8_classificacao_so_conta_primeira_fase\n";
}

function test_pior8_confronto_direto_em_grupo_nunca_circular(): void {
    // 4 times empatados em tudo; entre eles: 1>2, 2>3, 3>1 (ciclo) e todos empatam com o 4.
    // Mini-tabela: 1, 2 e 3 com 4 pts; o 4 com 3 pts → 4 por último; o ciclo cai no sorteio (id).
    $base = ['j' => 7, 'v' => 3, 'e' => 1, 'd' => 3, 'gp' => 10, 'gc' => 10, 'sg' => 0, 'faltas' => 2, 'pontos' => 10.0, 'buchholz' => 0];
    $linhas = [];
    foreach ([4, 1, 3, 2] as $tid) $linhas[] = $base + ['time_id' => $tid, 'nome' => "T$tid"];
    $jogos = [[1, 2, 1, 0], [2, 3, 1, 0], [3, 1, 1, 0], [1, 4, 0, 0], [2, 4, 0, 0], [3, 4, 0, 0]];
    $torneio = ['pontos_vitoria' => 3, 'pontos_empate' => 1, 'pontos_derrota' => 0];
    $criterios = ['pontos', 'saldo', 'gols_pro', 'fair_play', 'gols_contra_menos', 'confronto_direto_grupo', 'sorteio'];
    $ordens = [];
    foreach ([$linhas, array_reverse($linhas), [$linhas[2], $linhas[0], $linhas[3], $linhas[1]]] as $entrada) {
        [$ordenado, $decisoes] = ordenarClassificacaoPorGrupos($entrada, $criterios, $jogos, $torneio);
        $ordens[] = array_map(fn($r) => $r['time_id'], $ordenado);
        assertEqualsT('confronto_direto_grupo', $decisoes[3] ?? null, 'o 3 fica à frente do 4 pelo confronto direto');
    }
    foreach ($ordens as $o) assertEqualsT([1, 2, 3, 4], $o, 'ordem independe da entrada (não circular)');
    echo "OK: test_pior8_confronto_direto_em_grupo_nunca_circular\n";
}

function test_pior8_desempate_final_pelo_numero_do_time(): void {
    // Empate total (sem jogos): a ordem segue o seed (número do time), não o id do cadastro.
    $base = ['j' => 0, 'v' => 0, 'e' => 0, 'd' => 0, 'gp' => 0, 'gc' => 0, 'sg' => 0, 'faltas' => 0, 'pontos' => 0.0, 'buchholz' => 0];
    $linhas = array_map(fn($tid) => $base + ['time_id' => $tid, 'nome' => "T$tid"], [10, 20, 30]);
    [$ordenado, $decisoes] = ordenarClassificacaoPorGrupos($linhas, ['pontos', 'confronto_direto_grupo', 'sorteio'], [], ['pontos_vitoria' => 3, 'pontos_empate' => 1, 'pontos_derrota' => 0], [30 => 1, 10 => 2, 20 => 3]);
    assertEqualsT([30, 10, 20], array_map(fn($r) => $r['time_id'], $ordenado), 'empate total segue o seed');
    assertEqualsT([], $decisoes, 'seed não é critério anunciado na tabela');

    // Integração: torneio novo com times cadastrados fora de ordem → tabela zerada em Time 1..8.
    $db = testDb(); $ids = seedTimes($db, 8, 1, 'misto');
    $invertidos = array_reverse($ids);
    $id = criarTorneioPreset($db, 'misto', 'teste', null, null, $invertidos);
    assertEqualsT($invertidos, array_map(fn($r) => (int)$r['time_id'], calcularClassificacao($db, $id)), 'classificação zerada na ordem dos seeds');
    echo "OK: test_pior8_desempate_final_pelo_numero_do_time
";
}

function test_pior8_confronto_direto_grupo_decide_quando_ha_vencedor(): void {
    // Três empatados; o 3 venceu os dois → 1º no grupo; 2 venceu o 1 → 2º; 1 → 3º.
    $base = ['j' => 7, 'v' => 3, 'e' => 1, 'd' => 3, 'gp' => 10, 'gc' => 10, 'sg' => 0, 'faltas' => 2, 'pontos' => 10.0, 'buchholz' => 0];
    $linhas = array_map(fn($tid) => $base + ['time_id' => $tid, 'nome' => "T$tid"], [1, 2, 3]);
    $jogos = [[3, 1, 2, 1], [3, 2, 2, 1], [2, 1, 2, 1]];
    [$ordenado] = ordenarClassificacaoPorGrupos($linhas, ['pontos', 'saldo', 'confronto_direto_grupo', 'sorteio'], $jogos, ['pontos_vitoria' => 3, 'pontos_empate' => 1, 'pontos_derrota' => 0]);
    assertEqualsT([3, 2, 1], array_map(fn($r) => $r['time_id'], $ordenado), 'mini-tabela ordena o grupo empatado');
    echo "OK: test_pior8_confronto_direto_grupo_decide_quando_ha_vencedor\n";
}
