<?php
/**
 * Pareamento suíço — geração de SUGESTÃO (sem side effects) + confirmação (persiste).
 *
 * Algoritmo (rodadas 2+):
 *  1. Recalcula classificação atual.
 *  2. Escolhe bye: pior colocado entre os que ainda não receberam bye.
 *  3. Remove esse time do pool e busca, entre TODAS as (n-1)!! combinações de pares
 *     dos times restantes, a de menor custo total:
 *       - confronto repetido: penalidade enorme (evita rematch sempre que houver
 *         alternativa; minimiza contagem de rematches se for matematicamente inevitável)
 *       - diferença de posição na classificação: penalidade progressiva
 *  Com 13 times o pool sem bye tem 12 times → 11!! = 10395 combinações, força
 *  bruta é instantânea e GARANTE o ótimo (não é heurística).
 *
 * Rodada 1: sem histórico/pontuação — pareamento por seed (1×2, 3×4, ...) ou
 * sorteio aleatório (com seed de PRNG opcional para reprodutibilidade em testes).
 */

require_once __DIR__ . '/lib.php';

const REMATCH_PENALTY = 1_000_000;

/**
 * Gera a sugestão de pareamento da rodada $rodada. Não escreve no banco.
 * Retorna: ['bye'=>[...], 'pares'=>[[a,b,motivos[]],...], 'avisos'=>[...]]
 */
function sugerirPareamentoSwiss(PDO $db, int $torneioId, int $rodada, array $opts = []): array {
    $participantes = getParticipantes($db, $torneioId);
    $todosIds = array_column($participantes, 'time_id');
    $nomes = array_column($participantes, 'nome', 'time_id');

    $historico = getHistoricoConfrontosSwiss($db, $torneioId, $rodada);
    $byeHistorico = getHistoricoByeSwiss($db, $torneioId, $rodada);

    if ($rodada <= 1) {
        return sugerirRodada1($todosIds, $nomes, $opts);
    }

    $classificacao = calcularClassificacao($db, $torneioId);
    // Ordem de posição só entre quem está disputando o suíço (parametrizável no futuro)
    $posicao = [];
    foreach ($classificacao as $i => $row) $posicao[$row['time_id']] = $i; // 0-based

    // 1) Escolher bye: pior colocado ainda sem bye
    $byeForcado = $opts['bye_time_id'] ?? null;
    $avisos = [];
    if ($byeForcado !== null) {
        if (in_array($byeForcado, $byeHistorico, true)) {
            $avisos[] = "⚠ Override: {$nomes[$byeForcado]} já recebeu bye antes — confirmado manualmente pelo admin.";
        }
        $byeId = $byeForcado;
        $byeMotivo = 'Bye definido manualmente pelo admin.';
    } else {
        $ordenadoPiorParaMelhor = $todosIds;
        usort($ordenadoPiorParaMelhor, fn($a, $b) => ($posicao[$b] ?? 0) <=> ($posicao[$a] ?? 0));
        $byeId = null;
        foreach ($ordenadoPiorParaMelhor as $tid) {
            if (!in_array($tid, $byeHistorico, true)) { $byeId = $tid; break; }
        }
        if ($byeId === null) {
            // Não deveria acontecer com 13 times / 4 rodadas, mas não trava o operador
            $byeId = $ordenadoPiorParaMelhor[0];
            $avisos[] = "⚠ Todos os times elegíveis já receberam bye. Selecionado o pior colocado mesmo assim — revise manualmente.";
        }
        $byeMotivo = 'Pior classificado entre os times que ainda não receberam bye.';
    }

    $pool = array_values(array_filter($todosIds, fn($t) => $t !== $byeId));

    [$pares, $custoTotal, $temRematch] = melhorPareamento($pool, $posicao, $historico);

    if ($temRematch) {
        $avisos[] = "⚠ Não foi possível evitar 100% dos confrontos repetidos nesta rodada — foi escolhida a combinação com o MENOR número de revanches possível.";
    }

    $paresOut = [];
    foreach ($pares as [$a, $b]) {
        $motivos = [];
        $jaJogaram = jaSeEnfrentaram($historico, $a, $b);
        $motivos[] = $jaJogaram ? "⚠ {$nomes[$a]} e {$nomes[$b]} já se enfrentaram nesta fase." : "✓ Nunca se enfrentaram.";
        $dist = abs(($posicao[$a] ?? 0) - ($posicao[$b] ?? 0));
        $motivos[] = $dist <= 1 ? "✓ Posições próximas na classificação." : "⚠ Diferença de {$dist} posições na classificação.";
        $paresOut[] = ['time_a_id' => $a, 'time_b_id' => $b, 'motivos' => $motivos, 'rematch' => $jaJogaram];
    }

    return [
        'rodada' => $rodada,
        'bye' => ['time_id' => $byeId, 'nome' => $nomes[$byeId] ?? null, 'motivo' => $byeMotivo],
        'pares' => $paresOut,
        'avisos' => $avisos,
    ];
}

