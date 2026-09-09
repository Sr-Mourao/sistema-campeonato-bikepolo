<?php

function walletSeed(PDO $db, string $email = 'pessoa@teste.local', string $nome = 'Pessoa Teste'): array {
    $pessoa = carteiraCriarOuObterPessoa($db, $email, $nome);
    $carteira = carteiraCriarOuObter($db, (int)$pessoa['id']);
    return [$pessoa, $carteira];
}

function walletMp(array $recarga, string $id, string $status = 'approved', ?int $centavos = null): array {
    return [
        'id' => $id,
        'status' => $status,
        'transaction_amount' => ($centavos ?? (int)$recarga['valor_centavos']) / 100,
        'external_reference' => $recarga['referencia_externa'],
        'payment_method_id' => 'pix',
        'metadata' => ['origem' => 'carteira_recarga'],
    ];
}

function walletCredit(PDO $db, int $carteiraId, int $centavos): array {
    $r = carteiraCriarRecarga($db, $carteiraId, $centavos);
    carteiraConfirmarRecargaMercadoPago($db, walletMp($r, 'mp-' . bin2hex(random_bytes(5))));
    return $r;
}

function test_carteira_identidade_nocase_unica_e_sem_sobrescrita(): void {
    $db = testDb();
    $db->prepare("INSERT INTO pessoas(nome,email,telefone,genero,cidade) VALUES(?,?,?,?,?)")
       ->execute(['Nome atleta', 'Atleta@Email.com', '489999', 'feminino', 'Floripa']);
    $id = (int)$db->lastInsertId();
    $pessoa = carteiraCriarOuObterPessoa($db, 'ATLETA@email.COM', 'Nome indevido');
    carteiraCriarOuObter($db, $id);
    assertEqualsT($id, (int)$pessoa['id'], 'email em caixa diferente reutiliza pessoa');
    $row = $db->query("SELECT * FROM pessoas WHERE id=$id")->fetch();
    assertEqualsT('Nome atleta', $row['nome'], 'criação da carteira não altera nome existente');
    assertEqualsT('489999', $row['telefone'], 'criação da carteira não altera dados esportivos/pessoais');
    assertEqualsT(1, (int)$db->query('SELECT COUNT(*) FROM pessoas')->fetchColumn(), 'não duplica pessoa');
}

function test_carteira_criacao_unica_e_qr_opaco(): void {
    $db = testDb(); [$p, $a] = walletSeed($db); $b = carteiraCriarOuObter($db, (int)$p['id']);
    assertEqualsT($a['id'], $b['id'], 'uma carteira por identidade');
    assertTrue((bool)preg_match('/^[a-f0-9]{64}$/', $a['qr_token']), 'QR usa token aleatório opaco');
    assertEqualsT(64, strlen($a['qr_token']), 'QR não expõe um identificador sequencial');
}

function test_carteira_provisiona_todas_as_pessoas_existentes(): void {
    $db = testDb();
    $db->exec("INSERT INTO pessoas(nome,email) VALUES ('Atleta Um','um@evento.test'),('Atleta Dois','dois@evento.test'),('Público','publico@evento.test')");
    assertEqualsT(3, carteiraProvisionarTodasPessoas($db), 'todas as identidades existentes recebem carteira');
    assertEqualsT(3, (int)$db->query('SELECT COUNT(*) FROM carteiras')->fetchColumn(), 'existe uma carteira para cada pessoa');
    assertEqualsT(0, carteiraProvisionarTodasPessoas($db), 'provisionamento repetido não duplica carteiras');
    assertEqualsT(3, (int)$db->query('SELECT COUNT(DISTINCT pessoa_id) FROM carteiras')->fetchColumn(), 'vínculo continua único por pessoa');
}

function test_carteira_magic_link_valido_expirado_e_uso_unico(): void {
    $db = testDb(); [$p] = walletSeed($db);
    $magic = carteiraGerarMagicLink($db, (int)$p['id']);
    $stored = $db->query('SELECT token_hash FROM carteira_magic_links ORDER BY id DESC LIMIT 1')->fetchColumn();
    assertEqualsT(hash('sha256', $magic['token']), $stored, 'somente hash SHA-256 fica no banco');
    $used = carteiraConsumirMagicLink($db, $magic['token']);
    assertEqualsT($p['id'], $used['pessoa_id'], 'magic link autentica identidade correta');
    assertThrowsT(fn() => carteiraConsumirMagicLink($db, $magic['token']), 'magic link reutilizado é recusado');
    $expired = carteiraGerarMagicLink($db, (int)$p['id'], -10);
    assertThrowsT(fn() => carteiraConsumirMagicLink($db, $expired['token']), 'magic link expirado é recusado');
}

