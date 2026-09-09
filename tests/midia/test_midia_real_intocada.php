<?php
/**
 * Regressão do bug que apagou a foto da Luli (pessoa id 1) e o brasão do Tainha Malina
 * (time id 1): a suíte roda com banco em memória, então as entidades de teste nascem com
 * os MESMOS ids de gente real — e a lib de mídia gravava/limpava direto em public/imgs.
 * Cada `php tests/run.php` destruía essas imagens no disco enquanto o banco real seguia
 * apontando pra elas (arquivo sumia, path continuava lá).
 *
 * Estes testes travam a separação: nenhuma operação de mídia pode tocar public/imgs.
 */

require_once __DIR__ . '/../../public/api/admin/pessoas_lib.php';

function caminhoMidiaReal(string $relativo): string {
    return __DIR__ . '/../../public' . $relativo;
}

// 8) Suíte de testes NUNCA escreve ou apaga dentro da mídia real.
function test_midia_de_teste_nao_toca_no_diretorio_real(): void {
    assertTrue(defined('MIDIA_RAIZ'), 'A suíte precisa definir MIDIA_RAIZ antes de carregar a lib de mídia');
    assertTrue(
        !str_contains(str_replace('\\', '/', MIDIA_RAIZ), '/public'),
        'MIDIA_RAIZ nunca pode apontar pra pasta public real'
    );

    $db = testDb();
    $timeId = timeDeTeste($db);
    $pessoaId = pessoaDeTeste($db);
    assertEqualsT(1, $timeId, 'Banco em memória: o primeiro time é id 1 — o mesmo id de um time real');
    assertEqualsT(1, $pessoaId, 'Banco em memória: a primeira pessoa é id 1 — o mesmo id de uma pessoa real');

    $pathTime = salvarImagemTime($db, $timeId, validarImagemArquivo(criarPngTeste()), 'manual');
    $pathPessoa = salvarFotoPessoa($db, $pessoaId, validarImagemArquivo(criarPngTeste()), 'manual');

    assertTrue(is_file(MIDIA_RAIZ . $pathTime), 'Arquivo do teste deve existir na raiz isolada');
    assertTrue(is_file(MIDIA_RAIZ . $pathPessoa), 'Arquivo do teste deve existir na raiz isolada');
    assertTrue(!is_file(caminhoMidiaReal($pathTime)), 'Teste não pode criar arquivo dentro de public/imgs');
    assertTrue(!is_file(caminhoMidiaReal($pathPessoa)), 'Teste não pode criar arquivo dentro de public/imgs');

    // Remoção também tem que ficar confinada à raiz isolada.
    removerLogoTime($db, $timeId);
    removerFotoPessoa($db, $pessoaId);
    assertTrue(!is_file(MIDIA_RAIZ . $pathTime), 'Remoção deve apagar o arquivo da raiz isolada');

    @unlink(MIDIA_RAIZ . $pathPessoa);
    echo "OK: test_midia_de_teste_nao_toca_no_diretorio_real\n";
}

// 1) Editar o nome do atleta não pode encostar na mídia.
function test_renomear_atleta_preserva_foto_no_disco_e_no_banco(): void {
    $db = testDb();
    $pessoaId = pessoaDeTeste($db);
    $path = salvarFotoPessoa($db, $pessoaId, validarImagemArquivo(criarPngTeste()), 'manual');

    renomearPessoa($db, $pessoaId, 'Nome Novo');

    $row = $db->query("SELECT nome, foto_path, foto_origem FROM pessoas WHERE id = $pessoaId")->fetch();
    assertEqualsT('Nome Novo', $row['nome'], 'O nome deve mudar');
    assertEqualsT($path, $row['foto_path'], 'foto_path deve continuar idêntico');
    assertEqualsT('manual', $row['foto_origem'], 'A origem manual deve continuar manual');
    assertTrue(is_file(MIDIA_RAIZ . $path), 'O arquivo em disco não pode ser apagado por uma renomeação');

    @unlink(MIDIA_RAIZ . $path);
    echo "OK: test_renomear_atleta_preserva_foto_no_disco_e_no_banco\n";
}

