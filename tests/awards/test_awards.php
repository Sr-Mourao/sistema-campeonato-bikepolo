<?php

function seedAwardsPessoa(PDO $db, string $nome, array $categorias, string $tipo = 'atleta', string $status = 'pago'): int
{
    $email = strtolower(preg_replace('/\W+/', '.', $nome)) . '.' . bin2hex(random_bytes(2)) . '@awards.test';
    $db->prepare("INSERT INTO pessoas (nome, email) VALUES (?, ?)")->execute([$nome, $email]);
    $pessoaId = (int)$db->lastInsertId();
    $db->prepare("INSERT INTO inscricoes (pessoa_id, status, tipo_participacao) VALUES (?, ?, ?)")->execute([$pessoaId, $status, $tipo]);
    $inscricaoId = (int)$db->lastInsertId();
    foreach ($categorias as $categoria) $db->prepare("INSERT INTO inscricao_categorias (inscricao_id, categoria, valor) VALUES (?, ?, 0)")->execute([$inscricaoId, $categoria]);
    return $pessoaId;
}

function abrirAwardsTeste(PDO $db, array $curados): void
{
    awardsDefinirCuradoria($db, 'revelacao', $curados, 'teste');
    awardsDefinirCuradoria($db, 'jesse', $curados, 'teste');
    awardsAlterarStatus($db, 'aberta', 'teste');
}

function votosAwardsPara(array $ids): array
{
    return ['mvp' => $ids[0], 'wow' => $ids[1], 'revelacao' => $ids[2], 'jesse' => $ids[3]];
}

function test_awards_escopo_e_exclusivamente_misto(): void
{
    $db = testDb();
    $misto = seedAwardsPessoa($db, 'Atleta Misto', ['misto']);
    $mtnb = seedAwardsPessoa($db, 'Atleta MTNB', ['mtnb']);
    $ambos = seedAwardsPessoa($db, 'Atleta Ambas', ['misto', 'mtnb']);
    $apoio = seedAwardsPessoa($db, 'Pessoa Apoio', ['misto'], 'acompanhante');
    $cancelado = seedAwardsPessoa($db, 'Misto Cancelado', ['misto'], 'atleta', 'cancelado');
    assertTrue(awardsPessoaEhAtletaMisto($db, $misto), 'atleta MISTO pode participar');
    assertFalse(awardsPessoaEhAtletaMisto($db, $mtnb), 'atleta exclusivamente MTNB não participa');
    assertTrue(awardsPessoaEhAtletaMisto($db, $ambos), 'atleta MISTO + MTNB participa por causa do MISTO');
    assertFalse(awardsPessoaEhAtletaMisto($db, $apoio), 'não atleta não participa');
    assertFalse(awardsPessoaEhAtletaMisto($db, $cancelado), 'inscrição cancelada não participa');
    assertEqualsT([$ambos, $misto], array_column(awardsAtletasMisto($db), 'pessoa_id'), 'lista canônica contém somente atletas do MISTO em ordem nominal');
    echo "OK: test_awards_escopo_e_exclusivamente_misto\n";
}

function test_awards_candidatos_automaticos_curadoria_e_autovoto(): void
{
    $db = testDb();
    $a = seedAwardsPessoa($db, 'Ana Misto', ['misto']);
    $b = seedAwardsPessoa($db, 'Bia Misto', ['misto']);
    $c = seedAwardsPessoa($db, 'Caio Misto', ['misto']);
    $mtnb = seedAwardsPessoa($db, 'Dani MTNB', ['mtnb']);
    assertEqualsT([$b, $c], array_column(awardsCandidatos($db, 'mvp', $a), 'pessoa_id'), 'MVP traz todos MISTO exceto eleitor');
    assertEqualsT([$b, $c], array_column(awardsCandidatos($db, 'wow', $a), 'pessoa_id'), 'WOW traz todos MISTO exceto eleitor');
    awardsDefinirCuradoria($db, 'revelacao', [$b], 'teste');
    awardsDefinirCuradoria($db, 'jesse', [$a, $c], 'teste');
    assertEqualsT([$b], array_column(awardsCandidatos($db, 'revelacao'), 'pessoa_id'), 'Revelação usa apenas curadoria');
    assertEqualsT([$a, $c], array_column(awardsCandidatos($db, 'jesse'), 'pessoa_id'), 'Jessé usa apenas curadoria');
    assertThrowsT(fn() => awardsDefinirCuradoria($db, 'jesse', [$mtnb], 'teste'), 'MTNB não pode entrar na curadoria');
    awardsDefinirCuradoria($db, 'jesse', array_column(awardsAtletasMisto($db), 'pessoa_id'), 'teste');
    assertEqualsT([$a, $b, $c], array_column(awardsCandidatos($db, 'jesse'), 'pessoa_id'), 'adicionar todos significa somente atletas MISTO');
    echo "OK: test_awards_candidatos_automaticos_curadoria_e_autovoto\n";
}

