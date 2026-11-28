<?php
// Critérios de classificação configuráveis — brief seções 6, 19, 26 (exemplos A e B literais).

function timeFake(int $id, array $overrides = []): array {
    return array_merge([
        'time_id' => $id, 'nome' => "Time $id",
        'v' => 3, 'e' => 1, 'd' => 0, 'gp' => 10, 'gc' => 5, 'sg' => 5,
        'faltas' => 4, 'pontos' => 10.0, 'buchholz' => 0.0,
    ], $overrides);
}

function test_desempate_exemplo_A_saldo_antes_de_fairplay(): void {
    // Pontos > Saldo > Fair Play. A: SG+5/8 faltas · B: SG+4/2 faltas. A fica acima.
    $a = timeFake(1, ['sg' => 5, 'faltas' => 8, 'pontos' => 10]);
    $b = timeFake(2, ['sg' => 4, 'faltas' => 2, 'pontos' => 10]);
    $r = compararTimesClassificacao($a, $b, ['pontos', 'saldo', 'fair_play'], []);
    assertTrue($r < 0, 'Exemplo A: Time A deve ficar acima de B (saldo decide antes de fair play)');
    echo "OK: test_desempate_exemplo_A_saldo_antes_de_fairplay\n";
}

function test_desempate_exemplo_B_fairplay_antes_de_saldo(): void {
    // Pontos > Fair Play > Vitórias > Saldo. Mesmos times. B fica acima (menos faltas).
    $a = timeFake(1, ['sg' => 5, 'faltas' => 8, 'pontos' => 10, 'v' => 3]);
    $b = timeFake(2, ['sg' => 4, 'faltas' => 2, 'pontos' => 10, 'v' => 3]);
    $r = compararTimesClassificacao($a, $b, ['pontos', 'fair_play', 'vitorias', 'saldo'], []);
    assertTrue($r > 0, 'Exemplo B: Time B deve ficar acima de A (fair play decide antes de saldo, independente do saldo)');
    echo "OK: test_desempate_exemplo_B_fairplay_antes_de_saldo\n";
}

function test_fair_play_menos_e_melhor(): void {
    $a = timeFake(1, ['faltas' => 2]);
    $b = timeFake(2, ['faltas' => 9]);
    $r = aplicaCriterio('fair_play', $a, $b, []);
    assertTrue($r < 0, 'Fair play: 4 faltas é melhor que 9 — menos é melhor, nunca inverter');
    echo "OK: test_fair_play_menos_e_melhor\n";
}

function test_mudar_ordem_criterios_muda_posicao(): void {
    $db = testDb();
    seedTimes($db, 2);
    $torneioId = criarTorneioPreset($db, 'misto', 'teste', null, 'misto_swiss_13');
    $stmt = $db->query("SELECT id FROM times ORDER BY id");
    [$t1, $t2] = array_column($stmt->fetchAll(), 'id');

    // Ordem 1: Pontos > Saldo > Fair Play
    salvarCriterios($db, $torneioId, ['pontos', 'saldo', 'fair_play']);
    $stats = [
        $t1 => timeFake($t1, ['sg' => 5, 'faltas' => 8, 'pontos' => 10]),
        $t2 => timeFake($t2, ['sg' => 4, 'faltas' => 2, 'pontos' => 10]),
    ];
    $criterios = getCriterios($db, $torneioId);
    $lista = array_values($stats);
    usort($lista, fn($a, $b) => compararTimesClassificacao($a, $b, $criterios, []));
    assertEqualsT($t1, $lista[0]['time_id'], 'Com Saldo antes de Fair Play, Time A (melhor saldo) fica em 1º');

    // Ordem 2: Pontos > Fair Play > Saldo
    salvarCriterios($db, $torneioId, ['pontos', 'fair_play', 'saldo']);
    $criterios2 = getCriterios($db, $torneioId);
    $lista2 = array_values($stats);
    usort($lista2, fn($a, $b) => compararTimesClassificacao($a, $b, $criterios2, []));
    assertEqualsT($t2, $lista2[0]['time_id'], 'Com Fair Play antes de Saldo, Time B (menos faltas) passa a ficar em 1º — a ordem configurada MUDOU o resultado');

    echo "OK: test_mudar_ordem_criterios_muda_posicao\n";
}

function test_confronto_direto(): void {
    $confrontos = ['1-2' => ['vencedor' => 1]];
    $a = timeFake(1); $b = timeFake(2);
    $r = aplicaCriterio('confronto_direto', $a, $b, $confrontos);
    assertTrue($r < 0, 'Time 1 venceu o confronto direto, deve ficar acima');
    $rEmpate = aplicaCriterio('confronto_direto', timeFake(3), timeFake(4), []);
    assertEqualsT(0, $rEmpate, 'Sem confronto registrado, critério não decide (retorna 0)');
    echo "OK: test_confronto_direto\n";
}

