<?php
require_once __DIR__ . '/middleware.php';
adminGuard();

$db     = getDb();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $config = getConfigLoja($db);
    respond([
        'loja_aberta'      => $config['loja_aberta'] === '1',
        'mensagem_fechada' => $config['loja_mensagem_fechada'],
    ]);
}

if ($method === 'POST') {
    $body = getBody();

    if (array_key_exists('loja_aberta', $body)) {
        $valor = !empty($body['loja_aberta']) ? '1' : '0';
        $db->prepare("
            INSERT INTO configuracoes (chave, valor, atualizado_em) VALUES ('loja_aberta', ?, datetime('now'))
            ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em
        ")->execute([$valor]);
    }

    if (array_key_exists('mensagem_fechada', $body)) {
        $mensagem = trim((string)$body['mensagem_fechada']);
        if ($mensagem === '') respondError('Mensagem não pode ficar vazia');
        $db->prepare("
            INSERT INTO configuracoes (chave, valor, atualizado_em) VALUES ('loja_mensagem_fechada', ?, datetime('now'))
            ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em
        ")->execute([$mensagem]);
    }

    $config = getConfigLoja($db);
    respond([
        'ok'               => true,
        'loja_aberta'      => $config['loja_aberta'] === '1',
        'mensagem_fechada' => $config['loja_mensagem_fechada'],
    ]);
}

respondError('Método não suportado', 405);
