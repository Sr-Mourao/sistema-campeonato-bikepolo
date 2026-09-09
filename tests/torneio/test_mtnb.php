<?php

function montarMtnbComPrimeiraFase(PDO $db, bool $encerrar = true): array {
    $times = seedTimes($db, 5, 3, 'mtnb');
    $id = criarTorneioPreset($db, 'mtnb', 'teste');
    gerarPrimeiraFaseRoundRobin($db, $id, 'teste');
    if ($encerrar) {
        $stmt = $db->prepare("SELECT id,time_a_id,time_b_id FROM torneio_jogos WHERE torneio_id=? ORDER BY id");
        $stmt->execute([$id]);
        foreach ($stmt->fetchAll() as $j) {
            // O menor id vence sempre: produz ranking determinístico 1..5.
            $aVence = (int)$j['time_a_id'] < (int)$j['time_b_id'];
            atualizarPartida($db,$id,(int)$j['id'],['status'=>'encerrado','placar_a'=>$aVence?2:0,'placar_b'=>$aVence?0:2],'teste');
        }
    }
    return [$id,$times];
}

function encerrarMtnb(PDO $db, int $id, string $codigo, bool $ladoA = true): void {
    $stmt=$db->prepare('SELECT id FROM torneio_jogos WHERE torneio_id=? AND codigo=?');
    $stmt->execute([$id,$codigo]);
    atualizarPartida($db,$id,(int)$stmt->fetchColumn(),['status'=>'encerrado','placar_a'=>$ladoA?2:0,'placar_b'=>$ladoA?0:2],'teste');
}

function test_mtnb_round_robin_tem_10_jogos_reais_e_pares_unicos(): void {
    $db=testDb(); [$id,$times]=montarMtnbComPrimeiraFase($db,false);
    $stmt=$db->prepare("SELECT j.*,f.rodada FROM torneio_jogos j JOIN torneio_fases f ON f.id=j.fase_id WHERE j.torneio_id=? ORDER BY f.rodada,j.ordem");
    $stmt->execute([$id]); $jogos=$stmt->fetchAll();
    assertEqualsT(10,count($jogos),'Round Robin de 5 deve gerar exatamente 10 jogos');
    $pares=[]; $porTime=array_fill_keys($times,0); $porRodada=[];
    foreach($jogos as $j){
        assertEqualsT(0,(int)$j['is_bye'],'folga operacional não vira bye persistido');
        $par=[(int)$j['time_a_id'],(int)$j['time_b_id']]; sort($par); $pares[]=implode('-',$par);
        $porTime[$par[0]]++; $porTime[$par[1]]++; $porRodada[(int)$j['rodada']][]=$j;
    }
    assertEqualsT(10,count(array_unique($pares)),'cada par deve se enfrentar uma vez');
    foreach($porTime as $n) assertEqualsT(4,$n,'cada time deve jogar quatro partidas reais');
    assertEqualsT(5,count($porRodada),'deve haver cinco rodadas');
    foreach($porRodada as $r) assertEqualsT(2,count($r),'cada rodada deve ter dois jogos, sem linha de folga');
    echo "OK: test_mtnb_round_robin_tem_10_jogos_reais_e_pares_unicos\n";
}

