<?php
// Súmula digital: gols (normal/sem_autoria/gol_contra), faltas, elegibilidade, undo.
// Brief de simplificação — seções 6, 7, 11, 12, 15 (testes 1-7, 11).

function prepararJogoDeTeste(PDO $db): array {
    $ids = seedTimes($db, 2);
    $torneioId = criarTorneioPreset($db, 'misto', 'teste', null, 'misto_swiss_13');
    $db->prepare("INSERT INTO torneio_fases (torneio_id, tipo, rodada, rotulo, estado, conta_classificacao) VALUES (?, 'swiss', 1, 'R1', 'confirmada', 1)")->execute([$torneioId]);
    $faseId = (int)$db->lastInsertId();
    $db->prepare("INSERT INTO torneio_jogos (torneio_id, fase_id, codigo, time_a_id, time_b_id, status) VALUES (?, ?, 'J1', ?, ?, 'agendado')")
       ->execute([$torneioId, $faseId, $ids[0], $ids[1]]);
    $jogoId = (int)$db->lastInsertId();
    return [$torneioId, $jogoId, $ids[0], $ids[1]];
}

/** Cancela a inscrição de um membro (pra testar elegibilidade). */
function cancelarMembro(PDO $db, int $membroId): void {
    $stmt = $db->prepare("SELECT inscricao_id FROM membros_time WHERE id = ?");
    $stmt->execute([$membroId]);
    $inscricaoId = $stmt->fetchColumn();
    $db->prepare("UPDATE inscricoes SET status = 'cancelado' WHERE id = ?")->execute([$inscricaoId]);
}

function test_gol_normal_falta_e_undo(): void {
    $db = testDb();
    [$torneioId, $jogoId, $timeA, $timeB] = prepararJogoDeTeste($db);
    $membroA = primeiroMembroDoTime($db, $timeA);

    $gol = registrarGol($db, $torneioId, $jogoId, $timeA, $membroA, 'normal', 5, 'mesa');
    assertNotNullT($gol['evento_id'], 'Gol deve ser registrado com id');

    $falta = registrarFalta($db, $torneioId, $jogoId, $timeA, $membroA, 'mesa');
    assertNotNullT($falta['evento_id'], 'Falta deve ser registrada com id');

    $placar = recalcularPlacarDeEventos($db, $torneioId, $jogoId);
    assertEqualsT(1, $placar['placar_a'], 'Placar A deve refletir 1 gol registrado');
    assertEqualsT(0, $placar['placar_b'], 'Placar B deve ser 0');

    // Undo do gol — placar recalculado deve voltar a 0
    removerEvento($db, $torneioId, 'gol', $gol['evento_id'], 'mesa');
    $placar2 = recalcularPlacarDeEventos($db, $torneioId, $jogoId);
    assertEqualsT(0, $placar2['placar_a'], 'Após desfazer o gol, placar deve voltar a 0');

    // Falta removida não deve mais contar no Fair Play
    removerEvento($db, $torneioId, 'falta', $falta['evento_id'], 'mesa');
    atualizarPartida($db, $torneioId, $jogoId, ['status' => 'encerrado', 'placar_a' => 0, 'placar_b' => 0], 'mesa');
    $classificacao = calcularClassificacao($db, $torneioId);
    $porId = array_column($classificacao, null, 'time_id');
    assertEqualsT(0, $porId[$timeA]['faltas'], 'Falta desfeita não pode contar no Fair Play');

    echo "OK: test_gol_normal_falta_e_undo\n";
}

