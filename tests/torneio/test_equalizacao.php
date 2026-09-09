<?php
// Fase 2 — Equalização (brief seção 3 e 19).

function rodarSwissCompleto(PDO $db, int $torneioId): array {
    $byes = [];
    for ($r = 1; $r <= 4; $r++) {
        $sug = sugerirPareamentoSwiss($db, $torneioId, $r);
        $byes[] = $sug['bye']['time_id'];
        confirmarRodadaSwiss($db, $torneioId, $r, $sug['bye'], $sug['pares'], 'teste');
        $stmt = $db->prepare("SELECT j.id FROM torneio_jogos j JOIN torneio_fases f ON f.id=j.fase_id WHERE j.torneio_id=? AND f.rodada=? AND f.tipo='swiss' AND j.is_bye=0");
        $stmt->execute([$torneioId, $r]);
        foreach ($stmt->fetchAll() as $row) {
            [$a, $b] = placarAleatorio(true);
            atualizarPartida($db, $torneioId, (int)$row['id'], ['status' => 'encerrado', 'placar_a' => $a, 'placar_b' => $b], 'teste');
        }
    }
    return $byes;
}

function test_equalizacao_2_jogos_apenas_times_com_bye(): void {
    $db = testDb();
    seedTimes($db, 13);
    $torneioId = criarTorneioPreset($db, 'misto', 'teste');
    $byes = rodarSwissCompleto($db, $torneioId);

    $sugestao = sugerirEqualizacao($db, $torneioId);
    assertEqualsT(2, count($sugestao['pares']), 'Equalização deve sugerir exatamente 2 jogos');

    $timesNaEqualizacao = [];
    foreach ($sugestao['pares'] as $p) { $timesNaEqualizacao[] = $p['time_a_id']; $timesNaEqualizacao[] = $p['time_b_id']; }
    sort($timesNaEqualizacao); sort($byes);
    assertEqualsT($byes, $timesNaEqualizacao, 'Só os 4 times que tiveram bye devem estar na equalização');

    confirmarEqualizacao($db, $torneioId, $sugestao['pares'], 'teste');

    $classifAntes = calcularClassificacao($db, $torneioId);
    $porId = [];
    foreach ($classifAntes as $row) $porId[$row['time_id']] = $row;
    foreach ($byes as $tid) assertEqualsT(3, $porId[$tid]['j'], 'Antes de jogar a equalização, times com bye ainda têm 3 jogos');

    $stmt = $db->prepare("SELECT j.id FROM torneio_jogos j JOIN torneio_fases f ON f.id=j.fase_id WHERE j.torneio_id=? AND f.tipo='equalizacao'");
    $stmt->execute([$torneioId]);
    foreach ($stmt->fetchAll() as $row) {
        atualizarPartida($db, $torneioId, (int)$row['id'], ['status' => 'encerrado', 'placar_a' => 4, 'placar_b' => 2], 'teste');
    }

    $classifDepois = calcularClassificacao($db, $torneioId);
    assertEqualsT(13, count($classifDepois), 'Classificação continua com 13 times');
    foreach ($classifDepois as $row) {
        assertEqualsT(4, $row['j'], "Após a equalização TODOS os 13 times devem ter exatamente 4 jogos classificatórios (time {$row['time_id']} tem {$row['j']})");
    }

    echo "OK: test_equalizacao_2_jogos_apenas_times_com_bye\n";
}

function test_equalizacao_pareamento_1v2_3v4(): void {
    $db = testDb();
    seedTimes($db, 13);
    $torneioId = criarTorneioPreset($db, 'misto', 'teste');
    rodarSwissCompleto($db, $torneioId);

    $timesBye = getTimesEqualizacao($db, $torneioId); // já ordenado por posição
    $sugestao = sugerirEqualizacao($db, $torneioId);

    assertEqualsT($timesBye[0]['time_id'], $sugestao['pares'][0]['time_a_id'], 'EQ1 deve começar pelo melhor colocado entre os 4 do bye');
    assertEqualsT($timesBye[1]['time_id'], $sugestao['pares'][0]['time_b_id'], 'EQ1 deve ser melhor x 2º colocado');
    assertEqualsT($timesBye[2]['time_id'], $sugestao['pares'][1]['time_a_id'], 'EQ2 deve ser 3º x 4º colocado');
    assertEqualsT($timesBye[3]['time_id'], $sugestao['pares'][1]['time_b_id'], 'EQ2 deve ser 3º x 4º colocado');

    echo "OK: test_equalizacao_pareamento_1v2_3v4\n";
}

// TESTE 5/6/7 (seção 14 do brief de acabamento): Equalização só pode ser gerada
// com a Rodada 4 inteiramente encerrada — bloqueado no backend, não só no front.
function test_equalizacao_bloqueada_com_rodada4_incompleta(): void {
    $db = testDb();
    seedTimes($db, 13);
    $torneioId = criarTorneioPreset($db, 'misto', 'teste');

    for ($r = 1; $r <= 4; $r++) {
        $sug = sugerirPareamentoSwiss($db, $torneioId, $r);
        confirmarRodadaSwiss($db, $torneioId, $r, $sug['bye'], $sug['pares'], 'teste');
        $stmt = $db->prepare("SELECT j.id FROM torneio_jogos j JOIN torneio_fases f ON f.id=j.fase_id WHERE j.torneio_id=? AND f.rodada=? AND f.tipo='swiss' AND j.is_bye=0");
        $stmt->execute([$torneioId, $r]);
        $jogos = $stmt->fetchAll();

        if ($r === 4) {
            // Encerra só 5 dos 6 jogos da última rodada — a sexta fica pendente
            foreach (array_slice($jogos, 0, 5) as $row) {
                atualizarPartida($db, $torneioId, (int)$row['id'], ['status' => 'encerrado', 'placar_a' => 2, 'placar_b' => 1], 'teste');
            }
            assertThrowsT(fn() => sugerirEqualizacao($db, $torneioId), 'Rodada 4 com 1 jogo pendente não pode liberar sugestão de equalização');
            assertThrowsT(
                fn() => confirmarEqualizacao($db, $torneioId, [
                    ['codigo' => 'EQ1', 'time_a_id' => 1, 'time_b_id' => 2, 'motivos' => []],
                    ['codigo' => 'EQ2', 'time_a_id' => 3, 'time_b_id' => 4, 'motivos' => []],
                ], 'teste'),
                'Confirmação direta também deve ser bloqueada com Rodada 4 incompleta (backend, não só front)'
            );
            // Encerra o último jogo pendente — agora deve liberar
            $ultimo = $jogos[5];
            atualizarPartida($db, $torneioId, (int)$ultimo['id'], ['status' => 'encerrado', 'placar_a' => 2, 'placar_b' => 1], 'teste');
        } else {
            foreach ($jogos as $row) {
                atualizarPartida($db, $torneioId, (int)$row['id'], ['status' => 'encerrado', 'placar_a' => 2, 'placar_b' => 1], 'teste');
            }
        }
    }

    $sugestao = sugerirEqualizacao($db, $torneioId);
    assertEqualsT(2, count($sugestao['pares']), 'Com a Rodada 4 inteiramente encerrada, a sugestão deve ser liberada normalmente');

    echo "OK: test_equalizacao_bloqueada_com_rodada4_incompleta\n";
}
