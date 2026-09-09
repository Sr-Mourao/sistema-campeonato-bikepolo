<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/env.php';
require_once __DIR__ . '/email.php';
require_once __DIR__ . '/carteira/lib.php';

corsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') respondError('Método não suportado', 405);

$body = getBody();
$email = strtolower(trim($body['email'] ?? ''));

if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respondError('Email inválido');
}

$db = getDb();

// ── Verificação de código ──────────────────────────────────
// Se veio código junto com o email, é a etapa de verificação
if (!empty($body['code'])) {
    $code = trim($body['code']);

    $stmt = $db->prepare("
        SELECT * FROM login_codes
        WHERE email = ? AND used = 0 AND expires_at > datetime('now')
        ORDER BY criado_em DESC LIMIT 1
    ");
    $stmt->execute([$email]);
    $row = $stmt->fetch();

    if (!$row || !password_verify($code, $row['code_hash'])) {
        respondError('Código inválido ou expirado. Solicite um novo.', 401);
    }

    // Marca código como usado
    $db->prepare("UPDATE login_codes SET used = 1 WHERE id = ?")->execute([$row['id']]);

    // Cria sessão de 30 dias
    $token     = bin2hex(random_bytes(32));
    $expiresAt = date('Y-m-d H:i:s', time() + SESSION_DURATION);

    $stmt = $db->prepare("
        INSERT INTO sessions (token, email, expires_at)
        VALUES (?, ?, ?)
    ");
    $stmt->execute([$token, $email, $expiresAt]);
    carteiraDefinirCookieSessao($token, time() + SESSION_DURATION);

    respond([
        'token'      => $token,
        'email'      => $email,
        'expires_at' => $expiresAt,
    ]);
}

// ── Geração de código ──────────────────────────────────────
// Limita: máx 5 códigos por email nos últimos 15 minutos (anti-spam)
$stmt = $db->prepare("
    SELECT COUNT(*) as n FROM login_codes
    WHERE email = ? AND criado_em > datetime('now', '-15 minutes')
");
$stmt->execute([$email]);
if ((int)$stmt->fetch()['n'] >= 5) {
    respondError('Muitas tentativas. Aguarde alguns minutos.', 429);
}

$code     = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
$hash     = password_hash($code, PASSWORD_DEFAULT);
$expires  = date('Y-m-d H:i:s', time() + 600); // 10 minutos

$db->prepare("INSERT INTO login_codes (email, code_hash, expires_at) VALUES (?, ?, ?)")
   ->execute([$email, $hash, $expires]);

$sent = sendLoginCodeEmail($email, $code);

respond([
    'sent'    => $sent,
    'message' => 'Código enviado para ' . $email,
    // Em dev, retorna o código para facilitar testes
    'code_dev' => (RESEND_API_KEY === 're_COLOQUE_SUA_CHAVE_AQUI') ? $code : null,
]);
