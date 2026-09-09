<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/email.php';
corsHeaders();

$db = getDb();

// ── GET com checkout_token + pagamento_id — polling de status (PIX) ────────
if ($_SERVER['REQUEST_METHOD'] === 'GET' && !empty($_GET['checkout_token']) && !empty($_GET['pagamento_id'])) {
    $ctk  = trim($_GET['checkout_token']);
    $pgId = (int)$_GET['pagamento_id'];

    $stmt = $db->prepare("SELECT id, status, valor, metodo, criado_em FROM loj_pedidos WHERE id = ? AND checkout_token = ?");
    $stmt->execute([$pgId, $ctk]);
    $pedido = $stmt->fetch();
    if (!$pedido) respondError('Pedido não encontrado', 404);

    $stmt = $db->prepare("SELECT produto_nome, tamanho, quantidade, preco_unitario FROM loj_pedido_itens WHERE pedido_id = ?");
    $stmt->execute([$pgId]);
    $itens = array_map(fn($it) => [
        'descricao' => $it['quantidade'] . '× ' . $it['produto_nome'] . (!empty($it['tamanho']) ? " ({$it['tamanho']})" : ''),
        'valor'     => (float)$it['quantidade'] * (float)$it['preco_unitario'],
    ], $stmt->fetchAll());

    respond([[
        'id'        => (int)$pedido['id'],
        'tipo'      => 'lojinha',
        'status'    => $pedido['status'],
        'valor'     => (float)$pedido['valor'],
        'metodo'    => $pedido['metodo'],
        'itens'     => $itens,
        'criado_em' => $pedido['criado_em'],
    ]]);
}

// ── GET — catálogo público ──────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $config = getConfigLoja($db);

    $stmt = $db->query("SELECT id, nome, descricao, preco FROM loj_produtos WHERE ativo = 1 ORDER BY ordem, id");
    $produtos = $stmt->fetchAll();

    foreach ($produtos as &$p) {
        $s = $db->prepare("SELECT caminho FROM loj_produto_imagens WHERE produto_id = ? ORDER BY ordem, id");
        $s->execute([$p['id']]);
        $p['imagens'] = array_column($s->fetchAll(), 'caminho');

        $s = $db->prepare("SELECT tamanho FROM loj_produto_tamanhos WHERE produto_id = ? ORDER BY ordem, id");
        $s->execute([$p['id']]);
        $p['tamanhos'] = array_column($s->fetchAll(), 'tamanho');

        $p['id']    = (int)$p['id'];
        $p['preco'] = (float)$p['preco'];
    }

    respond([
        'loja_aberta'      => $config['loja_aberta'] === '1',
        'mensagem_fechada' => $config['loja_mensagem_fechada'],
        'produtos'         => $produtos,
    ]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') respondError('Método não suportado', 405);

$body = getBody();
$acao = $body['acao'] ?? 'criar';

// ── POST acao=simular_pago — mock de pagamento em dev ──────────────────
// Marca o pedido como pago sem cobrar nada. Só existe pra testar o fluxo da
// lojinha localmente; exige PAGAMENTO_MOCK ligado no env (padrão: desligado).
if ($acao === 'simular_pago') {
    if (!defined('PAGAMENTO_MOCK') || !PAGAMENTO_MOCK) {
        respondError('Simulação de pagamento desabilitada.', 403);
    }
    $pgId = (int)($body['pagamento_id'] ?? 0);
    $ctk  = trim($body['checkout_token'] ?? '');
    if (!$pgId || !$ctk) respondError('Dados de pagamento incompletos');

    $stmt = $db->prepare("SELECT * FROM loj_pedidos WHERE id = ? AND checkout_token = ?");
    $stmt->execute([$pgId, $ctk]);
    $pedido = $stmt->fetch();
    if (!$pedido) respondError('Token de checkout inválido', 401);
    if ($pedido['status'] !== 'pendente') respondError('Pedido já processado', 400);

    $db->prepare("UPDATE loj_pedidos SET status='pago', metodo='mockup', atualizado_em=datetime('now') WHERE id=?")
       ->execute([$pgId]);

    $stmt = $db->prepare("SELECT produto_nome, tamanho, quantidade, preco_unitario FROM loj_pedido_itens WHERE pedido_id = ?");
    $stmt->execute([$pgId]);
    $itensEmail = $stmt->fetchAll();
    sendLojaOrderConfirmedEmail($pedido['email'], $pedido['nome'], $pedido['codigo_retirada'], $itensEmail, (float)$pedido['valor']);

    respond([
        'id'     => $pgId,
        'tipo'   => 'lojinha',
        'status' => 'pago',
        'valor'  => (float)$pedido['valor'],
        'metodo' => 'mockup',
    ]);
}

// ── POST — cria pedido ──────────────────────────────────────────────────
$config = getConfigLoja($db);
if ($config['loja_aberta'] !== '1') respondError('O período de encomendas já foi encerrado.', 403);

$nome  = trim($body['nome'] ?? '');
$email = trim($body['email'] ?? '');
$itensBody = $body['itens'] ?? [];

if (empty($nome))                                                respondError('Nome é obrigatório');
if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) respondError('Email inválido');
if (empty($itensBody) || !is_array($itensBody))                  respondError('Selecione ao menos um produto');

