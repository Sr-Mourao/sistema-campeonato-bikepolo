<?php

function carteiraEmail(string $email): string {
    return strtolower(trim($email));
}

function carteiraCriarOuObterPessoa(PDO $db, string $email, ?string $nome = null): array {
    $email = carteiraEmail($email);
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) throw new DomainException('Email inválido');

    $stmt = $db->prepare('SELECT * FROM pessoas WHERE email = ? COLLATE NOCASE');
    $stmt->execute([$email]);
    $pessoa = $stmt->fetch();
    if ($pessoa) return $pessoa; // Nunca sobrescreve dados de uma identidade existente.

    $nome = trim((string)$nome);
    if ($nome === '') throw new DomainException('Nome é obrigatório para criar a carteira');

    try {
        $db->prepare('INSERT INTO pessoas (nome, email) VALUES (?, ?)')->execute([$nome, $email]);
    } catch (PDOException $e) {
        // Corrida entre duas solicitações do mesmo email: a constraint NOCASE decide.
        if (!str_contains($e->getMessage(), 'UNIQUE')) throw $e;
    }
    $stmt->execute([$email]);
    return $stmt->fetch();
}

function carteiraCriarOuObter(PDO $db, int $pessoaId): array {
    $stmt = $db->prepare('SELECT * FROM carteiras WHERE pessoa_id = ?');
    $stmt->execute([$pessoaId]);
    $carteira = $stmt->fetch();
    if ($carteira) return $carteira;

    try {
        $token = bin2hex(random_bytes(32));
        $db->prepare('INSERT INTO carteiras (pessoa_id, qr_token) VALUES (?, ?)')->execute([$pessoaId, $token]);
    } catch (PDOException $e) {
        if (!str_contains($e->getMessage(), 'UNIQUE')) throw $e;
    }
    $stmt->execute([$pessoaId]);
    return $stmt->fetch();
}

/**
 * Garante uma carteira para cada identidade já cadastrada. É usado pela listagem
 * administrativa para que atletas existentes apareçam sem cadastro manual ou acesso prévio.
 */
function carteiraProvisionarTodasPessoas(PDO $db): int {
    $ids = $db->query('SELECT p.id FROM pessoas p LEFT JOIN carteiras c ON c.pessoa_id=p.id WHERE c.id IS NULL ORDER BY p.id')->fetchAll(PDO::FETCH_COLUMN);
    if (!$ids) return 0;
    $criada = 0;
    $db->beginTransaction();
    try {
        $insert = $db->prepare('INSERT OR IGNORE INTO carteiras (pessoa_id,qr_token) VALUES (?,?)');
        foreach ($ids as $pessoaId) {
            $insert->execute([(int)$pessoaId, bin2hex(random_bytes(32))]);
            $criada += $insert->rowCount();
        }
        $db->commit();
        return $criada;
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        throw $e;
    }
}

function carteiraSessaoTokenDaRequisicao(): string {
    $header = trim($_SERVER['HTTP_X_SESSION_TOKEN'] ?? '');
    if ($header !== '') return $header;
    return trim($_COOKIE['cb_session'] ?? '');
}