function sugerirRodada1(array $todosIds, array $nomes, array $opts): array {
    $modo = $opts['modo'] ?? 'sorteio'; // 'sorteio' | 'seed'
    $ids = $todosIds;

    if ($modo === 'seed') {
        // Mantém a ordem recebida (já deve vir ordenada por seed em getParticipantes)
    } else {
        $seedPrng = $opts['seed_prng'] ?? null;
        if ($seedPrng !== null) {
            mt_srand((int)$seedPrng);
            usort($ids, fn($a, $b) => (mt_rand(0, 1_000_000) <=> mt_rand(0, 1_000_000)));
        } else {
            shuffle($ids);
        }
    }

    $byeId = end($ids);
    $pool = array_slice($ids, 0, count($ids) - 1);

    $pares = [];
    for ($i = 0; $i < count($pool); $i += 2) {
        $pares[] = [
            'time_a_id' => $pool[$i], 'time_b_id' => $pool[$i + 1],
            'motivos' => ['✓ Rodada 1 — sem histórico prévio.'],
            'rematch' => false,
        ];
    }

    return [
        'rodada' => 1,
        'bye' => ['time_id' => $byeId, 'nome' => $nomes[$byeId] ?? null, 'motivo' => 'Sorteio da rodada 1.'],
        'pares' => $pares,
        'avisos' => [],
    ];
}

/** Busca exaustiva (força bruta) do pareamento de menor custo entre os times do pool. */
function melhorPareamento(array $pool, array $posicao, array $historico): array {
    $n = count($pool);
    if ($n % 2 !== 0) throw new RuntimeException('Pool de pareamento precisa ter número par de times');

    $melhor = null;
    $melhorCusto = INF;

    $buscar = function (array $restantes, array $paresAtuais, float $custoAtual) use (
        &$buscar, &$melhor, &$melhorCusto, $posicao, $historico
    ) {
        if ($custoAtual >= $melhorCusto) return; // poda
        if (empty($restantes)) {
            if ($custoAtual < $melhorCusto) { $melhorCusto = $custoAtual; $melhor = $paresAtuais; }
            return;
        }
        $a = $restantes[0];
        $resto = array_slice($restantes, 1);
        foreach ($resto as $i => $b) {
            $custoPar = custoPareamento($a, $b, $posicao, $historico);
            $novoResto = $resto;
            unset($novoResto[$i]);
            $buscar(array_values($novoResto), [...$paresAtuais, [$a, $b]], $custoAtual + $custoPar);
        }
    };

    $buscar($pool, [], 0.0);

    $temRematch = false;
    foreach ($melhor as [$a, $b]) {
        if (jaSeEnfrentaram($historico, $a, $b)) { $temRematch = true; break; }
    }

    return [$melhor, $melhorCusto, $temRematch];
}

function custoPareamento(int $a, int $b, array $posicao, array $historico): float {
    $custo = abs(($posicao[$a] ?? 0) - ($posicao[$b] ?? 0));
    if (jaSeEnfrentaram($historico, $a, $b)) $custo += REMATCH_PENALTY;
    return (float)$custo;
}

function jaSeEnfrentaram(array $historico, int $a, int $b): bool {
    $key = $a < $b ? "$a-$b" : "$b-$a";
    return isset($historico[$key]);
}

