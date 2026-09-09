<?php
require_once __DIR__ . '/middleware.php';
adminGuard();

$db     = getDb();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $where  = [];
    $params = [];

    if (!empty($_GET['status'])) {
        $where[]  = 'pag.status = ?';
        $params[] = $_GET['status'];
    }
    if (!empty($_GET['tipo'])) {
        $where[]  = 'pag.tipo = ?';
        $params[] = $_GET['tipo'];
    }
    if (!empty($_GET['busca'])) {
        $where[]  = 'p.nome LIKE ?';
        $params[] = '%' . $_GET['busca'] . '%';
    }

    $whereStr = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $stmt = $db->prepare("
        SELECT
            pag.id, pag.inscricao_id, pag.tipo, pag.metodo, pag.status,
            pag.valor, pag.reembolsado, pag.criado_em, pag.atualizado_em,
            pag.referencia_externa, pag.dados_externos,
            p.nome AS atleta_nome, p.email AS atleta_email,
            i.status AS inscricao_status,
            i.valor_total
        FROM pagamentos pag
        JOIN inscricoes i ON i.id = pag.inscricao_id
        JOIN pessoas p ON p.id = i.pessoa_id
        $whereStr
        ORDER BY pag.criado_em DESC
        LIMIT 500
    ");
    $stmt->execute($params);
    respond($stmt->fetchAll());
}

if ($method === 'POST') {
    $body   = getBody();
    $action = $body['action'] ?? '';
    $id     = (int)($body['id'] ?? 0);
    if (!$id) respondError('ID obrigatório');

    if ($action === 'update_status') {
        $status = $body['status'] ?? '';
        if (!in_array($status, ['pendente', 'pago', 'cancelado'])) respondError('Status inválido');

        $pagStmt = $db->prepare("SELECT inscricao_id, tipo, status FROM pagamentos WHERE id = ?");
        $pagStmt->execute([$id]);
        $pagAntes = $pagStmt->fetch();
        if (!$pagAntes) respondError('Pagamento não encontrado', 404);

        $db->prepare("UPDATE pagamentos SET status = ?, metodo = ?, atualizado_em = datetime('now') WHERE id = ?")
           ->execute([$status, $body['metodo'] ?? null, $id]);

        if ($status === 'pago') {
            lockAlojamentoAoPagar($db, $id);
        } elseif ($pagAntes['status'] === 'pago' && $status !== 'pago') {
            desbloqueiaAlojamento($db, $id);
        }

        // Mantém inscricoes.status espelhado ao pagamento principal (inscricao/completo)
        if (in_array($pagAntes['tipo'], ['inscricao', 'completo'])) {
            if ($status === 'pago') {
                $db->prepare("UPDATE inscricoes SET status = 'pago', atualizado_em = datetime('now') WHERE id = ?")
                   ->execute([$pagAntes['inscricao_id']]);
            } elseif ($pagAntes['status'] === 'pago' && $status !== 'pago') {
                $db->prepare("UPDATE inscricoes SET status = 'aguardando_pagamento', atualizado_em = datetime('now') WHERE id = ? AND status != 'cancelado'")
                   ->execute([$pagAntes['inscricao_id']]);
            }
        }

        respond(['ok' => true]);
    }

    respondError('Ação desconhecida');
}

respondError('Método não permitido', 405);
