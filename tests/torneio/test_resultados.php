<?php

function resultadoJogo(string $codigo, int $a, int $b, int $vencedor, string $status = 'encerrado'): array
{
    return [
        'codigo' => $codigo, 'time_a_id' => $a, 'time_b_id' => $b,
        'vencedor_time_id' => $vencedor, 'status' => $status,
        'time_a_nome' => "Time $a", 'time_b_nome' => "Time $b",
    ];
}

function resultadoSeeds(int $quantidade): array
{
    $linhas = [];
    for ($seed = 1; $seed <= $quantidade; $seed++) {
        // Campanhas deliberadamente favorecem os piores seeds: não podem ordenar o final.
        $linhas[] = ['time_id' => 100 + $seed, 'posicao' => $seed, 'j' => 20 + $seed, 'v' => 20 + $seed, 'sg' => 100 + $seed];
    }
    return $linhas;
}

function test_resultados_misto_aplica_exatamente_os_niveis_e_seed(): void
{
    $torneio = ['estado' => 'FINALIZADO'];
    $jogos = [
        resultadoJogo('GF', 101, 102, 101), resultadoJogo('B6', 104, 103, 104),
        resultadoJogo('B5', 104, 105, 105),
        resultadoJogo('B3', 106, 120, 120), resultadoJogo('B4', 105, 121, 121),
        resultadoJogo('B1', 108, 122, 122), resultadoJogo('B2', 107, 123, 123),
        resultadoJogo('REP-R4', 110, 124, 124), resultadoJogo('REP-R5', 109, 125, 125),
        resultadoJogo('REP-R1', 113, 126, 126), resultadoJogo('REP-R2', 111, 127, 127), resultadoJogo('REP-R3', 112, 128, 128),
    ];
    $final = resultadosClassificacaoFinalMisto($torneio, $jogos, resultadoSeeds(13));
    assertEqualsT(13, count($final), 'Misto encerrado deve possuir 13 posições');
    assertEqualsT(range(1, 13), array_column($final, 'posicao'), 'Misto deve preencher 1º a 13º');
    assertEqualsT([101,102,103,104,105,106,107,108,109,110,111,112,113], array_column($final, 'time_id'), 'níveis equivalentes devem usar seed, nunca campanha ou código operacional');
    assertTrue($final[4]['ordenado_por_classificacao_primeira_fase'], '5º/6º precisa registrar desempate pela classificação da Primeira Fase');
    assertTrue($final[10]['ordenado_por_classificacao_primeira_fase'], '11º–13º precisam registrar desempate pela classificação da Primeira Fase');
    echo "OK: test_resultados_misto_aplica_exatamente_os_niveis_e_seed\n";
}

function test_resultados_gf2_nao_declara_campeao_antes_da_decisao(): void
{
    $torneio = ['estado' => 'DOUBLE'];
    $gf = resultadoJogo('GF', 101, 102, 102);
    $gf2 = resultadoJogo('GF2', 101, 102, 0, 'agendado');
    $parcial = resultadosClassificacaoFinalMisto($torneio, [$gf, $gf2], resultadoSeeds(13));
    assertEqualsT([], array_values(array_filter($parcial, fn($r) => $r['posicao'] <= 2)), 'vitória da Losers na GF não define campeão nem vice');
    $torneio['estado'] = 'FINALIZADO';
    $gf2 = resultadoJogo('GF2', 101, 102, 102);
    $final = resultadosClassificacaoFinalMisto($torneio, [$gf, $gf2], resultadoSeeds(13));
    assertEqualsT([102,101], array_column(array_slice($final, 0, 2), 'time_id'), 'GF2 encerrada define campeão e vice');
    $direto = resultadosClassificacaoFinalMisto(['estado' => 'FINALIZADO'], [resultadoJogo('GF', 101, 102, 101)], resultadoSeeds(13));
    assertEqualsT(101, $direto[0]['time_id'], 'Winners vencendo a GF define o campeão sem GF2');
    echo "OK: test_resultados_gf2_nao_declara_campeao_antes_da_decisao\n";
}

