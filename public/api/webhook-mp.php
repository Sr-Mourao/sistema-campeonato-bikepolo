<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/env.php';
require_once __DIR__ . '/email.php';
require_once __DIR__ . '/carteira/lib.php';
require_once __DIR__ . '/mercadopago.php';

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

// ── Busca detalhes do pagamento pela integração compartilhada ──────────
try {
    $mp = mercadoPagoBuscarPagamento((string)$mpId);
} catch (Throwable $e) {
    error_log('Webhook MP: ' . $e->getMessage());
    http_response_code(200); // retorna 200 para o MP não reenviar
    echo json_encode(['error' => 'Falha ao buscar pagamento']);
    exit;
}
$mpStatus = $mp['status'] ?? '';
$extRef   = $mp['external_reference'] ?? '';
$metodo   = $mp['payment_method_id'] ?? null;

if (!$extRef) {
    http_response_code(200);
    echo json_encode(['ok' => 'sem external_reference']);
    exit;
}

// Namespace inequívoco: recargas nunca são procuradas na tabela de inscrições.
if (str_starts_with($extRef, 'carteira_recarga:')) {
    $origem = $mp['metadata']['origem'] ?? '';
    if ($origem !== 'carteira_recarga') {
        error_log("Webhook MP: metadata incompatível para {$extRef}");
        http_response_code(200);
        echo json_encode(['error' => 'Origem de pagamento incompatível']);
        exit;
    }
    try {
        $creditado = carteiraConfirmarRecargaMercadoPago(getDb(), $mp);
        error_log("Webhook MP: recarga {$extRef} processada; novo_credito=" . ($creditado ? 'sim' : 'não'));
        http_response_code(200);
        echo json_encode(['ok' => true]);
    } catch (Throwable $e) {
        error_log('Webhook MP carteira: ' . $e->getMessage());
        // Falhas transitórias devem ser reenviadas pelo Mercado Pago; a idempotência
        // no banco torna a repetição segura.
        http_response_code(500);
        echo json_encode(['error' => 'Falha ao processar recarga']);
    }
    exit;
}

$pagamentoId = (int)$extRef;
$db = getDb();

$stmt = $db->prepare("SELECT * FROM pagamentos WHERE id = ?");
$stmt->execute([$pagamentoId]);
$pagamento = $stmt->fetch();

if (!$pagamento) {
    http_response_code(200);
    echo json_encode(['ok' => 'pagamento não encontrado']);
    exit;
}

// Busca dados da pessoa para notificação por email
$stmtPessoa = $db->prepare("
    SELECT p.nome, p.email
    FROM inscricoes i JOIN pessoas p ON p.id = i.pessoa_id
    WHERE i.id = ?
");
$stmtPessoa->execute([$pagamento['inscricao_id']]);
$pessoaDados = $stmtPessoa->fetch() ?: [];

// Atualiza referencia_externa caso ainda não esteja
$db->prepare("UPDATE pagamentos SET referencia_externa = ?, dados_externos = ?, atualizado_em = datetime('now') WHERE id = ?")
   ->execute([$mpId, json_encode($mp, JSON_UNESCAPED_UNICODE), $pagamentoId]);

if ($mpStatus === 'approved') {
    $jaEstavaPago = ($pagamento['status'] === 'pago');

    if (!$jaEstavaPago) {
        $db->prepare("UPDATE pagamentos SET status='pago', metodo=?, atualizado_em=datetime('now') WHERE id=?")
           ->execute([$metodo, $pagamentoId]);
        lockAlojamentoAoPagar($db, $pagamentoId);
    }

    if (in_array($pagamento['tipo'], ['inscricao', 'completo'])) {
        if ($pagamento['origem_pagamento'] === 'checkout') {
            // Checkout unificado: quita todos os demais pendentes da inscrição (alimentação, alojamento)
            $stmtQuitados = $db->prepare("SELECT id FROM pagamentos WHERE inscricao_id=? AND status='pendente'");
            $stmtQuitados->execute([$pagamento['inscricao_id']]);
            $quitadosIds = array_column($stmtQuitados->fetchAll(), 'id');

            $db->prepare("UPDATE pagamentos SET status='pago', metodo='mp', atualizado_em=datetime('now') WHERE inscricao_id=? AND status='pendente'")
               ->execute([$pagamento['inscricao_id']]);

            foreach ($quitadosIds as $qid) lockAlojamentoAoPagar($db, (int)$qid);
        }
        $db->prepare("UPDATE inscricoes SET status='pago', atualizado_em=datetime('now') WHERE id=?")
           ->execute([$pagamento['inscricao_id']]);
    }

    // Notifica apenas na primeira aprovação (evita email duplo em retentativas)
    if (!$jaEstavaPago && !empty($pessoaDados)) {
        $tipoLabels = ['inscricao' => 'Inscrição Esportiva', 'alimentacao' => 'Alimentação', 'alojamento' => 'Alojamento'];
        $tipoLabel  = $tipoLabels[$pagamento['tipo']] ?? 'Pagamento';
        sendPaymentApprovedEmail($pessoaDados['email'], $pessoaDados['nome'], $pagamento['tipo'], $tipoLabel, (float)$pagamento['valor']);
    }

    error_log("Webhook MP: pagamento {$pagamentoId} aprovado (MP #{$mpId})");
}

if (in_array($mpStatus, ['rejected', 'cancelled']) && $pagamento['status'] === 'pendente') {
    $db->prepare("UPDATE pagamentos SET status='cancelado', metodo=?, atualizado_em=datetime('now') WHERE id=?")
       ->execute([$metodo, $pagamentoId]);

    if (!empty($pessoaDados)) {
        $tipoLabels = ['inscricao' => 'Inscrição Esportiva', 'alimentacao' => 'Alimentação', 'alojamento' => 'Alojamento'];
        $tipoLabel  = $tipoLabels[$pagamento['tipo']] ?? 'Pagamento';
        sendPaymentRejectedEmail($pessoaDados['email'], $pessoaDados['nome'], $tipoLabel);
    }

    error_log("Webhook MP: pagamento {$pagamentoId} rejeitado (MP #{$mpId}) — {$mpStatus}");
}

http_response_code(200);
echo json_encode(['ok' => true]);
