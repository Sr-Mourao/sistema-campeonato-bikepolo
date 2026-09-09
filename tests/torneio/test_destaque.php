<?php
// resolverPartidaDestaque/resolverProximoJogo — seção 23 do brief "acabamento 3":
// status manda mais que ordem de programação. Testes 1-7.

function criarJogoTeste(PDO $db, int $torneioId, int $faseId, string $codigo, int $ordem, int $timeA, int $timeB, string $status, array $extra = []): int {
    $campos = array_merge([
        'placar_a' => null, 'placar_b' => null, 'horario_previsto' => null,
        'horario_inicio_real' => null, 'horario_fim_real' => null,
    ], $extra);
    $db->prepare("
        INSERT INTO torneio_jogos (torneio_id, fase_id, codigo, ordem, time_a_id, time_b_id, status, placar_a, placar_b, horario_previsto, horario_inicio_real, horario_fim_real)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ")->execute([$torneioId, $faseId, $codigo, $ordem, $timeA, $timeB, $status, $campos['placar_a'], $campos['placar_b'], $campos['horario_previsto'], $campos['horario_inicio_real'], $campos['horario_fim_real']]);
    return (int)$db->lastInsertId();
}

function prepararTorneioComFase(PDO $db): array {
    $ids = seedTimes($db, 6);
    $torneioId = criarTorneioPreset($db, 'misto', 'teste');
    $db->prepare("INSERT INTO torneio_fases (torneio_id, tipo, rodada, rotulo, estado, conta_classificacao) VALUES (?, 'swiss', 1, 'R1', 'confirmada', 1)")->execute([$torneioId]);
    $faseId = (int)$db->lastInsertId();
    return [$torneioId, $faseId, $ids];
}

// TESTE 1: jogo anterior agendado + jogo posterior em_andamento -> mostra em_andamento
function test_destaque_em_andamento_vence_agendado_anterior(): void {
    $db = testDb();
    [$torneioId, $faseId, $t] = prepararTorneioComFase($db);
    criarJogoTeste($db, $torneioId, $faseId, 'J1', 1, $t[0], $t[1], 'agendado');
    $j2 = criarJogoTeste($db, $torneioId, $faseId, 'J2', 2, $t[2], $t[3], 'em_andamento', ['horario_inicio_real' => '2026-09-05 13:40:00']);

    $res = resolverPartidaDestaque($db, $torneioId);
    assertEqualsT($j2, $res['jogo']['id'], 'Em andamento deve vencer agendado anterior na ordem');
    echo "OK: test_destaque_em_andamento_vence_agendado_anterior\n";
}

// TESTE 2: jogo anterior atrasado + jogo posterior em_andamento -> mostra em_andamento
function test_destaque_em_andamento_vence_atrasado_anterior(): void {
    $db = testDb();
    [$torneioId, $faseId, $t] = prepararTorneioComFase($db);
    criarJogoTeste($db, $torneioId, $faseId, 'J1', 1, $t[0], $t[1], 'atrasado');
    $j2 = criarJogoTeste($db, $torneioId, $faseId, 'J2', 2, $t[2], $t[3], 'em_andamento', ['horario_inicio_real' => '2026-09-05 13:40:00']);

    $res = resolverPartidaDestaque($db, $torneioId);
    assertEqualsT($j2, $res['jogo']['id'], 'Em andamento deve vencer atrasado anterior na ordem');
    echo "OK: test_destaque_em_andamento_vence_atrasado_anterior\n";
}

// TESTE 3: atrasado nunca é destaque — o placar segue para o próximo agendado.
// Marcar "atrasado" é a forma de pular o jogo sem precisar iniciar o seguinte.
function test_destaque_atrasado_nao_e_candidato(): void {
    $db = testDb();
    [$torneioId, $faseId, $t] = prepararTorneioComFase($db);
    criarJogoTeste($db, $torneioId, $faseId, 'J1', 1, $t[0], $t[1], 'atrasado', ['horario_previsto' => '2026-09-05 12:00:00']);
    $j2 = criarJogoTeste($db, $torneioId, $faseId, 'J2', 2, $t[2], $t[3], 'agendado', ['horario_previsto' => '2026-09-05 12:30:00']);
    criarJogoTeste($db, $torneioId, $faseId, 'J3', 3, $t[4], $t[5], 'agendado', ['horario_previsto' => '2026-09-05 13:00:00']);

    $res = resolverPartidaDestaque($db, $torneioId);
    assertEqualsT($j2, $res['jogo']['id'], 'Atrasado anterior não pode bloquear o próximo agendado');
    echo "OK: test_destaque_atrasado_nao_e_candidato\n";
}

// TESTE 3b: vários atrasados seguidos -> pula todos e vai no primeiro agendado
function test_destaque_pula_todos_os_atrasados(): void {
    $db = testDb();
    [$torneioId, $faseId, $t] = prepararTorneioComFase($db);
    criarJogoTeste($db, $torneioId, $faseId, 'J1', 1, $t[0], $t[1], 'atrasado');
    criarJogoTeste($db, $torneioId, $faseId, 'J2', 2, $t[2], $t[3], 'atrasado');
    $j3 = criarJogoTeste($db, $torneioId, $faseId, 'J3', 3, $t[4], $t[5], 'agendado');

    $res = resolverPartidaDestaque($db, $torneioId);
    assertEqualsT($j3, $res['jogo']['id'], 'Dois atrasados seguidos devem ser ignorados');
    echo "OK: test_destaque_pula_todos_os_atrasados\n";
}

// TESTE 3c: atrasado volta a ser jogado -> em_andamento reassume o destaque na hora
function test_destaque_atrasado_que_vira_em_andamento_reassume(): void {
    $db = testDb();
    [$torneioId, $faseId, $t] = prepararTorneioComFase($db);
    $j1 = criarJogoTeste($db, $torneioId, $faseId, 'J1', 1, $t[0], $t[1], 'atrasado');
    $j2 = criarJogoTeste($db, $torneioId, $faseId, 'J2', 2, $t[2], $t[3], 'agendado');

    assertEqualsT($j2, resolverPartidaDestaque($db, $torneioId)['jogo']['id'], 'Sanity check: começa no agendado');

    atualizarPartida($db, $torneioId, $j1, ['status' => 'em_andamento'], 'mesa');
    assertEqualsT($j1, resolverPartidaDestaque($db, $torneioId)['jogo']['id'], 'Ao virar em_andamento, o antes-atrasado reassume o destaque');
    echo "OK: test_destaque_atrasado_que_vira_em_andamento_reassume\n";
}

// TESTE 3d: sem em_andamento e sem agendado, só atrasado e encerrado -> fallback é a encerrada
function test_destaque_atrasado_nao_ganha_da_encerrada(): void {
    $db = testDb();
    [$torneioId, $faseId, $t] = prepararTorneioComFase($db);
    criarJogoTeste($db, $torneioId, $faseId, 'J1', 1, $t[0], $t[1], 'atrasado');
    $j2 = criarJogoTeste($db, $torneioId, $faseId, 'J2', 2, $t[2], $t[3], 'encerrado', ['placar_a' => 3, 'placar_b' => 2, 'horario_fim_real' => '2026-09-05 14:00:00']);

    $res = resolverPartidaDestaque($db, $torneioId);
    assertEqualsT($j2, $res['jogo']['id'], 'Sem agendado, o fallback é a última encerrada — nunca o atrasado');
    echo "OK: test_destaque_atrasado_nao_ganha_da_encerrada\n";
}

// TESTE 4: nenhum em_andamento/atrasado -> mostra o próximo agendado (ordem de calendário)
function test_destaque_proximo_agendado_quando_sem_em_andamento_ou_atrasado(): void {
    $db = testDb();
    [$torneioId, $faseId, $t] = prepararTorneioComFase($db);
    $j1 = criarJogoTeste($db, $torneioId, $faseId, 'J1', 1, $t[0], $t[1], 'agendado');
    criarJogoTeste($db, $torneioId, $faseId, 'J2', 2, $t[2], $t[3], 'agendado');

    $res = resolverPartidaDestaque($db, $torneioId);
    assertEqualsT($j1, $res['jogo']['id'], 'Deve escolher o agendado de menor ordem');
    echo "OK: test_destaque_proximo_agendado_quando_sem_em_andamento_ou_atrasado\n";
}

// TESTE 5: nenhuma partida futura -> fallback pra última encerrada
function test_destaque_fallback_ultima_encerrada(): void {
    $db = testDb();
    [$torneioId, $faseId, $t] = prepararTorneioComFase($db);
    criarJogoTeste($db, $torneioId, $faseId, 'J1', 1, $t[0], $t[1], 'encerrado', ['placar_a' => 2, 'placar_b' => 1, 'horario_fim_real' => '2026-09-05 13:00:00']);
    $j2 = criarJogoTeste($db, $torneioId, $faseId, 'J2', 2, $t[2], $t[3], 'encerrado', ['placar_a' => 0, 'placar_b' => 3, 'horario_fim_real' => '2026-09-05 14:00:00']);

    $res = resolverPartidaDestaque($db, $torneioId);
    assertEqualsT($j2, $res['jogo']['id'], 'Fallback deve ser a última encerrada (horario_fim_real mais recente)');
    echo "OK: test_destaque_fallback_ultima_encerrada\n";
}

// TESTE 6: mais de uma em_andamento -> pega a de início real mais recente e sinaliza
function test_destaque_multiplas_em_andamento_pega_mais_recente_e_sinaliza(): void {
    $db = testDb();
    [$torneioId, $faseId, $t] = prepararTorneioComFase($db);
    criarJogoTeste($db, $torneioId, $faseId, 'J1', 1, $t[0], $t[1], 'em_andamento', ['horario_inicio_real' => '2026-09-05 13:00:00']);
    $j2 = criarJogoTeste($db, $torneioId, $faseId, 'J2', 2, $t[2], $t[3], 'em_andamento', ['horario_inicio_real' => '2026-09-05 13:30:00']);

    $res = resolverPartidaDestaque($db, $torneioId);
    assertEqualsT($j2, $res['jogo']['id'], 'Deve escolher a de início real mais recente');
    assertTrue($res['multiplas_em_andamento'], 'Deve sinalizar múltiplas partidas em andamento');
    echo "OK: test_destaque_multiplas_em_andamento_pega_mais_recente_e_sinaliza\n";
}

// TESTE 7: resolverProximoJogo -> próximo agendado depois do destaque, nunca outro em_andamento
function test_proximo_jogo_e_o_proximo_agendado_depois_do_destaque(): void {
    $db = testDb();
    [$torneioId, $faseId, $t] = prepararTorneioComFase($db);
    criarJogoTeste($db, $torneioId, $faseId, 'J0', 0, $t[0], $t[1], 'agendado'); // antes do destaque — nunca é "próximo"
    $destaqueId = criarJogoTeste($db, $torneioId, $faseId, 'J1', 1, $t[0], $t[1], 'em_andamento', ['horario_inicio_real' => '2026-09-05 13:00:00']);
    $j2 = criarJogoTeste($db, $torneioId, $faseId, 'J2', 2, $t[2], $t[3], 'agendado');
    criarJogoTeste($db, $torneioId, $faseId, 'J3', 3, $t[4], $t[5], 'agendado');

    $res = resolverPartidaDestaque($db, $torneioId);
    assertEqualsT($destaqueId, $res['jogo']['id'], 'Sanity check: destaque deve ser o em_andamento');

    $proximo = resolverProximoJogo($res['todas'], $res['jogo']);
    assertEqualsT($j2, $proximo['id'], 'Próximo jogo deve ser o primeiro agendado depois do destaque, ignorando o que veio antes');
    echo "OK: test_proximo_jogo_e_o_proximo_agendado_depois_do_destaque\n";
}

// Aviso não-bloqueante (seção 3): iniciar uma partida com outra já em_andamento não bloqueia, só avisa.
function test_iniciar_partida_com_outra_ja_em_andamento_nao_bloqueia_mas_avisa(): void {
    $db = testDb();
    [$torneioId, $faseId, $t] = prepararTorneioComFase($db);
    $j1 = criarJogoTeste($db, $torneioId, $faseId, 'J1', 1, $t[0], $t[1], 'em_andamento', ['horario_inicio_real' => '2026-09-05 13:00:00']);
    $j2 = criarJogoTeste($db, $torneioId, $faseId, 'J2', 2, $t[2], $t[3], 'agendado');

    $r = atualizarPartida($db, $torneioId, $j2, ['status' => 'em_andamento'], 'mesa');
    assertEqualsT('em_andamento', $r['status'], 'Não deve bloquear o início da segunda partida');
    assertNotNullT($r['aviso'], 'Deve sinalizar aviso de outra partida já em andamento');
    echo "OK: test_iniciar_partida_com_outra_ja_em_andamento_nao_bloqueia_mas_avisa\n";
}

// Placar broadcast (brasões locais no destaque) — resolverPartidaDestaque() precisa
// devolver as colunas de logo (aditivas, mesma técnica de JOIN já existente com `times`)
// pra torneio-publico.php poder montar `time_a_logo`/`time_b_logo` cache-busted, sem
// nenhuma mudança na lógica de seleção da partida em si.
function test_destaque_traz_colunas_de_logo_dos_times(): void {
    $db = testDb();
    [$torneioId, $faseId, $t] = prepararTorneioComFase($db);
    $db->prepare("UPDATE times SET logo_path = '/imgs/times/999/logo.webp', logo_atualizado_em = '2026-01-01 10:00:00' WHERE id = ?")->execute([$t[0]]);

    criarJogoTeste($db, $torneioId, $faseId, 'J1', 1, $t[0], $t[1], 'em_andamento', ['horario_inicio_real' => '2026-09-05 13:00:00']);

    $res = resolverPartidaDestaque($db, $torneioId);
    assertEqualsT('/imgs/times/999/logo.webp', $res['jogo']['time_a_logo_path'], 'Coluna de logo do time A deve vir junto no destaque');
    assertEqualsT(null, $res['jogo']['time_b_logo_path'], 'Time sem logo deve vir null, nunca inventado');
    echo "OK: test_destaque_traz_colunas_de_logo_dos_times\n";
}

// A topologia da chave não define a fila: depois das quartas vêm B1/B2, só então SF1/SF2.
function test_destaque_double_respeita_ordem_operacional_oficial(): void {
    $db = testDb();
    $times = seedTimes($db, 8);
    $torneioId = criarTorneioPreset($db, 'misto', 'teste');
    $db->prepare("INSERT INTO torneio_fases (torneio_id, tipo, rodada, rotulo, estado, conta_classificacao) VALUES (?, 'double', NULL, 'Double', 'confirmada', 0)")->execute([$torneioId]);
    $faseId = (int)$db->lastInsertId();

    foreach (['QA', 'QB', 'QC', 'QD'] as $i => $codigo) {
        criarJogoTeste($db, $torneioId, $faseId, $codigo, ordemOperacionalDouble($codigo), $times[$i], $times[$i + 4], 'encerrado', [
            'placar_a' => 2, 'placar_b' => 1, 'horario_fim_real' => "2026-09-05 1{$i}:00:00",
        ]);
    }

    // Inserção propositalmente na ordem visual da Winners antes da Losers. Quem manda
    // na consulta deve ser `ordem`, não a posição/ordem de criação na árvore.
    $sf1 = criarJogoTeste($db, $torneioId, $faseId, 'SF1', ordemOperacionalDouble('SF1'), $times[0], $times[1], 'agendado');
    criarJogoTeste($db, $torneioId, $faseId, 'SF2', ordemOperacionalDouble('SF2'), $times[2], $times[3], 'agendado');
    $b1 = criarJogoTeste($db, $torneioId, $faseId, 'B1', ordemOperacionalDouble('B1'), $times[4], $times[5], 'agendado');
    $b2 = criarJogoTeste($db, $torneioId, $faseId, 'B2', ordemOperacionalDouble('B2'), $times[6], $times[7], 'agendado');

    assertEqualsT($b1, resolverPartidaDestaque($db, $torneioId)['jogo']['id'], 'Quartas encerradas: B1 deve preceder SF1 já preenchida');
    $db->prepare("UPDATE torneio_jogos SET status = 'encerrado', placar_a = 2, placar_b = 1, vencedor_time_id = time_a_id WHERE id = ?")->execute([$b1]);
    assertEqualsT($b2, resolverPartidaDestaque($db, $torneioId)['jogo']['id'], 'B1 encerrada: B2 deve ser a próxima');
    $db->prepare("UPDATE torneio_jogos SET status = 'encerrado', placar_a = 2, placar_b = 1, vencedor_time_id = time_a_id WHERE id = ?")->execute([$b2]);
    assertEqualsT($sf1, resolverPartidaDestaque($db, $torneioId)['jogo']['id'], 'B2 encerrada: SF1 deve ser a próxima');

    // STATUS > ORDEM continua intacto, inclusive numa operação manual fora da fila.
    $db->prepare("UPDATE torneio_jogos SET status = 'agendado' WHERE id IN (?, ?)")->execute([$b1, $b2]);
    $db->prepare("UPDATE torneio_jogos SET status = 'em_andamento', horario_inicio_real = '2026-09-05 18:00:00' WHERE id = ?")->execute([$sf1]);
    assertEqualsT($sf1, resolverPartidaDestaque($db, $torneioId)['jogo']['id'], 'SF1 manualmente em andamento deve prevalecer sobre B1/B2 agendadas');
    echo "OK: test_destaque_double_respeita_ordem_operacional_oficial\n";
}

function test_ordem_operacional_double_e_explicita_e_normaliza_chaves_existentes(): void {
    $esperada = ['QA', 'QB', 'QC', 'QD', 'B1', 'B2', 'SF1', 'SF2', 'B3', 'B4', 'FA', 'B5', 'B6', 'GF', 'GF2'];
    assertEqualsT(range(1, 15), array_map('ordemOperacionalDouble', $esperada), 'Sequência oficial deve ser explícita e completa');

    $db = testDb();
    $times = seedTimes($db, 2);
    $torneioId = criarTorneioPreset($db, 'misto', 'teste');
    $db->prepare("INSERT INTO torneio_fases (torneio_id, tipo, rodada, rotulo, estado, conta_classificacao) VALUES (?, 'double', NULL, 'Double antiga', 'confirmada', 0)")->execute([$torneioId]);
    $faseId = (int)$db->lastInsertId();
    criarJogoTeste($db, $torneioId, $faseId, 'SF1', 5, $times[0], $times[1], 'agendado');
    criarJogoTeste($db, $torneioId, $faseId, 'B1', 8, $times[0], $times[1], 'agendado');

    normalizarOrdemOperacionalDouble($db, $torneioId);
    $rows = $db->query("SELECT codigo, ordem FROM torneio_jogos ORDER BY ordem")->fetchAll();
    assertEqualsT([['codigo' => 'B1', 'ordem' => 5], ['codigo' => 'SF1', 'ordem' => 7]], $rows, 'Backfill deve corrigir somente a ordem operacional da Double existente');
    echo "OK: test_ordem_operacional_double_e_explicita_e_normaliza_chaves_existentes\n";
}
