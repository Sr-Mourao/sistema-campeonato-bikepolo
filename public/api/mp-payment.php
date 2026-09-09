<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/env.php';
require_once __DIR__ . '/email.php';
require_once __DIR__ . '/mercadopago.php';

corsHeaders();
header('Access-Control-Allow-Methods: POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') respondError('Método não suportado', 405);

$body          = getBody();
$formData      = $body['form_data']    ?? [];
$pagamentoId   = (int)($body['pagamento_id'] ?? 0);
$checkoutToken = trim($body['checkout_token'] ?? '');
$sessionToken  = $_SERVER['HTTP_X_SESSION_TOKEN'] ?? '';
$metodo        = trim($body['metodo'] ?? 'pix'); // 'pix' | 'cartao'

if (!$pagamentoId) respondError('pagamento_id é obrigatório');

$db = getDb();

// ── Autentica e determina o valor a cobrar ───────────────
$pagamento  = null;
$valorMP    = 0.0;
$inscricaoId = null;
$tipoFluxo  = ''; // 'checkout' ou 'dashboard'

if (!empty($sessionToken)) {
    // Dashboard: paga um serviço específico (alimentação, alojamento)
    $stmt = $db->prepare("
        SELECT pg.* FROM pagamentos pg
        JOIN inscricoes i ON i.id = pg.inscricao_id
        JOIN pessoas p    ON p.id = i.pessoa_id
        WHERE pg.id = ? AND p.email = ? COLLATE NOCASE AND pg.status IN ('pendente', 'cancelado')
    ");
    $sess = $db->prepare("SELECT email FROM sessions WHERE token = ? AND expires_at > datetime('now')");
    $sess->execute([$sessionToken]);
    $session = $sess->fetch();
    if (!$session) respondError('Sessão inválida', 401);

    $stmt->execute([$pagamentoId, $session['email']]);
    $pagamento = $stmt->fetch();
    if (!$pagamento) respondError('Pagamento não encontrado ou já processado', 404);

    $valorMP    = (float)$pagamento['valor'];
    $inscricaoId = (int)$pagamento['inscricao_id'];
    $tipoFluxo  = 'dashboard';

} elseif (!empty($checkoutToken)) {
    // Pós-inscrição: checkout unificado via token (paga todos os pendentes da inscrição)
    $stmt = $db->prepare("SELECT * FROM pagamentos WHERE id = ? AND checkout_token = ?");
    $stmt->execute([$pagamentoId, $checkoutToken]);
    $pagamento = $stmt->fetch();
    if (!$pagamento) respondError('Token de checkout inválido', 401);

    $inscricaoId = (int)$pagamento['inscricao_id'];

    // Soma todos os pagamentos pendentes da inscrição e inclui também o
    // pagamento selecionado caso ele já tenha sido cancelado/rejeitado.
    $stmt = $db->prepare("
        SELECT COALESCE(SUM(valor), 0) AS total
        FROM pagamentos
        WHERE inscricao_id = ?
          AND (status = 'pendente' OR id = ?)
    ");
    $stmt->execute([$inscricaoId, $pagamentoId]);
    $valorMP = (float)$stmt->fetchColumn();

    if ($valorMP <= 0) respondError('Não há pagamentos pendentes para esta inscrição', 400);
    $tipoFluxo = 'checkout';

} else {
    respondError('Não autenticado', 401);
}

// ── Aplica taxa de cartão (5%) ───────────────────────────
if ($metodo === 'cartao') {
    $valorMP = round($valorMP * 1.05, 2);
}

// ── Monta payload para o MP ──────────────────────────────
$descricoes = [
    'inscricao'  => '10º Brasileiro de Bike Polo — Inscrição',
    'alimentacao'=> '10º Brasileiro de Bike Polo — Alimentação',
    'alojamento' => '10º Brasileiro de Bike Polo — Alojamento',
];
$descricao = $tipoFluxo === 'checkout'
    ? '10º Brasileiro de Bike Polo — Inscrição + Serviços'
    : ($descricoes[$pagamento['tipo']] ?? '10º Brasileiro de Bike Polo');

$mpPayload = array_merge($formData, [
    'transaction_amount'  => $valorMP,
    'description'         => $descricao,
    'external_reference'  => (string)$pagamentoId,
    'notification_url'    => APP_URL . '/api/webhook-mp.php',
    'statement_descriptor'=> 'BIKEPOLO',
]);

// ── Chama a mesma integração MP compartilhada pelas recargas ──────────
try {
    $mp = mercadoPagoCriarPagamento($mpPayload, 'cb10-' . $tipoFluxo . '-' . $pagamentoId . '-' . time());
} catch (Throwable $e) {
    respondError($e->getMessage(), 502);
}

$mpId     = (int)($mp['id'] ?? 0);
$mpStatus = $mp['status'] ?? 'pending';

// ── Atualiza referencia_externa no registro ───────────────
// origem_pagamento registra se esta cobrança específica veio do checkout unificado
// (paga tudo) ou do pagamento individual pelo dashboard — o webhook usa isso depois
// para decidir se deve quitar os demais serviços pendentes da inscrição.
$db->prepare("
    UPDATE pagamentos
    SET referencia_externa = ?, dados_externos = ?, origem_pagamento = ?, atualizado_em = datetime('now')
    WHERE id = ?
")->execute([$mpId, json_encode($mp, JSON_UNESCAPED_UNICODE), $tipoFluxo, $pagamentoId]);

// ── Aprovação imediata (cartão sem 3DS) ───────────────────
if ($mpStatus === 'approved') {
    $metodo = $mp['payment_method_id'] ?? 'card';

    $db->prepare("UPDATE pagamentos SET status='pago', metodo=?, atualizado_em=datetime('now') WHERE id=?")
       ->execute([$metodo, $pagamentoId]);

    if ($tipoFluxo === 'checkout') {
        // Checkout unificado: quita todos os pendentes da inscrição
        $db->prepare("UPDATE pagamentos SET status='pago', metodo='mp', atualizado_em=datetime('now') WHERE inscricao_id=? AND status='pendente'")
           ->execute([$inscricaoId]);
        $db->prepare("UPDATE inscricoes SET status='pago', atualizado_em=datetime('now') WHERE id=?")
           ->execute([$inscricaoId]);
    } elseif (in_array($pagamento['tipo'], ['inscricao', 'completo'])) {
        $db->prepare("UPDATE inscricoes SET status='pago', atualizado_em=datetime('now') WHERE id=?")
           ->execute([$inscricaoId]);
    }

    // Notifica por email (aprovação síncrona — cartão sem 3DS)
    $stmtPessoa = $db->prepare("
        SELECT p.nome, p.email FROM inscricoes i JOIN pessoas p ON p.id = i.pessoa_id WHERE i.id = ?
    ");
    $stmtPessoa->execute([$inscricaoId]);
    $pessoaDados = $stmtPessoa->fetch() ?: [];
    if (!empty($pessoaDados)) {
        $tipoLabels = ['inscricao' => 'Inscrição Esportiva', 'alimentacao' => 'Alimentação', 'alojamento' => 'Alojamento'];
        $tipoLabel  = ($tipoFluxo === 'checkout') ? 'Inscrição + Serviços' : ($tipoLabels[$pagamento['tipo']] ?? 'Pagamento');
        $tipoCode   = ($tipoFluxo === 'checkout') ? 'checkout' : ($pagamento['tipo'] ?? 'inscricao');
        sendPaymentApprovedEmail($pessoaDados['email'], $pessoaDados['nome'], $tipoCode, $tipoLabel, $valorMP);
    }
}

// ── Resposta para o frontend ─────────────────────────────
$resp = [
    'success'      => true,
    'status'       => $mpStatus,
    'status_detail'=> $mp['status_detail'] ?? '',
    'transaction_amount' => (float)($mp['transaction_amount'] ?? $valorMP),
    'payment_method_id'  => $mp['payment_method_id'] ?? null,
    'mp_id'        => $mpId,
    'pagamento_id' => $pagamentoId,
];

// PIX: retorna dados do QR Code
if (isset($mp['point_of_interaction']['transaction_data'])) {
    $txData = $mp['point_of_interaction']['transaction_data'];
    $resp['pix'] = [
        'qr_code'        => $txData['qr_code']        ?? '',
        'qr_code_base64' => $txData['qr_code_base64'] ?? '',
        'ticket_url'     => $txData['ticket_url']      ?? '',
    ];
}

respond($resp);
