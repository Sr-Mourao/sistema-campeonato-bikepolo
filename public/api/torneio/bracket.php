<?php
/**
 * Equalização, Repescagem (single elimination) e Double Elimination.
 *
 * Propagação de vencedor/perdedor: cada jogo pendente guarda em time_a_origem /
 * time_b_origem um JSON {"tipo":"jogo","codigo":"QA","resultado":"vencedor"} (ou
 * "perdedor"), ou {"tipo":"fixo","time_id":N} quando o time já é conhecido no
 * momento da criação (ex: cabeças de chave). resolverPendencias() varre os jogos
 * com time_a_id/time_b_id NULL e preenche assim que o jogo de origem encerra —
 * chamada sempre depois de encerrarPartida(). Roda em ponto fixo (até 10
 * iterações) para resolver cadeias (ex: B3 depende de B1, que depende de QA/QB).
 */

require_once __DIR__ . '/lib.php';
require_once __DIR__ . '/swiss.php'; // sugerirEqualizacao() usa getHistoricoConfrontosSwiss()/jaSeEnfrentaram()
require_once __DIR__ . '/round_robin.php';

function origemFixo(int $timeId): array { return ['tipo' => 'fixo', 'time_id' => $timeId]; }
function origemJogo(string $codigo, string $resultado): array { return ['tipo' => 'jogo', 'codigo' => $codigo, 'resultado' => $resultado]; }

function resolveOrigem(PDO $db, int $torneioId, ?array $origem): ?int {
    if (!$origem) return null;
    if ($origem['tipo'] === 'fixo') return (int)$origem['time_id'];
    if ($origem['tipo'] === 'jogo') {
        $stmt = $db->prepare("SELECT * FROM torneio_jogos WHERE torneio_id = ? AND codigo = ?");
        $stmt->execute([$torneioId, $origem['codigo']]);
        $j = $stmt->fetch();
        if (!$j || $j['status'] !== 'encerrado' || $j['vencedor_time_id'] === null) return null;
        if ($origem['resultado'] === 'vencedor') return (int)$j['vencedor_time_id'];
        return (int)($j['vencedor_time_id'] == $j['time_a_id'] ? $j['time_b_id'] : $j['time_a_id']);
    }
    return null;
}

