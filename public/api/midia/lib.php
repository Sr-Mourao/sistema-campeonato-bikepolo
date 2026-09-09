<?php
/**
 * Brasões de time / fotos de atleta — fonte canônica de validação e armazenamento.
 *
 * Regras centrais (ver PLAN.md / migração Poloperator → interno):
 * - Banco guarda só caminho + metadados. NUNCA base64/BLOB.
 * - Arquivos ficam em public/imgs/times/{id}/ e public/imgs/atletas/{id}/ — nome do
 *   arquivo é sempre derivado do ID interno + MIME real detectado, nunca do nome
 *   enviado pelo cliente nem da extensão que ele mandou (evita path traversal e
 *   upload disfarçado).
 * - `origem` ('manual'|'importado') decide precedência: upload manual pelo admin NUNCA
 *   é sobrescrito por uma reimportação automática do Poloperator — só por outro upload
 *   manual, ou por uma reimportação explicitamente forçada (fora do fluxo automático).
 * - Sem GD/Imagick no servidor: não normalizamos/reconvertemos aqui. Upload manual do
 *   admin já chega redimensionado/convertido pra WebP (feito no navegador antes do
 *   POST); import do Poloperator baixa o arquivo como está (já vem em .webp de lá) e só
 *   valida que é uma imagem de verdade, de tamanho/dimensão razoável.
 */

const MIDIA_MIME_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];
const MIDIA_MIME_EXT = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
const MIDIA_MAX_BYTES = 3 * 1024 * 1024; // 3MB — generoso pra foto de celular, curto pra abuso
const MIDIA_MAX_DIMENSAO = 4000; // px — recusa imagem "canhão" (ex. foto de câmera sem compressão)

/** Remove acentos/caixa/espaços duplicados — usado só pra DECIDIR SE HÁ MATCH, nunca pra
 * decidir dado esportivo. Mesma normalização (conceitualmente) do lado React. */
function normalizaNome(string $s): string {
    $semAcento = @iconv('UTF-8', 'ASCII//TRANSLIT', $s);
    if ($semAcento === false) $semAcento = $s; // iconv pode falhar em runtimes sem locale — degrada sem quebrar
    $s = mb_strtolower($semAcento, 'UTF-8');
    // TRANSLIT em algumas builds de libiconv deixa resíduo (ex.: "ô" vira "o^", não só "o")
    // — remove qualquer coisa que não seja letra/dígito/espaço antes de colapsar espaços.
    $s = preg_replace('/[^a-z0-9\s]/', '', $s);
    $s = trim(preg_replace('/\s+/', ' ', $s));
    return $s;
}

/**
 * Valida um arquivo de upload ($_FILES[...] de UM arquivo) e devolve o MIME real + a
 * extensão correspondente. Lança RuntimeException com mensagem amigável se inválido.
 * Nunca confia em `$file['type']`/nome/extensão enviados pelo cliente.
 */
function validarImagemUpload(array $file): array {
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        throw new RuntimeException('Falha no upload do arquivo.');
    }
    if (!is_uploaded_file($file['tmp_name'] ?? '')) {
        throw new RuntimeException('Arquivo de upload inválido.');
    }
    if ((int)($file['size'] ?? 0) > MIDIA_MAX_BYTES) {
        throw new RuntimeException('Imagem muito grande (máx. ' . (MIDIA_MAX_BYTES / 1024 / 1024) . 'MB).');
    }

    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);
    if (!in_array($mime, MIDIA_MIME_PERMITIDOS, true)) {
        throw new RuntimeException('Formato inválido. Use JPEG, PNG ou WebP.');
    }

    $dimensoes = @getimagesize($file['tmp_name']);
    if ($dimensoes === false) {
        throw new RuntimeException('Arquivo não é uma imagem válida.');
    }
    [$largura, $altura] = $dimensoes;
    if ($largura > MIDIA_MAX_DIMENSAO || $altura > MIDIA_MAX_DIMENSAO) {
        throw new RuntimeException('Dimensões da imagem são grandes demais.');
    }

    return ['tmp_name' => $file['tmp_name'], 'mime' => $mime, 'ext' => MIDIA_MIME_EXT[$mime]];
}

