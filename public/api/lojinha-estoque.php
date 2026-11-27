<?php

/** Marca um pedido pendente como pago e baixa o estoque uma única vez. */
function lojinhaMarcarPedidoPago(PDO $db, int $pedidoId, string $metodo): bool {
    $db->beginTransaction();
    try {
        $stmt = $db->prepare("SELECT status FROM loj_pedidos WHERE id = ?");
        $stmt->execute([$pedidoId]);
        $pedido = $stmt->fetch();
        if (!$pedido || $pedido['status'] !== 'pendente') {
            $db->commit();
            return false;
        }

        $stmt = $db->prepare("UPDATE loj_pedidos SET status='pago', metodo=?, atualizado_em=datetime('now') WHERE id=? AND status='pendente'");
        $stmt->execute([$metodo, $pedidoId]);
        if ($stmt->rowCount() !== 1) {
            $db->commit();
            return false;
        }

        $stmt = $db->prepare("SELECT id, produto_id, tamanho, quantidade FROM loj_pedido_itens WHERE pedido_id = ?");
        $stmt->execute([$pedidoId]);
        $itens = $stmt->fetchAll();
        $estoque = $db->prepare("SELECT estoque FROM loj_produto_tamanhos WHERE produto_id = ? AND tamanho = ?");
        $baixar = $db->prepare("UPDATE loj_produto_tamanhos SET estoque = estoque - ? WHERE produto_id = ? AND tamanho = ? AND estoque IS NOT NULL");
        $movimento = $db->prepare("INSERT INTO loj_estoque_movimentos (produto_id, tamanho, quantidade, tipo, pedido_item_id) VALUES (?, ?, ?, 'pedido_baixa', ?)");

        foreach ($itens as $item) {
            if ($item['tamanho'] === null) continue;
            $estoque->execute([$item['produto_id'], $item['tamanho']]);
            $linha = $estoque->fetch();
            if (!$linha || $linha['estoque'] === null) continue; // estoque não controlado
            $baixar->execute([$item['quantidade'], $item['produto_id'], $item['tamanho']]);
            $movimento->execute([$item['produto_id'], $item['tamanho'], -((int)$item['quantidade']), $item['id']]);
        }

        $db->commit();
        return true;
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        throw $e;
    }
}

/** Cancela pedido e repõe apenas as unidades que tiveram baixa registrada. */
function lojinhaCancelarPedido(PDO $db, int $pedidoId): bool {
    $db->beginTransaction();
    try {
        $stmt = $db->prepare("SELECT status FROM loj_pedidos WHERE id = ?");
        $stmt->execute([$pedidoId]);
        $pedido = $stmt->fetch();
        if (!$pedido || $pedido['status'] === 'cancelado') {
            $db->commit();
            return false;
        }

        $stmt = $db->prepare("UPDATE loj_pedidos SET status='cancelado', atualizado_em=datetime('now') WHERE id=? AND status=?");
        $stmt->execute([$pedidoId, $pedido['status']]);
        if ($stmt->rowCount() !== 1) {
            $db->commit();
            return false;
        }

        if (in_array($pedido['status'], ['pago', 'retirado'], true)) {
            $stmt = $db->prepare("SELECT m.id, m.produto_id, m.tamanho, m.quantidade, m.pedido_item_id
                FROM loj_estoque_movimentos m
                WHERE m.tipo='pedido_baixa' AND m.pedido_item_id IN (SELECT id FROM loj_pedido_itens WHERE pedido_id = ?)
                  AND NOT EXISTS (SELECT 1 FROM loj_estoque_movimentos r WHERE r.tipo='pedido_reposicao' AND r.pedido_item_id=m.pedido_item_id)");
            $stmt->execute([$pedidoId]);
            $movimentos = $stmt->fetchAll();
            $repor = $db->prepare("UPDATE loj_produto_tamanhos SET estoque = estoque + ? WHERE produto_id = ? AND tamanho = ? AND estoque IS NOT NULL");
            $registrar = $db->prepare("INSERT INTO loj_estoque_movimentos (produto_id, tamanho, quantidade, tipo, pedido_item_id) VALUES (?, ?, ?, 'pedido_reposicao', ?)");
            foreach ($movimentos as $mov) {
                $qtd = abs((int)$mov['quantidade']);
                $repor->execute([$qtd, $mov['produto_id'], $mov['tamanho']]);
                $registrar->execute([$mov['produto_id'], $mov['tamanho'], $qtd, $mov['pedido_item_id']]);
            }
        }

        $db->commit();
        return true;
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        throw $e;
    }
}