function test_buchholz_soma_pontos_atuais_dos_adversarios_sem_bye(): void {
    $db = testDb();
    seedTimes($db, 4);
    $torneioId = criarTorneioPreset($db, 'misto', 'teste', null, 'misto_swiss_13');
    $stmt = $db->query("SELECT id FROM times ORDER BY id");
    [$t1, $t2, $t3, $t4] = array_column($stmt->fetchAll(), 'id');

    // fase única "swiss" rodada 1 manual: T1 x T2 (T1 vence), T3 x T4 (empate)
    $db->prepare("INSERT INTO torneio_fases (torneio_id, tipo, rodada, rotulo, estado, conta_classificacao) VALUES (?, 'swiss', 1, 'R1', 'confirmada', 1)")->execute([$torneioId]);
    $faseId = (int)$db->lastInsertId();
    $db->prepare("INSERT INTO torneio_jogos (torneio_id, fase_id, codigo, time_a_id, time_b_id, status, placar_a, placar_b) VALUES (?, ?, 'J1', ?, ?, 'encerrado', 3, 1)")
       ->execute([$torneioId, $faseId, $t1, $t2]);
    $db->prepare("INSERT INTO torneio_jogos (torneio_id, fase_id, codigo, time_a_id, time_b_id, status, placar_a, placar_b) VALUES (?, ?, 'J2', ?, ?, 'encerrado', 2, 2)")
       ->execute([$torneioId, $faseId, $t3, $t4]);

    $classificacao = calcularClassificacao($db, $torneioId);
    $porId = array_column($classificacao, null, 'time_id');
    // T1 venceu (3 pts) — Buchholz de T1 = pontos atuais de T2 (0 pts, perdeu) = 0
    assertEqualsT(0.0, $porId[$t1]['buchholz'], 'Buchholz de T1 deve ser os pontos atuais de T2 (seu único adversário)');
    // T3 empatou (1pt) — Buchholz de T3 = pontos atuais de T4 (1pt, empate) = 1
    assertEqualsT(1.0, $porId[$t3]['buchholz'], 'Buchholz de T3 deve ser os pontos atuais de T4');

    echo "OK: test_buchholz_soma_pontos_atuais_dos_adversarios_sem_bye\n";
}

// Área pública (seção 8 do brief) expõe a composição do Buchholz — mesmos dados já
// somados, nunca um recálculo paralelo. `buchholz_detalhe` deve bater com `buchholz`.
function test_buchholz_detalhe_expoe_composicao_sem_recalculo(): void {
    $db = testDb();
    seedTimes($db, 4);
    $torneioId = criarTorneioPreset($db, 'misto', 'teste', null, 'misto_swiss_13');
    $stmt = $db->query("SELECT id, nome FROM times ORDER BY id");
    $times = $stmt->fetchAll();
    [$t1, $t2, $t3, $t4] = array_column($times, 'id');
    $nomes = array_column($times, 'nome', 'id');

    $db->prepare("INSERT INTO torneio_fases (torneio_id, tipo, rodada, rotulo, estado, conta_classificacao) VALUES (?, 'swiss', 1, 'R1', 'confirmada', 1)")->execute([$torneioId]);
    $faseId = (int)$db->lastInsertId();
    $db->prepare("INSERT INTO torneio_jogos (torneio_id, fase_id, codigo, time_a_id, time_b_id, status, placar_a, placar_b) VALUES (?, ?, 'J1', ?, ?, 'encerrado', 3, 1)")
       ->execute([$torneioId, $faseId, $t1, $t2]);
    $db->prepare("INSERT INTO torneio_jogos (torneio_id, fase_id, codigo, time_a_id, time_b_id, status, placar_a, placar_b) VALUES (?, ?, 'J2', ?, ?, 'encerrado', 2, 2)")
       ->execute([$torneioId, $faseId, $t3, $t4]);

    $classificacao = calcularClassificacao($db, $torneioId);
    $porId = array_column($classificacao, null, 'time_id');

    $detalheT1 = $porId[$t1]['buchholz_detalhe'];
    assertEqualsT(1, count($detalheT1), 'T1 enfrentou só um adversário real (T2)');
    assertEqualsT($t2, $detalheT1[0]['time_id'], 'Adversário de T1 no detalhe deve ser T2');
    assertEqualsT($nomes[$t2], $detalheT1[0]['nome'], 'Detalhe deve trazer o nome do adversário');
    $soma = array_sum(array_column($detalheT1, 'pontos'));
    assertEqualsT($porId[$t1]['buchholz'], $soma, 'Soma do detalhe deve bater exatamente com o buchholz já calculado');

    echo "OK: test_buchholz_detalhe_expoe_composicao_sem_recalculo\n";
}

