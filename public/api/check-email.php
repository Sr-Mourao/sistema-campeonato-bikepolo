<?php
require_once __DIR__ . '/db.php';
corsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') respondError('Método não suportado', 405);

$email = strtolower(trim($_GET['email'] ?? ''));
if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) respondError('Email inválido');

$db = getDb();
$s  = $db->prepare("
    SELECT COUNT(*) as total
    FROM inscricoes i
    JOIN pessoas p ON p.id = i.pessoa_id
    WHERE LOWER(p.email) = ? AND i.status != 'cancelado'
");
$s->execute([$email]);
$row = $s->fetch();

respond(['exists' => (int)$row['total'] > 0]);
