<?php
/**
 * Poloperator como base dos times: lê o cadastro interno, monta o plano
 * (planejarTimesPoloperator, puro) e aplica só o que FALTA — cria times, pessoas,
 * inscrições e vínculos. Idempotente: rodar de novo não duplica nada. Nunca apaga,
 * renomeia nem move alguém de time (divergências voltam como aviso para o admin).
 *
 * Requer: db.php (generateTeamCode), admin/poloperator_import_lib.php, midia/lib.php (normalizaNome).
 */

/** Cadastro interno da categoria no formato que o planejamento espera. */
function cadastroInternoParaPoloperator(PDO $db, string $categoria): array {
    $stmt = $db->prepare("SELECT id, nome, poloperator_id FROM times WHERE categoria = ? ORDER BY nome");
    $stmt->execute([$categoria]);
    $times = $stmt->fetchAll();

    $roster = [];
    $stmtR = $db->prepare("
        SELECT p.id, p.nome, p.poloperator_id
        FROM membros_time mt
        JOIN inscricoes i ON i.id = mt.inscricao_id AND i.status != 'cancelado'
        JOIN pessoas p ON p.id = i.pessoa_id
        WHERE mt.time_id = ?
        ORDER BY mt.id
    ");
    foreach ($times as $t) {
        $stmtR->execute([(int)$t['id']]);
        $roster[(int)$t['id']] = $stmtR->fetchAll();
    }

    // Pessoas inscritas na categoria e ainda sem time nela (ex.: cadastradas à mão).
    $stmtS = $db->prepare("
        SELECT DISTINCT p.id, p.nome, p.poloperator_id
        FROM pessoas p
        JOIN inscricoes i ON i.pessoa_id = p.id AND i.status != 'cancelado'
        JOIN inscricao_categorias ic ON ic.inscricao_id = i.id AND ic.categoria = ?
        WHERE NOT EXISTS (
            SELECT 1 FROM membros_time mt JOIN times t ON t.id = mt.time_id
            JOIN inscricoes i2 ON i2.id = mt.inscricao_id
            WHERE i2.pessoa_id = p.id AND t.categoria = ?
        )
    ");
    $stmtS->execute([$categoria, $categoria]);

    return ['times' => $times, 'roster' => $roster, 'sem_time' => $stmtS->fetchAll()];
}

function planoTimesPoloperator(PDO $db, string $categoria, array $timesExternos, array $apelidos): array {
    $c = cadastroInternoParaPoloperator($db, $categoria);
    return planejarTimesPoloperator($timesExternos, $c['times'], $c['roster'], $c['sem_time'], $apelidos);
}

/** Inscrição ativa da pessoa (cria uma "paga", valor 0, na categoria, se não houver). */
function garantirInscricaoNaCategoria(PDO $db, int $pessoaId, string $categoria): int {
    $stmt = $db->prepare("SELECT id FROM inscricoes WHERE pessoa_id = ? AND status != 'cancelado' ORDER BY id LIMIT 1");
    $stmt->execute([$pessoaId]);
    $inscId = $stmt->fetchColumn();
    if (!$inscId) {
        $db->prepare("INSERT INTO inscricoes (pessoa_id, status, valor_total) VALUES (?, 'pago', 0)")->execute([$pessoaId]);
        $inscId = $db->lastInsertId();
    }
    $inscId = (int)$inscId;
    $chk = $db->prepare("SELECT 1 FROM inscricao_categorias WHERE inscricao_id = ? AND categoria = ?");
    $chk->execute([$inscId, $categoria]);
    if (!$chk->fetchColumn()) {
        $db->prepare("INSERT INTO inscricao_categorias (inscricao_id, categoria, valor) VALUES (?, ?, 0)")->execute([$inscId, $categoria]);
    }
    return $inscId;
}

/**
 * Aplica o plano dentro de uma transação. Devolve o plano recalculado depois da gravação
 * (tudo deve aparecer como 'existe'/'no_time', salvo avisos) e o que foi criado.
 */
function criarTimesDoPoloperator(PDO $db, string $categoria, array $timesExternos, array $apelidos): array {
    $plano = planoTimesPoloperator($db, $categoria, $timesExternos, $apelidos);
    $criados = ['times' => 0, 'pessoas' => 0, 'vinculos' => 0];

    $db->beginTransaction();
    try {
        $selEmail = $db->prepare("SELECT id FROM pessoas WHERE email = ?");
        foreach ($plano['times'] as $t) {
            $timeId = $t['interno']['id'] ?? null;
            if ($t['acao'] === 'criar') {
                $db->prepare("INSERT INTO times (nome, categoria, codigo, poloperator_id) VALUES (?, ?, ?, ?)")
                   ->execute([$t['nome'], $categoria, generateTeamCode($db), $t['externo']['id']]);
                $timeId = (int)$db->lastInsertId();
                $criados['times']++;
            }
            foreach ($t['atletas'] as $a) {
                if (!in_array($a['acao'], ['criar', 'adicionar'], true)) continue;
                if ($a['acao'] === 'criar') {
                    $base = emailFicticioPior($a['nome']);
                    $email = $base; $n = 2;
                    for (;;) { // homônimo com outro e-mail fictício: nunca reaproveita a pessoa errada
                        $selEmail->execute([$email]);
                        if (!$selEmail->fetchColumn()) break;
                        $email = str_replace('@', ".$n@", $base); $n++;
                    }
                    $db->prepare("INSERT INTO pessoas (nome, email, telefone, poloperator_id) VALUES (?, ?, NULL, ?)")
                       ->execute([$a['nome'], $email, $a['externo']['id']]);
                    $pessoaId = (int)$db->lastInsertId();
                    $criados['pessoas']++;
                } else {
                    $pessoaId = (int)$a['pessoa']['id'];
                    $db->prepare("UPDATE pessoas SET poloperator_id = COALESCE(poloperator_id, ?) WHERE id = ?")->execute([$a['externo']['id'], $pessoaId]);
                }
                $inscId = garantirInscricaoNaCategoria($db, $pessoaId, $categoria);
                $db->prepare("INSERT OR IGNORE INTO membros_time (time_id, inscricao_id) VALUES (?, ?)")->execute([$timeId, $inscId]);
                $criados['vinculos']++;
            }
        }
        $db->commit();
    } catch (\Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        throw $e;
    }

    return ['criados' => $criados, 'plano' => planoTimesPoloperator($db, $categoria, $timesExternos, $apelidos)];
}
