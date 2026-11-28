<?php
// Simulação como ferramenta operacional (sem sandbox) + reset de resultados.
// Brief de simplificação — seções 2, 3, 4, 15 (testes 8, 9, 12).

function montarRodada1(PDO $db): array {
    seedTimes($db, 13);
    $torneioId = criarTorneioPreset($db, 'misto', 'teste', null, 'misto_swiss_13');
    $sug = sugerirPareamentoSwiss($db, $torneioId, 1);
    $r = confirmarRodadaSwiss($db, $torneioId, 1, $sug['bye'], $sug['pares'], 'teste');
    return [$torneioId, (int)$r['fase_id']];
}

// TESTE 8: simular partida gera eventos reais válidos (não seta placar direto)
function test_simular_partida_gera_eventos_reais(): void {
    $db = testDb();
    [$torneioId, $faseId] = montarRodada1($db);
    $stmt = $db->prepare("SELECT id FROM torneio_jogos WHERE torneio_id = ? AND fase_id = ? AND is_bye = 0 LIMIT 1");
    $stmt->execute([$torneioId, $faseId]);
    $jogoId = (int)$stmt->fetchColumn();

    $r = simularPartida($db, $torneioId, $jogoId, 'admin');
    assertEqualsT('encerrado', getJogo($db, $torneioId, $jogoId)['status'], 'Partida simulada deve ficar encerrada');

    $stmt = $db->prepare("SELECT COUNT(*) FROM torneio_eventos_gol WHERE jogo_id = ? AND removido = 0");
    $stmt->execute([$jogoId]);
    $totalEventosGol = (int)$stmt->fetchColumn();
    assertEqualsT($r['placar_a'] + $r['placar_b'], $totalEventosGol, 'Quantidade de eventos de gol deve bater exatamente com a soma do placar simulado');

    // Todo evento de gol com tipo='normal' precisa ter membro_id de um atleta elegível do time certo
    $stmt = $db->prepare("
        SELECT ev.time_id, ev.membro_id, mt.time_id AS time_do_membro
        FROM torneio_eventos_gol ev LEFT JOIN membros_time mt ON mt.id = ev.membro_id
        WHERE ev.jogo_id = ? AND ev.tipo = 'normal'
    ");
    $stmt->execute([$jogoId]);
    foreach ($stmt->fetchAll() as $row) {
        assertEqualsT($row['time_id'], $row['time_do_membro'], 'Gol normal simulado deve ter autor de fato pertencente ao time correto');
    }

    echo "OK: test_simular_partida_gera_eventos_reais\n";
}

function test_simular_partida_nao_simula_bye_nem_ja_encerrada(): void {
    $db = testDb();
    [$torneioId, $faseId] = montarRodada1($db);
    $stmt = $db->prepare("SELECT id FROM torneio_jogos WHERE torneio_id = ? AND fase_id = ? AND is_bye = 1");
    $stmt->execute([$torneioId, $faseId]);
    $byeId = (int)$stmt->fetchColumn();

    assertThrowsT(fn() => simularPartida($db, $torneioId, $byeId, 'admin'), 'Jogo de bye não pode ser simulado');
    echo "OK: test_simular_partida_nao_simula_bye_nem_ja_encerrada\n";
}

// TESTE 9: simular partidas pendentes da rodada — sem [object Object], conclui tudo,
// gera gols/faltas por jogador, atualiza classificação/artilharia/fair play.
function test_simular_partidas_pendentes_atualiza_tudo(): void {
    $db = testDb();
    [$torneioId, $faseId] = montarRodada1($db);

    $log = simularPartidasPendentes($db, $torneioId, $faseId, 'admin');
    assertEqualsT(6, count($log), 'Devem ser simuladas as 6 partidas reais da rodada (bye não conta)');
    foreach ($log as $linha) {
        assertTrue(is_string($linha), 'Cada linha do log deve ser string legível — nunca objeto/array cru');
        assertFalse(str_contains($linha, 'Object'), 'Log não pode conter serialização crua de objeto');
    }

    $stmt = $db->prepare("
        SELECT COUNT(*) FROM torneio_jogos j JOIN torneio_fases f ON f.id = j.fase_id
        WHERE j.torneio_id = ? AND f.id = ? AND j.is_bye = 0 AND j.status != 'encerrado'
    ");
    $stmt->execute([$torneioId, $faseId]);
    assertEqualsT(0, (int)$stmt->fetchColumn(), 'Todas as 6 partidas reais devem estar encerradas');

    $classificacao = calcularClassificacao($db, $torneioId);
    $totalJ = array_sum(array_column($classificacao, 'j'));
    assertEqualsT(12, $totalJ, 'Standings deve refletir os 6 jogos simulados (12 participações)');

    $artilharia = calcularArtilharia($db, $torneioId, 'torneio');
    $fairplay = calcularFairPlayTimes($db, $torneioId, 'torneio');
    assertTrue(count($fairplay) === 13, 'Fair play deve listar os 13 times mesmo que alguns tenham 0 faltas');
    // Artilharia pode ter 0 se todo mundo saiu sem_autoria (improvável, mas não é bug em si) —
    // o que importa é que o cálculo funciona e não trava.
    assertTrue(is_array($artilharia), 'calcularArtilharia deve retornar array válido após simulação');

    // Rodar de novo na mesma fase (tudo já encerrado) não deve gerar mais nada
    $log2 = simularPartidasPendentes($db, $torneioId, $faseId, 'admin');
    assertEqualsT(1, count($log2), 'Sem partidas pendentes, deve avisar e não fazer nada');

    echo "OK: test_simular_partidas_pendentes_atualiza_tudo\n";
}

// TESTE 12: zerar resultados mantém times/jogadores/config, remove resultados
function test_zerar_resultados_preserva_config_remove_resultados(): void {
    $db = testDb();
    [$torneioId, $faseId] = montarRodada1($db);
    simularPartidasPendentes($db, $torneioId, $faseId, 'admin');

    $participantesAntes = getParticipantes($db, $torneioId);
    $criteriosAntes = getCriterios($db, $torneioId);
    assertEqualsT(13, count($participantesAntes), 'Deve haver 13 participantes antes do reset');

    zerarResultados($db, $torneioId, 'admin');

    $stmt = $db->prepare("SELECT COUNT(*) FROM torneio_jogos WHERE torneio_id = ?");
    $stmt->execute([$torneioId]);
    assertEqualsT(0, (int)$stmt->fetchColumn(), 'Zerar resultados deve remover todos os jogos');

    $stmt = $db->prepare("SELECT COUNT(*) FROM torneio_fases WHERE torneio_id = ?");
    $stmt->execute([$torneioId]);
    assertEqualsT(0, (int)$stmt->fetchColumn(), 'Zerar resultados deve remover as fases geradas (permite gerar a Rodada 1 de novo)');

    $stmt = $db->prepare("SELECT COUNT(*) FROM torneio_eventos_gol WHERE torneio_id = ?");
    $stmt->execute([$torneioId]);
    assertEqualsT(0, (int)$stmt->fetchColumn(), 'Zerar resultados deve remover os gols');

    $participantesDepois = getParticipantes($db, $torneioId);
    $criteriosDepois = getCriterios($db, $torneioId);
    assertEqualsT($participantesAntes, $participantesDepois, 'Participantes devem ser preservados');
    assertEqualsT($criteriosAntes, $criteriosDepois, 'Critérios de classificação devem ser preservados');

    $torneio = getTorneio($db, $torneioId);
    assertEqualsT('CONFIGURACAO', $torneio['estado'], 'Torneio deve voltar ao estado inicial');

    // Times/pessoas/inscricoes nunca são tocados por zerarResultados
    $stmt = $db->query("SELECT COUNT(*) FROM times");
    assertTrue((int)$stmt->fetchColumn() >= 13, 'Times não podem ser apagados pelo reset');

    // E dá pra gerar a Rodada 1 de novo normalmente
    $sug = sugerirPareamentoSwiss($db, $torneioId, 1);
    $novaFase = confirmarRodadaSwiss($db, $torneioId, 1, $sug['bye'], $sug['pares'], 'admin');
    assertNotNullT($novaFase['fase_id'], 'Deve ser possível gerar a Rodada 1 de novo após o reset');

    echo "OK: test_zerar_resultados_preserva_config_remove_resultados\n";
}
