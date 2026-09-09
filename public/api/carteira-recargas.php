<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/carteira/lib.php';
corsHeaders();
if($_SERVER['REQUEST_METHOD']!=='GET') respondError('Método não suportado',405);
$db=getDb(); $pessoa=carteiraPessoaDaSessao($db); if(!$pessoa) respondError('Não autenticado',401);
$stmt=$db->prepare("SELECT r.id,'recarga' AS tipo,CASE r.status WHEN 'aprovada' THEN 'pago' WHEN 'recusada' THEN 'cancelado' WHEN 'cancelada' THEN 'cancelado' WHEN 'estornada' THEN 'cancelado' ELSE 'pendente' END AS status,r.valor_centavos/100.0 AS valor,r.metodo,r.criada_em FROM carteira_recargas r JOIN carteiras c ON c.id=r.carteira_id WHERE c.pessoa_id=? ORDER BY r.id DESC");
$stmt->execute([$pessoa['id']]); respond($stmt->fetchAll());