function test_awards_validacao_abertura_e_bloqueio_curadoria(): void
{
    $db = testDb();
    $a = seedAwardsPessoa($db, 'Ana', ['misto']);
    assertThrowsT(fn() => awardsAlterarStatus($db, 'aberta', 'teste'), 'não abre sem curadorias');
    awardsDefinirCuradoria($db, 'revelacao', [$a], 'teste');
    assertThrowsT(fn() => awardsAlterarStatus($db, 'aberta', 'teste'), 'não abre sem Jessé');
    awardsDefinirCuradoria($db, 'jesse', [$a], 'teste');
    awardsAlterarStatus($db, 'aberta', 'teste');
    assertEqualsT('aberta', awardsStatus($db), 'abertura válida');
    assertThrowsT(fn() => awardsDefinirCuradoria($db, 'jesse', [], 'teste'), 'curadoria bloqueada após abrir');
    awardsAlterarStatus($db, 'encerrada', 'teste');
    assertEqualsT('encerrada', awardsStatus($db), 'encerramento congela votação');
    echo "OK: test_awards_validacao_abertura_e_bloqueio_curadoria\n";
}

function test_awards_voto_atomico_upsert_e_seguranca(): void
{
    $db = testDb();
    $eleitor = seedAwardsPessoa($db, 'Eleitor', ['misto']);
    $a = seedAwardsPessoa($db, 'Candidata A', ['misto']);
    $b = seedAwardsPessoa($db, 'Candidata B', ['misto']);
    $c = seedAwardsPessoa($db, 'Candidata C', ['misto']);
    $d = seedAwardsPessoa($db, 'Candidata D', ['misto']);
    $mtnb = seedAwardsPessoa($db, 'Somente MTNB', ['mtnb']);
    assertThrowsT(fn() => awardsSalvarVotos($db, $eleitor, votosAwardsPara([$a, $b, $c, $d])), 'não vota com votação fechada');
    abrirAwardsTeste($db, [$a, $b, $c, $d]);
    assertThrowsT(fn() => awardsSalvarVotos($db, $eleitor, votosAwardsPara([$eleitor, $b, $c, $d])), 'backend rejeita autovoto');
    assertThrowsT(fn() => awardsSalvarVotos($db, $eleitor, votosAwardsPara([$mtnb, $b, $c, $d])), 'backend rejeita candidato MTNB');
    assertThrowsT(fn() => awardsSalvarVotos($db, $eleitor, ['mvp' => $a]), 'backend rejeita voto incompleto');
    awardsSalvarVotos($db, $eleitor, votosAwardsPara([$a, $b, $c, $d]));
    assertEqualsT(4, (int)$db->query("SELECT COUNT(*) FROM awards_votos")->fetchColumn(), 'quatro votos gravados atomicamente');
    awardsSalvarVotos($db, $eleitor, votosAwardsPara([$b, $a, $d, $c]));
    assertEqualsT(4, (int)$db->query("SELECT COUNT(*) FROM awards_votos")->fetchColumn(), 'upsert não duplica categoria');
    assertEqualsT($b, awardsVotosPessoa($db, $eleitor)['mvp'], 'voto pode ser alterado enquanto aberta');
    awardsAlterarStatus($db, 'encerrada', 'teste');
    assertThrowsT(fn() => awardsSalvarVotos($db, $eleitor, votosAwardsPara([$a, $b, $c, $d])), 'não altera após encerramento');
    echo "OK: test_awards_voto_atomico_upsert_e_seguranca\n";
}