function test_carteira_sessao_legada_reutilizada_por_30_dias(): void {
    $db = testDb(); [$p] = walletSeed($db);
    $expires = gmdate('Y-m-d H:i:s', time() + SESSION_DURATION);
    $token = bin2hex(random_bytes(32));
    $db->prepare('INSERT INTO sessions(token,email,expires_at) VALUES(?,?,?)')->execute([$token, $p['email'], $expires]);
    $session = carteiraCriarSessao($db, $p['email'], $token);
    assertEqualsT($token, $session['token'], 'ponte reutiliza a sessão legada em vez de duplicar');
    assertEqualsT(1, (int)$db->query('SELECT COUNT(*) FROM sessions')->fetchColumn(), 'ponte não cria sessão extra');
    assertEqualsT($p['id'], carteiraPessoaDaSessao($db, $token)['id'], 'sessão identifica a mesma pessoa');
}

function test_carteira_dados_sao_sempre_da_pessoa_autenticada(): void {
    $db = testDb(); [$p1, $w1] = walletSeed($db, 'um@teste.local', 'Um'); [, $w2] = walletSeed($db, 'dois@teste.local', 'Dois');
    carteiraRegistrarMovimento($db, (int)$w2['id'], 'AJUSTE_ADMINISTRATIVO', 9900, ['admin_usuario'=>'admin']);
    $data = carteiraDados($db, (int)$p1['id']);
    assertEqualsT($w1['id'], $data['carteira']['id'], 'endpoint deriva carteira da identidade da sessão');
    assertEqualsT(0, (int)$data['carteira']['saldo_centavos'], 'não expõe saldo da carteira alheia');
}

function test_carteira_recarga_status_e_idempotencia_forte(): void {
    $db = testDb(); [, $wallet] = walletSeed($db); $id = (int)$wallet['id'];
    foreach (['pending', 'rejected', 'cancelled'] as $i => $status) {
        $r = carteiraCriarRecarga($db, $id, 2000 + $i * 100);
        assertFalse(carteiraConfirmarRecargaMercadoPago($db, walletMp($r, 'mp-no-' . $i, $status)), "$status não credita");
    }
    assertEqualsT(0, (int)$db->query("SELECT saldo_centavos FROM carteiras WHERE id=$id")->fetchColumn(), 'pendente/recusado/cancelado não altera saldo');
    $r = carteiraCriarRecarga($db, $id, 5000);
    $db->prepare('UPDATE carteira_recargas SET valor_cobrado_centavos=?,metodo=? WHERE id=?')->execute([5250,'cartao',$r['id']]);
    assertTrue(carteiraConfirmarRecargaMercadoPago($db, walletMp($r, 'mp-card-1', 'approved', 5250)), 'cartão confirmado na criação credita o valor da carteira');
    assertFalse(carteiraConfirmarRecargaMercadoPago($db, walletMp($r, 'mp-card-1', 'approved', 5250)), 'webhook posterior do cartão não duplica crédito');
    assertEqualsT(5000, (int)$db->query("SELECT saldo_centavos FROM carteiras WHERE id=$id")->fetchColumn(), 'apenas um crédito');
    assertEqualsT(1, (int)$db->query("SELECT COUNT(*) FROM carteira_movimentos WHERE tipo='RECARGA'")->fetchColumn(), 'apenas um movimento de recarga');
    $r2 = carteiraCriarRecarga($db, $id, 5000);
    assertThrowsT(fn()=>carteiraConfirmarRecargaMercadoPago($db, walletMp($r2, 'mp-card-1')), 'UNIQUE payment_id impede uso em segunda recarga');
}

function test_carteira_venda_atomica_historico_e_double_submit(): void {
    $db = testDb(); [, $wallet] = walletSeed($db); $wid=(int)$wallet['id']; walletCredit($db,$wid,10000);
    $db->exec("INSERT INTO carteira_produtos(nome,preco_centavos,estoque) VALUES('Lanche',1800,4)"); $pid=(int)$db->lastInsertId();
    $request='sale-' . bin2hex(random_bytes(12));
    $sale=carteiraVenda($db,$wid,[['produto_id'=>$pid,'quantidade'=>2]],'operador',$request);
    $again=carteiraVenda($db,$wid,[['produto_id'=>$pid,'quantidade'=>2]],'operador',$request);
    assertEqualsT($sale['id'],$again['id'],'double submit devolve a mesma venda');
    assertEqualsT(6400,(int)$db->query("SELECT saldo_centavos FROM carteiras WHERE id=$wid")->fetchColumn(),'venda debita saldo');
    assertEqualsT(2,(int)$db->query("SELECT estoque FROM carteira_produtos WHERE id=$pid")->fetchColumn(),'venda baixa estoque');
    assertEqualsT(1800,(int)$db->query('SELECT preco_unitario_centavos FROM carteira_venda_itens')->fetchColumn(),'item preserva preço histórico');
    $db->exec("UPDATE carteira_produtos SET preco_centavos=2500 WHERE id=$pid");
    assertEqualsT(1800,(int)$db->query('SELECT preco_unitario_centavos FROM carteira_venda_itens')->fetchColumn(),'mudança futura não altera venda');
    assertEqualsT(1,(int)$db->query('SELECT COUNT(*) FROM carteira_vendas')->fetchColumn(),'double submit não duplica venda');
    assertTrue(carteiraSaldoConfere($db,$wid),'saldo materializado equivale à soma dos movimentos');
}