// TESTE 4: gol normal atualiza placar E artilharia
function test_gol_normal_atualiza_placar_e_artilharia(): void {
    $db = testDb();
    [$torneioId, $jogoId, $timeA] = prepararJogoDeTeste($db);
    $membroA = primeiroMembroDoTime($db, $timeA);
    registrarGol($db, $torneioId, $jogoId, $timeA, $membroA, 'normal', 5, 'mesa');
    atualizarPartida($db, $torneioId, $jogoId, ['status' => 'encerrado', 'placar_a' => 1, 'placar_b' => 0], 'mesa');

    $artilharia = calcularArtilharia($db, $torneioId, 'torneio');
    assertEqualsT(1, count($artilharia), 'Gol normal deve gerar 1 artilheiro');
    assertEqualsT($membroA, $artilharia[0]['membro_id'], 'Artilheiro deve ser o autor do gol normal');
    assertEqualsT(1, $artilharia[0]['gols'], 'Artilheiro deve ter 1 gol');
    echo "OK: test_gol_normal_atualiza_placar_e_artilharia\n";
}

// TESTE 5: sem_autoria atualiza placar mas NÃO artilharia individual
function test_gol_sem_autoria_nao_conta_artilharia(): void {
    $db = testDb();
    [$torneioId, $jogoId, $timeA] = prepararJogoDeTeste($db);
    $gol = registrarGol($db, $torneioId, $jogoId, $timeA, null, 'sem_autoria', null, 'mesa');
    assertNotNullT($gol['evento_id'], '"Sem autoria" deve ser permitido sem membro_id');

    $placar = recalcularPlacarDeEventos($db, $torneioId, $jogoId);
    assertEqualsT(1, $placar['placar_a'], 'Sem autoria ainda soma no placar do time');

    $artilharia = calcularArtilharia($db, $torneioId, 'torneio');
    assertEqualsT(0, count($artilharia), 'Gol sem autoria NÃO pode gerar artilheiro individual');
    echo "OK: test_gol_sem_autoria_nao_conta_artilharia\n";
}

// TESTE 6: gol contra soma pro time beneficiado, nunca conta artilharia, e não exige autor
function test_gol_contra_beneficia_time_sem_artilharia(): void {
    $db = testDb();
    [$torneioId, $jogoId, , $timeB] = prepararJogoDeTeste($db);
    $gol = registrarGol($db, $torneioId, $jogoId, $timeB, null, 'gol_contra', null, 'mesa');
    assertNotNullT($gol['evento_id'], 'Gol contra deve ser aceito sem autor (simplificação)');

    $placar = recalcularPlacarDeEventos($db, $torneioId, $jogoId);
    assertEqualsT(1, $placar['placar_b'], 'Gol contra deve somar pro time beneficiado (B)');

    $artilharia = calcularArtilharia($db, $torneioId, 'torneio');
    assertEqualsT(0, count($artilharia), 'Gol contra nunca pode gerar artilheiro individual');
    echo "OK: test_gol_contra_beneficia_time_sem_artilharia\n";
}

function test_gol_normal_exige_autor(): void {
    $db = testDb();
    [$torneioId, $jogoId, $timeA] = prepararJogoDeTeste($db);
    assertThrowsT(
        fn() => registrarGol($db, $torneioId, $jogoId, $timeA, null, 'normal', null, 'mesa'),
        'Gol tipo normal deve exigir um atleta selecionado'
    );
    echo "OK: test_gol_normal_exige_autor\n";
}

function test_atleta_nao_pode_marcar_por_time_que_nao_e_dele(): void {
    $db = testDb();
    [$torneioId, $jogoId, $timeA, $timeB] = prepararJogoDeTeste($db);
    $membroDoTimeB = primeiroMembroDoTime($db, $timeB);
    assertThrowsT(
        fn() => registrarGol($db, $torneioId, $jogoId, $timeA, $membroDoTimeB, 'normal', null, 'mesa'),
        'Atleta do time B não pode marcar gol pelo time A'
    );
    echo "OK: test_atleta_nao_pode_marcar_por_time_que_nao_e_dele\n";
}

function test_time_precisa_estar_na_partida(): void {
    $db = testDb();
    [$torneioId, $jogoId] = prepararJogoDeTeste($db);
    $outroTime = seedTimes($db, 1)[0];
    assertThrowsT(
        fn() => registrarGol($db, $torneioId, $jogoId, $outroTime, null, 'sem_autoria', null, 'mesa'),
        'Time que não está na partida não pode registrar gol'
    );
    echo "OK: test_time_precisa_estar_na_partida\n";
}

