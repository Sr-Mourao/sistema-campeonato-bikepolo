<?php
/** Upload/remoção manual de brasão de time e foto de atleta — usado pelo admin de Times. */
require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/../midia/lib.php';
adminGuard();

$db     = getDb();
$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'POST') respondError('Método não suportado', 405);

// Upload manda multipart/form-data (tem arquivo); remoção manda JSON — mesmo padrão de
// detecção usado em public/api/times.php.
$isMultipart = str_contains($_SERVER['CONTENT_TYPE'] ?? '', 'multipart/form-data');
if ($isMultipart) {
    $action = $_POST['action'] ?? '';
    $timeId = (int)($_POST['time_id'] ?? 0);
    $pessoaId = (int)($_POST['pessoa_id'] ?? 0);
} else {
    $body = getBody();
    $action = $body['action'] ?? '';
    $timeId = (int)($body['time_id'] ?? 0);
    $pessoaId = (int)($body['pessoa_id'] ?? 0);
}

try {
    if ($action === 'upload_logo_time') {
        if (!$timeId) respondError('time_id é obrigatório');
        if (empty($_FILES['arquivo'])) respondError('Nenhum arquivo enviado');
        $arquivo = validarImagemUpload($_FILES['arquivo']);
        $path = salvarImagemTime($db, $timeId, $arquivo, 'manual');
        respond(['ok' => true, 'logo_path' => urlComCacheBust($path, date('Y-m-d H:i:s'))]);
    }

    if ($action === 'remover_logo_time') {
        if (!$timeId) respondError('time_id é obrigatório');
        removerLogoTime($db, $timeId);
        respond(['ok' => true]);
    }

    if ($action === 'upload_foto_pessoa') {
        if (!$pessoaId) respondError('pessoa_id é obrigatório');
        if (empty($_FILES['arquivo'])) respondError('Nenhum arquivo enviado');
        $arquivo = validarImagemUpload($_FILES['arquivo']);
        $path = salvarFotoPessoa($db, $pessoaId, $arquivo, 'manual');
        respond(['ok' => true, 'foto_path' => urlComCacheBust($path, date('Y-m-d H:i:s'))]);
    }

    if ($action === 'remover_foto_pessoa') {
        if (!$pessoaId) respondError('pessoa_id é obrigatório');
        removerFotoPessoa($db, $pessoaId);
        respond(['ok' => true]);
    }
} catch (\RuntimeException $e) {
    respondError($e->getMessage(), 400);
}

respondError('Ação desconhecida');
