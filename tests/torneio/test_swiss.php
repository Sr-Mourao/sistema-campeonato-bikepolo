<?php
// 13 times, 4 rodadas suíças — regras centrais da fase 1 (brief seção 4 e 19).

function test_swiss_13_times_4_rodadas(): void {
    $db = testDb();
    $timeIds = seedTimes($db, 13);
    $torneioId = criarTorneioPreset($db, 'misto', 'teste', null, 'misto_swiss_13');

    $byesVistos = [];
    for ($r = 1; $r <= 4; $r++) {
        $sugestao = sugerirPareamentoSwiss($db, $torneioId, $r);

        assertEqualsT(6, count($sugestao['pares']), "Rodada $r deve sugerir 6 partidas");
        assertNotNullT($sugestao['bye']['time_id'], "Rodada $r deve ter um bye");
        assertFalse(in_array($sugestao['bye']['time_id'], $byesVistos, true), "Time não pode receber bye duas vezes (rodada $r)");
        $byesVistos[] = $sugestao['bye']['time_id'];

        // Nenhum time deve aparecer duas vezes nos pares, e o bye não pode estar nos pares
        $vistos = [];
        foreach ($sugestao['pares'] as $par) {
            foreach ([$par['time_a_id'], $par['time_b_id']] as $tid) {
                assertFalse(in_array($tid, $vistos, true), "Time $tid duplicado no pareamento da rodada $r");
                assertFalse($tid === $sugestao['bye']['time_id'], "Time do bye não pode estar pareado na rodada $r");
                $vistos[] = $tid;
            }
        }
        assertEqualsT(12, count($vistos), "Rodada $r deve envolver 12 times pareados + 1 bye = 13");

        confirmarRodadaSwiss($db, $torneioId, $r, $sugestao['bye'], $sugestao['pares'], 'teste');

        // 6 jogos reais + 1 linha de bye = 7 registros em torneio_jogos pra essa rodada
        $stmt = $db->prepare("
            SELECT COUNT(*) FROM torneio_jogos j JOIN torneio_fases f ON f.id = j.fase_id
            WHERE j.torneio_id = ? AND f.tipo = 'swiss' AND f.rodada = ?
        ");
        $stmt->execute([$torneioId, $r]);
        assertEqualsT(7, (int)$stmt->fetchColumn(), "Rodada $r deve ter 6 jogos + 1 bye persistidos");

        // Encerra os 6 jogos reais com placar aleatório plausível pra próxima rodada poder recalcular
        $stmt = $db->prepare("
            SELECT j.id FROM torneio_jogos j JOIN torneio_fases f ON f.id = j.fase_id
            WHERE j.torneio_id = ? AND f.tipo = 'swiss' AND f.rodada = ? AND j.is_bye = 0
        ");
        $stmt->execute([$torneioId, $r]);
        foreach ($stmt->fetchAll() as $row) {
            [$a, $b] = placarAleatorio(true);
            atualizarPartida($db, $torneioId, (int)$row['id'], ['status' => 'encerrado', 'placar_a' => $a, 'placar_b' => $b], 'teste');
        }
    }

    assertEqualsT(4, count($byesVistos), "Devem ser exatamente 4 times diferentes recebendo bye");
    assertEqualsT(4, count(array_unique($byesVistos)), "Os 4 byes devem ser de times distintos");

    // Após as 4 rodadas: os 4 times com bye têm 3 jogos reais, os outros 9 têm 4.
    $classificacao = calcularClassificacao($db, $torneioId);
    assertEqualsT(13, count($classificacao), "Classificação deve ter os 13 times");
    $com3 = array_filter($classificacao, fn($t) => $t['j'] === 3);
    $com4 = array_filter($classificacao, fn($t) => $t['j'] === 4);
    assertEqualsT(4, count($com3), "4 times devem ter exatamente 3 jogos (os que receberam bye)");
    assertEqualsT(9, count($com4), "9 times devem ter exatamente 4 jogos");
    foreach ($com3 as $t) assertTrue(in_array($t['time_id'], $byesVistos, true), "Time com 3 jogos deve ser um dos que recebeu bye");

    // Bye vale 0: nenhum time deve ter pontos/gols vindos do bye em si (checado indiretamente:
    // soma de J de todos os times reais == 2 * (jogos reais realizados), sem sobra do bye)
    $totalJ = array_sum(array_column($classificacao, 'j'));
    assertEqualsT((9 * 4 + 4 * 3), $totalJ, "Soma de jogos J não pode incluir os byes");

    echo "OK: test_swiss_13_times_4_rodadas\n";
}

function test_swiss_rodada1_seed(): void {
    $db = testDb();
    seedTimes($db, 13);
    $torneioId = criarTorneioPreset($db, 'misto', 'teste', null, 'misto_swiss_13');
    $sugestao = sugerirPareamentoSwiss($db, $torneioId, 1, ['modo' => 'seed']);
    assertEqualsT(6, count($sugestao['pares']), "Rodada 1 por seed deve gerar 6 pares");
    // 1x2, 3x4 ... (seed 13 fica de bye, último da lista)
    assertEqualsT(1, $sugestao['pares'][0]['time_a_id'], "Primeiro par deve começar pelo seed 1");
    echo "OK: test_swiss_rodada1_seed\n";
}

function test_swiss_rematch_evitado_no_caso_normal(): void {
    $db = testDb();
    seedTimes($db, 13);
    $torneioId = criarTorneioPreset($db, 'misto', 'teste', null, 'misto_swiss_13');
    $paresJaVistos = [];
    for ($r = 1; $r <= 4; $r++) {
        $sugestao = sugerirPareamentoSwiss($db, $torneioId, $r);
        foreach ($sugestao['pares'] as $par) {
            $key = min($par['time_a_id'], $par['time_b_id']) . '-' . max($par['time_a_id'], $par['time_b_id']);
            assertFalse(isset($paresJaVistos[$key]), "Rodada $r não deveria repetir confronto $key — 13 times/4 rodadas sempre tem solução sem revanche");
            $paresJaVistos[$key] = true;
        }
        confirmarRodadaSwiss($db, $torneioId, $r, $sugestao['bye'], $sugestao['pares'], 'teste');
        $stmt = $db->prepare("SELECT j.id FROM torneio_jogos j JOIN torneio_fases f ON f.id=j.fase_id WHERE j.torneio_id=? AND f.rodada=? AND f.tipo='swiss' AND j.is_bye=0");
        $stmt->execute([$torneioId, $r]);
        foreach ($stmt->fetchAll() as $row) {
            atualizarPartida($db, $torneioId, (int)$row['id'], ['status' => 'encerrado', 'placar_a' => 3, 'placar_b' => 1], 'teste');
        }
    }
    echo "OK: test_swiss_rematch_evitado_no_caso_normal\n";
}

function test_swiss_rematch_inevitavel_e_sinalizado(): void {
    // Pool minúsculo e artificial onde TODOS os confrontos possíveis já ocorreram —
    // não existe pareamento sem revanche. melhorPareamento() deve mesmo assim devolver
    // uma resposta determinística e sinalizar temRematch=true.
    $pool = [1, 2, 3, 4];
    $posicao = [1 => 0, 2 => 1, 3 => 2, 4 => 3];
    $historico = ['1-2' => true, '1-3' => true, '1-4' => true, '2-3' => true, '2-4' => true, '3-4' => true];

    [$pares, $custo, $temRematch] = melhorPareamento($pool, $posicao, $historico);
    assertTrue($temRematch, "Com todos os confrontos já jogados, deveria sinalizar revanche inevitável");
    assertEqualsT(2, count($pares), "Deve retornar 2 pares mesmo em cenário sem solução limpa");

    echo "OK: test_swiss_rematch_inevitavel_e_sinalizado\n";
}

function test_swiss_bye_forcado_manual_com_aviso(): void {
    $db = testDb();
    $timeIds = seedTimes($db, 13);
    $torneioId = criarTorneioPreset($db, 'misto', 'teste', null, 'misto_swiss_13');

    $sug1 = sugerirPareamentoSwiss($db, $torneioId, 1);
    confirmarRodadaSwiss($db, $torneioId, 1, $sug1['bye'], $sug1['pares'], 'teste');
    $stmt = $db->prepare("SELECT j.id FROM torneio_jogos j JOIN torneio_fases f ON f.id=j.fase_id WHERE j.torneio_id=? AND f.rodada=1 AND j.is_bye=0");
    $stmt->execute([$torneioId]);
    foreach ($stmt->fetchAll() as $row) {
        atualizarPartida($db, $torneioId, (int)$row['id'], ['status' => 'encerrado', 'placar_a' => 2, 'placar_b' => 0], 'teste');
    }

    $byeR1 = $sug1['bye']['time_id'];
    $sug2 = sugerirPareamentoSwiss($db, $torneioId, 2, ['bye_time_id' => $byeR1]);
    assertEqualsT($byeR1, $sug2['bye']['time_id'], "Override manual de bye deve ser respeitado");
    assertTrue(count($sug2['avisos']) > 0, "Forçar bye repetido deve gerar aviso explícito");

    echo "OK: test_swiss_bye_forcado_manual_com_aviso\n";
}
