<?php
// Validação e armazenamento de brasão/foto (migração de mídia) — sem rede, arquivos de
// fixture reais (imagem PNG mínima válida, SVG malicioso de exemplo).

const TESTE_PNG_1X1_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function criarArquivoTeste(string $conteudo, string $sufixo = ''): string {
    $tmp = tempnam(sys_get_temp_dir(), 'midiateste_') . $sufixo;
    file_put_contents($tmp, $conteudo);
    return $tmp;
}

function criarPngTeste(): string {
    return criarArquivoTeste(base64_decode(TESTE_PNG_1X1_BASE64), '.png');
}

function test_validar_imagem_arquivo_aceita_png_valido(): void {
    $png = criarPngTeste();
    $arquivo = validarImagemArquivo($png);
    assertEqualsT('image/png', $arquivo['mime'], 'PNG válido deve ser aceito com o MIME real');
    assertEqualsT('png', $arquivo['ext'], 'Extensão deve vir do MIME detectado, não do nome do arquivo');
    @unlink($png);
    echo "OK: test_validar_imagem_arquivo_aceita_png_valido\n";
}

// SVG é um formato executável (pode ter <script>) — nunca aceito, mesmo que a extensão/MIME
// "pareça" imagem (seção 9 do brief de migração de mídia).
function test_validar_imagem_arquivo_rejeita_svg(): void {
    $svg = criarArquivoTeste('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', '.svg');
    assertThrowsT(fn() => validarImagemArquivo($svg), 'SVG nunca deve ser aceito, mesmo sem payload malicioso óbvio');
    @unlink($svg);
    echo "OK: test_validar_imagem_arquivo_rejeita_svg\n";
}

function test_validar_imagem_arquivo_rejeita_arquivo_nao_imagem(): void {
    $txt = criarArquivoTeste('isso nao e uma imagem, so texto puro', '.jpg'); // extensão mentirosa
    assertThrowsT(fn() => validarImagemArquivo($txt), 'Extensão não decide nada — MIME real reprova um arquivo de texto disfarçado');
    @unlink($txt);
    echo "OK: test_validar_imagem_arquivo_rejeita_arquivo_nao_imagem\n";
}

function test_validar_imagem_arquivo_rejeita_arquivo_grande(): void {
    // Maior que MIDIA_MAX_BYTES, sem precisar gerar uma imagem gigante de verdade.
    $grande = criarArquivoTeste(str_repeat('0', MIDIA_MAX_BYTES + 1), '.bin');
    assertThrowsT(fn() => validarImagemArquivo($grande), 'Arquivo maior que o limite deve ser rejeitado');
    @unlink($grande);
    echo "OK: test_validar_imagem_arquivo_rejeita_arquivo_grande\n";
}

function timeDeTeste(PDO $db): int {
    $sufixo = substr(bin2hex(random_bytes(3)), 0, 6);
    $db->prepare("INSERT INTO times (nome, categoria, codigo) VALUES (?, 'misto', ?)")->execute(["Time Mídia $sufixo", "TM$sufixo"]);
    return (int)$db->lastInsertId();
}

function pessoaDeTeste(PDO $db): int {
    $sufixo = substr(bin2hex(random_bytes(3)), 0, 6);
    $db->prepare("INSERT INTO pessoas (nome, email) VALUES (?, ?)")->execute(["Pessoa Mídia $sufixo", "midia{$sufixo}@teste.local"]);
    return (int)$db->lastInsertId();
}

function test_salvar_imagem_time_grava_path_origem_e_timestamp(): void {
    $db = testDb();
    $timeId = timeDeTeste($db);
    $arquivo = validarImagemArquivo(criarPngTeste());

    $path = salvarImagemTime($db, $timeId, $arquivo, 'manual');
    assertTrue(str_starts_with($path, "/imgs/times/$timeId/"), 'Caminho deve ser público e organizado por ID interno, não por nome');
    assertTrue(is_file(MIDIA_RAIZ . $path), 'Arquivo deve realmente existir em disco no caminho gravado');

    $stmt = $db->prepare("SELECT logo_path, logo_origem, logo_atualizado_em FROM times WHERE id = ?");
    $stmt->execute([$timeId]);
    $row = $stmt->fetch();
    assertEqualsT($path, $row['logo_path'], 'logo_path no banco deve bater com o caminho devolvido');
    assertEqualsT('manual', $row['logo_origem'], 'Origem deve ser gravada corretamente');
    assertTrue($row['logo_atualizado_em'] !== null, 'Timestamp de atualização deve ser gravado');

    @unlink(MIDIA_RAIZ . $path);
    echo "OK: test_salvar_imagem_time_grava_path_origem_e_timestamp\n";
}

