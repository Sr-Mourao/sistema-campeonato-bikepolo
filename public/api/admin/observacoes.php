<?php
require_once __DIR__ . '/middleware.php';
adminGuard();

$db     = getDb();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $id = (int)($_GET['inscricao_id'] ?? 0);
    if (!$id) respondError('inscricao_id obrigatório');
    $stmt = $db->prepare("SELECT * FROM observacoes WHERE inscricao_id = ? ORDER BY criado_em DESC");
    $stmt->execute([$id]);
    respond($stmt->fetchAll());
}

if ($method === 'POST') {
    $body  = getBody();
    $id    = (int)($body['inscricao_id'] ?? 0);
    $texto = trim($body['texto'] ?? '');
    $tipo  = $body['tipo'] ?? 'manual';

    if (!$id || !$texto) respondError('inscricao_id e texto obrigatórios');

    $db->prepare("INSERT INTO observacoes (inscricao_id, texto, tipo) VALUES (?, ?, ?)")
       ->execute([$id, $texto, $tipo]);

    respond(['ok' => true, 'id' => $db->lastInsertId()]);
}

respondError('Método não permitido', 405);