/**
 * Mesma validação, mas pra um arquivo JÁ BAIXADO em disco (fluxo de importação do
 * Poloperator, sem $_FILES). Reaproveita as mesmas regras — nunca uma segunda política.
 */
function validarImagemArquivo(string $caminho): array {
    if (!is_file($caminho) || filesize($caminho) > MIDIA_MAX_BYTES) {
        throw new RuntimeException('Arquivo baixado é inválido ou grande demais.');
    }
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime = finfo_file($finfo, $caminho);
    finfo_close($finfo);
    if (!in_array($mime, MIDIA_MIME_PERMITIDOS, true)) {
        throw new RuntimeException('Arquivo baixado não é uma imagem em formato aceito.');
    }
    $dimensoes = @getimagesize($caminho);
    if ($dimensoes === false) {
        throw new RuntimeException('Arquivo baixado não é uma imagem válida.');
    }
    [$largura, $altura] = $dimensoes;
    if ($largura > MIDIA_MAX_DIMENSAO || $altura > MIDIA_MAX_DIMENSAO) {
        throw new RuntimeException('Dimensões da imagem baixada são grandes demais.');
    }
    return ['tmp_name' => $caminho, 'mime' => $mime, 'ext' => MIDIA_MIME_EXT[$mime]];
}

/**
 * Raiz física da mídia. Em produção é sempre `public/`; a suíte de testes redefine
 * MIDIA_RAIZ para um diretório temporário ANTES de carregar esta lib.
 *
 * Isto não é cosmético: o banco de teste é `sqlite::memory:`, então a primeira pessoa e
 * o primeiro time inseridos recebem SEMPRE id = 1 — e sem esta raiz separada as funções
 * abaixo gravavam e apagavam dentro de public/imgs/atletas/1 e public/imgs/times/1, que
 * são mídia REAL de gente de verdade. Rodar a suíte destruía essas imagens no disco
 * enquanto o banco real seguia apontando pra elas.
 */
function midiaRaiz(): string {
    return defined('MIDIA_RAIZ') ? MIDIA_RAIZ : __DIR__ . '/../..';
}

/** Diretório físico + prefixo de URL pública pra uma entidade ('times'|'atletas'). */
function midiaDiretorio(string $entidade, int $id): array {
    $dir = midiaRaiz() . "/imgs/$entidade/$id";
    $urlBase = "/imgs/$entidade/$id";
    return [$dir, $urlBase];
}

/** Apaga o conteúdo de um diretório de mídia, exceto o arquivo indicado em $manterNome
 * (se houver) — usado ao trocar de arquivo, sempre DEPOIS do novo já estar gravado com
 * sucesso, nunca antes (evita ficar sem nenhum arquivo se a gravação do novo falhar). */
function limparDiretorioMidia(string $dir, ?string $manterNome = null): void {
    if (!is_dir($dir)) return;
    foreach (glob($dir . '/*') ?: [] as $f) {
        if (is_file($f) && basename($f) !== $manterNome) @unlink($f);
    }
}

/** `?v=timestamp` — trocar a imagem sempre muda a URL, nunca fica cache velho no navegador. */
function urlComCacheBust(?string $path, ?string $atualizadoEm): ?string {
    if (!$path) return null;
    if (!$atualizadoEm) return $path;
    $v = strtotime($atualizadoEm) ?: time();
    return $path . '?v=' . $v;
}

/**
 * Grava o brasão de um time — MOVE/COPIA o arquivo validado pro diretório do time e
 * atualiza `times.logo_path/logo_origem/logo_atualizado_em` (e `poloperator_id` quando
 * informado). Respeita precedência: só sobrescreve se a origem atual não for 'manual',
 * A MENOS que $forcar seja true (reimportação explícita). Copia (não move) o arquivo de
 * origem pra funcionar tanto com um tmp_name de upload quanto com um arquivo baixado.
 */
