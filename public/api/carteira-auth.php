<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/env.php';
require_once __DIR__ . '/email.php';
require_once __DIR__ . '/carteira/auth_lib.php';

corsHeaders();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') respondError('Método não suportado', 405);

$body = getBody();
$acao = trim($body['acao'] ?? 'solicitar');
$db = getDb();

try {
    carteiraValidarSameOrigin();

    if ($acao === 'ponte_sessao') {
        $token = trim($_SERVER['HTTP_X_SESSION_TOKEN'] ?? '');
        $pessoa = carteiraPessoaDaSessao($db, $token);
        if (!$pessoa) respondError('Sessão inválida', 401);
        carteiraCriarOuObter($db, (int)$pessoa['id']);
        carteiraCriarSessao($db, $pessoa['email'], $token);
        respond(['ok'=>true]);
    }

    if ($acao === 'consumir') {
        $link = carteiraConsumirMagicLink($db, trim($body['token'] ?? ''));
        carteiraCriarSessao($db, $link['email']);
        respond(['ok'=>true]);
    }

    if ($acao === 'logout') {
        $token = carteiraSessaoTokenDaRequisicao();
        if ($token !== '') $db->prepare('DELETE FROM sessions WHERE token=?')->execute([$token]);
        carteiraLimparCookieSessao();
        respond(['ok'=>true]);
    }

    if ($acao !== 'solicitar') respondError('Ação inválida');
    $email = carteiraEmail($body['email'] ?? '');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) respondError('Email inválido');
    $stmt=$db->prepare('SELECT * FROM pessoas WHERE email=? COLLATE NOCASE'); $stmt->execute([$email]);
    $pessoa=$stmt->fetch();
    if (!$pessoa && trim($body['nome'] ?? '') === '') {
        respond(['nome_obrigatorio'=>true,'email'=>$email], 422);
    }
    $pessoa = carteiraCriarOuObterPessoa($db, $email, $body['nome'] ?? null);
    carteiraCriarOuObter($db, (int)$pessoa['id']);

    $rate=$db->prepare("SELECT COUNT(*) FROM carteira_magic_links WHERE pessoa_id=? AND criado_em > datetime('now','-15 minutes')");
    $rate->execute([$pessoa['id']]);
    if ((int)$rate->fetchColumn() >= 5) respondError('Muitas tentativas. Aguarde alguns minutos.', 429);

    $magic=carteiraGerarMagicLink($db,(int)$pessoa['id']);
    $enviado=sendWalletMagicLinkEmail($pessoa['email'],$pessoa['nome'],$magic['token']);
    if (!$enviado) throw new RuntimeException('Falha no envio do magic link');
    respond([
        'sent'=>$enviado,
        'message'=>'Enviamos um link de acesso para ' . $email,
        'token_dev'=>(RESEND_API_KEY === 're_COLOQUE_SUA_CHAVE_AQUI') ? $magic['token'] : null,
    ]);
} catch (DomainException $e) {
    respondError($e->getMessage(), 400);
} catch (Throwable $e) {
    error_log('[carteira-auth] ' . $e->getMessage());
    respondError('Não foi possível processar o acesso', 500);
}
