<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/carteira/lib.php';

corsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') respondError('Método não suportado', 405);

$body = getBody();
$email = strtolower(trim($body['email'] ?? ''));

if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respondError('Email inválido');
}

$code = trim((string)($body['code'] ?? ''));
if (!preg_match('/^\d{8}$/', $code)) {
    respondError('Informe o código de 8 dígitos.', 400);
}

$db = getDb();

// O código é permanente até o admin redefini-lo. Após 5 erros, bloqueia por 15 min.
$stmt = $db->prepare("
    SELECT p.id, p.email, ac.code_hash, ac.failed_attempts, ac.locked_until
    FROM pessoas p
    JOIN athlete_access_codes ac ON ac.pessoa_id = p.id
    WHERE p.email = ? COLLATE NOCASE
");
$stmt->execute([$email]);
$row = $stmt->fetch();

if (!$row) respondError('E-mail ou código inválido.', 401);
if ($row['locked_until'] && strtotime($row['locked_until'] . ' UTC') > time()) {
    respondError('Muitas tentativas. Tente novamente em 15 minutos.', 429);
}

if (!password_verify($code, $row['code_hash'])) {
    $falhas = (int)$row['failed_attempts'] + 1;
    $bloqueio = $falhas >= 5 ? gmdate('Y-m-d H:i:s', time() + 900) : null;
    $db->prepare('UPDATE athlete_access_codes SET failed_attempts=?, locked_until=?, atualizado_em=datetime(\'now\') WHERE pessoa_id=?')
        ->execute([$bloqueio ? 0 : $falhas, $bloqueio, $row['id']]);
    respondError('E-mail ou código inválido.', 401);
}

$db->prepare("UPDATE athlete_access_codes SET failed_attempts=0, locked_until=NULL, atualizado_em=datetime('now') WHERE pessoa_id=?")
    ->execute([$row['id']]);

// Cria sessão de 30 dias no formato já usado pelos endpoints da área do atleta.
$token     = bin2hex(random_bytes(32));
$expiresAt = date('Y-m-d H:i:s', time() + SESSION_DURATION);

$stmt = $db->prepare('INSERT INTO sessions (token, email, expires_at) VALUES (?, ?, ?)');
$stmt->execute([$token, $row['email'], $expiresAt]);
carteiraDefinirCookieSessao($token, time() + SESSION_DURATION);

respond([
    'token'      => $token,
    'email'      => $row['email'],
    'expires_at' => $expiresAt,
]);