function test_mtnb_seed_e_arvore_double_com_vantagem_do_primeiro(): void {
    $db=testDb(); [$id,$times]=montarMtnbComPrimeiraFase($db,true);
    $class=fecharClassificacao($db,$id,'teste'); gerarDouble($db,$id,'teste');
    $p1=jogoPorCodigo($db,$id,'P1'); $w1=jogoPorCodigo($db,$id,'W1'); $w2=jogoPorCodigo($db,$id,'W2');
    assertEqualsT((int)$class[4]['time_id'],(int)$p1['time_a_id'],'P1 começa com o 5º');
    assertEqualsT((int)$class[3]['time_id'],(int)$p1['time_b_id'],'P1 enfrenta o 4º');
    assertEqualsT((int)$class[0]['time_id'],(int)$w1['time_a_id'],'1º entra somente em W1');
    assertNullT($w1['time_b_id'],'1º deve aguardar vencedor de P1');
    assertEqualsT((int)$class[1]['time_id'],(int)$w2['time_a_id'],'W2 começa com o 2º');
    assertEqualsT((int)$class[2]['time_id'],(int)$w2['time_b_id'],'W2 recebe o 3º');
    $stmt=$db->prepare("SELECT codigo FROM torneio_jogos WHERE torneio_id=? AND fase_id=(SELECT id FROM torneio_fases WHERE torneio_id=? AND tipo='double') ORDER BY ordem");
    $stmt->execute([$id,$id]);
    assertEqualsT(['P1','W2','W1','L1','WF','L2','LF','GF'],array_column($stmt->fetchAll(),'codigo'),'ordem operacional MTNB deve ser canônica');
    echo "OK: test_mtnb_seed_e_arvore_double_com_vantagem_do_primeiro\n";
}

function test_mtnb_losers_propaga_e_elimina_so_na_segunda_derrota(): void {
    $db=testDb(); [$id]=montarMtnbComPrimeiraFase($db,true); fecharClassificacao($db,$id,'teste'); gerarDouble($db,$id,'teste');
    encerrarMtnb($db,$id,'P1',true); encerrarMtnb($db,$id,'W2',true); encerrarMtnb($db,$id,'W1',true);
    $l1=jogoPorCodigo($db,$id,'L1'); $l2=jogoPorCodigo($db,$id,'L2');
    assertNotNullT($l1['time_a_id'],'perdedor P1 cai em L1'); assertNotNullT($l1['time_b_id'],'perdedor W2 cai em L1');
    assertNotNullT($l2['time_b_id'],'perdedor W1 cai em L2 e ainda não é eliminado');
    encerrarMtnb($db,$id,'L1',true); assertNotNullT(jogoPorCodigo($db,$id,'L2')['time_a_id'],'vencedor L1 avança a L2');
    encerrarMtnb($db,$id,'WF',true); encerrarMtnb($db,$id,'L2',true);
    $lf=jogoPorCodigo($db,$id,'LF'); assertNotNullT($lf['time_a_id'],'vencedor L2 chega à LF'); assertNotNullT($lf['time_b_id'],'perdedor WF cai à LF');
    encerrarMtnb($db,$id,'LF',true); $gf=jogoPorCodigo($db,$id,'GF');
    assertNotNullT($gf['time_a_id'],'vencedor WF chega invicto à GF'); assertNotNullT($gf['time_b_id'],'vencedor LF chega à GF com uma derrota');
    echo "OK: test_mtnb_losers_propaga_e_elimina_so_na_segunda_derrota\n";
}

function test_mtnb_caminhos_alternativos_4o_3o_e_derrota_do_1o(): void {
    $db=testDb(); [$id]=montarMtnbComPrimeiraFase($db,true); $class=fecharClassificacao($db,$id,'teste'); gerarDouble($db,$id,'teste');
    encerrarMtnb($db,$id,'P1',false); // 4º vence 5º
    encerrarMtnb($db,$id,'W2',false); // 3º vence 2º
    encerrarMtnb($db,$id,'W1',false); // vencedor do play-in vence o 1º
    $l1=jogoPorCodigo($db,$id,'L1'); $l2=jogoPorCodigo($db,$id,'L2');
    assertEqualsT((int)$class[4]['time_id'],(int)$l1['time_a_id'],'5º cai à L1 após perder o play-in');
    assertEqualsT((int)$class[1]['time_id'],(int)$l1['time_b_id'],'2º cai à L1 após perder para o 3º');
    assertEqualsT((int)$class[0]['time_id'],(int)$l2['time_b_id'],'1º cai à L2, não é eliminado na primeira derrota');
    echo "OK: test_mtnb_caminhos_alternativos_4o_3o_e_derrota_do_1o\n";
}

