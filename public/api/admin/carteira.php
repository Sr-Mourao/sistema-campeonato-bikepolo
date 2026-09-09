<?php
require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/../email.php';
require_once __DIR__ . '/../carteira/auth_lib.php';
adminGuard();

$db=getDb();
$provisionadas=carteiraProvisionarTodasPessoas($db);
$admin=(string)($_SESSION['admin_user']??'admin');
$acao=trim($_GET['acao']??'');

function carteiraAdminDetalhe(PDO $db,int $id): ?array {
    $stmt=$db->prepare("SELECT c.id,c.saldo_centavos,c.status,c.qr_token,c.criada_em,p.id AS pessoa_id,p.nome,p.email FROM carteiras c JOIN pessoas p ON p.id=c.pessoa_id WHERE c.id=?");
    $stmt->execute([$id]); return $stmt->fetch()?:null;
}

if($_SERVER['REQUEST_METHOD']==='GET') {
    if($acao==='produtos') {
        respond($db->query('SELECT * FROM carteira_produtos ORDER BY ativo DESC,nome')->fetchAll());
    }
    if($acao==='carteiras') {
        $busca=trim($_GET['busca']??''); $like='%'.$busca.'%';
        $stmt=$db->prepare("
          SELECT c.id,c.saldo_centavos,c.status,c.criada_em,p.nome,p.email,p.telefone,p.cidade,p.nacionalidade,p.genero,
            cl.nome AS clube,
            GROUP_CONCAT(DISTINCT ic.categoria) AS categorias,
            MAX(i.status) AS status_inscricao,
            COALESCE((SELECT SUM(valor_centavos) FROM carteira_movimentos m WHERE m.carteira_id=c.id AND m.tipo='RECARGA'),0) total_recarregado_centavos,
            COALESCE((SELECT -SUM(valor_centavos) FROM carteira_movimentos m WHERE m.carteira_id=c.id AND m.tipo='COMPRA'),0) total_consumido_centavos
          FROM carteiras c
          JOIN pessoas p ON p.id=c.pessoa_id
          LEFT JOIN clubes cl ON cl.id=p.clube_id
          LEFT JOIN inscricoes i ON i.pessoa_id=p.id
          LEFT JOIN inscricao_categorias ic ON ic.inscricao_id=i.id
          WHERE ?='' OR p.nome LIKE ? OR p.email LIKE ? OR cl.nome LIKE ? OR p.cidade LIKE ?
          GROUP BY c.id
          ORDER BY p.nome COLLATE NOCASE
        "); $stmt->execute([$busca,$like,$like,$like,$like]); respond(['carteiras'=>$stmt->fetchAll(),'provisionadas'=>$provisionadas]);
    }
    if($acao==='resolver_qr') {
        $token=trim($_GET['token']??'');
        $stmt=$db->prepare("SELECT c.id,c.saldo_centavos,c.status,p.nome,p.email FROM carteiras c JOIN pessoas p ON p.id=c.pessoa_id WHERE c.qr_token=?");
        $stmt->execute([$token]); $row=$stmt->fetch(); if(!$row)respondError('QR de carteira inválido',404); respond($row);
    }
    if($acao==='vendas') {
        $vendas=$db->query("SELECT v.*,p.nome,p.email FROM carteira_vendas v JOIN carteiras c ON c.id=v.carteira_id JOIN pessoas p ON p.id=c.pessoa_id ORDER BY v.id DESC LIMIT 200")->fetchAll();
        $it=$db->prepare('SELECT produto_nome,quantidade,preco_unitario_centavos FROM carteira_venda_itens WHERE venda_id=? ORDER BY id');
        foreach($vendas as &$v){$it->execute([$v['id']]);$v['itens']=$it->fetchAll();} unset($v); respond($vendas);
    }
    if($acao==='resumo') {
        $scalar=fn(string $sql)=>(int)$db->query($sql)->fetchColumn();
        $produtos=$db->query("SELECT p.id,p.nome,p.estoque,COALESCE(SUM(CASE WHEN v.status='confirmada' THEN i.quantidade ELSE 0 END),0) quantidade_vendida,COALESCE(SUM(CASE WHEN v.status='confirmada' THEN i.quantidade*i.preco_unitario_centavos ELSE 0 END),0) valor_bruto_centavos FROM carteira_produtos p LEFT JOIN carteira_venda_itens i ON i.produto_id=p.id LEFT JOIN carteira_vendas v ON v.id=i.venda_id GROUP BY p.id ORDER BY p.nome")->fetchAll();
        respond([
          'recargas_aprovadas_centavos'=>$scalar("SELECT COALESCE(SUM(valor_centavos),0) FROM carteira_recargas WHERE status='aprovada'"),
          'vendas_centavos'=>$scalar("SELECT COALESCE(SUM(total_centavos),0) FROM carteira_vendas WHERE status='confirmada'"),
          'estornado_centavos'=>$scalar("SELECT COALESCE(SUM(total_centavos),0) FROM carteira_vendas WHERE status='estornada'"),
          'reembolsado_centavos'=>$scalar("SELECT COALESCE(-SUM(valor_centavos),0) FROM carteira_movimentos WHERE tipo='REEMBOLSO'"),
          'saldo_carteiras_centavos'=>$scalar('SELECT COALESCE(SUM(saldo_centavos),0) FROM carteiras'),
          'numero_carteiras'=>$scalar('SELECT COUNT(*) FROM carteiras'),
          'carteiras_com_saldo'=>$scalar('SELECT COUNT(*) FROM carteiras WHERE saldo_centavos>0'),
          'estoque_atual'=>$scalar('SELECT COALESCE(SUM(estoque),0) FROM carteira_produtos'),
          'produtos'=>$produtos,
        ]);
    }
    respondError('Ação inválida');
}

if($_SERVER['REQUEST_METHOD']!=='POST') respondError('Método não suportado',405);
try {
    carteiraValidarSameOrigin();
    $body=getBody(); $acao=trim($body['acao']??'');
    if($acao==='criar_carteira') {
        $email=carteiraEmail($body['email']??'');
        $stmt=$db->prepare('SELECT * FROM pessoas WHERE email=? COLLATE NOCASE');$stmt->execute([$email]);$existente=$stmt->fetch();
        $pessoa=$existente?:carteiraCriarOuObterPessoa($db,$email,$body['nome']??null);
        $carteira=carteiraCriarOuObter($db,(int)$pessoa['id']);
        $magic=carteiraGerarMagicLink($db,(int)$pessoa['id']);
        $enviado=sendWalletMagicLinkEmail($pessoa['email'],$pessoa['nome'],$magic['token']);
        if(!$enviado)throw new RuntimeException('Carteira criada, mas não foi possível enviar o acesso');
        respond(['carteira'=>carteiraAdminDetalhe($db,(int)$carteira['id']),'identidade_existente'=>(bool)$existente,'email_enviado'=>$enviado],201);
    }
    if($acao==='salvar_produto') {
        $id=(int)($body['id']??0);$nome=trim($body['nome']??'');$preco=(int)($body['preco_centavos']??0);$ativo=!empty($body['ativo'])?1:0;
        if($nome===''||$preco<=0)throw new DomainException('Nome e preço são obrigatórios');
        if($id){$stmt=$db->prepare("UPDATE carteira_produtos SET nome=?,preco_centavos=?,ativo=?,atualizado_em=datetime('now') WHERE id=?");$stmt->execute([$nome,$preco,$ativo,$id]);if(!$stmt->rowCount())throw new DomainException('Produto não encontrado');}
        else{$estoque=(int)($body['estoque']??0);if($estoque<0)throw new DomainException('Estoque inválido');$db->beginTransaction();try{$db->prepare('INSERT INTO carteira_produtos(nome,preco_centavos,estoque,ativo)VALUES(?,?,?,?)')->execute([$nome,$preco,$estoque,$ativo]);$id=(int)$db->lastInsertId();if($estoque>0)$db->prepare("INSERT INTO carteira_estoque_movimentos(produto_id,tipo,quantidade,estoque_anterior,estoque_posterior,admin_usuario,observacao)VALUES(?,'AJUSTE',?,0,?,?,?)")->execute([$id,$estoque,$estoque,$admin,'Estoque inicial']);$db->commit();}catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw$e;}}
        $stmt=$db->prepare('SELECT * FROM carteira_produtos WHERE id=?');$stmt->execute([$id]);respond($stmt->fetch());
    }
    if($acao==='ajustar_estoque') respond(carteiraAjustarEstoque($db,(int)($body['produto_id']??0),(int)($body['quantidade']??0),$admin,trim($body['motivo']??'')));
    if($acao==='vender') respond(carteiraVenda($db,(int)($body['carteira_id']??0),$body['itens']??[],$admin,trim($body['request_id']??'')),201);
    if($acao==='estornar_venda') respond(carteiraEstornarVenda($db,(int)($body['venda_id']??0),$admin));
    if($acao==='reembolsar') respond(carteiraReembolsar($db,(int)($body['carteira_id']??0),(int)($body['valor_centavos']??0),$admin,trim($body['observacao']??'')));
    if($acao==='ajustar_saldo') {
        $valor=(int)($body['valor_centavos']??0);$motivo=trim($body['motivo']??'');if($valor===0||$motivo==='')throw new DomainException('Informe valor e motivo');
        $db->beginTransaction();try{$r=carteiraRegistrarMovimento($db,(int)$body['carteira_id'],'AJUSTE_ADMINISTRATIVO',$valor,['admin_usuario'=>$admin,'observacao'=>$motivo]);$db->commit();respond($r);}catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw$e;}
    }
    if($acao==='zerar_operacao') {
        if(($body['confirmacao']??'')!=='ZERAR CARTEIRA')throw new DomainException('Digite ZERAR CARTEIRA para confirmar');
        if(!adminPasswordConfere((string)($body['senha']??'')))respondError('Senha administrativa inválida',401);
        $resultado=carteiraZerarOperacao($db);
        error_log('[admin-carteira] operação zerada por '.$admin.'; '.json_encode($resultado));
        respond($resultado);
    }
    respondError('Ação inválida');
} catch(DomainException $e){respondError($e->getMessage(),409);}
catch(Throwable $e){error_log('[admin-carteira] '.$e->getMessage());respondError('Erro na operação da carteira',500);}