function test_carteira_venda_rollback_saldo_e_estoque_insuficientes(): void {
    $db=testDb();[, $wallet]=walletSeed($db);$wid=(int)$wallet['id'];walletCredit($db,$wid,1000);
    $db->exec("INSERT INTO carteira_produtos(nome,preco_centavos,estoque) VALUES('Produto',800,1)");$pid=(int)$db->lastInsertId();
    assertThrowsT(fn()=>carteiraVenda($db,$wid,[['produto_id'=>$pid,'quantidade'=>2]],'admin','req-'.bin2hex(random_bytes(10))),'estoque insuficiente bloqueia');
    assertEqualsT(1000,(int)$db->query("SELECT saldo_centavos FROM carteiras WHERE id=$wid")->fetchColumn(),'rollback mantém saldo');
    assertEqualsT(1,(int)$db->query("SELECT estoque FROM carteira_produtos WHERE id=$pid")->fetchColumn(),'rollback mantém estoque');
    assertThrowsT(fn()=>carteiraVenda($db,$wid,[['produto_id'=>$pid,'quantidade'=>1],['produto_id'=>$pid,'quantidade'=>1]],'admin','req-'.bin2hex(random_bytes(10))),'itens repetidos são agregados e bloqueados');
    assertEqualsT(0,(int)$db->query('SELECT COUNT(*) FROM carteira_vendas')->fetchColumn(),'falha não registra venda');
}

function test_carteira_estorno_transacional_e_unico(): void {
    $db=testDb();[, $wallet]=walletSeed($db);$wid=(int)$wallet['id'];walletCredit($db,$wid,5000);
    $db->exec("INSERT INTO carteira_produtos(nome,preco_centavos,estoque) VALUES('Bebida',1200,3)");$pid=(int)$db->lastInsertId();
    $sale=carteiraVenda($db,$wid,[['produto_id'=>$pid,'quantidade'=>1]],'op','req-'.bin2hex(random_bytes(10)));
    carteiraEstornarVenda($db,(int)$sale['id'],'admin');
    assertEqualsT(5000,(int)$db->query("SELECT saldo_centavos FROM carteiras WHERE id=$wid")->fetchColumn(),'estorno devolve saldo');
    assertEqualsT(3,(int)$db->query("SELECT estoque FROM carteira_produtos WHERE id=$pid")->fetchColumn(),'estorno devolve estoque');
    assertThrowsT(fn()=>carteiraEstornarVenda($db,(int)$sale['id'],'admin'),'segundo estorno é recusado');
    assertTrue(carteiraSaldoConfere($db,$wid),'saldo segue coerente após estorno');
}

function test_carteira_reembolso_e_ajuste_exigem_admin_e_limites(): void {
    $db=testDb();[, $wallet]=walletSeed($db);$wid=(int)$wallet['id'];walletCredit($db,$wid,4000);
    carteiraReembolsar($db,$wid,1500,'admin-teste','Pix externo ref 123');
    assertEqualsT(2500,(int)$db->query("SELECT saldo_centavos FROM carteiras WHERE id=$wid")->fetchColumn(),'reembolso reduz saldo');
    $mov=$db->query("SELECT * FROM carteira_movimentos WHERE tipo='REEMBOLSO'")->fetch();
    assertEqualsT('admin-teste',$mov['admin_usuario'],'reembolso audita admin');
    assertThrowsT(fn()=>carteiraReembolsar($db,$wid,3000,'admin-teste',null),'reembolso acima do saldo bloqueado');
    assertTrue(carteiraSaldoConfere($db,$wid),'saldo materializado segue coerente');
}

