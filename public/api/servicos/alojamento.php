<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../env.php';
require_once __DIR__ . '/../email.php';

corsHeaders();

header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');

$token = $_SERVER['HTTP_X_SESSION_TOKEN'] ?? '';
if (empty($token)) respondError('Não autenticado', 401);

$db = getDb();

$stmt = $db->prepare("SELECT email FROM sessions WHERE token = ? AND expires_at > datetime('now')");
$stmt->execute([$token]);
$session = $stmt->fetch();
if (!$session) respondError('Sessão inválida', 401);

$stmt = $db->prepare("
    SELECT i.id as inscricao_id FROM inscricoes i
    JOIN pessoas p ON p.id = i.pessoa_id
    WHERE p.email = ? COLLATE NOCASE
    ORDER BY i.criado_em DESC LIMIT 1
");
$stmt->execute([$session['email']]);
$row = $stmt->fetch();
if (!$row) respondError('Nenhuma inscrição encontrada', 404);
$inscricaoId = (int)$row['inscricao_id'];
$VALOR_ALOJ_DIARIA = getPrecos($db)['valor_alojamento_diaria'];

function verificaPrazoAlojamento(): void {
    if (ALOJAMENTO_EDITAVEL_ATE !== null && date('Y-m-d') > ALOJAMENTO_EDITAVEL_ATE) {
        respondError('O prazo para alteração do alojamento encerrou em ' . ALOJAMENTO_EDITAVEL_ATE, 403);
    }
}

// Devolve o estado atual do alojamento — cada dia marcado com 'pago' (travado, imutável)
// ou não (pendente, ainda editável/cancelável).
function respondeAlojamentoAtual(PDO $db, int $inscricaoId, array $extra = []): void {
    $stmt = $db->prepare("SELECT dia, valor, pagamento_id FROM alojamento WHERE inscricao_id = ? ORDER BY dia");
    $stmt->execute([$inscricaoId]);
    $linhas = array_map(fn($r) => [
        'dia'   => (int)$r['dia'],
        'valor' => (float)$r['valor'],
        'pago'  => $r['pagamento_id'] !== null,
    ], $stmt->fetchAll());
    respond(array_merge(['alojamento' => $linhas], $extra));
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    respondeAlojamentoAtual($db, $inscricaoId);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verificaPrazoAlojamento();

    if (getConfigGeral($db)['alojamento_aberto'] !== '1') {
        respondError('A contratação de alojamento está temporariamente fechada.', 403);
    }

    $body = getBody();
    $diasSolicitados = array_values(array_unique(array_filter(
        array_map('intval', $body['dias'] ?? []),
        fn($d) => in_array($d, ALOJAMENTO_DIAS_VALIDOS)
    )));

    // Dias já existentes para esta inscrição — travados (pagos) nunca são reofertados nem apagados.
    $stmt = $db->prepare("SELECT dia, pagamento_id FROM alojamento WHERE inscricao_id = ?");
    $stmt->execute([$inscricaoId]);
    $existentes   = $stmt->fetchAll();
    $diasTravados = array_map(fn($r) => (int)$r['dia'], array_filter($existentes, fn($r) => $r['pagamento_id'] !== null));
    $temTravados  = count($diasTravados) > 0;

    $colisao = array_intersect($diasSolicitados, $diasTravados);
    if (!empty($colisao)) {
        respondError('Os dias ' . implode(', ', $colisao) . '/set já estão contratados e pagos.', 409);
    }

    // Quem já tem alojamento pago está contratando dias extras — quem não tem, está
    // fazendo/editando sua contratação normal. O backend decide, nunca o frontend.
    $tipoPagamento = $temTravados ? 'alojamento_extra' : 'alojamento';

    $db->beginTransaction();
    try {
        // Cancela pagamento pendente correspondente (usuário alterou a seleção antes de pagar)
        $pgCancelado = null;
        $stmtPg = $db->prepare("SELECT id, tipo, status, valor, itens_json FROM pagamentos WHERE inscricao_id = ? AND tipo = ? AND status = 'pendente' LIMIT 1");
        $stmtPg->execute([$inscricaoId, $tipoPagamento]);
        $pgPendente = $stmtPg->fetch();
        if ($pgPendente) {
            $db->prepare("UPDATE pagamentos SET status = 'cancelado', atualizado_em = datetime('now') WHERE id = ?")
               ->execute([$pgPendente['id']]);
            $pgCancelado = [
                'id'     => (int)$pgPendente['id'],
                'tipo'   => $pgPendente['tipo'],
                'status' => 'cancelado',
                'valor'  => (float)$pgPendente['valor'],
                'metodo' => null,
                'itens'  => $pgPendente['itens_json'] ? json_decode($pgPendente['itens_json'], true) : null,
            ];
        }

        // Nunca apaga dias travados — só substitui a seleção ainda solta (pendente)
        $db->prepare("DELETE FROM alojamento WHERE inscricao_id = ? AND pagamento_id IS NULL")
           ->execute([$inscricaoId]);

        $stmt = $db->prepare("INSERT INTO alojamento (inscricao_id, dia, valor) VALUES (?, ?, ?)");
        foreach ($diasSolicitados as $dia) {
            $stmt->execute([$inscricaoId, $dia, $VALOR_ALOJ_DIARIA]);
        }

        $db->commit();

        // Notifica por email
        $stmtNome = $db->prepare("SELECT p.nome FROM pessoas p JOIN inscricoes i ON i.pessoa_id = p.id WHERE i.id = ?");
        $stmtNome->execute([$inscricaoId]);
        $nomeAtleta = (string)($stmtNome->fetchColumn() ?: '');
        if ($nomeAtleta) {
            if (empty($diasSolicitados)) {
                $detalhes = 'Nenhum dia selecionado.';
            } else {
                $valorFormatado = 'R$ ' . number_format($VALOR_ALOJ_DIARIA, 2, ',', '.');
                $linhasAloj = array_map(fn($d) => "Dia {$d}/set — {$valorFormatado}", $diasSolicitados);
                $detalhes   = implode('<br>', $linhasAloj);
            }
            sendServiceUpdatedEmail($session['email'], $nomeAtleta, $temTravados ? 'alojamento extra' : 'alojamento', $detalhes);
        }

        respondeAlojamentoAtual($db, $inscricaoId, [
            'dias'                => $diasSolicitados,
            'tipo_pagamento'      => $tipoPagamento,
            'pagamento_cancelado' => $pgCancelado,
        ]);

    } catch (\Exception $e) {
        $db->rollBack();
        respondError('Erro ao salvar: ' . $e->getMessage(), 500);
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    verificaPrazoAlojamento();

    // Nunca apaga dias travados (já pagos) — só a seleção pendente/solta.
    $db->prepare("DELETE FROM alojamento WHERE inscricao_id = ? AND pagamento_id IS NULL")
       ->execute([$inscricaoId]);

    respond(['success' => true]);
}

respondError('Método não suportado', 405);
