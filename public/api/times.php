<?php
require_once __DIR__ . '/db.php';
corsHeaders();

$db = getDb();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $codigo    = strtoupper(trim($_GET['codigo'] ?? ''));
    $categoria = strtolower(trim($_GET['categoria'] ?? ''));

    if (empty($codigo)) respondError('Código é obrigatório');
    if ($categoria && !in_array($categoria, ['misto', 'mtnb'])) respondError('Categoria inválida');

    $stmt = $db->prepare("
        SELECT t.id, t.nome, t.categoria, t.codigo, t.logo_path,
               COUNT(DISTINCT CASE WHEN i.status != 'cancelado' THEN mt.id END) AS total_membros
        FROM times t
        LEFT JOIN membros_time mt ON mt.time_id = t.id
        LEFT JOIN inscricoes i ON i.id = mt.inscricao_id
        WHERE t.codigo = ?
        GROUP BY t.id
    ");
    $stmt->execute([$codigo]);
    $time = $stmt->fetch();

    if (!$time) respondError('Time não encontrado', 404);

    if ($categoria && $time['categoria'] !== $categoria) {
        respondError('Código inválido para esta categoria', 404);
    }

    $stmt = $db->prepare("
        SELECT p.nome
        FROM membros_time mt
        JOIN inscricoes i ON i.id = mt.inscricao_id AND i.status != 'cancelado'
        JOIN pessoas p ON p.id = i.pessoa_id
        WHERE mt.time_id = ?
    ");
    $stmt->execute([$time['id']]);
    $time['atletas'] = array_column($stmt->fetchAll(), 'nome');
    $time['total_membros'] = (int)$time['total_membros'];

    respond($time);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $isMultipart = str_contains($_SERVER['CONTENT_TYPE'] ?? '', 'multipart/form-data');

    if ($isMultipart) {
        $nome      = trim($_POST['nome'] ?? '');
        $categoria = trim($_POST['categoria'] ?? '');
        $criador_id = (int)($_POST['criador_id'] ?? 0);
    } else {
        $body = getBody();
        $nome      = trim($body['nome'] ?? '');
        $categoria = trim($body['categoria'] ?? '');
        $criador_id = (int)($body['criador_id'] ?? 0);
    }

    if (empty($nome)) respondError('Nome do time é obrigatório');
    if (!in_array($categoria, ['misto', 'mtnb'])) respondError('Categoria inválida');

    $logo_path = null;

    if ($isMultipart && isset($_FILES['logo']) && $_FILES['logo']['error'] === UPLOAD_ERR_OK) {
        // SVG removido da whitelist — é um formato executável (pode conter <script>/onload)
        // e não vale o risco de sanitização pra um upload público sem revisão (mesmo
        // hardening aplicado ao restante da migração de mídia — ver midia/lib.php).
        $allowed = ['image/jpeg', 'image/png', 'image/webp'];
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($finfo, $_FILES['logo']['tmp_name']);
        finfo_close($finfo);

        if (!in_array($mime, $allowed)) respondError('Formato inválido. Use JPEG, PNG ou WebP');
        if ($_FILES['logo']['size'] > 2 * 1024 * 1024) respondError('Imagem muito grande (máx. 2MB)');

        $ext = strtolower(pathinfo($_FILES['logo']['name'], PATHINFO_EXTENSION));
        $filename = uniqid('logo_', true) . '.' . $ext;
        $uploadDir = __DIR__ . '/../imgs/times/';
        if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

        move_uploaded_file($_FILES['logo']['tmp_name'], $uploadDir . $filename);
        $logo_path = '/imgs/times/' . $filename;
    }

    $codigo = generateTeamCode($db);

    $stmt = $db->prepare("INSERT INTO times (nome, categoria, codigo, logo_path, criador_id) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([$nome, $categoria, $codigo, $logo_path, $criador_id ?: null]);

    respond([
        'id'        => (int)$db->lastInsertId(),
        'nome'      => $nome,
        'categoria' => $categoria,
        'codigo'    => $codigo,
        'logo_path' => $logo_path,
    ], 201);
}

respondError('Método não suportado', 405);
