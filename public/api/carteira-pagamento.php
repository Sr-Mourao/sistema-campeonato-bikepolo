<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/env.php';
require_once __DIR__ . '/mercadopago.php';
require_once __DIR__ . '/carteira/lib.php';

corsHeaders();
if($_SERVER['REQUEST_METHOD']!=='POST') respondError('Método não suportado',405);
$db=getDb(); $pessoa=carteiraPessoaDaSessao($db); if(!$pessoa) respondError('Não autenticado',401);
try {
    carteiraValidarSameOrigin();
    $body=getBody(); $id=(int)($body['pagamento_id']??0); $metodo=($body['metodo']??'pix')==='cartao'?'cartao':'pix';
    $stmt=$db->prepare("SELECT r.* FROM carteira_recargas r JOIN carteiras c ON c.id=r.carteira_id WHERE r.id=? AND c.pessoa_id=? AND r.status='pendente'");
    $stmt->execute([$id,$pessoa['id']]); $recarga=$stmt->fetch(); if(!$recarga) respondError('Recarga não encontrada ou já processada',404);
    $credito=(int)$recarga['valor_centavos']; $cobrado=$metodo==='cartao'?(int)round($credito*1.05):$credito;
    $db->prepare("UPDATE carteira_recargas SET status='pendente',metodo=?,valor_cobrado_centavos=?,atualizada_em=datetime('now') WHERE id=?")->execute([$metodo,$cobrado,$id]);
    $payload=array_merge($body['form_data']??[],[
        'transaction_amount'=>$cobrado/100,
        'description'=>'10º Brasileiro de Bike Polo — Recarga de carteira',
        'external_reference'=>$recarga['referencia_externa'],
        'notification_url'=>APP_URL.'/api/webhook-mp.php',
        'statement_descriptor'=>'BIKEPOLO',
        'metadata'=>['origem'=>'carteira_recarga','recarga_id'=>$id],
    ]);
    $mp=mercadoPagoCriarPagamento($payload,'cb10-carteira-recarga-'.$id);
    // Cartão aprovado imediatamente e webhook posterior convergem para a mesma rotina idempotente.
    // Para Pix, esta chamada apenas persiste o estado pendente; polling nunca cria crédito.
    carteiraConfirmarRecargaMercadoPago($db,$mp);
    $resp=['success'=>true,'status'=>$mp['status']??'pending','status_detail'=>$mp['status_detail']??'','transaction_amount'=>$mp['transaction_amount']??($cobrado/100),'payment_method_id'=>$mp['payment_method_id']??null,'mp_id'=>$mp['id']??null,'pagamento_id'=>$id];
    if(isset($mp['point_of_interaction']['transaction_data'])){$tx=$mp['point_of_interaction']['transaction_data'];$resp['pix']=['qr_code'=>$tx['qr_code']??'','qr_code_base64'=>$tx['qr_code_base64']??'','ticket_url'=>$tx['ticket_url']??''];}
    respond($resp);
} catch(DomainException $e){respondError($e->getMessage(),400);}
catch(Throwable $e){error_log('[carteira-pagamento] '.$e->getMessage());respondError('Erro no pagamento da recarga',502);}