// TESTE 1: jogador cancelado não aparece na súmula
function test_jogador_cancelado_nao_aparece_na_sumula(): void {
    $db = testDb();
    [$torneioId, $jogoId, $timeA] = prepararJogoDeTeste($db);
    $membroA = primeiroMembroDoTime($db, $timeA);
    cancelarMembro($db, $membroA);

    $sumula = getElencoPartida($db, $torneioId, $jogoId);
    $idsNoElenco = array_column($sumula['elenco'], 'membro_id');
    assertFalse(in_array($membroA, $idsNoElenco, true), 'Atleta com inscrição cancelada não pode aparecer no elenco da súmula');
    echo "OK: test_jogador_cancelado_nao_aparece_na_sumula\n";
}

// Roster público do time (área pública, seções 17-19 do brief) — mesma regra de
// elegibilidade de getElencoPartida(), agora sem depender de uma partida específica.
function test_get_elenco_time_esconde_jogador_cancelado(): void {
    $db = testDb();
    [, , $timeA] = prepararJogoDeTeste($db);
    $membroA = primeiroMembroDoTime($db, $timeA);
    cancelarMembro($db, $membroA);

    $elenco = getElencoTime($db, $timeA);
    $ids = array_column($elenco, 'membro_id');
    assertFalse(in_array($membroA, $ids, true), 'Atleta com inscrição cancelada não pode aparecer no roster público do time');
    echo "OK: test_get_elenco_time_esconde_jogador_cancelado\n";
}

// TESTE 2: API rejeita gol pra jogador cancelado, mesmo se o front tentar
function test_api_rejeita_gol_para_jogador_cancelado(): void {
    $db = testDb();
    [$torneioId, $jogoId, $timeA] = prepararJogoDeTeste($db);
    $membroA = primeiroMembroDoTime($db, $timeA);
    cancelarMembro($db, $membroA);

    assertThrowsT(
        fn() => registrarGol($db, $torneioId, $jogoId, $timeA, $membroA, 'normal', null, 'mesa'),
        'Não pode registrar gol pra atleta com inscrição cancelada'
    );
    echo "OK: test_api_rejeita_gol_para_jogador_cancelado\n";
}

// TESTE 3: API rejeita falta pra jogador cancelado
function test_api_rejeita_falta_para_jogador_cancelado(): void {
    $db = testDb();
    [$torneioId, $jogoId, $timeA] = prepararJogoDeTeste($db);
    $membroA = primeiroMembroDoTime($db, $timeA);
    cancelarMembro($db, $membroA);

    assertThrowsT(
        fn() => registrarFalta($db, $torneioId, $jogoId, $timeA, $membroA, 'mesa'),
        'Não pode registrar falta pra atleta com inscrição cancelada'
    );
    echo "OK: test_api_rejeita_falta_para_jogador_cancelado\n";
}

// TESTE 7: falta atualiza total do time, do jogador, fair play e standings (quando critério ativo)
function test_falta_atualiza_time_jogador_fairplay_e_standings(): void {
    $db = testDb();
    [$torneioId, $jogoId, $timeA, $timeB] = prepararJogoDeTeste($db);
    $membroA = primeiroMembroDoTime($db, $timeA);
    registrarFalta($db, $torneioId, $jogoId, $timeA, $membroA, 'mesa');
    registrarFalta($db, $torneioId, $jogoId, $timeA, $membroA, 'mesa');
    atualizarPartida($db, $torneioId, $jogoId, ['status' => 'encerrado', 'placar_a' => 1, 'placar_b' => 1], 'mesa');

    $fairplay = calcularFairPlayTimes($db, $torneioId, 'torneio');
    $porId = array_column($fairplay, null, 'time_id');
    assertEqualsT(2, $porId[$timeA]['faltas'], 'Fair play do time A deve contar as 2 faltas');
    assertEqualsT(0, $porId[$timeB]['faltas'], 'Time B não deve ter faltas');

    $individuais = calcularFaltasIndividuais($db, $torneioId, 'torneio');
    assertEqualsT(1, count($individuais), 'Deve haver 1 jogador com faltas registradas');
    assertEqualsT(2, $individuais[0]['faltas'], 'Jogador deve ter 2 faltas');

    salvarCriterios($db, $torneioId, ['pontos', 'fair_play']);
    $classificacao = calcularClassificacao($db, $torneioId);
    $porIdC = array_column($classificacao, null, 'time_id');
    assertEqualsT(2, $porIdC[$timeA]['faltas'], 'Standings deve refletir as faltas do time A');
    assertTrue($porIdC[$timeB]['posicao'] < $porIdC[$timeA]['posicao'], 'Com Fair Play habilitado e pontos iguais, o time com menos faltas (B) fica acima');

    echo "OK: test_falta_atualiza_time_jogador_fairplay_e_standings\n";
}