function test_resultados_mtnb_respeita_topologia_real_l1_l2_lf(): void
{
    $jogos = [
        resultadoJogo('GF', 101, 102, 102), resultadoJogo('GF2', 101, 102, 102),
        resultadoJogo('LF', 102, 103, 102), resultadoJogo('L2', 103, 104, 103), resultadoJogo('L1', 104, 105, 104),
    ];
    $final = resultadosClassificacaoFinalMtnb(['estado' => 'FINALIZADO'], $jogos, resultadoSeeds(5));
    assertEqualsT(5, count($final), 'MTNB encerrado deve possuir 5 posições');
    assertEqualsT([102,101,103,104,105], array_column($final, 'time_id'), 'MTNB: GF2, LF, L2 e L1 definem 1º–5º');
    echo "OK: test_resultados_mtnb_respeita_topologia_real_l1_l2_lf\n";
}

function test_resultados_estatisticas_ignoram_agendado_bye_e_gf2_inexistente(): void
{
    $db = testDb();
    $timesIds = seedTimes($db, 2);
    $db->exec("INSERT INTO torneios (nome,categoria,formato,estado) VALUES ('Stats','misto','misto_swiss_13','DOUBLE')");
    $torneioId = (int)$db->lastInsertId();
    foreach ($timesIds as $timeId) $db->prepare('INSERT INTO torneio_participantes (torneio_id,time_id,ativo) VALUES (?,?,1)')->execute([$torneioId,$timeId]);
    $db->prepare("INSERT INTO torneio_fases (torneio_id,tipo,rodada,rotulo,estado,conta_classificacao) VALUES (?,'swiss',1,'R1','confirmada',1)")->execute([$torneioId]);
    $fasePrimeira = (int)$db->lastInsertId();
    $db->prepare("INSERT INTO torneio_fases (torneio_id,tipo,rodada,rotulo,estado,conta_classificacao) VALUES (?,'double',NULL,'Double','confirmada',0)")->execute([$torneioId]);
    $faseDouble = (int)$db->lastInsertId();
    $insert = $db->prepare("INSERT INTO torneio_jogos (torneio_id,fase_id,codigo,ordem,time_a_id,time_b_id,is_bye,status,placar_a,placar_b,vencedor_time_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
    $insert->execute([$torneioId,$fasePrimeira,'R1',1,$timesIds[0],$timesIds[1],0,'encerrado',3,1,$timesIds[0]]); $jogoPrimeira = (int)$db->lastInsertId();
    $insert->execute([$torneioId,$fasePrimeira,'R2-pendente',2,$timesIds[0],$timesIds[1],0,'agendado',null,null,null]);
    $insert->execute([$torneioId,$fasePrimeira,'R-bye',3,$timesIds[0],null,1,'encerrado',null,null,null]);
    $insert->execute([$torneioId,$faseDouble,'B1',1,$timesIds[0],$timesIds[1],0,'encerrado',1,2,$timesIds[1]]);
    $insert->execute([$torneioId,$faseDouble,'GF2',2,$timesIds[0],$timesIds[1],0,'agendado',null,null,null]);
    $membro = primeiroMembroDoTime($db, $timesIds[0]);
    $db->prepare("INSERT INTO torneio_eventos_gol (torneio_id,jogo_id,time_id,membro_id,tipo) VALUES (?,?,?,?, 'normal')")->execute([$torneioId,$jogoPrimeira,$timesIds[0],$membro]);
    $db->prepare("INSERT INTO torneio_eventos_gol (torneio_id,jogo_id,time_id,membro_id,tipo) VALUES (?,?,?,?, 'sem_autoria')")->execute([$torneioId,$jogoPrimeira,$timesIds[0],null]);
    $db->prepare("INSERT INTO torneio_eventos_falta (torneio_id,jogo_id,time_id,membro_id) VALUES (?,?,?,?)")->execute([$torneioId,$jogoPrimeira,$timesIds[0],$membro]);
    $torneio = getTorneio($db,$torneioId); $jogos = resultadosJogos($db,$torneioId);
    $times = array_fill_keys($timesIds, []); $campanhas = resultadosCampanhas($db,$torneio,$jogos,$times);
    $c = $campanhas[$timesIds[0]];
    assertEqualsT(2,$c['total']['j'],'somente partidas reais encerradas contam');
    assertEqualsT($c['primeira_fase']['j'] + $c['double']['j'],$c['total']['j'],'breakdown deve somar ao total');
    assertEqualsT(1,$c['total']['gols_normais'],'gol normal é contabilizado separadamente');
    assertEqualsT(1,$c['total']['gols_outorgados'],'gol outorgado não vira gol individual');
    assertEqualsT(1,$c['total']['faltas'],'faltas reais encerradas contam');
    assertFalse(in_array('GF2',$c['fases_disputadas'],true),'GF2 agendada não entra nas fases disputadas');
    echo "OK: test_resultados_estatisticas_ignoram_agendado_bye_e_gf2_inexistente\n";
}

function test_resultados_awards_so_publica_apuracao_encerrada(): void
{
    $db = testDb();
    assertEqualsT([], resultadosAwardsPublicos($db, 'misto')['categorias'], 'Awards abertos/fechados não publicam vencedor provisório');
    $db->exec("UPDATE awards_config SET status='encerrada' WHERE id=1");
    $publicos = resultadosAwardsPublicos($db, 'misto');
    assertEqualsT(4, count($publicos['categorias']), 'categorias reais cadastradas aparecem após encerramento');
    foreach ($publicos['categorias'] as $categoria) assertTrue(array_key_exists('vencedores',$categoria), 'empates são representados por vencedores em lista');
    echo "OK: test_resultados_awards_so_publica_apuracao_encerrada\n";
}

function test_resultados_mtnb_publica_apenas_awards_manuais_publicados(): void
{
    $db = testDb();
    $atleta = seedAwardsPessoa($db, 'Vencedora MTNB', ['mtnb']);
    awardsMtnbSalvar($db, ['nome' => 'Destaque MTNB', 'descricao' => 'Resultado externo', 'publicado' => true, 'pessoa_ids' => [$atleta]], 'teste');
    awardsMtnbSalvar($db, ['nome' => 'Rascunho MTNB', 'publicado' => false, 'pessoa_ids' => [$atleta]], 'teste');
    $publicos = resultadosAwardsPublicos($db, 'mtnb');
    assertEqualsT(1, count($publicos['categorias']), 'MTNB publica somente categorias marcadas como publicadas');
    assertEqualsT('Vencedora MTNB', $publicos['categorias'][0]['vencedores'][0]['nome'], 'MTNB usa a pessoa real selecionada no admin');
    assertEqualsT('cadastro_oficial', $publicos['categorias'][0]['origem'], 'MTNB não simula votação interna');
    $times = seedTimes($db,5,1,'mtnb');
    $db->exec("INSERT INTO torneios (nome,categoria,formato,estado) VALUES ('MTNB','mtnb','mtnb_round_robin_5','CONFIGURACAO')");
    $torneioId = (int)$db->lastInsertId();
    foreach ($times as $timeId) $db->prepare('INSERT INTO torneio_participantes (torneio_id,time_id,ativo) VALUES (?,?,1)')->execute([$torneioId,$timeId]);
    $payload = consolidarResultadosPublicos($db,getTorneio($db,$torneioId));
    assertEqualsT(1, count($payload['awards']['categorias']), 'payload consolidado inclui Awards MTNB publicados');
    echo "OK: test_resultados_mtnb_publica_apenas_awards_manuais_publicados\n";
}
