<?php
/**
 * Admin middleware — incluir no topo de todos os endpoints admin.
 * Inicia sessão, configura CORS e expõe adminGuard().
 */

// ── Helpers de erro (DEFINIDOS ANTES de db.php, para getDb() poder usar) ──
function _respondAdminError(string $publicMsg, ?string $debugMsg = null, int $status = 500): void
{
    http_response_code($status);
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
    }
    $logLine = $debugMsg ?? $publicMsg;
    error_log('[admin] ' . $logLine);
    $out = ['error' => $publicMsg];
    if (defined('APP_DEBUG') && APP_DEBUG && $debugMsg !== null && $debugMsg !== '') {
        $out['debug'] = $debugMsg;
    }
    echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$adminExceptionHandler = function (Throwable $e): void {
    _respondAdminError(
        'Erro interno do servidor',
        sprintf('Unhandled exception: %s in %s:%d', $e->getMessage(), $e->getFile(), $e->getLine()),
        500
    );
};
set_exception_handler($adminExceptionHandler);

$adminErrorHandler = function ($severity, $message, $file, $line) {
    if (!(error_reporting() & $severity)) {
        return false;
    }
    throw new \ErrorException($message, 0, $severity, $file, $line);
};
set_error_handler($adminErrorHandler);

$adminShutdownHandler = function (): void {
    $err = error_get_last();
    if (!$err) {
        return;
    }
    $fatal = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR];
    if (!in_array($err['type'], $fatal, true)) {
        return;
    }
    _respondAdminError(
        'Erro interno do servidor',
        sprintf('Fatal error: %s in %s:%d', $err['message'] ?? '', $err['file'] ?? '', $err['line'] ?? 0),
        500
    );
};
register_shutdown_function($adminShutdownHandler);

require_once __DIR__ . '/../env.php';
require_once __DIR__ . '/../db.php';

// O painel fica autenticado até um logout explícito. A validade longa é
// renovada em toda requisição administrativa, evitando que o caixa do evento
// seja derrubado por inatividade ou ao fechar e reabrir o navegador.
const ADMIN_SESSION_LIFETIME = 10 * 365 * 24 * 60 * 60;
$adminSessionSecure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
ini_set('session.gc_maxlifetime', (string) ADMIN_SESSION_LIFETIME);
ini_set('session.use_strict_mode', '1');
session_set_cookie_params([
    'lifetime' => ADMIN_SESSION_LIFETIME,
    'path' => '/',
    'secure' => $adminSessionSecure,
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();

function adminRefreshSessionCookie(): void
{
    if (headers_sent() || session_status() !== PHP_SESSION_ACTIVE || session_id() === '') return;
    $params = session_get_cookie_params();
    setcookie(session_name(), session_id(), [
        'expires' => time() + ADMIN_SESSION_LIFETIME,
        'path' => $params['path'] ?: '/',
        'domain' => $params['domain'] ?? '',
        'secure' => (bool) ($params['secure'] ?? false),
        'httponly' => true,
        'samesite' => $params['samesite'] ?? 'Lax',
    ]);
}

if (!empty($_SESSION['admin'])) adminRefreshSessionCookie();

/**
 * Origens autorizadas a falar com a API admin COM credenciais.
 *
 * Antes daqui refletia-se `Origin` de volta sem checar nada. Combinado com
 * `Allow-Credentials: true`, isso permitia que QUALQUER site aberto no mesmo
 * navegador de quem está logado no painel lesse as respostas do admin
 * (inscrições, financeiro, carteiras) usando a sessão da vítima.
 *
 * Agora só passam: a APP_URL configurada e as origens locais de desenvolvimento
 * (o Vite roda em :5173 e faz proxy pro PHP em :8000 — origens diferentes).
 */
function adminOrigensPermitidas(): array
{
    $lista = [];
    if (defined('APP_URL') && APP_URL !== '') {
        $lista[] = rtrim(APP_URL, '/');
    }
    foreach (['5173', '5174', '4173', '8000', '80'] as $porta) {
        foreach (['localhost', '127.0.0.1'] as $host) {
            $lista[] = "http://$host:$porta";
        }
    }
    $lista[] = 'http://localhost';
    $lista[] = 'http://127.0.0.1';
    return array_values(array_unique($lista));
}

// CORS com suporte a credentials (necessário para sessões PHP)
$origin = rtrim($_SERVER['HTTP_ORIGIN'] ?? '', '/');
header('Content-Type: application/json; charset=utf-8');
header('Vary: Origin');
if ($origin !== '' && in_array($origin, adminOrigensPermitidas(), true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
}
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function adminGuard(): void
{
    if (empty($_SESSION['admin'])) {
        respond(['error' => 'Não autorizado'], 401);
    }
}

function adminPasswordConfere(string $password): bool
{
    return str_starts_with(ADMIN_PASS, '$2y$')
        ? password_verify($password, ADMIN_PASS)
        : hash_equals((string)ADMIN_PASS, $password);
}