function test_estatisticas_padrao_somam_todas_as_fases(): void {
    $db = testDb();
    [$torneioId, $jogoClassificatorio, $timeA, $timeB] = prepararJogoDeTeste($db);
    $membroA = primeiroMembroDoTime($db, $timeA);

    registrarGol($db, $torneioId, $jogoClassificatorio, $timeA, $membroA, 'normal', null, 'mesa');
    registrarFalta($db, $torneioId, $jogoClassificatorio, $timeA, $membroA, 'mesa');
    atualizarPartida($db, $torneioId, $jogoClassificatorio, ['status' => 'encerrado', 'placar_a' => 1, 'placar_b' => 0], 'mesa');

    $db->prepare("INSERT INTO torneio_fases (torneio_id, tipo, rotulo, estado, conta_classificacao) VALUES (?, 'double', 'Double', 'confirmada', 0)")
       ->execute([$torneioId]);
    $faseEliminatoria = (int)$db->lastInsertId();
    $db->prepare("INSERT INTO torneio_jogos (torneio_id, fase_id, codigo, time_a_id, time_b_id, status) VALUES (?, ?, 'GF', ?, ?, 'agendado')")
       ->execute([$torneioId, $faseEliminatoria, $timeA, $timeB]);
    $jogoEliminatorio = (int)$db->lastInsertId();

    registrarGol($db, $torneioId, $jogoEliminatorio, $timeA, $membroA, 'normal', null, 'mesa');
    registrarFalta($db, $torneioId, $jogoEliminatorio, $timeA, $membroA, 'mesa');
    atualizarPartida($db, $torneioId, $jogoEliminatorio, ['status' => 'encerrado', 'placar_a' => 1, 'placar_b' => 0], 'mesa');

    $artilharia = calcularArtilharia($db, $torneioId);
    $faltasIndividuais = calcularFaltasIndividuais($db, $torneioId);
    $fairPlay = array_column(calcularFairPlayTimes($db, $torneioId), null, 'time_id');
    assertEqualsT(2, $artilharia[0]['gols'], 'Artilharia padrão deve somar primeira fase e eliminatórias');
    assertEqualsT(2, $faltasIndividuais[0]['faltas'], 'Faltas individuais padrão devem somar primeira fase e eliminatórias');
    assertEqualsT(2, $fairPlay[$timeA]['faltas'], 'Fair Play padrão deve somar faltas de todas as fases');
    assertEqualsT(2, $fairPlay[$timeA]['jogos'], 'Média do Fair Play deve considerar jogos de todas as fases');

    $artilhariaClassificatoria = calcularArtilharia($db, $torneioId, 'classificatoria');
    $faltasClassificatoria = calcularFaltasIndividuais($db, $torneioId, 'classificatoria');
    assertEqualsT(1, $artilhariaClassificatoria[0]['gols'], 'Filtro explícito da classificatória deve continuar disponível');
    assertEqualsT(1, $faltasClassificatoria[0]['faltas'], 'Filtro explícito da classificatória deve continuar disponível');

    echo "OK: test_estatisticas_padrao_somam_todas_as_fases\n";
}

