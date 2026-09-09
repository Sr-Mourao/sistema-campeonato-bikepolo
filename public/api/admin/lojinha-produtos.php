<?php
require_once __DIR__ . '/middleware.php';
adminGuard();

$db = getDb();

function lojCarregaProduto(PDO $db, int $id): ?array {
    $stmt = $db->prepare("SELECT * FROM loj_produtos WHERE id = ?");
    $stmt->execute([$id]);
    $produto = $stmt->fetch();
    if (!$produto) return null;

    $s = $db->prepare("SELECT id, caminho, ordem FROM loj_produto_imagens WHERE produto_id = ? ORDER BY ordem, id");
    $s->execute([$id]);
    $produto['imagens'] = $s->fetchAll();

    $s = $db->prepare("SELECT id, tamanho, ordem FROM loj_produto_tamanhos WHERE produto_id = ? ORDER BY ordem, id");
    $s->execute([$id]);
    $produto['tamanhos'] = $s->fetchAll();

    $produto['id']     = (int)$produto['id'];
    $produto['preco']  = (float)$produto['preco'];
    $produto['ativo']  = (int)$produto['ativo'];
    $produto['ordem']  = (int)$produto['ordem'];
    return $produto;
}

// ── GET — lista ou detalhe ───────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!empty($_GET['id'])) {
        $produto = lojCarregaProduto($db, (int)$_GET['id']);
        if (!$produto) respondError('Produto não encontrado', 404);
        respond($produto);
    }

    $stmt = $db->query("SELECT id FROM loj_produtos ORDER BY ordem, id");
    $produtos = array_map(fn($r) => lojCarregaProduto($db, (int)$r['id']), $stmt->fetchAll());
    respond($produtos);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') respondError('Método não suportado', 405);

$isMultipart = str_contains($_SERVER['CONTENT_TYPE'] ?? '', 'multipart/form-data');
$acao = $isMultipart ? trim($_POST['acao'] ?? '') : trim((getBody())['acao'] ?? '');

// ── remover_imagem ────────────────────────────────────────
if ($acao === 'remover_imagem') {
    $body = $isMultipart ? $_POST : getBody();
    $imagemId = (int)($body['imagem_id'] ?? 0);
    if (!$imagemId) respondError('imagem_id é obrigatório');

    $stmt = $db->prepare("SELECT caminho FROM loj_produto_imagens WHERE id = ?");
    $stmt->execute([$imagemId]);
    $img = $stmt->fetch();
    if (!$img) respondError('Imagem não encontrada', 404);

    $db->prepare("DELETE FROM loj_produto_imagens WHERE id = ?")->execute([$imagemId]);

    $caminhoFisico = __DIR__ . '/../../' . ltrim($img['caminho'], '/');
    if (is_file($caminhoFisico)) @unlink($caminhoFisico);

    respond(['ok' => true]);
}

// ── excluir ───────────────────────────────────────────────
if ($acao === 'excluir' || $acao === 'excluir_forcado') {
    $body = $isMultipart ? $_POST : getBody();
    $id = (int)($body['id'] ?? 0);
    if (!$id) respondError('id é obrigatório');

    $stmt = $db->prepare("SELECT COUNT(*) FROM loj_pedido_itens WHERE produto_id = ?");
    $stmt->execute([$id]);
    $itensCount = (int)$stmt->fetchColumn();

    if ($itensCount > 0 && $acao !== 'excluir_forcado') {
        $stmt = $db->prepare("SELECT COUNT(DISTINCT pedido_id) FROM loj_pedido_itens WHERE produto_id = ?");
        $stmt->execute([$id]);
        $pedidosCount = (int)$stmt->fetchColumn();
        respondError(
            "Não é possível excluir: este produto aparece em {$itensCount} item(ns) de pedido ({$pedidosCount} pedido(s)). Desative-o em vez de excluir ou use a exclusão forçada para apagar também os pedidos teste.",
            409,
            ['itens_count' => $itensCount, 'pedidos_count' => $pedidosCount]
        );
    }

    if ($itensCount > 0) {
        // Exclusão forçada: apaga os itens de pedido do produto e, se sobrar
        // pedido vazio (sem outros itens), apaga o pedido também.
        $stmtIds = $db->prepare("SELECT DISTINCT pedido_id FROM loj_pedido_itens WHERE produto_id = ?");
        $stmtIds->execute([$id]);
        $pedidos = array_map(fn($r) => (int)$r['pedido_id'], $stmtIds->fetchAll());

        $db->prepare("DELETE FROM loj_pedido_itens WHERE produto_id = ?")->execute([$id]);

        foreach ($pedidos as $pid) {
            $stmt = $db->prepare("SELECT COUNT(*) FROM loj_pedido_itens WHERE pedido_id = ?");
            $stmt->execute([$pid]);
            if ((int)$stmt->fetchColumn() === 0) {
                $db->prepare("DELETE FROM loj_pedidos WHERE id = ?")->execute([$pid]);
            }
        }
    }

    $stmt = $db->prepare("SELECT caminho FROM loj_produto_imagens WHERE produto_id = ?");
    $stmt->execute([$id]);
    foreach ($stmt->fetchAll() as $img) {
        $caminhoFisico = __DIR__ . '/../../' . ltrim($img['caminho'], '/');
        if (is_file($caminhoFisico)) @unlink($caminhoFisico);
    }

    $db->prepare("DELETE FROM loj_produto_imagens WHERE produto_id = ?")->execute([$id]);
    $db->prepare("DELETE FROM loj_produto_tamanhos WHERE produto_id = ?")->execute([$id]);
    $db->prepare("DELETE FROM loj_produtos WHERE id = ?")->execute([$id]);

    respond(['ok' => true, 'itens_removidos' => $itensCount]);
}