// Precedência (seção 16 do brief): upload manual nunca é sobrescrito por uma reimportação
// automática do Poloperator.
function test_salvar_imagem_time_manual_nao_e_sobrescrita_por_importacao(): void {
    $db = testDb();
    $timeId = timeDeTeste($db);

    $manualPath = salvarImagemTime($db, $timeId, validarImagemArquivo(criarPngTeste()), 'manual');

    assertThrowsT(
        fn() => salvarImagemTime($db, $timeId, validarImagemArquivo(criarPngTeste()), 'importado'),
        'Reimportação automática não pode sobrescrever uma imagem definida manualmente'
    );

    $stmt = $db->prepare("SELECT logo_path, logo_origem FROM times WHERE id = ?");
    $stmt->execute([$timeId]);
    $row = $stmt->fetch();
    assertEqualsT($manualPath, $row['logo_path'], 'Caminho da imagem manual deve permanecer intacto');
    assertEqualsT('manual', $row['logo_origem'], 'Origem deve continuar manual');

    @unlink(MIDIA_RAIZ . $manualPath);
    echo "OK: test_salvar_imagem_time_manual_nao_e_sobrescrita_por_importacao\n";
}

// Uma segunda importação (origem='importado' de novo) PODE atualizar uma imagem que já
// era 'importado' — só 'manual' é protegida.
function test_salvar_imagem_time_importado_pode_ser_atualizado_por_nova_importacao(): void {
    $db = testDb();
    $timeId = timeDeTeste($db);

    salvarImagemTime($db, $timeId, validarImagemArquivo(criarPngTeste()), 'importado', 'poloid-1');
    $novoPath = salvarImagemTime($db, $timeId, validarImagemArquivo(criarPngTeste()), 'importado', 'poloid-1');

    $stmt = $db->prepare("SELECT logo_path, poloperator_id FROM times WHERE id = ?");
    $stmt->execute([$timeId]);
    $row = $stmt->fetch();
    assertEqualsT($novoPath, $row['logo_path'], 'Segunda importação deve atualizar a imagem normalmente');
    assertEqualsT('poloid-1', $row['poloperator_id'], 'poloperator_id deve ficar gravado pra próximas importações');

    @unlink(MIDIA_RAIZ . $novoPath);
    echo "OK: test_salvar_imagem_time_importado_pode_ser_atualizado_por_nova_importacao\n";
}

function test_remover_logo_time_limpa_banco_e_arquivo(): void {
    $db = testDb();
    $timeId = timeDeTeste($db);
    $path = salvarImagemTime($db, $timeId, validarImagemArquivo(criarPngTeste()), 'manual');
    $caminhoFisico = MIDIA_RAIZ . $path;
    assertTrue(is_file($caminhoFisico), 'Pré-condição: arquivo deve existir antes de remover');

    removerLogoTime($db, $timeId);

    assertFalse(is_file($caminhoFisico), 'Arquivo deve ser apagado do disco ao remover');
    $stmt = $db->prepare("SELECT logo_path, logo_origem FROM times WHERE id = ?");
    $stmt->execute([$timeId]);
    $row = $stmt->fetch();
    assertEqualsT(null, $row['logo_path'], 'logo_path deve voltar a NULL');
    assertEqualsT(null, $row['logo_origem'], 'logo_origem deve voltar a NULL');
    echo "OK: test_remover_logo_time_limpa_banco_e_arquivo\n";
}

// Espelho pra pessoas — mesma política de precedência que times.
function test_salvar_foto_pessoa_respeita_precedencia_manual(): void {
    $db = testDb();
    $pessoaId = pessoaDeTeste($db);
    $manualPath = salvarFotoPessoa($db, $pessoaId, validarImagemArquivo(criarPngTeste()), 'manual');

    assertThrowsT(
        fn() => salvarFotoPessoa($db, $pessoaId, validarImagemArquivo(criarPngTeste()), 'importado'),
        'Foto manual do atleta não pode ser sobrescrita por importação automática'
    );

    $stmt = $db->prepare("SELECT foto_path FROM pessoas WHERE id = ?");
    $stmt->execute([$pessoaId]);
    assertEqualsT($manualPath, $stmt->fetchColumn(), 'Foto manual deve permanecer intacta');

    @unlink(MIDIA_RAIZ . $manualPath);
    echo "OK: test_salvar_foto_pessoa_respeita_precedencia_manual\n";
}

function test_url_com_cache_bust_muda_ao_atualizar(): void {
    $v1 = urlComCacheBust('/imgs/times/1/logo.webp', '2026-01-01 10:00:00');
    $v2 = urlComCacheBust('/imgs/times/1/logo.webp', '2026-01-02 10:00:00');
    assertTrue($v1 !== $v2, 'URLs com timestamps diferentes devem gerar cache-bust diferente');
    assertEqualsT(null, urlComCacheBust(null, null), 'Sem path, deve devolver null (nunca inventar URL)');
    echo "OK: test_url_com_cache_bust_muda_ao_atualizar\n";
}