function test_get_elenco_partida_monta_sumula(): void {
    $db = testDb();
    [$torneioId, $jogoId, $timeA, $timeB] = prepararJogoDeTeste($db);
    $membroA = primeiroMembroDoTime($db, $timeA);
    $membroB = primeiroMembroDoTime($db, $timeB);
    registrarGol($db, $torneioId, $jogoId, $timeA, $membroA, 'normal', 5, 'mesa');
    registrarFalta($db, $torneioId, $jogoId, $timeB, $membroB, 'mesa');

    $sumula = getElencoPartida($db, $torneioId, $jogoId);
    assertTrue(count($sumula['elenco']) >= 8, 'Elenco deve trazer os atletas dos dois times');
    assertEqualsT(2, count($sumula['eventos']), 'Deve haver 2 eventos (1 gol + 1 falta) ordenados por horário');
    $categorias = array_column($sumula['eventos'], 'categoria');
    assertTrue(in_array('gol', $categorias, true) && in_array('falta', $categorias, true), 'Eventos devem incluir gol e falta');

    echo "OK: test_get_elenco_partida_monta_sumula\n";
}

// TESTE 11: corrigir uma partida antiga recalcula tudo que depende dela
function test_undo_placar_reabre_partida_sem_vencedor_travado(): void {
    $db = testDb();
    [$torneioId, $jogoId] = prepararJogoDeTeste($db);
    atualizarPartida($db, $torneioId, $jogoId, ['status' => 'encerrado', 'placar_a' => 2, 'placar_b' => 1], 'mesa');
    $jogo = getJogo($db, $torneioId, $jogoId);
    assertNotNullT($jogo['vencedor_time_id'], 'Após encerrar, deve haver vencedor');

    // Undo: reabre a partida (corrigir erro de mesa)
    atualizarPartida($db, $torneioId, $jogoId, ['status' => 'agendado'], 'mesa');
    $jogo2 = getJogo($db, $torneioId, $jogoId);
    assertEqualsT('agendado', $jogo2['status'], 'Status deve voltar a agendado');
    assertNullT($jogo2['vencedor_time_id'], 'Vencedor não pode ficar "travado" de um resultado desfeito');

    echo "OK: test_undo_placar_reabre_partida_sem_vencedor_travado\n";
}

function test_corrigir_partida_antiga_recalcula_dependentes(): void {
    $db = testDb();
    [$torneioId, $jogoId, $timeA, $timeB] = prepararJogoDeTeste($db);
    $membroA = primeiroMembroDoTime($db, $timeA);
    registrarGol($db, $torneioId, $jogoId, $timeA, $membroA, 'normal', null, 'mesa');
    atualizarPartida($db, $torneioId, $jogoId, ['status' => 'encerrado', 'placar_a' => 1, 'placar_b' => 0], 'mesa');

    $antes = calcularClassificacao($db, $torneioId);
    $porIdAntes = array_column($antes, null, 'time_id');
    assertEqualsT($timeA, $porIdAntes[$timeA]['time_id'], 'Sanity check');
    assertTrue($porIdAntes[$timeA]['pontos'] > $porIdAntes[$timeB]['pontos'], 'Time A deve estar na frente antes da correção');

    // Mesa errou: o resultado real era o oposto. Reabre e corrige.
    atualizarPartida($db, $torneioId, $jogoId, ['status' => 'agendado'], 'mesa');
    atualizarPartida($db, $torneioId, $jogoId, ['status' => 'encerrado', 'placar_a' => 0, 'placar_b' => 3], 'mesa');

    $depois = calcularClassificacao($db, $torneioId);
    $porIdDepois = array_column($depois, null, 'time_id');
    assertTrue($porIdDepois[$timeB]['pontos'] > $porIdDepois[$timeA]['pontos'], 'Depois de corrigir, o time B deve assumir a frente — standings recalculado a partir da mesma fonte de dados');

    echo "OK: test_corrigir_partida_antiga_recalcula_dependentes\n";
}
