<?php
require_once __DIR__ . '/db.php';
corsHeaders();

$db = getDb();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $q = trim($_GET['q'] ?? '');

    if (strlen($q) < 1) {
        // Retorna todos os clubes cadastrados (exclui Free Agent)
        $stmt = $db->query("SELECT id, nome FROM clubes WHERE nome != 'Free Agent' ORDER BY nome LIMIT 80");
    } else {
        $stmt = $db->prepare("SELECT id, nome FROM clubes WHERE nome LIKE ? AND nome != 'Free Agent' ORDER BY nome LIMIT 15");
        $stmt->execute(["%$q%"]);
    }

    respond($stmt->fetchAll());
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = getBody();
    $nome = trim($body['nome'] ?? '');

    if (empty($nome)) respondError('Nome do clube é obrigatório');
    if (mb_strlen($nome) > 100) respondError('Nome muito longo');

    $stmt = $db->prepare("SELECT id, nome FROM clubes WHERE nome = ? COLLATE NOCASE");
    $stmt->execute([$nome]);
    $existing = $stmt->fetch();

    if ($existing) {
        respond($existing);
    }

    $stmt = $db->prepare("INSERT INTO clubes (nome) VALUES (?)");
    $stmt->execute([$nome]);

    respond(['id' => (int)$db->lastInsertId(), 'nome' => $nome], 201);
}

respondError('Método não suportado', 405);