// ── criar / atualizar ─────────────────────────────────────
if (!in_array($acao, ['criar', 'atualizar'])) respondError('Ação inválida');
if (!$isMultipart) respondError('Requisição deve ser multipart/form-data');

$nome      = trim($_POST['nome'] ?? '');
$descricao = trim($_POST['descricao'] ?? '');
$preco     = (float)($_POST['preco'] ?? 0);
$ativo     = isset($_POST['ativo']) ? (int)!!$_POST['ativo'] : 1;
$ordem     = (int)($_POST['ordem'] ?? 0);
$tamanhos  = json_decode($_POST['tamanhos'] ?? '[]', true);
if (!is_array($tamanhos)) $tamanhos = [];

if (empty($nome)) respondError('Nome é obrigatório');
if ($preco <= 0)  respondError('Preço deve ser maior que zero');

if ($acao === 'criar') {
    $stmt = $db->prepare("INSERT INTO loj_produtos (nome, descricao, preco, ativo, ordem) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([$nome, $descricao ?: null, $preco, $ativo, $ordem]);
    $produtoId = (int)$db->lastInsertId();
} else {
    $produtoId = (int)($_POST['id'] ?? 0);
    if (!$produtoId) respondError('id é obrigatório');
    $stmt = $db->prepare("SELECT id FROM loj_produtos WHERE id = ?");
    $stmt->execute([$produtoId]);
    if (!$stmt->fetch()) respondError('Produto não encontrado', 404);

    $db->prepare("
        UPDATE loj_produtos SET nome=?, descricao=?, preco=?, ativo=?, ordem=?, atualizado_em=datetime('now')
        WHERE id=?
    ")->execute([$nome, $descricao ?: null, $preco, $ativo, $ordem, $produtoId]);
}

// Tamanhos: substitui a lista inteira (mais simples e sem ambiguidade de diff)
$db->prepare("DELETE FROM loj_produto_tamanhos WHERE produto_id = ?")->execute([$produtoId]);
$stmtTam = $db->prepare("INSERT INTO loj_produto_tamanhos (produto_id, tamanho, ordem) VALUES (?, ?, ?)");
foreach (array_values($tamanhos) as $i => $tam) {
    $tam = trim((string)$tam);
    if ($tam === '') continue;
    $stmtTam->execute([$produtoId, $tam, $i]);
}

// Imagens novas (acrescenta às existentes)
if (!empty($_FILES['imagens']) && is_array($_FILES['imagens']['tmp_name'])) {
    $allowed = ['image/jpeg', 'image/png', 'image/webp'];
    $uploadDir = __DIR__ . '/../../imgs/lojinha/';

    // ── Diagnóstico do diretório de upload ───────────────────
    if (!is_dir($uploadDir)) {
        $ok = @mkdir($uploadDir, 0755, true);
        if (!$ok) {
            $debug = sprintf('Não foi possível criar a pasta de upload: %s. Verifique permissões da pasta /public/imgs/.', $uploadDir);
            if (!is_writable(__DIR__ . '/../../imgs/') || !is_dir(__DIR__ . '/../../imgs/')) {
                $debug .= ' A pasta pai imgs/ não existe ou não é gravável.';
            }
            respondError('Não foi possível criar a pasta de imagens da lojinha no servidor. Verifique as permissões.', 500, $debug);
        }
    }
    if (!is_writable($uploadDir)) {
        $debug = sprintf('Pasta de upload sem permissão de escrita: %s. Use chmod/chown para tornar gravável pelo usuário do Apache/PHP.', $uploadDir);
        respondError('Pasta de upload sem permissão de escrita no servidor. Entre em contato com o suporte.', 500, $debug);
    }

    $stmt = $db->prepare("SELECT COALESCE(MAX(ordem), -1) FROM loj_produto_imagens WHERE produto_id = ?");
    $stmt->execute([$produtoId]);
    $proximaOrdem = (int)$stmt->fetchColumn() + 1;

    $stmtImg = $db->prepare("INSERT INTO loj_produto_imagens (produto_id, caminho, ordem) VALUES (?, ?, ?)");

    // Mapeamento legível de códigos de erro do upload PHP.
    $uploadErrors = [
        UPLOAD_ERR_INI_SIZE   => 'O arquivo enviado excede o limite definido no php.ini (upload_max_filesize).',
        UPLOAD_ERR_FORM_SIZE  => 'O arquivo enviado excede o limite definido no formulário HTML.',
        UPLOAD_ERR_PARTIAL    => 'O upload foi feito apenas parcialmente. Tente novamente.',
        UPLOAD_ERR_NO_FILE    => 'Nenhum arquivo foi enviado.',
        UPLOAD_ERR_NO_TMP_DIR => 'Falta uma pasta temporária no servidor PHP (upload_tmp_dir).',
        UPLOAD_ERR_CANT_WRITE => 'Falha ao escrever arquivo em disco no servidor (permissões da pasta tmp/lojinha).',
        UPLOAD_ERR_EXTENSION  => 'Uma extensão do PHP parou o upload.',
    ];

    foreach ($_FILES['imagens']['tmp_name'] as $i => $tmpName) {
        $errCode = (int)($_FILES['imagens']['error'][$i] ?? UPLOAD_ERR_OK);
        if ($errCode !== UPLOAD_ERR_OK) {
            $msg = $uploadErrors[$errCode] ?? ("Erro desconhecido no upload, código " . $errCode);
            $debug = sprintf(
                'Upload failed — arquivo "%s", error code %d. Tamanho=%s bytes, ini upload_max_filesize=%s, post_max_size=%s',
                $_FILES['imagens']['name'][$i] ?? '',
                $errCode,
                $_FILES['imagens']['size'][$i] ?? 0,
                ini_get('upload_max_filesize') ?: '',
                ini_get('post_max_size') ?: ''
            );
            respondError($msg, 400, $debug);
        }
        if ($tmpName === '' || !is_uploaded_file($tmpName)) {
            $debug = sprintf('Arquivo temporário de upload não existe ou não foi enviado por POST: "%s"', (string)$tmpName);
            respondError('Arquivo de upload inválido. Tente novamente.', 400, $debug);
        }

        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime  = finfo_file($finfo, $tmpName);
        finfo_close($finfo);
        if (!in_array($mime, $allowed)) {
            respondError('Formato inválido. Use JPEG, PNG ou WebP');
        }
        if ($_FILES['imagens']['size'][$i] > 2 * 1024 * 1024) {
            respondError('Imagem muito grande (máx. 2MB)');
        }

        $ext      = strtolower(pathinfo($_FILES['imagens']['name'][$i], PATHINFO_EXTENSION));
        if ($ext === '') $ext = ($mime === 'image/png') ? 'png' : ($mime === 'image/webp' ? 'webp' : 'jpg');
        $filename = uniqid('produto_', true) . '.' . $ext;
        $destino  = $uploadDir . $filename;

        $movido = @move_uploaded_file($tmpName, $destino);
        if (!$movido) {
            $realDir = realpath($uploadDir) ?: $uploadDir;
            $isWritable = is_writable($uploadDir);
            $isFileDir = is_dir($uploadDir);
            $tmpOk = is_uploaded_file($tmpName);
            $debug = sprintf(
                'move_uploaded_file failed — orig="%s" (is_uploaded=%s, size=%s), dest="%s" (dir_exists=%s, dir_writable=%s, realpath="%s"). php_user=%s, posix_user=%s, sys_temp_dir=%s',
                $tmpName,
                $tmpOk ? 'true' : 'false',
                (string)@filesize($tmpName),
                $destino,
                $isFileDir ? 'true' : 'false',
                $isWritable ? 'true' : 'false',
                $realDir,
                get_current_user() ?: '(unknown)',
                function_exists('posix_getpwuid') && ($u = posix_getpwuid(posix_geteuid())) ? ($u['name'] ?? '') : '(unknown)',
                sys_get_temp_dir() ?: ''
            );
            respondError('Falha ao salvar a imagem no servidor. Verifique permissões da pasta imgs/lojinha.', 500, $debug);
        }
        @chmod($destino, 0644);

        $stmtImg->execute([$produtoId, '/imgs/lojinha/' . $filename, $proximaOrdem]);
        $proximaOrdem++;
    }
}

respond(lojCarregaProduto($db, $produtoId), $acao === 'criar' ? 201 : 200);
