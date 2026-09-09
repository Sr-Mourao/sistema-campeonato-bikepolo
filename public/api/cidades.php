<?php
require_once __DIR__ . '/db.php';
corsHeaders();

$db = getDb();
$q  = trim($_GET['q'] ?? '');

if (strlen($q) < 1) {
    $stmt = $db->query("SELECT DISTINCT cidade FROM pessoas WHERE cidade IS NOT NULL AND cidade != '' ORDER BY cidade LIMIT 80");
} else {
    $stmt = $db->prepare("SELECT DISTINCT cidade FROM pessoas WHERE cidade LIKE ? AND cidade != '' ORDER BY cidade LIMIT 20");
    $stmt->execute(["%$q%"]);
}

respond(array_column($stmt->fetchAll(), 'cidade'));