function test_carteira_reset_de_producao_preserva_identidades_carteiras_e_qr(): void {
    $db=testDb();[$pessoa,$wallet]=walletSeed($db,'atleta@evento.test','Atleta Existente');$wid=(int)$wallet['id'];
    $db->prepare("INSERT INTO inscricoes(pessoa_id,status) VALUES(?,'pago')")->execute([(int)$pessoa['id']]);
    $qrAntes=$wallet['qr_token'];
    walletCredit($db,$wid,5000);
    $db->exec("INSERT INTO carteira_produtos(nome,preco_centavos,estoque) VALUES('Produto teste',1200,3)");$pid=(int)$db->lastInsertId();
    carteiraAjustarEstoque($db,$pid,2,'admin','Carga de teste');
    carteiraVenda($db,$wid,[['produto_id'=>$pid,'quantidade'=>1]],'admin','reset-'.bin2hex(random_bytes(10)));
    carteiraGerarMagicLink($db,(int)$pessoa['id']);

    $resultado=carteiraZerarOperacao($db);

    assertTrue($resultado['ok'],'reset conclui em transação');
    foreach(['carteira_venda_itens','carteira_estoque_movimentos','carteira_movimentos','carteira_vendas','carteira_recargas','carteira_produtos','carteira_magic_links'] as $tabela) {
        assertEqualsT(0,(int)$db->query("SELECT COUNT(*) FROM $tabela")->fetchColumn(),"reset limpa $tabela");
    }
    assertEqualsT(1,(int)$db->query('SELECT COUNT(*) FROM pessoas')->fetchColumn(),'reset preserva pessoa/atleta');
    assertEqualsT(1,(int)$db->query('SELECT COUNT(*) FROM inscricoes')->fetchColumn(),'reset preserva inscrição');
    assertEqualsT(1,(int)$db->query('SELECT COUNT(*) FROM carteiras')->fetchColumn(),'reset preserva carteira');
    $carteiraDepois=$db->query("SELECT saldo_centavos,qr_token,status FROM carteiras WHERE id=$wid")->fetch();
    assertEqualsT(0,(int)$carteiraDepois['saldo_centavos'],'reset zera saldo materializado');
    assertEqualsT($qrAntes,$carteiraDepois['qr_token'],'reset preserva QR permanente');
    assertEqualsT('ativa',$carteiraDepois['status'],'reset deixa carteira ativa');
    assertTrue(carteiraSaldoConfere($db,$wid),'saldo zerado continua coerente com movimentos');
}

function test_carteira_constraints_financeiras_e_permissoes(): void {
    $db=testDb();[, $wallet]=walletSeed($db);$wid=(int)$wallet['id'];
    assertThrowsT(fn()=>$db->exec("UPDATE carteiras SET saldo_centavos=-1 WHERE id=$wid"),'banco impede saldo negativo');
    $_SERVER['REQUEST_METHOD']='POST';$_SERVER['HTTP_HOST']='evento.test';unset($_SERVER['HTTP_ORIGIN'],$_SERVER['HTTP_REFERER']);
    assertThrowsT(fn()=>carteiraValidarSameOrigin(),'mutação por cookie exige origem same-origin');
    $_SERVER['HTTP_ORIGIN']='https://malicioso.test';assertThrowsT(fn()=>carteiraValidarSameOrigin(),'origem estrangeira é recusada');
    $_SERVER['HTTP_ORIGIN']='http://evento.test';carteiraValidarSameOrigin();
    $_SERVER['HTTP_HOST']='localhost:8000';
    $_SERVER['HTTP_ORIGIN']='http://localhost:5173';
    $_SERVER['HTTP_SEC_FETCH_SITE']='same-origin';
    carteiraValidarSameOrigin();
    $_SERVER['HTTP_SEC_FETCH_SITE']='cross-site';
    assertThrowsT(fn()=>carteiraValidarSameOrigin(),'Sec-Fetch-Site cross-site continua bloqueado');
    unset($_SERVER['HTTP_SEC_FETCH_SITE']);
    $_SERVER['REQUEST_METHOD']='GET';
    $admin=file_get_contents(__DIR__.'/../../public/api/admin/carteira.php');
    assertTrue(str_contains($admin,'adminGuard();'),'todos endpoints administrativos exigem admin');
    assertTrue(str_contains($admin,"adminPasswordConfere") && str_contains($admin,"ZERAR CARTEIRA"),'reset exige senha administrativa e frase exata');
    $public=file_get_contents(__DIR__.'/../../src/pages/Carteira.tsx');
    assertTrue(str_contains($public,'QR de identificação') && !str_contains($public,"carteiraVenda("),'rota pública do QR não executa débito');
    assertTrue(str_contains($public,"replaceState({}, '', '/carteira')"),'magic token desaparece da URL após consumo');
}
