<?php

require_once __DIR__ . '/../../public/api/admin/pessoas_lib.php';

function cenarioPessoaComEventos(): array {
    $db = testDb();
    $db->prepare("INSERT INTO times (nome, categoria, codigo) VALUES ('Time Teste', 'misto', 'NOME-TESTE')")->execute();
    $timeId = (int)$db->lastInsertId();
    $db->prepare("
        INSERT INTO pessoas
            (nome, email, foto_path, foto_origem, foto_atualizado_em, poloperator_id)
        VALUES
            ('Nome Antigo', 'nome@teste.local', '/imgs/atletas/321/foto.webp', 'manual', '2026-09-02 10:00:00', 'polo-321')
    ")->execute();
    $pessoaId = (int)$db->lastInsertId();
    $db->prepare("INSERT INTO inscricoes (pessoa_id, status) VALUES (?, 'pago')")->execute([$pessoaId]);
    $inscricaoId = (int)$db->lastInsertId();
    $db->prepare('INSERT INTO membros_time (time_id, inscricao_id) VALUES (?, ?)')->execute([$timeId, $inscricaoId]);
    $membroId = (int)$db->lastInsertId();

    $torneioId = criarTorneioPreset($db, 'misto', 'teste', 'Torneio de teste');
    $db->prepare("INSERT INTO torneio_fases (torneio_id, tipo, rodada, rotulo, estado, conta_classificacao) VALUES (?, 'swiss', 1, 'Rodada 1', 'confirmada', 1)")->execute([$torneioId]);
    $faseId = (int)$db->lastInsertId();
    $db->prepare("INSERT INTO torneio_jogos (torneio_id, fase_id, codigo, ordem, time_a_id, time_b_id, status, placar_a, placar_b) VALUES (?, ?, '1.1', 1, ?, ?, 'encerrado', 1, 0)")->execute([$torneioId, $faseId, $timeId, $timeId]);
    $jogoId = (int)$db->lastInsertId();
    $db->prepare("INSERT INTO torneio_eventos_gol (torneio_id, jogo_id, time_id, membro_id, tipo, removido) VALUES (?, ?, ?, ?, 'normal', 0)")->execute([$torneioId, $jogoId, $timeId, $membroId]);
    $golId = (int)$db->lastInsertId();
    $db->prepare('INSERT INTO torneio_eventos_falta (torneio_id, jogo_id, time_id, membro_id, removido) VALUES (?, ?, ?, ?, 0)')->execute([$torneioId, $jogoId, $timeId, $membroId]);
    $faltaId = (int)$db->lastInsertId();

    return compact('db', 'timeId', 'pessoaId', 'inscricaoId', 'membroId', 'torneioId', 'jogoId', 'golId', 'faltaId');
}

function test_renomear_pessoa_preserva_midia_vinculos_e_eventos(): void {
    $c = cenarioPessoaComEventos();
    /** @var PDO $db */
    $db = $c['db'];
    $antes = $db->query("SELECT foto_path, foto_origem, foto_atualizado_em, poloperator_id FROM pessoas WHERE id = {$c['pessoaId']}")->fetch();

    $nome = renomearPessoa($db, $c['pessoaId'], '  Nome Novo  ');
    assertEqualsT('Nome Novo', $nome, 'Deve normalizar apenas espaços externos do novo nome');

    $depois = $db->query("SELECT nome, foto_path, foto_origem, foto_atualizado_em, poloperator_id FROM pessoas WHERE id = {$c['pessoaId']}")->fetch();
    assertEqualsT('Nome Novo', $depois['nome'], 'Nome deve ser atualizado em pessoas');
    foreach (['foto_path', 'foto_origem', 'foto_atualizado_em', 'poloperator_id'] as $campo) {
        assertEqualsT($antes[$campo], $depois[$campo], "$campo deve permanecer intacto");
    }

    $membro = $db->query("SELECT id, time_id, inscricao_id FROM membros_time WHERE id = {$c['membroId']}")->fetch();
    assertEqualsT($c['timeId'], (int)$membro['time_id'], 'Vínculo com o time deve permanecer');
    assertEqualsT($c['inscricaoId'], (int)$membro['inscricao_id'], 'Vínculo com a inscrição deve permanecer');
    assertEqualsT(1, (int)$db->query("SELECT COUNT(*) FROM inscricoes WHERE id = {$c['inscricaoId']} AND pessoa_id = {$c['pessoaId']}")->fetchColumn(), 'Inscrição deve permanecer ligada à mesma pessoa');

    $gol = $db->query("SELECT id, membro_id FROM torneio_eventos_gol WHERE id = {$c['golId']}")->fetch();
    $falta = $db->query("SELECT id, membro_id FROM torneio_eventos_falta WHERE id = {$c['faltaId']}")->fetch();
    assertEqualsT($c['membroId'], (int)$gol['membro_id'], 'Gol deve continuar associado ao mesmo membro');
    assertEqualsT($c['membroId'], (int)$falta['membro_id'], 'Falta deve continuar associada ao mesmo membro');

    echo "OK: test_renomear_pessoa_preserva_midia_vinculos_e_eventos\n";
}

function test_renomear_pessoa_reflete_nas_leituras_publicas_e_estatisticas(): void {
    $c = cenarioPessoaComEventos();
    /** @var PDO $db */
    $db = $c['db'];
    renomearPessoa($db, $c['pessoaId'], 'Nome Público Atualizado');

    $elenco = getElencoTime($db, $c['timeId']); // usado por torneio-publico.php e pela súmula
    assertEqualsT('Nome Público Atualizado', $elenco[0]['nome'], 'Elenco público deve resolver o nome atual em pessoas');
    assertEqualsT('/imgs/atletas/321/foto.webp', $elenco[0]['foto_path'], 'Elenco público deve preservar a foto');

    $equipes = $db->prepare("
        SELECT p.nome, p.foto_path FROM membros_time mt
        JOIN inscricoes i ON i.id = mt.inscricao_id
        JOIN pessoas p ON p.id = i.pessoa_id
        WHERE mt.time_id = ? AND i.status != 'cancelado'
    ");
    $equipes->execute([$c['timeId']]);
    $atletaPublico = $equipes->fetch(); // mesma cadeia de JOIN de equipes.php/admin/times.php
    assertEqualsT('Nome Público Atualizado', $atletaPublico['nome'], '/equipes deve ler o novo nome');

    $artilharia = calcularArtilharia($db, $c['torneioId'], 'torneio');
    $faltas = calcularFaltasIndividuais($db, $c['torneioId'], 'torneio');
    assertEqualsT($c['membroId'], (int)$artilharia[0]['membro_id'], 'Artilharia deve manter a identidade pelo membro_id');
    assertEqualsT('Nome Público Atualizado', $artilharia[0]['atleta'], 'Artilharia deve refletir o novo nome');
    assertEqualsT($c['membroId'], (int)$faltas[0]['membro_id'], 'Faltas devem manter a identidade pelo membro_id');
    assertEqualsT('Nome Público Atualizado', $faltas[0]['atleta'], 'Faltas devem refletir o novo nome');

    echo "OK: test_renomear_pessoa_reflete_nas_leituras_publicas_e_estatisticas\n";
}

function test_renomear_pessoa_rejeita_nome_vazio(): void {
    $c = cenarioPessoaComEventos();
    assertThrowsT(fn() => renomearPessoa($c['db'], $c['pessoaId'], '   '), 'Nome vazio deve ser rejeitado no backend');
    assertEqualsT('Nome Antigo', $c['db']->query("SELECT nome FROM pessoas WHERE id = {$c['pessoaId']}")->fetchColumn(), 'Falha de validação não pode alterar o registro');
    echo "OK: test_renomear_pessoa_rejeita_nome_vazio\n";
}