/** Pares já confirmados em rodadas suíças anteriores (< $antesDaRodada) deste torneio. */
function getHistoricoConfrontosSwiss(PDO $db, int $torneioId, int $antesDaRodada): array {
    $stmt = $db->prepare("
        SELECT j.time_a_id, j.time_b_id FROM torneio_jogos j
        JOIN torneio_fases f ON f.id = j.fase_id
        WHERE j.torneio_id = ? AND f.tipo = 'swiss' AND f.rodada < ?
              AND j.is_bye = 0 AND j.status != 'cancelado'
    ");
    $stmt->execute([$torneioId, $antesDaRodada]);
    $out = [];
    foreach ($stmt->fetchAll() as $row) {
        $a = $row['time_a_id']; $b = $row['time_b_id'];
        if ($a === null || $b === null) continue;
        $key = $a < $b ? "$a-$b" : "$b-$a";
        $out[$key] = true;
    }
    return $out;
}

function getHistoricoByeSwiss(PDO $db, int $torneioId, int $antesDaRodada): array {
    $stmt = $db->prepare("
        SELECT j.time_a_id FROM torneio_jogos j
        JOIN torneio_fases f ON f.id = j.fase_id
        WHERE j.torneio_id = ? AND f.tipo = 'swiss' AND f.rodada < ? AND j.is_bye = 1
    ");
    $stmt->execute([$torneioId, $antesDaRodada]);
    return array_column($stmt->fetchAll(), 'time_a_id');
}

/**
 * Persiste a rodada suíça (fase + jogos) a partir do pareamento (possivelmente
 * editado pelo admin) recebido do frontend. Idempotente por rodada: se a fase já
 * existir e estiver 'confirmada', recusa (edição de rodada confirmada é outro fluxo,
 * ver torneio/undo.php).
 */
function confirmarRodadaSwiss(
    PDO $db, int $torneioId, int $rodada, array $bye, array $pares, string $usuario
): array {
    return torneioTx($db, function (PDO $db) use ($torneioId, $rodada, $bye, $pares, $usuario) {
        $stmt = $db->prepare("SELECT * FROM torneio_fases WHERE torneio_id = ? AND tipo = 'swiss' AND rodada = ?");
        $stmt->execute([$torneioId, $rodada]);
        $fase = $stmt->fetch();
        if ($fase && $fase['estado'] === 'confirmada') {
            throw new RuntimeException("Rodada $rodada já está confirmada. Use o fluxo de edição/undo para alterar.");
        }

        if (!$fase) {
            $db->prepare("
                INSERT INTO torneio_fases (torneio_id, tipo, rodada, rotulo, estado, conta_classificacao)
                VALUES (?, 'swiss', ?, ?, 'confirmada', 1)
            ")->execute([$torneioId, $rodada, "Suíço — Rodada $rodada"]);
            $faseId = (int)$db->lastInsertId();
        } else {
            $faseId = (int)$fase['id'];
            $db->prepare("UPDATE torneio_fases SET estado = 'confirmada', confirmada_em = datetime('now'), confirmada_por = ? WHERE id = ?")
               ->execute([$usuario, $faseId]);
        }

        $stmtIns = $db->prepare("
            INSERT INTO torneio_jogos (torneio_id, fase_id, codigo, ordem, time_a_id, time_b_id, is_bye, bye_motivo, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");

        $ordem = 1;
        $codigos = [];
        foreach ($pares as $par) {
            $codigo = "{$rodada}." . $ordem;
            $stmtIns->execute([
                $torneioId, $faseId, $codigo, $ordem,
                $par['time_a_id'], $par['time_b_id'], 0, null, 'agendado',
            ]);
            $codigos[] = $codigo;
            $ordem++;
        }
        // Bye vira uma linha própria (is_bye=1, time_b_id NULL), status já encerrado —
        // não entra em standings além do contador informativo (ver calcularClassificacao).
        $codigoBye = "{$rodada}.bye";
        $stmtIns->execute([
            $torneioId, $faseId, $codigoBye, $ordem,
            $bye['time_id'], null, 1, $bye['motivo'] ?? null, 'encerrado',
        ]);

        torneioAuditoria(
            $db, $torneioId, $usuario, 'confirmar_rodada', 'torneio_fases', $faseId,
            null, ['rodada' => $rodada, 'pares' => $pares, 'bye' => $bye], null
        );
        torneioSnapshot($db, $torneioId, $faseId, 'rodada_confirmada', ['rodada' => $rodada, 'pares' => $pares, 'bye' => $bye], $usuario);

        return ['fase_id' => $faseId, 'codigos' => $codigos, 'codigo_bye' => $codigoBye];
    });
}