$itensValidados = [];
$valorTotal = 0.0;

foreach ($itensBody as $item) {
    $produtoId  = (int)($item['produto_id'] ?? 0);
    $quantidade = (int)($item['quantidade'] ?? 0);
    $tamanho    = trim($item['tamanho'] ?? '');

    if (!$produtoId || $quantidade < 1) continue;

    $stmt = $db->prepare("SELECT id, nome, preco FROM loj_produtos WHERE id = ? AND ativo = 1");
    $stmt->execute([$produtoId]);
    $produto = $stmt->fetch();
    if (!$produto) respondError("Produto #{$produtoId} não está mais disponível");

    $stmt = $db->prepare("SELECT tamanho FROM loj_produto_tamanhos WHERE produto_id = ?");
    $stmt->execute([$produtoId]);
    $tamanhosDisponiveis = array_column($stmt->fetchAll(), 'tamanho');

    if (!empty($tamanhosDisponiveis)) {
        if (empty($tamanho) || !in_array($tamanho, $tamanhosDisponiveis, true)) {
            respondError("Selecione um tamanho válido para {$produto['nome']}");
        }
    } else {
        $tamanho = null;
    }

    $itensValidados[] = [
        'produto_id'     => $produtoId,
        'produto_nome'   => $produto['nome'],
        'tamanho'        => $tamanho,
        'quantidade'     => $quantidade,
        'preco_unitario' => (float)$produto['preco'],
    ];
    $valorTotal += $quantidade * (float)$produto['preco'];
}

if (empty($itensValidados)) respondError('Selecione ao menos um produto');

$checkoutToken  = bin2hex(random_bytes(24));
$codigoRetirada = generateCodigoRetirada($db);

try {
    $db->beginTransaction();

    $s = $db->prepare("
        INSERT INTO loj_pedidos (nome, email, whatsapp, observacoes, status, valor, checkout_token, codigo_retirada)
        VALUES (?, ?, ?, ?, 'pendente', ?, ?, ?)
    ");
    $s->execute([
        $nome, $email,
        trim($body['whatsapp'] ?? '') ?: null,
        trim($body['observacoes'] ?? '') ?: null,
        $valorTotal, $checkoutToken, $codigoRetirada,
    ]);
    $pedidoId = (int)$db->lastInsertId();

    $s = $db->prepare("
        INSERT INTO loj_pedido_itens (pedido_id, produto_id, produto_nome, tamanho, quantidade, preco_unitario)
        VALUES (?, ?, ?, ?, ?, ?)
    ");
    foreach ($itensValidados as $it) {
        $s->execute([$pedidoId, $it['produto_id'], $it['produto_nome'], $it['tamanho'], $it['quantidade'], $it['preco_unitario']]);
    }

    $db->commit();
} catch (\Exception $e) {
    $db->rollBack();
    respondError('Erro ao criar pedido: ' . $e->getMessage(), 500);
}

$itensResposta = array_map(fn($it) => [
    'descricao' => $it['quantidade'] . '× ' . $it['produto_nome'] . (!empty($it['tamanho']) ? " ({$it['tamanho']})" : ''),
    'valor'     => $it['quantidade'] * $it['preco_unitario'],
], $itensValidados);

respond([
    'success' => true,
    'id'             => $pedidoId,
    'tipo'           => 'lojinha',
    'status'         => 'pendente',
    'metodo'         => null,
    'valor'          => $valorTotal,
    'itens'          => $itensResposta,
    'checkout_token' => $checkoutToken,
], 201);
