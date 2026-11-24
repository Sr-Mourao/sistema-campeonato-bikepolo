<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/env.php';
require_once __DIR__ . '/email.php';

corsHeaders();
header('Access-Control-Allow-Methods: POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') respondError('Método não suportado', 405);

$body          = getBody();
$formData      = $body['form_data']    ?? [];
$pedidoId      = (int)($body['pagamento_id'] ?? 0);
$checkoutToken = trim($body['checkout_token'] ?? '');
$metodo        = trim($body['metodo'] ?? 'pix'); // 'pix' | 'cartao'

if (!$pedidoId)      respondError('pagamento_id é obrigatório');
if (!$checkoutToken) respondError('Não autenticado', 401);

$db = getDb();

$stmt = $db->prepare("SELECT * FROM loj_pedidos WHERE id = ? AND checkout_token = ?");
$stmt->execute([$pedidoId, $checkoutToken]);
$pedido = $stmt->fetch();
if (!$pedido) respondError('Token de checkout inválido', 401);
if ($pedido['status'] !== 'pendente') respondError('Pedido não encontrado ou já processado', 404);

$valorMP = (float)$pedido['valor'];

// ── Aplica taxa de cartão (5%) ───────────────────────────
if ($metodo === 'cartao') {
    $valorMP = round($valorMP * 1.05, 2);
}

// ── Monta payload para o MP ──────────────────────────────
$mpPayload = array_merge($formData, [
    'transaction_amount'  => $valorMP,
    'description'         => "2° Pior Campeonato de Bici Polo de Bike Polo — Lojinha (Pedido #{$pedidoId})",
    'external_reference'  => (string)$pedidoId,
    'notification_url'    => APP_URL . '/api/webhook-mp-lojinha.php',
    'statement_descriptor'=> 'BIKEPOLO',
]);

// ── Chama MP Payments API ────────────────────────────────
$ch = curl_init('https://api.mercadopago.com/v1/payments');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode($mpPayload, JSON_UNESCAPED_UNICODE),
    CURLOPT_HTTPHEADER     => [
        'Authorization: Bearer ' . MP_ACCESS_TOKEN,
        'Content-Type: application/json',
        'X-Idempotency-Key: cb10-loja-' . $pedidoId . '-' . time(),
    ],
    CURLOPT_TIMEOUT        => 30,
]);
$raw      = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr  = curl_error($ch);
curl_close($ch);

if ($curlErr) respondError('Erro de conexão com Mercado Pago: ' . $curlErr, 502);

$mp = json_decode($raw, true);
if ($httpCode >= 400) {
    respondError($mp['message'] ?? $mp['error'] ?? 'Erro no Mercado Pago', 502);
}

$mpId     = (int)($mp['id'] ?? 0);
$mpStatus = $mp['status'] ?? 'pending';

$db->prepare("
    UPDATE loj_pedidos
    SET referencia_externa = ?, dados_externos = ?, atualizado_em = datetime('now')
    WHERE id = ?
")->execute([$mpId, json_encode($mp, JSON_UNESCAPED_UNICODE), $pedidoId]);

// ── Aprovação imediata (cartão sem 3DS) ───────────────────
if ($mpStatus === 'approved') {
    $metodo = $mp['payment_method_id'] ?? 'card';

    $db->prepare("UPDATE loj_pedidos SET status='pago', metodo=?, atualizado_em=datetime('now') WHERE id=?")
       ->execute([$metodo, $pedidoId]);

    $stmt = $db->prepare("SELECT produto_nome, tamanho, quantidade, preco_unitario FROM loj_pedido_itens WHERE pedido_id = ?");
    $stmt->execute([$pedidoId]);
    $itensEmail = $stmt->fetchAll();
    sendLojaOrderConfirmedEmail($pedido['email'], $pedido['nome'], $pedido['codigo_retirada'], $itensEmail, $valorMP);
}

// ── Resposta para o frontend ─────────────────────────────
$resp = [
    'success'      => true,
    'status'       => $mpStatus,
    'status_detail'=> $mp['status_detail'] ?? '',
    'transaction_amount' => (float)($mp['transaction_amount'] ?? $valorMP),
    'payment_method_id'  => $mp['payment_method_id'] ?? null,
    'mp_id'        => $mpId,
    'pagamento_id' => $pedidoId,
];

if (isset($mp['point_of_interaction']['transaction_data'])) {
    $txData = $mp['point_of_interaction']['transaction_data'];
    $resp['pix'] = [
        'qr_code'        => $txData['qr_code']        ?? '',
        'qr_code_base64' => $txData['qr_code_base64'] ?? '',
        'ticket_url'     => $txData['ticket_url']      ?? '',
    ];
}

respond($resp);
