<?php
// Poloperator como base dos times: criarTimesDoPoloperator() cria só o que falta, é
// idempotente, usa os apelidos e nunca move ninguém de time. Sem rede: dados fixos.

function poloTimesFixture(): array {
    return [
        ['id' => 'pt1', 'name' => 'Time 1', 'players' => [
            ['id' => 'p-luq', 'name' => 'Luqueta', 'photoPath' => 'https://x/1.webp'],
            ['id' => 'p-emi', 'name' => 'Emiliane Mayumi Ito', 'photoPath' => 'https://x/2.webp'],
        ]],
        ['id' => 'pt2', 'name' => 'Time 2', 'players' => [
            ['id' => 'p-kwy', 'name' => 'Kwy'],
            ['id' => 'p-mat', 'name' => 'Mati'],
            ['id' => 'p-jay', 'name' => 'JAY '],
        ]],
    ];
}

function poloContar(PDO $db, string $sql): int { return (int)$db->query($sql)->fetchColumn(); }

function test_poloperator_cria_times_e_atletas_com_apelidos_sem_duplicar(): void {
    $db = testDb();
    $apelidos = ['Luqueta' => 'Lusca', 'Emiliane Mayumi Ito' => 'Emi', 'Mati' => 'Mat'];

    $previa = planoTimesPoloperator($db, 'misto', poloTimesFixture(), $apelidos);
    assertEqualsT(['times_criar' => 2, 'atletas_criar' => 5, 'atletas_adicionar' => 0, 'avisos' => 0], $previa['resumo'], 'prévia: tudo a criar');
    assertEqualsT(0, poloContar($db, "SELECT COUNT(*) FROM times"), 'prévia não grava nada');

    $r = criarTimesDoPoloperator($db, 'misto', poloTimesFixture(), $apelidos);
    assertEqualsT(['times' => 2, 'pessoas' => 5, 'vinculos' => 5], $r['criados'], 'cria 2 times, 5 pessoas e 5 vínculos');
    $nomes = $db->query("SELECT t.nome || ':' || p.nome FROM times t JOIN membros_time mt ON mt.time_id=t.id JOIN inscricoes i ON i.id=mt.inscricao_id JOIN pessoas p ON p.id=i.pessoa_id ORDER BY t.nome, mt.id")->fetchAll(PDO::FETCH_COLUMN);
    assertEqualsT(['Time 1:Lusca', 'Time 1:Emi', 'Time 2:Kwy', 'Time 2:Mat', 'Time 2:JAY'], $nomes, 'nomes internos usam os apelidos');
    assertEqualsT('lusca@pior.example.com', $db->query("SELECT email FROM pessoas WHERE nome='Lusca'")->fetchColumn(), 'e-mail fictício no padrão do seed');
    assertEqualsT(5, poloContar($db, "SELECT COUNT(*) FROM inscricao_categorias WHERE categoria='misto'"), 'inscrição na categoria misto');
    assertEqualsT(5, poloContar($db, "SELECT COUNT(*) FROM pessoas WHERE poloperator_id IS NOT NULL AND telefone IS NULL"), 'grava poloperator_id e não inventa telefone');
    assertEqualsT(['times_criar' => 0, 'atletas_criar' => 0, 'atletas_adicionar' => 0, 'avisos' => 0], $r['plano']['resumo'], 'depois de criar, nada pendente');

    $r2 = criarTimesDoPoloperator($db, 'misto', poloTimesFixture(), $apelidos);
    assertEqualsT(['times' => 0, 'pessoas' => 0, 'vinculos' => 0], $r2['criados'], 'rodar de novo não duplica');
    assertEqualsT(5, poloContar($db, "SELECT COUNT(*) FROM pessoas"), 'continua com 5 pessoas');
    echo "OK: test_poloperator_cria_times_e_atletas_com_apelidos_sem_duplicar\n";
}

function test_poloperator_atleta_nova_entra_no_time_e_pessoa_sem_time_e_reaproveitada(): void {
    $db = testDb();
    criarTimesDoPoloperator($db, 'misto', poloTimesFixture(), []);
    // Pessoa cadastrada à mão (inscrita no misto, sem time) que depois cria conta no Poloperator.
    $db->exec("INSERT INTO pessoas (nome, email) VALUES ('Deivi', 'deivi@manual.example.com')");
    $pid = (int)$db->lastInsertId();
    garantirInscricaoNaCategoria($db, $pid, 'misto');
    $externos = poloTimesFixture();
    $externos[0]['players'][] = ['id' => 'p-dei', 'name' => 'Deivi'];
    $r = criarTimesDoPoloperator($db, 'misto', $externos, []);
    assertEqualsT(['times' => 0, 'pessoas' => 0, 'vinculos' => 1], $r['criados'], 'só vincula a pessoa já cadastrada');
    $time = $db->query("SELECT t.nome FROM membros_time mt JOIN times t ON t.id=mt.time_id JOIN inscricoes i ON i.id=mt.inscricao_id WHERE i.pessoa_id=$pid")->fetchColumn();
    assertEqualsT('Time 1', $time, 'Deivi entra no Time 1');
    assertEqualsT('p-dei', $db->query("SELECT poloperator_id FROM pessoas WHERE id=$pid")->fetchColumn(), 'grava o poloperator_id da pessoa existente');
    echo "OK: test_poloperator_atleta_nova_entra_no_time_e_pessoa_sem_time_e_reaproveitada\n";
}

function test_poloperator_nunca_move_atleta_de_time(): void {
    $db = testDb();
    criarTimesDoPoloperator($db, 'misto', poloTimesFixture(), []);
    // No Poloperator, o Kwy aparece agora no Time 1 (e ainda no Time 2 aqui).
    $externos = poloTimesFixture();
    $externos[0]['players'][] = ['id' => 'p-kwy', 'name' => 'Kwy'];
    $externos[1]['players'] = array_values(array_filter($externos[1]['players'], fn($p) => $p['id'] !== 'p-kwy'));
    $plano = planoTimesPoloperator($db, 'misto', $externos, []);
    $kwy = array_values(array_filter($plano['times'][0]['atletas'], fn($a) => $a['externo']['id'] === 'p-kwy'))[0];
    assertEqualsT(['outro_time', 'Time 2'], [$kwy['acao'], $kwy['outro_time']], 'divergência vira aviso');
    $r = criarTimesDoPoloperator($db, 'misto', $externos, []);
    assertEqualsT(0, $r['criados']['vinculos'], 'não move nem duplica o vínculo');
    $times = $db->query("SELECT GROUP_CONCAT(t.nome) FROM membros_time mt JOIN times t ON t.id=mt.time_id JOIN inscricoes i ON i.id=mt.inscricao_id JOIN pessoas p ON p.id=i.pessoa_id WHERE p.nome='Kwy'")->fetchColumn();
    assertEqualsT('Time 2', $times, 'Kwy continua só no Time 2');
    echo "OK: test_poloperator_nunca_move_atleta_de_time\n";
}

function test_email_ficticio_pior_sem_acentos(): void {
    assertEqualsT('mendonca@pior.example.com', emailFicticioPior('Mendonça'), 'cedilha');
    assertEqualsT('emily.ethel@pior.example.com', emailFicticioPior('Emily Ethel'), 'espaço vira ponto');
    assertEqualsT('fabio@pior.example.com', emailFicticioPior('Fábio'), 'acento agudo');
    echo "OK: test_email_ficticio_pior_sem_acentos\n";
}
