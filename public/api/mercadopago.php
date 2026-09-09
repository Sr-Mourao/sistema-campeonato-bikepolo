<?php
require_once __DIR__ . '/env.php';

function mercadoPagoRequest(string $metodo, string $caminho, ?array $payload = null, ?string $idempotencyKey = null): array {
    $ch = curl_init('https://api.mercadopago.com' . $caminho);
    $headers = ['Authorization: Bearer ' . MP_ACCESS_TOKEN, 'Content-Type: application/json'];
    if ($idempotencyKey) $headers[] = 'X-Idempotency-Key: ' . $idempotencyKey;
    $opts = [CURLOPT_RETURNTRANSFER=>true,CURLOPT_CUSTOMREQUEST=>$metodo,CURLOPT_HTTPHEADER=>$headers,CURLOPT_TIMEOUT=>30];
    if ($payload !== null) $opts[CURLOPT_POSTFIELDS] = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    curl_setopt_array($ch,$opts);
    $raw=curl_exec($ch); $status=curl_getinfo($ch,CURLINFO_HTTP_CODE); $erro=curl_error($ch); curl_close($ch);
    if ($erro) throw new RuntimeException('Erro de conexão com Mercado Pago: ' . $erro);
    $data=json_decode((string)$raw,true);
    if ($status<200 || $status>=300 || !is_array($data)) throw new RuntimeException($data['message'] ?? $data['error'] ?? 'Erro no Mercado Pago');
    return $data;
}

function mercadoPagoCriarPagamento(array $payload, string $idempotencyKey): array {
    return mercadoPagoRequest('POST','/v1/payments',$payload,$idempotencyKey);
}

function mercadoPagoBuscarPagamento(string $paymentId): array {
    if (!preg_match('/^\d+$/',$paymentId)) throw new DomainException('ID Mercado Pago inválido');
    return mercadoPagoRequest('GET','/v1/payments/' . $paymentId);
}
