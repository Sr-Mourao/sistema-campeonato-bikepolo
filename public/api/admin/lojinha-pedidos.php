<?php
require_once __DIR__ . '/middleware.php';
adminGuard();

$db = getDb();

// ── GET com id — detalhe completo ────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET' && !empty($_GET['id'])) {
    $id = (int)$_GET['id'];
    $stmt = $db->prepare("SELECT * FROM loj_pedidos WHERE id = ?");
    $stmt->execute([$id]);
    $pedido = $stmt->fetch();
    if (!$pedido) respondError('Pedido não encontrado', 404);

    $stmt = $db->prepare("SELECT id, produto_id, produto_nome, tamanho, quantidade, preco_unitario FROM loj_pedido_itens WHERE pedido_id = ?");
    $stmt->execute([$id]);
    $pedido['itens'] = $stmt->fetchAll();

    $pedido['id']    = (int)$pedido['id'];
    $pedido['valor'] = (float)$pedido['valor'];
    respond($pedido);
}

// ── GET — lista com filtros ───────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $where  = [];
    $params = [];

    $status = trim($_GET['status'] ?? '');
    if ($status !== '' && $status !== 'todos') {
        $where[] = 'p.status = ?';
        $params[] = $status;
    } else {
        $where[] = "p.status != 'cancelado'";
    }

    $busca = trim($_GET['busca'] ?? '');
    if ($busca !== '') {
        $where[] = '(p.nome LIKE ? OR p.email LIKE ? OR p.whatsapp LIKE ? OR p.codigo_retirada LIKE ?)';
        $like = '%' . $busca . '%';
        array_push($params, $like, $like, $like, $like);
    }

    $sql = "
        SELECT p.id, p.nome, p.email, p.whatsapp, p.status, p.metodo, p.valor,
               p.codigo_retirada, p.criado_em,
               (SELECT GROUP_CONCAT(pi.quantidade || 'x ' || pi.produto_nome ||
                                     CASE WHEN pi.tamanho IS NOT NULL THEN ' (' || pi.tamanho || ')' ELSE '' END, ', ')
                  FROM loj_pedido_itens pi WHERE pi.pedido_id = p.id) AS itens_resumo
        FROM loj_pedidos p
        WHERE " . implode(' AND ', $where) . "
        ORDER BY p.criado_em DESC
        LIMIT 500
    ";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    respond(array_map(fn($r) => array_merge($r, [
        'id'    => (int)$r['id'],
        'valor' => (float)$r['valor'],
    ]), $stmt->fetchAll()));
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') respondError('Método não suportado', 405);

$body   = getBody();
$action = $body['action'] ?? '';
$id     = (int)($body['id'] ?? 0);
if (!$id) respondError('id é obrigatório');

$stmt = $db->prepare("SELECT * FROM loj_pedidos WHERE id = ?");
$stmt->execute([$id]);
$pedido = $stmt->fetch();
if (!$pedido) respondError('Pedido não encontrado', 404);

if ($action === 'marcar_retirado') {
    if ($pedido['status'] !== 'pago') respondError('Só é possível marcar como retirado um pedido pago');
    $db->prepare("UPDATE loj_pedidos SET status='retirado', atualizado_em=datetime('now') WHERE id=?")->execute([$id]);
    respond(['ok' => true, 'status' => 'retirado']);
}

if ($action === 'cancelar') {
    $db->prepare("UPDATE loj_pedidos SET status='cancelado', atualizado_em=datetime('now') WHERE id=?")->execute([$id]);
    respond(['ok' => true, 'status' => 'cancelado']);
}

if ($action === 'marcar_pago_manual') {
    $db->prepare("UPDATE loj_pedidos SET status='pago', metodo='manual', atualizado_em=datetime('now') WHERE id=?")->execute([$id]);
    respond(['ok' => true, 'status' => 'pago']);
}

respondError('Ação inválida');