function test_awards_autenticacao_deriva_permissao_do_misto(): void
{
    $db = testDb();
    $misto = seedAwardsPessoa($db, 'Misto Login', ['misto']);
    $mtnb = seedAwardsPessoa($db, 'MTNB Login', ['mtnb']);
    foreach ([[$misto, 'token-misto'], [$mtnb, 'token-mtnb']] as [$id, $token]) {
        $email = $db->query("SELECT email FROM pessoas WHERE id = $id")->fetchColumn();
        $db->prepare("INSERT INTO sessions (token, email, expires_at) VALUES (?, ?, datetime('now', '+1 day'))")->execute([$token, $email]);
    }
    assertEqualsT($misto, awardsPessoaAutenticada($db, 'token-misto')['pessoa_id'], 'sessão MISTO autorizada');
    assertThrowsT(fn() => awardsPessoaAutenticada($db, 'token-mtnb'), 'sessão exclusivamente MTNB negada');
    assertThrowsT(fn() => awardsPessoaAutenticada($db, 'inexistente'), 'usuário sem sessão negado');
    echo "OK: test_awards_autenticacao_deriva_permissao_do_misto\n";
}

function test_awards_permissao_de_voto_misto_ambas_mtnb_e_nao_atleta(): void
{
    $db = testDb();
    $ambas = seedAwardsPessoa($db, 'Eleitora Ambas', ['misto', 'mtnb']);
    $soMtnb = seedAwardsPessoa($db, 'Eleitor MTNB', ['mtnb']);
    $apoio = seedAwardsPessoa($db, 'Pessoa Não Atleta', ['misto'], 'acompanhante');
    $candidatos = [
        seedAwardsPessoa($db, 'Candidato Um', ['misto']),
        seedAwardsPessoa($db, 'Candidato Dois', ['misto']),
        seedAwardsPessoa($db, 'Candidato Três', ['misto']),
        seedAwardsPessoa($db, 'Candidato Quatro', ['misto']),
    ];
    abrirAwardsTeste($db, $candidatos);
    awardsSalvarVotos($db, $ambas, votosAwardsPara($candidatos));
    assertEqualsT(4, count(awardsVotosPessoa($db, $ambas)), 'atleta MISTO + MTNB consegue votar por ser MISTO');
    assertThrowsT(fn() => awardsSalvarVotos($db, $soMtnb, votosAwardsPara($candidatos)), 'atleta exclusivamente MTNB não consegue votar');
    assertThrowsT(fn() => awardsSalvarVotos($db, $apoio, votosAwardsPara($candidatos)), 'pessoa não atleta não consegue votar');
    echo "OK: test_awards_permissao_de_voto_misto_ambas_mtnb_e_nao_atleta\n";
}

function test_awards_apuracao_preserva_empates_multiplos(): void
{
    $db = testDb();
    $a = seedAwardsPessoa($db, 'Ana', ['misto']);
    $b = seedAwardsPessoa($db, 'Bia', ['misto']);
    $c = seedAwardsPessoa($db, 'Caio', ['misto']);
    $d = seedAwardsPessoa($db, 'Dani', ['misto']);
    abrirAwardsTeste($db, [$a, $b, $c, $d]);
    $insert = $db->prepare("INSERT INTO awards_votos (eleitor_pessoa_id, categoria, candidato_pessoa_id) VALUES (?, 'mvp', ?)");
    $insert->execute([$a, $b]); $insert->execute([$b, $a]);
    $r = awardsApuracao($db)['mvp'];
    assertTrue($r['empate'], 'empate entre duas pessoas é preservado');
    assertEqualsT([$a, $b], array_column($r['vencedores'], 'pessoa_id'), 'dois vencedores retornados em lista');
    $insert->execute([$c, $d]);
    $r3 = awardsApuracao($db)['mvp'];
    assertTrue($r3['empate'], 'empate triplo é preservado');
    assertEqualsT([$a, $b, $d], array_column($r3['vencedores'], 'pessoa_id'), 'todos os três vencedores são retornados');
    assertFalse(array_key_exists('winner', $r3), 'API não presume vencedor único');
    echo "OK: test_awards_apuracao_preserva_empates_multiplos\n";
}