/** Propaga vencedores/perdedores para todos os jogos pendentes deste torneio. Idempotente. */
function resolverPendencias(PDO $db, int $torneioId): array {
    $resolvidos = [];
    for ($iter = 0; $iter < 10; $iter++) {
        $stmt = $db->prepare("
            SELECT * FROM torneio_jogos
            WHERE torneio_id = ? AND is_bye = 0 AND (time_a_id IS NULL OR time_b_id IS NULL)
        ");
        $stmt->execute([$torneioId]);
        $pendentes = $stmt->fetchAll();
        if (!$pendentes) break;

        $mudou = false;
        foreach ($pendentes as $j) {
            $novoA = $j['time_a_id'] !== null ? (int)$j['time_a_id'] : resolveOrigem($db, $torneioId, $j['time_a_origem'] ? json_decode($j['time_a_origem'], true) : null);
            $novoB = $j['time_b_id'] !== null ? (int)$j['time_b_id'] : resolveOrigem($db, $torneioId, $j['time_b_origem'] ? json_decode($j['time_b_origem'], true) : null);
            if ($novoA != $j['time_a_id'] || $novoB != $j['time_b_id']) {
                $db->prepare("UPDATE torneio_jogos SET time_a_id = ?, time_b_id = ?, atualizado_em = datetime('now') WHERE id = ?")
                   ->execute([$novoA, $novoB, $j['id']]);
                $resolvidos[] = $j['codigo'];
                $mudou = true;
            }
        }
        if (!$mudou) break;
    }
    return $resolvidos;
}

/**
 * Jogos que já herdaram um time a partir do resultado de $codigo (propagação já
 * aconteceu). Usada antes de permitir editar/reabrir um jogo já encerrado — se a
 * lista não for vazia, o admin precisa confirmar explicitamente o impacto (a
 * edição vai exigir re-resolver esses dependentes, o que pode até esvaziá-los).
 */
function getDependentesResolvidos(PDO $db, int $torneioId, string $codigo): array {
    $stmt = $db->prepare("
        SELECT codigo, time_a_origem, time_b_origem, time_a_id, time_b_id, status
        FROM torneio_jogos WHERE torneio_id = ? AND (time_a_origem LIKE ? OR time_b_origem LIKE ?)
    ");
    $like = '%"codigo":"' . $codigo . '"%';
    $stmt->execute([$torneioId, $like, $like]);
    return array_values(array_filter($stmt->fetchAll(), fn($r) => $r['time_a_id'] !== null || $r['time_b_id'] !== null));
}

// ─────────────────────────────────────────────────────────────────────────
// Equalização
// ─────────────────────────────────────────────────────────────────────────

/**
 * Todas as rodadas suíças configuradas precisam existir, estar confirmadas, e
 * TODAS as partidas reais (não-bye) delas precisam estar decididas (encerrado/
 * wo/cancelado) — nunca basta a fase estar "confirmada" (isso só significa que
 * o pareamento foi publicado, não que os jogos terminaram). Backend é a
 * validação real; o frontend só espelha isso pra habilitar/desabilitar o botão.
 */
function validarSwissCompleto(PDO $db, int $torneioId): void {
    $torneio = getTorneio($db, $torneioId);
    if (!$torneio) throw new RuntimeException('Torneio não encontrado.');

    $stmt = $db->prepare("SELECT * FROM torneio_fases WHERE torneio_id = ? AND tipo = 'swiss' ORDER BY rodada");
    $stmt->execute([$torneioId]);
    $fases = $stmt->fetchAll();

    if (count($fases) < (int)$torneio['rodadas_swiss'] || array_filter($fases, fn($f) => $f['estado'] !== 'confirmada')) {
        throw new RuntimeException('A Equalização só pode ser gerada após o encerramento completo da Rodada ' . $torneio['rodadas_swiss'] . '.');
    }

    $stmt = $db->prepare("
        SELECT COUNT(*) FROM torneio_jogos j JOIN torneio_fases f ON f.id = j.fase_id
        WHERE j.torneio_id = ? AND f.tipo = 'swiss' AND j.is_bye = 0
              AND j.status NOT IN ('encerrado', 'wo', 'cancelado')
    ");
    $stmt->execute([$torneioId]);
    if ((int)$stmt->fetchColumn() > 0) {
        throw new RuntimeException('A Equalização só pode ser gerada após o encerramento completo da Rodada ' . $torneio['rodadas_swiss'] . '.');
    }
}

/** Os 4 times que receberam bye no suíço, ordenados pela classificação após a Rodada 4. */
function getTimesEqualizacao(PDO $db, int $torneioId): array {
    $stmt = $db->prepare("
        SELECT DISTINCT j.time_a_id FROM torneio_jogos j
        JOIN torneio_fases f ON f.id = j.fase_id
        WHERE j.torneio_id = ? AND f.tipo = 'swiss' AND j.is_bye = 1
    ");
    $stmt->execute([$torneioId]);
    $byeIds = array_map('intval', array_column($stmt->fetchAll(), 'time_a_id'));

    $classificacao = calcularClassificacao($db, $torneioId);
    $ordenado = array_values(array_filter($classificacao, fn($row) => in_array($row['time_id'], $byeIds, true)));
    return $ordenado; // já vem ordenado por posição (calcularClassificacao ordena)
}

function sugerirEqualizacao(PDO $db, int $torneioId): array {
    validarSwissCompleto($db, $torneioId);
    $times = getTimesEqualizacao($db, $torneioId);
    if (count($times) !== 4) {
        throw new RuntimeException('Equalização requer exatamente 4 times com bye — encontrado ' . count($times) . '. Confirme as 4 rodadas suíças primeiro.');
    }
    $historico = getHistoricoConfrontosSwiss($db, $torneioId, PHP_INT_MAX);

    // melhor×2º, 3º×4º (entre os quatro do bye)
    $par1 = [$times[0]['time_id'], $times[1]['time_id']];
    $par2 = [$times[2]['time_id'], $times[3]['time_id']];

    $avisos = [];
    $motivos1 = ["✓ Melhor colocado × 2º colocado entre os times que receberam bye."];
    if (jaSeEnfrentaram($historico, $par1[0], $par1[1])) {
        $motivos1[] = "⚠ Esses times já se enfrentaram no suíço — revanche na equalização.";
        $avisos[] = "⚠ EQ1 é uma revanche de um confronto do suíço.";
    }
    $motivos2 = ["✓ 3º colocado × 4º colocado entre os times que receberam bye."];
    if (jaSeEnfrentaram($historico, $par2[0], $par2[1])) {
        $motivos2[] = "⚠ Esses times já se enfrentaram no suíço — revanche na equalização.";
        $avisos[] = "⚠ EQ2 é uma revanche de um confronto do suíço.";
    }

    return [
        'pares' => [
            ['codigo' => 'EQ1', 'time_a_id' => $par1[0], 'time_b_id' => $par1[1], 'motivos' => $motivos1],
            ['codigo' => 'EQ2', 'time_a_id' => $par2[0], 'time_b_id' => $par2[1], 'motivos' => $motivos2],
        ],
        'avisos' => $avisos,
    ];
}

function confirmarEqualizacao(PDO $db, int $torneioId, array $pares, string $usuario): array {
    validarSwissCompleto($db, $torneioId);
    return torneioTx($db, function (PDO $db) use ($torneioId, $pares, $usuario) {
        $stmt = $db->prepare("SELECT * FROM torneio_fases WHERE torneio_id = ? AND tipo = 'equalizacao'");
        $stmt->execute([$torneioId]);
        $fase = $stmt->fetch();
        if ($fase && $fase['estado'] === 'confirmada') {
            throw new RuntimeException('Equalização já está confirmada.');
        }
        if (!$fase) {
            $db->prepare("
                INSERT INTO torneio_fases (torneio_id, tipo, rodada, rotulo, estado, conta_classificacao)
                VALUES (?, 'equalizacao', NULL, 'Equalização', 'confirmada', 1)
            ")->execute([$torneioId]);
            $faseId = (int)$db->lastInsertId();
        } else {
            $faseId = (int)$fase['id'];
            $db->prepare("UPDATE torneio_fases SET estado='confirmada', confirmada_em=datetime('now'), confirmada_por=? WHERE id=?")
               ->execute([$usuario, $faseId]);
        }

        $stmtIns = $db->prepare("
            INSERT INTO torneio_jogos (torneio_id, fase_id, codigo, ordem, time_a_id, time_b_id, status)
            VALUES (?, ?, ?, ?, ?, ?, 'agendado')
        ");
        $ordem = 1;
        foreach ($pares as $par) {
            $stmtIns->execute([$torneioId, $faseId, $par['codigo'], $ordem++, $par['time_a_id'], $par['time_b_id']]);
        }

        torneioAuditoria($db, $torneioId, $usuario, 'confirmar_equalizacao', 'torneio_fases', $faseId, null, $pares, null);
        torneioSnapshot($db, $torneioId, $faseId, 'equalizacao_confirmada', ['pares' => $pares], $usuario);

        return ['fase_id' => $faseId];
    });
}

// ─────────────────────────────────────────────────────────────────────────
// Fechamento da classificatória (congela seeds pra repescagem/double)
// ─────────────────────────────────────────────────────────────────────────

function fecharClassificacao(PDO $db, int $torneioId, string $usuario): array {
    return torneioTx($db, function (PDO $db) use ($torneioId, $usuario) {
        $torneio = getTorneio($db, $torneioId);
        if (!$torneio) throw new RuntimeException('Torneio não encontrado.');
        $roundRobin = formatoEhRoundRobin($torneio);
        if ($roundRobin) validarRoundRobinCompleto($db, $torneioId);
        $classificacao = calcularClassificacao($db, $torneioId);
        $n = count($classificacao);
        // gerarRepescagem() sempre precisa de EXATAMENTE 7 times além dos classificados
        // diretos (REP-R1..R5 usam posições diretos+1 até diretos+7 — ver seus offsets
        // literais logo abaixo). NÃO é `classificados_diretos + vagas_repescagem`: vagas
        // é quantas vagas a Repescagem CONCEDE na Double (hoje 2), não quantos times a
        // disputam (sempre 7, do 7º ao 13º com a config atual — 6 diretos + 7 repescagem).
        if (formatoTemRepescagem($torneio) && $n < (int)$torneio['classificados_diretos'] + 7) {
            throw new RuntimeException('Número de participantes insuficiente para fechar a classificação com esta configuração.');
        }
        if ($roundRobin && $n !== formatoParticipantes($torneio)) {
            throw new RuntimeException('A classificação deste formato deve possuir exatamente ' . formatoParticipantes($torneio) . ' times.');
        }
        $db->prepare("UPDATE torneios SET estado = 'CLASSIFICACAO_FECHADA', atualizado_em = datetime('now') WHERE id = ?")
           ->execute([$torneioId]);
        torneioAuditoria($db, $torneioId, $usuario, 'fechar_classificacao', 'torneios', $torneioId, null, $classificacao, null);
        torneioSnapshot($db, $torneioId, null, 'classificacao_congelada', ['classificacao' => $classificacao], $usuario);
        return $classificacao;
    });
}

// ─────────────────────────────────────────────────────────────────────────
// Repescagem — Single Elimination especial (7 times → 2 vagas)
// ─────────────────────────────────────────────────────────────────────────

function gerarRepescagem(PDO $db, int $torneioId, string $usuario): array {
    return torneioTx($db, function (PDO $db) use ($torneioId, $usuario) {
        $torneio = getTorneio($db, $torneioId);
        if (!$torneio) throw new RuntimeException('Torneio não encontrado.');
        if (!formatoTemRepescagem($torneio)) throw new RuntimeException('Este formato de torneio não possui Repescagem.');
        if ($torneio['estado'] !== 'CLASSIFICACAO_FECHADA' && $torneio['estado'] !== 'REPESCAGEM') {
            throw new RuntimeException('Feche a classificação antes de gerar a repescagem.');
        }
        $classificacao = calcularClassificacao($db, $torneioId);
        $diretos = (int)$torneio['classificados_diretos'];
        $pos = fn($p) => $classificacao[$p - 1]['time_id']; // 1-indexed

        $existe = $db->prepare("SELECT id FROM torneio_fases WHERE torneio_id = ? AND tipo = 'repescagem'");
        $existe->execute([$torneioId]);
        if ($existe->fetch()) throw new RuntimeException('Repescagem já foi gerada para este torneio.');

        $db->prepare("
            INSERT INTO torneio_fases (torneio_id, tipo, rodada, rotulo, estado, conta_classificacao)
            VALUES (?, 'repescagem', NULL, 'Repescagem', 'confirmada', 0)
        ")->execute([$torneioId]);
        $faseId = (int)$db->lastInsertId();

        $stmtIns = $db->prepare("
            INSERT INTO torneio_jogos (torneio_id, fase_id, codigo, bracket, ordem, time_a_id, time_b_id, time_a_origem, time_b_origem, status)
            VALUES (?, ?, ?, 'repescagem', ?, ?, ?, ?, ?, 'agendado')
        ");
        $j = fn($v) => $v !== null ? json_encode($v) : null;

        $stmtIns->execute([$torneioId, $faseId, 'REP-R1', 1, $pos($diretos + 2), $pos($diretos + 7), null, null]); // 8º x 13º
        $stmtIns->execute([$torneioId, $faseId, 'REP-R2', 2, $pos($diretos + 3), $pos($diretos + 6), null, null]); // 9º x 12º
        $stmtIns->execute([$torneioId, $faseId, 'REP-R3', 3, $pos($diretos + 4), $pos($diretos + 5), null, null]); // 10º x 11º
        $stmtIns->execute([$torneioId, $faseId, 'REP-R4', 4, null, null, $j(origemJogo('REP-R1', 'vencedor')), $j(origemJogo('REP-R2', 'vencedor'))]);
        $stmtIns->execute([$torneioId, $faseId, 'REP-R5', 5, $pos($diretos + 1), null, null, $j(origemJogo('REP-R3', 'vencedor'))]); // 7º x vencedor R3

        torneioAuditoria($db, $torneioId, $usuario, 'gerar_repescagem', 'torneio_fases', $faseId, null, ['classificacao' => $classificacao], null);
        if ($torneio['estado'] === 'CLASSIFICACAO_FECHADA') {
            $db->prepare("UPDATE torneios SET estado = 'REPESCAGEM' WHERE id = ?")->execute([$torneioId]);
        }
        return ['fase_id' => $faseId];
    });
}

/**
 * Reseeding dos dois classificados da Repescagem — NUNCA o caminho R4/R5 percorrido, só o
 * mérito já acumulado na Primeira Fase decide quem é o "melhor" seed entre os dois (brief
 * de reseeding da Repescagem). A Repescagem só concede as duas vagas; ela não produz uma
 * classificação própria entre os dois classificados (caminhos assimétricos — o 7º colocado
 * pode conquistar a vaga disputando só REP-R5, por exemplo). Usa exclusivamente a `posicao`
 * já definida por `calcularClassificacao()` (critérios de desempate já aplicados lá) —
 * nunca reaplica pontos/Buchholz/saldo/fair play/vitórias aqui.
 *
 * @param array $classificacao retorno de calcularClassificacao() (fonte da posição final)
 * @param array $rep ['A' => time_id vencedor REP-R4, 'B' => time_id vencedor REP-R5]
 * @return array{melhor:int, pior:int, posicao_melhor:int, posicao_pior:int}
 */
function seedsRepescados(array $classificacao, array $rep): array {
    $posicaoPorTime = array_column($classificacao, 'posicao', 'time_id');
    $a = (int)$rep['A'];
    $b = (int)$rep['B'];
    $posA = $posicaoPorTime[$a] ?? PHP_INT_MAX;
    $posB = $posicaoPorTime[$b] ?? PHP_INT_MAX;
    // Menor posição = melhor seed.
    if ($posA <= $posB) {
        return ['melhor' => $a, 'pior' => $b, 'posicao_melhor' => $posA, 'posicao_pior' => $posB];
    }
    return ['melhor' => $b, 'pior' => $a, 'posicao_melhor' => $posB, 'posicao_pior' => $posA];
}

/** true quando REP-R4 e REP-R5 já têm vencedor definido — os 2 repescados estão prontos. */
function repescagemConcluida(PDO $db, int $torneioId): bool {
    $stmt = $db->prepare("
        SELECT codigo, status, vencedor_time_id FROM torneio_jogos j
        JOIN torneio_fases f ON f.id = j.fase_id
        WHERE j.torneio_id = ? AND f.tipo = 'repescagem' AND j.codigo IN ('REP-R4','REP-R5')
    ");
    $stmt->execute([$torneioId]);
    $rows = $stmt->fetchAll();
    if (count($rows) !== 2) return false;
    foreach ($rows as $r) if ($r['status'] !== 'encerrado' || $r['vencedor_time_id'] === null) return false;
    return true;
}

function getRepescados(PDO $db, int $torneioId): array {
    $stmt = $db->prepare("
        SELECT codigo, vencedor_time_id FROM torneio_jogos j
        JOIN torneio_fases f ON f.id = j.fase_id
        WHERE j.torneio_id = ? AND f.tipo = 'repescagem' AND j.codigo IN ('REP-R4','REP-R5')
    ");
    $stmt->execute([$torneioId]);
    $out = [];
    foreach ($stmt->fetchAll() as $r) $out[$r['codigo']] = (int)$r['vencedor_time_id'];
    return ['A' => $out['REP-R4'] ?? null, 'B' => $out['REP-R5'] ?? null];
}

// ─────────────────────────────────────────────────────────────────────────
// Double Elimination (8 times)
// ─────────────────────────────────────────────────────────────────────────

function gerarDouble(PDO $db, int $torneioId, string $usuario): array {
    $torneioFormato = getTorneio($db, $torneioId);
    if (!$torneioFormato) throw new RuntimeException('Torneio não encontrado.');
    $tipoDouble = formatoDouble($torneioFormato);
    if ($tipoDouble === 'mtnb_5') return gerarDoubleMtnb($db, $torneioId, $usuario);
    if ($tipoDouble === 'direta_8') return gerarDoubleDireta8($db, $torneioId, $usuario);
    return torneioTx($db, function (PDO $db) use ($torneioId, $usuario) {
        $torneio = getTorneio($db, $torneioId);
        if (!repescagemConcluida($db, $torneioId)) {
            throw new RuntimeException('A repescagem ainda não produziu os 2 classificados.');
        }
        $existe = $db->prepare("SELECT id FROM torneio_fases WHERE torneio_id = ? AND tipo = 'double'");
        $existe->execute([$torneioId]);
        if ($existe->fetch()) throw new RuntimeException('Chave Double Elimination já foi gerada.');

        $classificacao = calcularClassificacao($db, $torneioId);
        $pos = fn($p) => $classificacao[$p - 1]['time_id'];
        $rep = getRepescados($db, $torneioId);
        // Reseeding: melhor posição final na Primeira Fase enfrenta o 2º, a outra enfrenta
        // o 1º — nunca o caminho REP-R4/REP-R5 percorrido (ver seedsRepescados()).
        $seeds = seedsRepescados($classificacao, $rep);

        $faseId = inserirChaveDouble8($db, $torneioId, [
            1 => $pos(1), 2 => $pos(2), 3 => $pos(3), 4 => $pos(4), 5 => $pos(5), 6 => $pos(6),
            7 => $seeds['melhor'], 8 => $seeds['pior'],
        ]);

        torneioAuditoria($db, $torneioId, $usuario, 'gerar_double', 'torneio_fases', $faseId, null, [
            'repescados' => $rep, 'seeds_1a6' => array_map(fn($p) => $pos($p), range(1, 6)),
            'reseeding_repescados' => $seeds,
        ], null);
        $db->prepare("UPDATE torneios SET estado = 'DOUBLE' WHERE id = ?")->execute([$torneioId]);
        return ['fase_id' => $faseId];
    });
}

/**
 * Cria a fase Double Elimination de 8 e seus 14 jogos (GF2 só nasce em talvezGerarGF2).
 * $seeds = [1..8 => time_id]: QA 4×5, QB 3×6, QC 2×7, QD 1×8. Compartilhada pelo Misto
 * suíço (7/8 = repescados reordenados) e pelo formato de 8 com entrada direta.
 */
function inserirChaveDouble8(PDO $db, int $torneioId, array $seeds): int {
    for ($s = 1; $s <= 8; $s++) {
        if (empty($seeds[$s])) throw new LogicException("Seed $s da Double não definido.");
    }
    $db->prepare("
        INSERT INTO torneio_fases (torneio_id, tipo, rodada, rotulo, estado, conta_classificacao)
        VALUES (?, 'double', NULL, 'Double Elimination', 'confirmada', 0)
    ")->execute([$torneioId]);
    $faseId = (int)$db->lastInsertId();

    $j = fn($v) => $v !== null ? json_encode($v) : null;
    $stmtIns = $db->prepare("
        INSERT INTO torneio_jogos (torneio_id, fase_id, codigo, bracket, ordem, time_a_id, time_b_id, time_a_origem, time_b_origem, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'agendado')
    ");
    $ins = function (string $codigo, string $bracket, ?int $a, ?int $b, ?array $oa, ?array $ob) use ($stmtIns, $torneioId, $faseId, $j) {
        $ordem = ordemOperacionalDouble($codigo);
        if ($ordem === null) throw new LogicException("Partida $codigo não possui ordem operacional oficial.");
        $stmtIns->execute([$torneioId, $faseId, $codigo, $bracket, $ordem, $a, $b, $j($oa), $j($ob)]);
    };
    $p = fn(int $s): int => (int)$seeds[$s];

    // Chave inicial
    $ins('QA', 'winners', $p(4), $p(5), null, null);
    $ins('QB', 'winners', $p(3), $p(6), null, null);
    $ins('QC', 'winners', $p(2), $p(7), null, null);
    $ins('QD', 'winners', $p(1), $p(8), null, null);

    // Semis e final Winners
    $ins('SF1', 'winners', null, null, origemJogo('QD', 'vencedor'), origemJogo('QA', 'vencedor'));
    $ins('SF2', 'winners', null, null, origemJogo('QC', 'vencedor'), origemJogo('QB', 'vencedor'));
    $ins('FA', 'winners', null, null, origemJogo('SF1', 'vencedor'), origemJogo('SF2', 'vencedor'));

    // Losers
    $ins('B1', 'losers', null, null, origemJogo('QA', 'perdedor'), origemJogo('QB', 'perdedor'));
    $ins('B2', 'losers', null, null, origemJogo('QC', 'perdedor'), origemJogo('QD', 'perdedor'));
    $ins('B3', 'losers', null, null, origemJogo('B1', 'vencedor'), origemJogo('SF2', 'perdedor'));
    $ins('B4', 'losers', null, null, origemJogo('B2', 'vencedor'), origemJogo('SF1', 'perdedor'));
    $ins('B5', 'losers', null, null, origemJogo('B3', 'vencedor'), origemJogo('B4', 'vencedor'));
    $ins('B6', 'losers', null, null, origemJogo('B5', 'vencedor'), origemJogo('FA', 'perdedor'));

    // Grande Final — time_a sempre lado Winners, time_b sempre lado Losers (ver talvezGerarGF2)
    $ins('GF', 'final', null, null, origemJogo('FA', 'vencedor'), origemJogo('B6', 'vencedor'));

    return $faseId;
}

/**
 * Double de 8 com entrada direta (formato misto_round_robin_8): sem Repescagem, os seeds
 * 1..8 são exatamente as posições finais da 1ª fase (todos contra todos).
 */
function gerarDoubleDireta8(PDO $db, int $torneioId, string $usuario): array {
    return torneioTx($db, function (PDO $db) use ($torneioId, $usuario) {
        $torneio = getTorneio($db, $torneioId);
        if (!$torneio || formatoDouble($torneio) !== 'direta_8') throw new RuntimeException('Formato sem Double de entrada direta.');
        if ($torneio['estado'] !== 'CLASSIFICACAO_FECHADA') throw new RuntimeException('Feche a classificação antes de gerar a Double.');
        $existe = $db->prepare("SELECT 1 FROM torneio_fases WHERE torneio_id=? AND tipo='double'");
        $existe->execute([$torneioId]);
        if ($existe->fetchColumn()) throw new RuntimeException('Chave Double Elimination já foi gerada.');

        $classificacao = calcularClassificacao($db, $torneioId);
        if (count($classificacao) !== 8) throw new RuntimeException('A Double requer os 8 seeds da Primeira Fase.');
        $seeds = [];
        foreach ($classificacao as $i => $row) $seeds[$i + 1] = (int)$row['time_id'];

        $faseId = inserirChaveDouble8($db, $torneioId, $seeds);
        $db->prepare("UPDATE torneios SET estado='DOUBLE', atualizado_em=datetime('now') WHERE id=?")->execute([$torneioId]);
        torneioAuditoria($db, $torneioId, $usuario, 'gerar_double', 'torneio_fases', $faseId, null,
            ['formato' => formatoDoTorneio($torneio), 'seeds_1a8' => array_values($seeds)], null);
        return ['fase_id' => $faseId];
    });
}

/** Double real de 5: quatro jogos Winners, três Losers e GF/GF2 compartilhada. */
function gerarDoubleMtnb(PDO $db, int $torneioId, string $usuario): array {
    return torneioTx($db, function (PDO $db) use ($torneioId, $usuario) {
        $torneio = getTorneio($db, $torneioId);
        if (!$torneio || !torneioEhMtnb($torneio)) throw new RuntimeException('Formato MTNB inválido.');
        if ($torneio['estado'] !== 'CLASSIFICACAO_FECHADA') throw new RuntimeException('Feche a classificação antes de gerar a Double.');
        $existe = $db->prepare("SELECT 1 FROM torneio_fases WHERE torneio_id=? AND tipo='double'");
        $existe->execute([$torneioId]);
        if ($existe->fetchColumn()) throw new RuntimeException('Chave Double Elimination já foi gerada.');
        $classificacao = calcularClassificacao($db, $torneioId);
        if (count($classificacao) !== 5) throw new RuntimeException('A Double MTNB requer os 5 seeds da Primeira Fase.');
        $pos = fn(int $p): int => (int)$classificacao[$p - 1]['time_id'];
        $db->prepare("INSERT INTO torneio_fases (torneio_id,tipo,rodada,rotulo,estado,conta_classificacao,gerada_em,confirmada_em,confirmada_por) VALUES (?,'double',NULL,'Double Elimination','confirmada',0,datetime('now'),datetime('now'),?)")
           ->execute([$torneioId, $usuario]);
        $faseId = (int)$db->lastInsertId();
        $stmt = $db->prepare("INSERT INTO torneio_jogos (torneio_id,fase_id,codigo,bracket,ordem,time_a_id,time_b_id,time_a_origem,time_b_origem,status) VALUES (?,?,?,?,?,?,?,?,?,'agendado')");
        $json = fn(?array $v) => $v ? json_encode($v) : null;
        $ins = function(string $codigo, string $bracket, ?int $a, ?int $b, ?array $oa, ?array $ob) use ($stmt,$torneioId,$faseId,$json) {
            $stmt->execute([$torneioId,$faseId,$codigo,$bracket,ordemOperacionalDouble($codigo,'mtnb_round_robin_5'),$a,$b,$json($oa),$json($ob)]);
        };
        $ins('P1','winners',$pos(5),$pos(4),null,null);
        $ins('W2','winners',$pos(2),$pos(3),null,null);
        $ins('W1','winners',$pos(1),null,null,origemJogo('P1','vencedor'));
        $ins('WF','winners',null,null,origemJogo('W1','vencedor'),origemJogo('W2','vencedor'));
        $ins('L1','losers',null,null,origemJogo('P1','perdedor'),origemJogo('W2','perdedor'));
        $ins('L2','losers',null,null,origemJogo('L1','vencedor'),origemJogo('W1','perdedor'));
        $ins('LF','losers',null,null,origemJogo('L2','vencedor'),origemJogo('WF','perdedor'));
        // time_a é sempre o finalista invicto, contrato usado pela regra genérica de GF2.
        $ins('GF','final',null,null,origemJogo('WF','vencedor'),origemJogo('LF','vencedor'));
        $db->prepare("UPDATE torneios SET estado='DOUBLE', atualizado_em=datetime('now') WHERE id=?")->execute([$torneioId]);
        torneioAuditoria($db,$torneioId,$usuario,'gerar_double','torneio_fases',$faseId,null,['formato'=>'mtnb_round_robin_5','seeds'=>array_map(fn($r)=>(int)$r['time_id'],$classificacao)],null);
        return ['fase_id'=>$faseId];
    });
}

/**
 * Depois de encerrar o jogo GF: se quem venceu veio da chave Losers (time_b),
 * o torneio ainda não acabou — gera a GF2 (revanche, decide o campeão). Se quem
 * venceu veio da chave Winners (time_a), o torneio termina ali (dupla eliminação
 * exige que o time da Losers vença duas vezes a decisão).
 */
function talvezGerarGF2(PDO $db, int $torneioId, string $usuario): ?array {
    return torneioTx($db, function (PDO $db) use ($torneioId, $usuario) {
        $stmt = $db->prepare("
            SELECT j.* FROM torneio_jogos j JOIN torneio_fases f ON f.id = j.fase_id
            WHERE j.torneio_id = ? AND f.tipo = 'double' AND j.codigo = 'GF'
        ");
        $stmt->execute([$torneioId]);
        $gf = $stmt->fetch();
        if (!$gf || $gf['status'] !== 'encerrado' || $gf['vencedor_time_id'] === null) return null;

        if ((int)$gf['vencedor_time_id'] === (int)$gf['time_a_id']) {
            // Campeão decidido na GF única (lado Winners venceu)
            $db->prepare("UPDATE torneios SET estado = 'FINALIZADO' WHERE id = ?")->execute([$torneioId]);
            return null;
        }

        $jaExiste = $db->prepare("SELECT id FROM torneio_jogos WHERE torneio_id = ? AND codigo = 'GF2'");
        $jaExiste->execute([$torneioId]);
        if ($jaExiste->fetch()) return null; // idempotente

        $torneio = getTorneio($db, $torneioId);
        $ordemGf2 = ordemOperacionalDouble('GF2', $torneio ? formatoDoTorneio($torneio) : 'misto_swiss_13');
        $db->prepare("
            INSERT INTO torneio_jogos (torneio_id, fase_id, codigo, bracket, ordem, time_a_id, time_b_id, status)
            VALUES (?, ?, 'GF2', 'final', ?, ?, ?, 'agendado')
        ")->execute([$torneioId, $gf['fase_id'], $ordemGf2, $gf['time_a_id'], $gf['time_b_id']]);

        torneioAuditoria($db, $torneioId, $usuario, 'gerar_gf2', 'torneio_jogos', (int)$db->lastInsertId(), null, ['motivo' => 'Time da chave Losers venceu a GF'], null);
        return ['gerada' => true];
    });
}
