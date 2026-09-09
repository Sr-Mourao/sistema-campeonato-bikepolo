<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/env.php';
require_once __DIR__ . '/carteira/lib.php';

corsHeaders();
$db=getDb();
$pessoa=carteiraPessoaDaSessao($db);
if(!$pessoa) respondError('Não autenticado',401);

try {
    if($_SERVER['REQUEST_METHOD']==='GET') {
        respond(carteiraDados($db,(int)$pessoa['id']));
    }
    if($_SERVER['REQUEST_METHOD']!=='POST') respondError('Método não suportado',405);
    carteiraValidarSameOrigin();
    $body=getBody(); $acao=$body['acao']??'';
    if($acao==='criar_recarga') {
        $carteira=carteiraCriarOuObter($db,(int)$pessoa['id']);
        $recarga=carteiraCriarRecarga($db,(int)$carteira['id'],(int)($body['valor_centavos']??0));
        respond($recarga,201);
    }
    respondError('Ação inválida');
} catch(DomainException $e){respondError($e->getMessage(),400);}
catch(Throwable $e){error_log('[carteira] '.$e->getMessage());respondError('Erro ao processar carteira',500);}