function test_mtnb_gf_e_gf2_reutilizam_regra_generica(): void {
    foreach([true,false] as $winnersVence){
        $db=testDb(); [$id]=montarMtnbComPrimeiraFase($db,true); fecharClassificacao($db,$id,'teste'); gerarDouble($db,$id,'teste');
        foreach(['P1','W2','W1','L1','WF','L2','LF'] as $c) encerrarMtnb($db,$id,$c,true);
        encerrarMtnb($db,$id,'GF',$winnersVence);
        $gf2=jogoPorCodigo($db,$id,'GF2');
        if($winnersVence){ assertFalse($gf2!==false,'Winners vence GF: não há GF2'); assertEqualsT('FINALIZADO',getTorneio($db,$id)['estado'],'GF decide campeonato'); }
        else { assertTrue($gf2!==false,'Losers vence GF: deve gerar GF2'); assertFalse(getTorneio($db,$id)['estado']==='FINALIZADO','ainda não há campeão'); encerrarMtnb($db,$id,'GF2',true); assertEqualsT('FINALIZADO',getTorneio($db,$id)['estado'],'GF2 decide campeonato'); }
    }
    echo "OK: test_mtnb_gf_e_gf2_reutilizam_regra_generica\n";
}

function test_mtnb_isolamento_resultado_evento_reset_e_resolver(): void {
    $db=testDb(); seedTimes($db,13,1,'misto'); $misto=criarTorneioPreset($db,'misto','teste');
    $sugMisto=sugerirPareamentoSwiss($db,$misto,1); confirmarRodadaSwiss($db,$misto,1,$sugMisto['bye'],$sugMisto['pares'],'teste');
    [$mtnb,$times]=montarMtnbComPrimeiraFase($db,false);
    $jogo=$db->query("SELECT id FROM torneio_jogos WHERE torneio_id=$mtnb ORDER BY id LIMIT 1")->fetchColumn();
    $membro=primeiroMembroDoTime($db,$times[0]);
    $linha=jogoPorCodigo($db,$mtnb,'RR1.1'); $timeEvento=in_array($times[0],[(int)$linha['time_a_id'],(int)$linha['time_b_id']],true)?$times[0]:(int)$linha['time_a_id'];
    $membro=primeiroMembroDoTime($db,$timeEvento); registrarGol($db,$mtnb,(int)$jogo,$timeEvento,$membro,'normal',1,'teste');
    assertEqualsT(0,count(calcularArtilharia($db,$misto,'torneio')),'evento MTNB não aparece no Misto');
    assertEqualsT('RR1.1',resolverPartidaDestaque($db,$mtnb)['jogo']['codigo'],'resolver MTNB usa somente MTNB');
    $destaqueMisto=resolverPartidaDestaque($db,$misto)['jogo'];
    assertEqualsT($misto,(int)$destaqueMisto['torneio_id'],'resolver Misto seleciona somente partida Misto');
    assertFalse(str_starts_with($destaqueMisto['codigo'],'RR'),'resolver Misto nunca recebe partida Round Robin MTNB');
    zerarResultados($db,$mtnb,'teste');
    assertEqualsT(0,(int)$db->query("SELECT count(*) FROM torneio_jogos WHERE torneio_id=$mtnb")->fetchColumn(),'reset remove só MTNB');
    assertEqualsT(7,(int)$db->query("SELECT count(*) FROM torneio_jogos WHERE torneio_id=$misto")->fetchColumn(),'reset MTNB não remove jogos Misto');
    assertEqualsT(13,count(getParticipantes($db,$misto)),'reset MTNB preserva participantes Misto');
    assertEqualsT(5,count(getParticipantes($db,$mtnb)),'reset preserva participantes MTNB');
    gerarPrimeiraFaseRoundRobin($db,$mtnb,'teste'); zerarResultados($db,$misto,'teste');
    assertEqualsT(10,(int)$db->query("SELECT count(*) FROM torneio_jogos WHERE torneio_id=$mtnb")->fetchColumn(),'reset Misto não remove jogos MTNB');
    echo "OK: test_mtnb_isolamento_resultado_evento_reset_e_resolver\n";
}