function carteiraPessoaDaSessao(PDO $db, ?string $token = null): ?array {
    $token = $token ?? carteiraSessaoTokenDaRequisicao();
    if ($token === '') return null;
    $stmt = $db->prepare("
        SELECT p.*, s.id AS sessao_id, s.token AS sessao_token, s.expires_at AS sessao_expira
        FROM sessions s JOIN pessoas p ON p.email = s.email COLLATE NOCASE
        WHERE s.token = ? AND s.expires_at > datetime('now')
    ");
    $stmt->execute([$token]);
    return $stmt->fetch() ?: null;
}

function carteiraCookieSeguro(): bool {
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || strtolower($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
}

function carteiraDefinirCookieSessao(string $token, int $expiraTimestamp): void {
    if (headers_sent()) return;
    setcookie('cb_session', $token, [
        'expires' => $expiraTimestamp,
        'path' => '/',
        'secure' => carteiraCookieSeguro(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function carteiraLimparCookieSessao(): void {
    if (headers_sent()) return;
    setcookie('cb_session', '', [
        'expires' => time() - 3600, 'path' => '/', 'secure' => carteiraCookieSeguro(),
        'httponly' => true, 'samesite' => 'Lax',
    ]);
}

function carteiraCriarSessao(PDO $db, string $email, ?string $tokenExistente = null): array {
    // A ponte do login legado reutiliza a sessão válida; magic link sempre recebe token novo.
    if ($tokenExistente !== null) {
        $stmt = $db->prepare("SELECT token, expires_at FROM sessions WHERE token=? AND email=? COLLATE NOCASE AND expires_at > datetime('now')");
        $stmt->execute([$tokenExistente, carteiraEmail($email)]);
        $existente = $stmt->fetch();
        if ($existente) {
            carteiraDefinirCookieSessao($existente['token'], strtotime($existente['expires_at'] . ' UTC'));
            return $existente;
        }
    }

    $token = bin2hex(random_bytes(32));
    $expiraTs = time() + SESSION_DURATION;
    $expira = gmdate('Y-m-d H:i:s', $expiraTs);
    $db->prepare('INSERT INTO sessions (token, email, expires_at) VALUES (?, ?, ?)')
       ->execute([$token, carteiraEmail($email), $expira]);
    carteiraDefinirCookieSessao($token, $expiraTs);
    return ['token' => $token, 'expires_at' => $expira];
}

function carteiraValidarSameOrigin(): void {
    $metodo = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (in_array($metodo, ['GET', 'HEAD', 'OPTIONS'], true)) return;

    // Este cabeçalho é definido pelo navegador e não pode ser forjado por JavaScript.
    // Ele continua correto quando o Vite/reverse proxy usa changeOrigin e troca o Host
    // visto pelo PHP (ex.: navegador :5173 -> PHP :8000).
    $fetchSite = strtolower(trim($_SERVER['HTTP_SEC_FETCH_SITE'] ?? ''));
    if ($fetchSite === 'same-origin') return;
    if ($fetchSite !== '' && $fetchSite !== 'none') {
        throw new DomainException('Origem da requisição não permitida');
    }

    $fonte = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
    $host = strtolower(trim($_SERVER['HTTP_HOST'] ?? ''));
    if ($fonte === '' || $host === '') throw new DomainException('Origem da requisição não permitida');
    $scheme = carteiraCookieSeguro() ? 'https' : 'http';
    $parts = parse_url($fonte);
    if (!is_array($parts) || empty($parts['scheme']) || empty($parts['host'])) throw new DomainException('Origem da requisição não permitida');
    $fonteAuthority = strtolower($parts['host']) . (isset($parts['port']) ? ':' . $parts['port'] : '');
    $origemEsperada = $scheme . '://' . $host;
    $origemRecebida = strtolower($parts['scheme']) . '://' . $fonteAuthority;
    $permitidas = [$origemEsperada];
    if (defined('APP_URL')) {
        $app = parse_url(APP_URL);
        if (is_array($app) && !empty($app['scheme']) && !empty($app['host'])) {
            $permitidas[] = strtolower($app['scheme']) . '://' . strtolower($app['host']) . (isset($app['port']) ? ':' . $app['port'] : '');
        }
    }
    foreach (array_unique($permitidas) as $permitida) {
        if (hash_equals($permitida, $origemRecebida)) return;
    }
    throw new DomainException('Origem da requisição não permitida');
}

function carteiraDados(PDO $db, int $pessoaId): array {
    $carteira = carteiraCriarOuObter($db, $pessoaId);
    $stmt = $db->prepare('SELECT id, nome, email FROM pessoas WHERE id=?');
    $stmt->execute([$pessoaId]);
    $pessoa = $stmt->fetch();
    $stmt = $db->prepare('SELECT * FROM carteira_movimentos WHERE carteira_id=? ORDER BY id DESC LIMIT 100');
    $stmt->execute([$carteira['id']]);
    $movimentos = $stmt->fetchAll();
    $stmt = $db->prepare('SELECT id, valor_centavos, status, metodo, criada_em, atualizada_em FROM carteira_recargas WHERE carteira_id=? ORDER BY id DESC LIMIT 20');
    $stmt->execute([$carteira['id']]);
    return ['pessoa' => $pessoa, 'carteira' => $carteira, 'movimentos' => $movimentos, 'recargas' => $stmt->fetchAll()];
}

function carteiraRegistrarMovimento(PDO $db, int $carteiraId, string $tipo, int $valorCentavos, array $meta = []): array {
    if ($valorCentavos === 0) throw new DomainException('O valor do movimento não pode ser zero');
    $stmt = $db->prepare('SELECT saldo_centavos, status FROM carteiras WHERE id=?');
    $stmt->execute([$carteiraId]);
    $carteira = $stmt->fetch();
    if (!$carteira || $carteira['status'] !== 'ativa') throw new DomainException('Carteira inválida ou bloqueada');
    $anterior = (int)$carteira['saldo_centavos'];
    $posterior = $anterior + $valorCentavos;
    if ($posterior < 0) throw new DomainException('Saldo insuficiente');

    $up = $db->prepare("UPDATE carteiras SET saldo_centavos=?, atualizada_em=datetime('now') WHERE id=? AND saldo_centavos=?");
    $up->execute([$posterior, $carteiraId, $anterior]);
    if ($up->rowCount() !== 1) throw new RuntimeException('Carteira atualizada simultaneamente; tente novamente');

    $db->prepare("
        INSERT INTO carteira_movimentos
        (carteira_id,tipo,valor_centavos,saldo_anterior_centavos,saldo_posterior_centavos,recarga_id,venda_id,admin_usuario,observacao)
        VALUES (?,?,?,?,?,?,?,?,?)
    ")->execute([
        $carteiraId, $tipo, $valorCentavos, $anterior, $posterior,
        $meta['recarga_id'] ?? null, $meta['venda_id'] ?? null,
        $meta['admin_usuario'] ?? null, $meta['observacao'] ?? null,
    ]);
    return ['anterior' => $anterior, 'posterior' => $posterior];
}

function carteiraCriarRecarga(PDO $db, int $carteiraId, int $valorCentavos): array {
    if ($valorCentavos < 500 || $valorCentavos > 100000) throw new DomainException('Informe um valor entre R$ 5,00 e R$ 1.000,00');
    $provisoria = 'pre:' . bin2hex(random_bytes(16));
    $db->prepare('INSERT INTO carteira_recargas (carteira_id, valor_centavos, referencia_externa) VALUES (?,?,?)')
       ->execute([$carteiraId, $valorCentavos, $provisoria]);
    $id = (int)$db->lastInsertId();
    $ref = 'carteira_recarga:' . $id . ':' . bin2hex(random_bytes(12));
    $db->prepare('UPDATE carteira_recargas SET referencia_externa=? WHERE id=?')->execute([$ref, $id]);
    return ['id' => $id, 'carteira_id' => $carteiraId, 'valor_centavos' => $valorCentavos, 'status' => 'pendente', 'referencia_externa' => $ref];
}

function carteiraConfirmarRecargaMercadoPago(PDO $db, array $mp): bool {
    $ref = (string)($mp['external_reference'] ?? '');
    if (!str_starts_with($ref, 'carteira_recarga:')) throw new DomainException('Referência de recarga inválida');
    if (($mp['metadata']['origem'] ?? '') !== 'carteira_recarga') throw new DomainException('Origem do pagamento inválida');
    $mpId = (string)($mp['id'] ?? '');
    if ($mpId === '') throw new DomainException('Pagamento Mercado Pago sem ID');

    $stmt = $db->prepare('SELECT * FROM carteira_recargas WHERE referencia_externa=?');
    $stmt->execute([$ref]);
    $recarga = $stmt->fetch();
    if (!$recarga) throw new DomainException('Recarga não encontrada');
    $recebido = (int)round(((float)($mp['transaction_amount'] ?? 0)) * 100);
    $esperado = (int)($recarga['valor_cobrado_centavos'] ?: $recarga['valor_centavos']);
    if ($recebido !== $esperado) throw new DomainException('Valor confirmado diverge da recarga');

    $statusMp = (string)($mp['status'] ?? '');
    $mapa = ['pending' => 'pendente', 'in_process' => 'pendente', 'approved' => 'aprovada', 'rejected' => 'recusada', 'cancelled' => 'cancelada', 'refunded' => 'estornada', 'charged_back' => 'estornada'];
    $status = $mapa[$statusMp] ?? 'pendente';
    $dados = json_encode($mp, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    $db->beginTransaction();
    try {
        $stmt->execute([$ref]);
        $recarga = $stmt->fetch();
        if ($recarga['status'] === 'aprovada') {
            if ((string)$recarga['mp_payment_id'] !== $mpId) throw new DomainException('Recarga já vinculada a outro pagamento');
            $db->commit();
            return false;
        }
        if ($status !== 'aprovada') {
            if ($recarga['status'] === 'pendente') {
                $db->prepare("UPDATE carteira_recargas SET status=?, metodo=?, mp_payment_id=COALESCE(mp_payment_id,?), dados_externos=?, atualizada_em=datetime('now') WHERE id=?")
                   ->execute([$status, $mp['payment_method_id'] ?? null, $mpId, $dados, $recarga['id']]);
            }
            $db->commit();
            return false;
        }

        $up = $db->prepare("UPDATE carteira_recargas SET status='aprovada', metodo=?, mp_payment_id=?, dados_externos=?, atualizada_em=datetime('now') WHERE id=? AND status!='aprovada'");
        $up->execute([$mp['payment_method_id'] ?? null, $mpId, $dados, $recarga['id']]);
        if ($up->rowCount() !== 1) {
            $db->commit();
            return false;
        }
        carteiraRegistrarMovimento($db, (int)$recarga['carteira_id'], 'RECARGA', (int)$recarga['valor_centavos'], [
            'recarga_id' => (int)$recarga['id'], 'observacao' => 'Recarga Mercado Pago',
        ]);
        $db->commit();
        return true;
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        throw $e;
    }
}

function carteiraVenda(PDO $db, int $carteiraId, array $itens, string $admin, string $requestId): array {
    $requestId = trim($requestId);
    if (strlen($requestId) < 16) throw new DomainException('Identificador da venda inválido');
    if (!$itens) throw new DomainException('Selecione ao menos um produto');

    $db->beginTransaction();
    try {
        $stmt = $db->prepare('SELECT * FROM carteira_vendas WHERE request_id=?');
        $stmt->execute([$requestId]);
        if ($existente = $stmt->fetch()) {
            if ((int)$existente['carteira_id'] !== $carteiraId) throw new DomainException('Identificador de venda já utilizado');
            $db->commit(); return $existente + ['idempotente' => true];
        }

        $quantidades = [];
        foreach ($itens as $item) {
            $pid = (int)($item['produto_id'] ?? 0); $qtd = (int)($item['quantidade'] ?? 0);
            if ($pid <= 0 || $qtd <= 0) throw new DomainException('Item de venda inválido');
            $quantidades[$pid] = ($quantidades[$pid] ?? 0) + $qtd;
        }
        $produtos = []; $total = 0;
        $sel = $db->prepare('SELECT * FROM carteira_produtos WHERE id=?');
        foreach ($quantidades as $pid => $qtd) {
            $sel->execute([$pid]); $produto = $sel->fetch();
            if (!$produto || !(int)$produto['ativo']) throw new DomainException('Produto indisponível');
            if ((int)$produto['estoque'] < $qtd) throw new DomainException('Estoque insuficiente para ' . $produto['nome']);
            $produtos[] = [$produto, $qtd];
            $total += (int)$produto['preco_centavos'] * $qtd;
        }
        $stmt = $db->prepare("SELECT saldo_centavos,status FROM carteiras WHERE id=?");
        $stmt->execute([$carteiraId]); $carteira = $stmt->fetch();
        if (!$carteira || $carteira['status'] !== 'ativa') throw new DomainException('Carteira inválida ou bloqueada');
        if ((int)$carteira['saldo_centavos'] < $total) throw new DomainException('Saldo insuficiente');

        $db->prepare('INSERT INTO carteira_vendas (carteira_id,admin_usuario,total_centavos,request_id) VALUES (?,?,?,?)')
           ->execute([$carteiraId, $admin, $total, $requestId]);
        $vendaId = (int)$db->lastInsertId();
        $insItem = $db->prepare('INSERT INTO carteira_venda_itens (venda_id,produto_id,produto_nome,quantidade,preco_unitario_centavos) VALUES (?,?,?,?,?)');
        $upEstoque = $db->prepare("UPDATE carteira_produtos SET estoque=estoque-?, atualizado_em=datetime('now') WHERE id=? AND estoque>=?");
        $insEstoque = $db->prepare("INSERT INTO carteira_estoque_movimentos (produto_id,tipo,quantidade,estoque_anterior,estoque_posterior,venda_id,admin_usuario,observacao) VALUES (?,'VENDA',?,?,?,?,?,?)");
        foreach ($produtos as [$produto, $qtd]) {
            $insItem->execute([$vendaId, $produto['id'], $produto['nome'], $qtd, $produto['preco_centavos']]);
            $antes = (int)$produto['estoque']; $depois = $antes - $qtd;
            $upEstoque->execute([$qtd, $produto['id'], $qtd]);
            if ($upEstoque->rowCount() !== 1) throw new DomainException('Estoque alterado durante a venda');
            $insEstoque->execute([$produto['id'], -$qtd, $antes, $depois, $vendaId, $admin, 'Venda #' . $vendaId]);
        }
        carteiraRegistrarMovimento($db, $carteiraId, 'COMPRA', -$total, ['venda_id'=>$vendaId,'admin_usuario'=>$admin,'observacao'=>'Venda #' . $vendaId]);
        $db->commit();
        return ['id'=>$vendaId,'carteira_id'=>$carteiraId,'total_centavos'=>$total,'status'=>'confirmada','request_id'=>$requestId,'idempotente'=>false];
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        throw $e;
    }
}

function carteiraEstornarVenda(PDO $db, int $vendaId, string $admin): array {
    $db->beginTransaction();
    try {
        $stmt = $db->prepare('SELECT * FROM carteira_vendas WHERE id=?'); $stmt->execute([$vendaId]);
        $venda = $stmt->fetch();
        if (!$venda) throw new DomainException('Venda não encontrada');
        if ($venda['status'] === 'estornada') throw new DomainException('Venda já estornada');
        // Reserva o estorno dentro da própria transação; uma segunda requisição
        // concorrente não consegue devolver saldo ou estoque novamente.
        $reserva = $db->prepare("UPDATE carteira_vendas SET status='estornada',estornada_em=datetime('now'),estornada_por=? WHERE id=? AND status='confirmada'");
        $reserva->execute([$admin, $vendaId]);
        if ($reserva->rowCount() !== 1) throw new DomainException('Venda já estornada');
        $stmt = $db->prepare('SELECT * FROM carteira_venda_itens WHERE venda_id=?'); $stmt->execute([$vendaId]);
        foreach ($stmt->fetchAll() as $item) {
            $p = $db->prepare('SELECT estoque FROM carteira_produtos WHERE id=?'); $p->execute([$item['produto_id']]);
            $antes = (int)$p->fetchColumn(); $qtd = (int)$item['quantidade']; $depois = $antes + $qtd;
            $db->prepare("UPDATE carteira_produtos SET estoque=?, atualizado_em=datetime('now') WHERE id=?")->execute([$depois,$item['produto_id']]);
            $db->prepare("INSERT INTO carteira_estoque_movimentos (produto_id,tipo,quantidade,estoque_anterior,estoque_posterior,venda_id,admin_usuario,observacao) VALUES (?,'ESTORNO',?,?,?,?,?,?)")
               ->execute([$item['produto_id'],$qtd,$antes,$depois,$vendaId,$admin,'Estorno da venda #' . $vendaId]);
        }
        carteiraRegistrarMovimento($db, (int)$venda['carteira_id'], 'ESTORNO', (int)$venda['total_centavos'], ['venda_id'=>$vendaId,'admin_usuario'=>$admin,'observacao'=>'Estorno da venda #' . $vendaId]);
        $db->commit(); return ['ok'=>true];
    } catch (Throwable $e) { if ($db->inTransaction()) $db->rollBack(); throw $e; }
}

function carteiraReembolsar(PDO $db, int $carteiraId, int $valorCentavos, string $admin, ?string $observacao): array {
    if ($valorCentavos <= 0) throw new DomainException('Valor de reembolso inválido');
    $db->beginTransaction();
    try {
        $saldo = carteiraRegistrarMovimento($db, $carteiraId, 'REEMBOLSO', -$valorCentavos, ['admin_usuario'=>$admin,'observacao'=>$observacao ?: 'Reembolso Pix realizado externamente']);
        $db->commit(); return $saldo;
    } catch (Throwable $e) { if ($db->inTransaction()) $db->rollBack(); throw $e; }
}

function carteiraAjustarEstoque(PDO $db, int $produtoId, int $delta, string $admin, string $motivo): array {
    if ($delta === 0 || trim($motivo) === '') throw new DomainException('Informe quantidade e motivo do ajuste');
    $db->beginTransaction();
    try {
        $stmt=$db->prepare('SELECT estoque FROM carteira_produtos WHERE id=?'); $stmt->execute([$produtoId]);
        $valor=$stmt->fetchColumn(); if ($valor === false) throw new DomainException('Produto não encontrado');
        $antes=(int)$valor; $depois=$antes+$delta; if ($depois<0) throw new DomainException('Estoque não pode ficar negativo');
        $db->prepare("UPDATE carteira_produtos SET estoque=?,atualizado_em=datetime('now') WHERE id=?")->execute([$depois,$produtoId]);
        $db->prepare("INSERT INTO carteira_estoque_movimentos (produto_id,tipo,quantidade,estoque_anterior,estoque_posterior,admin_usuario,observacao) VALUES (?,'AJUSTE',?,?,?,?,?)")
           ->execute([$produtoId,$delta,$antes,$depois,$admin,trim($motivo)]);
        $db->commit(); return ['estoque'=>$depois];
    } catch(Throwable $e){ if($db->inTransaction())$db->rollBack(); throw $e; }
}

function carteiraSaldoConfere(PDO $db, int $carteiraId): bool {
    $stmt=$db->prepare('SELECT saldo_centavos FROM carteiras WHERE id=?'); $stmt->execute([$carteiraId]);
    $saldo=(int)$stmt->fetchColumn();
    $stmt=$db->prepare('SELECT COALESCE(SUM(valor_centavos),0) FROM carteira_movimentos WHERE carteira_id=?'); $stmt->execute([$carteiraId]);
    return $saldo === (int)$stmt->fetchColumn();
}

/** Remove somente a operação de teste da carteira. Identidades, inscrições,
 * carteiras e tokens QR permanentes são preservados. */
function carteiraZerarOperacao(PDO $db): array {
    $tabelas = [
        'itens_venda' => 'carteira_venda_itens',
        'estoque_movimentos' => 'carteira_estoque_movimentos',
        'movimentos' => 'carteira_movimentos',
        'vendas' => 'carteira_vendas',
        'recargas' => 'carteira_recargas',
        'produtos' => 'carteira_produtos',
        'magic_links' => 'carteira_magic_links',
    ];
    $removidos = [];
    $db->beginTransaction();
    try {
        foreach ($tabelas as $chave => $tabela) {
            $removidos[$chave] = $db->exec('DELETE FROM ' . $tabela);
        }
        $carteiras = $db->exec("UPDATE carteiras SET saldo_centavos=0,status='ativa',atualizada_em=datetime('now') WHERE saldo_centavos!=0 OR status!='ativa'");
        $db->commit();
        return ['ok'=>true,'removidos'=>$removidos,'carteiras_zeradas'=>$carteiras];
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        throw $e;
    }
}