function salvarImagemTime(PDO $db, int $timeId, array $arquivoValidado, string $origem, ?string $poloperatorId = null, bool $forcar = false): string {
    $stmt = $db->prepare("SELECT logo_origem FROM times WHERE id = ?");
    $stmt->execute([$timeId]);
    $row = $stmt->fetch();
    if (!$row) throw new RuntimeException('Time não encontrado.');
    if (!$forcar && $row['logo_origem'] === 'manual' && $origem === 'importado') {
        throw new RuntimeException('Este time já tem um brasão definido manualmente — reimportação não pode sobrescrevê-lo sem confirmação explícita.');
    }

    [$dir, $urlBase] = midiaDiretorio('times', $timeId);
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $nomeArquivo = 'logo.' . $arquivoValidado['ext'];
    $destino = $dir . '/' . $nomeArquivo;
    if (!@copy($arquivoValidado['tmp_name'], $destino)) {
        throw new RuntimeException('Falha ao salvar a imagem no servidor.');
    }
    // Só remove extensões antigas (ex.: trocou de .png pra .webp) DEPOIS do novo arquivo
    // já estar gravado com sucesso — nunca deixa o time sem nenhum arquivo no meio do caminho.
    limparDiretorioMidia($dir, $nomeArquivo);

    $agora = date('Y-m-d H:i:s');
    $novoPath = "$urlBase/$nomeArquivo";
    $db->prepare("UPDATE times SET logo_path = ?, logo_origem = ?, logo_atualizado_em = ?, poloperator_id = COALESCE(?, poloperator_id) WHERE id = ?")
       ->execute([$novoPath, $origem, $agora, $poloperatorId, $timeId]);

    return $novoPath;
}

/** Espelho de salvarImagemTime() pra pessoas/atletas — mesma política de precedência. */
function salvarFotoPessoa(PDO $db, int $pessoaId, array $arquivoValidado, string $origem, ?string $poloperatorId = null, bool $forcar = false): string {
    $stmt = $db->prepare("SELECT foto_origem FROM pessoas WHERE id = ?");
    $stmt->execute([$pessoaId]);
    $row = $stmt->fetch();
    if (!$row) throw new RuntimeException('Pessoa não encontrada.');
    if (!$forcar && $row['foto_origem'] === 'manual' && $origem === 'importado') {
        throw new RuntimeException('Esta pessoa já tem uma foto definida manualmente — reimportação não pode sobrescrevê-la sem confirmação explícita.');
    }

    [$dir, $urlBase] = midiaDiretorio('atletas', $pessoaId);
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $nomeArquivo = 'foto.' . $arquivoValidado['ext'];
    $destino = $dir . '/' . $nomeArquivo;
    if (!@copy($arquivoValidado['tmp_name'], $destino)) {
        throw new RuntimeException('Falha ao salvar a imagem no servidor.');
    }
    limparDiretorioMidia($dir, $nomeArquivo);

    $agora = date('Y-m-d H:i:s');
    $novoPath = "$urlBase/$nomeArquivo";
    $db->prepare("UPDATE pessoas SET foto_path = ?, foto_origem = ?, foto_atualizado_em = ?, poloperator_id = COALESCE(?, poloperator_id) WHERE id = ?")
       ->execute([$novoPath, $origem, $agora, $poloperatorId, $pessoaId]);

    return $novoPath;
}

function removerLogoTime(PDO $db, int $timeId): void {
    [$dir] = midiaDiretorio('times', $timeId);
    limparDiretorioMidia($dir);
    $db->prepare("UPDATE times SET logo_path = NULL, logo_origem = NULL, logo_atualizado_em = NULL WHERE id = ?")->execute([$timeId]);
}

function removerFotoPessoa(PDO $db, int $pessoaId): void {
    [$dir] = midiaDiretorio('atletas', $pessoaId);
    limparDiretorioMidia($dir);
    $db->prepare("UPDATE pessoas SET foto_path = NULL, foto_origem = NULL, foto_atualizado_em = NULL WHERE id = ?")->execute([$pessoaId]);
}
