<?php
require_once __DIR__ . '/middleware.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    respond([
        'autenticado' => !empty($_SESSION['admin']),
        'username'    => $_SESSION['admin_user'] ?? null,
    ]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respondError('Método não permitido', 405);
}

$body = getBody();
$action = $body['action'] ?? 'login';

if ($action === 'logout') {
    $_SESSION = [];
    session_destroy();
    $params = session_get_cookie_params();
    setcookie(session_name(), '', [
        'expires' => time() - 3600,
        'path' => $params['path'] ?: '/',
        'domain' => $params['domain'] ?? '',
        'secure' => (bool) ($params['secure'] ?? false),
        'httponly' => true,
        'samesite' => $params['samesite'] ?? 'Lax',
    ]);
    respond(['ok' => true]);
}

// Login
$username = trim($body['username'] ?? '');
$password = $body['password'] ?? '';

if (!$username || !$password) {
    respondError('Usuário e senha obrigatórios');
}

if ($username !== ADMIN_USER) {
    respondError('Credenciais inválidas', 401);
}

// Suporta texto simples (dev) e hash bcrypt (produção)
$passOk = adminPasswordConfere($password);

if (!$passOk) {
    respondError('Credenciais inválidas', 401);
}

session_regenerate_id(true);
$_SESSION['admin']        = true;
$_SESSION['admin_user']   = $username;
$_SESSION['admin_login_em'] = date('Y-m-d H:i:s');
adminRefreshSessionCookie();

respond(['ok' => true, 'username' => $username]);
