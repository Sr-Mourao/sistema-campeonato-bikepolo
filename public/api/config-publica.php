<?php
/**
 * Configuração pública do front — só o que pode ser lido por qualquer pessoa.
 *
 * Existe para que a chave PÚBLICA do Mercado Pago (usada pelo SDK no navegador)
 * saia de dentro do código-fonte e passe a vir de public/api/env.php, junto com
 * o resto da configuração da instância. Nunca devolva aqui MP_ACCESS_TOKEN,
 * MP_WEBHOOK_SECRET, RESEND_API_KEY ou qualquer credencial de servidor.
 */
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/env.php';

corsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') respondError('Método não suportado', 405);

respond([
    'mp_public_key' => defined('MP_PUBLIC_KEY') ? (string)MP_PUBLIC_KEY : '',
    'pagamento_mock' => defined('PAGAMENTO_MOCK') && PAGAMENTO_MOCK,
]);