// ─────────────────────────────────────────────────────────────────────────
// Indicador de desempate na tabela pública (brief "ajustes cirúrgicos na tabela") —
// decompoeDecisao() deve: (1) apontar pra quem FICOU À FRENTE, nunca pra quem perdeu;
// (2) funcionar genericamente pra qualquer critério, sem caso especial de Buchholz;
// (3) nunca disparar quando o critério responsável é o primeiro da ordem (isso é
// ordenação normal, não desempate). Sempre via o MESMO comparador usado pra ordenar
// (usort + compararTimesClassificacao), nunca uma segunda implementação.
function ordenarERotular(array $times, array $criterios, array $confrontos = []): array {
    usort($times, fn($a, $b) => compararTimesClassificacao($a, $b, $criterios, $confrontos));
    $out = [];
    foreach ($times as $t) {
        $t['decisao'] = decompoeDecisao($t, $times, $criterios, $confrontos);
        $out[] = $t;
    }
    return $out;
}

// CASO 1: dois times empatados em pontos, separados por Buchholz -> indicador no time
// que ficou acima, valor = "buchholz" (a chave crua, não um texto formatado).
function test_hint_caso1_pontos_empatados_separados_por_buchholz(): void {
    $a = timeFake(1, ['pontos' => 6, 'buchholz' => 6]);
    $b = timeFake(2, ['pontos' => 6, 'buchholz' => 3]);
    $lista = ordenarERotular([$a, $b], ['pontos', 'buchholz', 'fair_play', 'saldo', 'confronto_direto']);
    assertEqualsT(1, $lista[0]['time_id'], 'Time 1 (buchholz maior) deve ficar acima');
    assertEqualsT('buchholz', $lista[0]['decisao'], 'Indicador deve ficar no time que ficou À FRENTE (o vencedor do desempate)');
    assertEqualsT(null, $lista[1]['decisao'], 'Time que perdeu o desempate não deve ter indicador');
    echo "OK: test_hint_caso1_pontos_empatados_separados_por_buchholz\n";
}

// CASO 2: empatados em Pontos + Buchholz, separados por Fair Play -> indicador "fair_play".
function test_hint_caso2_separados_por_fair_play(): void {
    $a = timeFake(1, ['pontos' => 6, 'buchholz' => 5, 'faltas' => 2]);
    $b = timeFake(2, ['pontos' => 6, 'buchholz' => 5, 'faltas' => 4]);
    $lista = ordenarERotular([$a, $b], ['pontos', 'buchholz', 'fair_play', 'saldo']);
    assertEqualsT(1, $lista[0]['time_id'], 'Time 1 (menos faltas) deve ficar acima');
    assertEqualsT('fair_play', $lista[0]['decisao'], 'CASO 2: indicador deve ser fair_play');
    echo "OK: test_hint_caso2_separados_por_fair_play\n";
}

// CASO 3: separados por Saldo -> indicador "saldo".
function test_hint_caso3_separados_por_saldo(): void {
    $a = timeFake(1, ['pontos' => 6, 'buchholz' => 5, 'faltas' => 2, 'sg' => 5]);
    $b = timeFake(2, ['pontos' => 6, 'buchholz' => 5, 'faltas' => 2, 'sg' => 2]);
    $lista = ordenarERotular([$a, $b], ['pontos', 'buchholz', 'fair_play', 'saldo']);
    assertEqualsT(1, $lista[0]['time_id'], 'Time 1 (melhor saldo) deve ficar acima');
    assertEqualsT('saldo', $lista[0]['decisao'], 'CASO 3: indicador deve ser saldo');
    echo "OK: test_hint_caso3_separados_por_saldo\n";
}

// CASO 4: separados por Confronto Direto -> indicador "confronto_direto".
function test_hint_caso4_separados_por_confronto_direto(): void {
    $a = timeFake(1, ['pontos' => 6, 'buchholz' => 5, 'faltas' => 2, 'sg' => 3]);
    $b = timeFake(2, ['pontos' => 6, 'buchholz' => 5, 'faltas' => 2, 'sg' => 3]);
    $confrontos = ['1-2' => ['vencedor' => 1]];
    $lista = ordenarERotular([$a, $b], ['pontos', 'buchholz', 'fair_play', 'saldo', 'confronto_direto'], $confrontos);
    assertEqualsT(1, $lista[0]['time_id'], 'Time 1 (venceu o confronto direto) deve ficar acima');
    assertEqualsT('confronto_direto', $lista[0]['decisao'], 'CASO 4: indicador deve ser confronto_direto');
    echo "OK: test_hint_caso4_separados_por_confronto_direto\n";
}

