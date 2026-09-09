<?php
require_once __DIR__ . '/middleware.php';
adminGuard();

$db     = getDb();
$method = $_SERVER['REQUEST_METHOD'];

$CHAVES = ['inscricoes_abertas', 'alojamento_aberto', 'alimentacao_aberto'];

function respondeConfigGeral(PDO $db): void {
    $c = getConfigGeral($db);
    respond([
        'inscricoes_abertas' => $c['inscricoes_abertas'] === '1',
        'alojamento_aberto'  => $c['alojamento_aberto']  === '1',
        'alimentacao_aberto' => $c['alimentacao_aberto']  === '1',
    ]);
}

if ($method === 'GET') {
    respondeConfigGeral($db);
}

if ($method === 'POST') {
    $body = getBody();

    foreach ($CHAVES as $chave) {
        if (array_key_exists($chave, $body)) {
            $valor = !empty($body[$chave]) ? '1' : '0';
            $db->prepare("
                INSERT INTO configuracoes (chave, valor, atualizado_em) VALUES (?, ?, datetime('now'))
                ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em
            ")->execute([$chave, $valor]);
        }
    }

    respondeConfigGeral($db);
}

respondError('Método não suportado', 405);