// 4) Renomear o time não pode encostar no brasão.
function test_renomear_time_preserva_logo_no_disco_e_no_banco(): void {
    $db = testDb();
    $timeId = timeDeTeste($db);
    $path = salvarImagemTime($db, $timeId, validarImagemArquivo(criarPngTeste()), 'manual');

    $db->prepare('UPDATE times SET nome = ? WHERE id = ?')->execute(['Outro Nome', $timeId]);

    $row = $db->query("SELECT logo_path, logo_origem FROM times WHERE id = $timeId")->fetch();
    assertEqualsT($path, $row['logo_path'], 'logo_path deve continuar idêntico');
    assertEqualsT('manual', $row['logo_origem'], 'A origem manual deve continuar manual');
    assertTrue(is_file(MIDIA_RAIZ . $path), 'O arquivo do brasão não pode sumir do disco');

    @unlink(MIDIA_RAIZ . $path);
    echo "OK: test_renomear_time_preserva_logo_no_disco_e_no_banco\n";
}

// 6) Zerar resultados do torneio não pode encostar em mídia.
function test_zerar_resultados_preserva_midia_de_times_e_pessoas(): void {
    $db = testDb();
    $timeId = timeDeTeste($db);
    $pessoaId = pessoaDeTeste($db);
    $logo = salvarImagemTime($db, $timeId, validarImagemArquivo(criarPngTeste()), 'manual');
    $foto = salvarFotoPessoa($db, $pessoaId, validarImagemArquivo(criarPngTeste()), 'manual');

    $torneioId = criarTorneioPreset($db, 'misto', 'teste');
    zerarResultados($db, $torneioId, 'teste');

    assertEqualsT($logo, $db->query("SELECT logo_path FROM times WHERE id = $timeId")->fetchColumn(), 'Zerar resultados não pode limpar logo_path');
    assertEqualsT($foto, $db->query("SELECT foto_path FROM pessoas WHERE id = $pessoaId")->fetchColumn(), 'Zerar resultados não pode limpar foto_path');
    assertTrue(is_file(MIDIA_RAIZ . $logo) && is_file(MIDIA_RAIZ . $foto), 'Zerar resultados não pode apagar arquivos de mídia');

    @unlink(MIDIA_RAIZ . $logo);
    @unlink(MIDIA_RAIZ . $foto);
    echo "OK: test_zerar_resultados_preserva_midia_de_times_e_pessoas\n";
}

// 3/5) Importação do Poloperator nunca sobrescreve mídia manual — nem do time, nem da pessoa.
function test_importacao_nao_sobrescreve_midia_manual(): void {
    $db = testDb();
    $timeId = timeDeTeste($db);
    $pessoaId = pessoaDeTeste($db);
    $logo = salvarImagemTime($db, $timeId, validarImagemArquivo(criarPngTeste()), 'manual');
    $foto = salvarFotoPessoa($db, $pessoaId, validarImagemArquivo(criarPngTeste()), 'manual');

    assertThrowsT(
        fn() => salvarImagemTime($db, $timeId, validarImagemArquivo(criarPngTeste()), 'importado', 'polo-time'),
        'Importação não pode sobrescrever brasão manual'
    );
    assertThrowsT(
        fn() => salvarFotoPessoa($db, $pessoaId, validarImagemArquivo(criarPngTeste()), 'importado', 'polo-pessoa'),
        'Importação não pode sobrescrever foto manual'
    );

    assertEqualsT($logo, $db->query("SELECT logo_path FROM times WHERE id = $timeId")->fetchColumn(), 'Brasão manual intacto após tentativa de importação');
    assertEqualsT($foto, $db->query("SELECT foto_path FROM pessoas WHERE id = $pessoaId")->fetchColumn(), 'Foto manual intacta após tentativa de importação');
    assertTrue(is_file(MIDIA_RAIZ . $logo) && is_file(MIDIA_RAIZ . $foto), 'Arquivos manuais continuam em disco');

    @unlink(MIDIA_RAIZ . $logo);
    @unlink(MIDIA_RAIZ . $foto);
    echo "OK: test_importacao_nao_sobrescreve_midia_manual\n";
}
