<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/env.php';
require_once __DIR__ . '/email.php';
require_once __DIR__ . '/lojinha-estoque.php';

// Webhook do Mercado Pago — não usa corsHeaders() (não é chamado por browser)
header('Content-Type: application/json');

// ── Valida assinatura (requer MP_WEBHOOK_SECRET configurado) ──────────────
if (MP_WEBHOOK_SECRET !== '') {
    $xsig      = $_SERVER['HTTP_X_SIGNATURE']  ?? '';
    $xreqId    = $_SERVER['HTTP_X_REQUEST_ID'] ?? '';
    $dataId    = $_GET['data_id'] ?? '';

    preg_match('/ts=(\d+)/',        $xsig, $tsM);
    preg_match('/v1=([a-f0-9]+)/', $xsig, $hashM);
    $ts   = $tsM[1]   ?? '';
    $hash = $hashM[1] ?? '';

    $manifest = "id:{$dataId};request-id:{$xreqId};ts:{$ts};";
    $expected = hash_hmac('sha256', $manifest, MP_WEBHOOK_SECRET);

    if (!hash_equals($expected, $hash)) {
        http_response_code(401);
        echo json_encode(['error' => 'Assinatura inválida']);
        exit;
    }
}

$body   = json_decode(file_get_contents('php://input'), true) ?? [];
$action = $body['action'] ?? '';
$mpId   = (int)($body['data']['id'] ?? $_GET['data_id'] ?? 0);

// Só processa eventos de pagamento
if ($action !== 'payment.created' && $action !== 'payment.updated') {
    http_response_code(200);
    echo json_encode(['ok' => true]);
    exit;
}

if (!$mpId) {
    http_response_code(400);
    echo json_encode(['error' => 'ID de pagamento ausente']);
    exit;
}

// ── Busca detalhes do pagamento no MP ────────────────────
$ch = curl_init("https://api.mercadopago.com/v1/payments/{$mpId}");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . MP_ACCESS_TOKEN],
    CURLOPT_TIMEOUT        => 15,
]);
$raw  = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($code !== 200) {
    http_response_code(200); // retorna 200 para o MP não reenviar
    echo json_encode(['error' => 'Falha ao buscar pagamento']);
    exit;
}

$mp       = json_decode($raw, true);
$mpStatus = $mp['status'] ?? '';
$extRef   = $mp['external_reference'] ?? '';
$metodo   = $mp['payment_method_id'] ?? null;

if (!$extRef) {
    http_response_code(200);
    echo json_encode(['ok' => 'sem external_reference']);
    exit;
}

$pedidoId = (int)$extRef;
$db = getDb();

$stmt = $db->prepare("SELECT * FROM loj_pedidos WHERE id = ?");
$stmt->execute([$pedidoId]);
$pedido = $stmt->fetch();

if (!$pedido) {
    http_response_code(200);
    echo json_encode(['ok' => 'pedido não encontrado']);
    exit;
}

// Atualiza referencia_externa caso ainda não esteja
$db->prepare("UPDATE loj_pedidos SET referencia_externa = ?, dados_externos = ?, atualizado_em = datetime('now') WHERE id = ?")
   ->execute([$mpId, json_encode($mp, JSON_UNESCAPED_UNICODE), $pedidoId]);

if ($mpStatus === 'approved') {
    if (lojinhaMarcarPedidoPago($db, $pedidoId, $metodo ?? 'mercadopago')) {

        // Notifica apenas na primeira aprovação (evita email duplo em retentativas)
        $stmt = $db->prepare("SELECT produto_nome, tamanho, quantidade, preco_unitario FROM loj_pedido_itens WHERE pedido_id = ?");
        $stmt->execute([$pedidoId]);
        $itensEmail = $stmt->fetchAll();
        sendLojaOrderConfirmedEmail($pedido['email'], $pedido['nome'], $pedido['codigo_retirada'], $itensEmail, (float)$pedido['valor']);
    }

    error_log("Webhook MP Lojinha: pedido {$pedidoId} aprovado (MP #{$mpId})");
}

if (in_array($mpStatus, ['rejected', 'cancelled']) && $pedido['status'] === 'pendente') {
    lojinhaCancelarPedido($db, $pedidoId);

    error_log("Webhook MP Lojinha: pedido {$pedidoId} rejeitado (MP #{$mpId}) — {$mpStatus}");
}

http_response_code(200);
echo json_encode(['ok' => true]);