// CASO 5: pontos diferentes -> nenhum indicador (a ordenação primária não é "desempate").
function test_hint_caso5_pontos_diferentes_sem_indicador(): void {
    $a = timeFake(1, ['pontos' => 9]);
    $b = timeFake(2, ['pontos' => 6]);
    $lista = ordenarERotular([$a, $b], ['pontos', 'buchholz', 'fair_play']);
    assertEqualsT(null, $lista[0]['decisao'], 'CASO 5: pontos já resolveram — não é desempate, sem indicador');
    assertEqualsT(null, $lista[1]['decisao'], 'CASO 5: último da lista nunca tem indicador');
    echo "OK: test_hint_caso5_pontos_diferentes_sem_indicador\n";
}

// CASO 6: grupo com 3+ empatados — cada linha só explica sua própria margem sobre a
// PRÓXIMA (nunca compara ingenuamente com uma referência fixa), coerente com o comparador.
function test_hint_caso6_grupo_de_tres_ou_mais_empatados(): void {
    $criterios = ['pontos', 'buchholz', 'fair_play', 'saldo'];
    $a = timeFake(1, ['pontos' => 6, 'buchholz' => 10, 'faltas' => 2, 'sg' => 1]);
    $b = timeFake(2, ['pontos' => 6, 'buchholz' => 7, 'faltas' => 2, 'sg' => 1]);
    $c = timeFake(3, ['pontos' => 6, 'buchholz' => 7, 'faltas' => 2, 'sg' => -1]);
    $d = timeFake(4, ['pontos' => 3, 'buchholz' => 99, 'faltas' => 0, 'sg' => 99]); // pontos bem diferentes — nunca deveria "vazar" indicador

    $lista = ordenarERotular([$a, $b, $c, $d], $criterios);
    assertEqualsT([1, 2, 3, 4], array_column($lista, 'time_id'), 'Ordem esperada: A > B > C > D');
    assertEqualsT('buchholz', $lista[0]['decisao'], 'A fica à frente de B por Buchholz (10 > 7)');
    assertEqualsT('saldo', $lista[1]['decisao'], 'B fica à frente de C por Saldo (pontos/buchholz/fairplay empatados, sg 1 > -1)');
    assertEqualsT(null, $lista[2]['decisao'], 'C está à frente de D só porque os pontos já diferem — não é desempate, mesmo D tendo buchholz/saldo "melhores"');
    assertEqualsT(null, $lista[3]['decisao'], 'Último da lista nunca tem indicador');
    echo "OK: test_hint_caso6_grupo_de_tres_ou_mais_empatados\n";
}

// CASO 7: mudar a ordem dos critérios no admin muda QUAL critério aparece como indicador
// (e pra qual time), sem nenhuma segunda fonte de verdade — mesmos dois times, duas ordens.
function test_hint_caso7_ordem_configurada_muda_o_indicador(): void {
    $a = timeFake(1, ['pontos' => 6, 'faltas' => 8, 'sg' => 5]);
    $b = timeFake(2, ['pontos' => 6, 'faltas' => 2, 'sg' => 3]);

    // Ordem 1: Saldo antes de Fair Play — Time 1 (melhor saldo) fica acima, indicador = saldo.
    $lista1 = ordenarERotular([$a, $b], ['pontos', 'saldo', 'fair_play']);
    assertEqualsT(1, $lista1[0]['time_id'], 'Ordem 1: saldo decide primeiro, Time 1 fica acima');
    assertEqualsT('saldo', $lista1[0]['decisao'], 'Ordem 1: indicador deve ser saldo');

    // Ordem 2: Fair Play antes de Saldo — Time 2 (menos faltas) passa a ficar acima, indicador = fair_play.
    $lista2 = ordenarERotular([$a, $b], ['pontos', 'fair_play', 'saldo']);
    assertEqualsT(2, $lista2[0]['time_id'], 'Ordem 2: fair play decide primeiro, Time 2 passa a ficar acima');
    assertEqualsT('fair_play', $lista2[0]['decisao'], 'Ordem 2: indicador deve acompanhar a nova ordem — sem divergência entre config e interface');

    echo "OK: test_hint_caso7_ordem_configurada_muda_o_indicador\n";
}