function test_awards_apuracao_funciona_desde_o_primeiro_voto_e_zero_nao_e_empate(): void
{
    $db = testDb();
    $eleitor = seedAwardsPessoa($db, 'Eleitor Único', ['misto']);
    $ana = seedAwardsPessoa($db, 'Ana', ['misto']);
    $bruno = seedAwardsPessoa($db, 'Bruno', ['misto']);
    $carlos = seedAwardsPessoa($db, 'Carlos', ['misto']);
    abrirAwardsTeste($db, [$ana, $bruno, $carlos]);

    $semVotos = awardsApuracao($db);
    foreach (['mvp', 'wow', 'revelacao', 'jesse'] as $categoria) {
        assertEqualsT(0, $semVotos[$categoria]['maior_quantidade'], "$categoria sem votos tem maior quantidade zero");
        assertEqualsT([], $semVotos[$categoria]['vencedores'], "$categoria sem votos não inventa vencedores");
        assertFalse($semVotos[$categoria]['empate'], "$categoria sem votos não é empate");
    }

    awardsSalvarVotos($db, $eleitor, ['mvp' => $ana, 'wow' => $bruno, 'revelacao' => $carlos, 'jesse' => $ana]);
    $apuracao = awardsApuracao($db);
    $esperados = ['mvp' => $ana, 'wow' => $bruno, 'revelacao' => $carlos, 'jesse' => $ana];
    foreach ($esperados as $categoria => $pessoaId) {
        assertEqualsT(1, $apuracao[$categoria]['maior_quantidade'], "$categoria apura desde o primeiro voto");
        assertEqualsT([$pessoaId], array_column($apuracao[$categoria]['vencedores'], 'pessoa_id'), "$categoria retorna o vencedor correto com um voto");
        assertFalse($apuracao[$categoria]['empate'], "$categoria possui vencedor único");
    }
    echo "OK: test_awards_apuracao_funciona_desde_o_primeiro_voto_e_zero_nao_e_empate\n";
}

function test_awards_zerar_dados_remove_votos_curadorias_e_preserva_atletas(): void
{
    $db = testDb();
    $eleitor = seedAwardsPessoa($db, 'Eleitor Reset', ['misto']);
    $a = seedAwardsPessoa($db, 'Candidata Reset A', ['misto']);
    $b = seedAwardsPessoa($db, 'Candidata Reset B', ['misto']);
    $c = seedAwardsPessoa($db, 'Candidata Reset C', ['misto']);
    abrirAwardsTeste($db, [$a, $b, $c]);
    awardsSalvarVotos($db, $eleitor, ['mvp' => $a, 'wow' => $b, 'revelacao' => $c, 'jesse' => $a]);
    awardsAlterarStatus($db, 'encerrada', 'teste');

    $aptosAntes = array_column(awardsAtletasMisto($db), 'pessoa_id');
    awardsZerarDados($db, 'admin-reset');

    assertEqualsT('fechada', awardsStatus($db), 'reset retorna votação para FECHADA');
    assertEqualsT(0, (int)$db->query("SELECT COUNT(*) FROM awards_votos")->fetchColumn(), 'reset remove todos os votos');
    assertEqualsT(0, (int)$db->query("SELECT COUNT(*) FROM awards_candidatos")->fetchColumn(), 'reset remove todas as curadorias');
    assertEqualsT($aptosAntes, array_column(awardsAtletasMisto($db), 'pessoa_id'), 'reset preserva atletas MISTO');
    $config = $db->query("SELECT aberta_em, encerrada_em, atualizado_por FROM awards_config WHERE id = 1")->fetch();
    assertNullT($config['aberta_em'], 'reset limpa timestamp de abertura');
    assertNullT($config['encerrada_em'], 'reset limpa timestamp de encerramento');
    assertEqualsT('admin-reset', $config['atualizado_por'], 'reset registra o admin responsável');
    echo "OK: test_awards_zerar_dados_remove_votos_curadorias_e_preserva_atletas\n";
}
