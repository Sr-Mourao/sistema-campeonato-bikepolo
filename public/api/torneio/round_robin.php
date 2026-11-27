<?php
require_once __DIR__ . '/lib.php';
require_once __DIR__ . '/formato.php';

/**
 * Circle method. O null existe apenas durante o cálculo do calendário e nunca é
 * persistido: não há partida, vitória, ponto ou estatística para a folga.
 *
 * @return array<int,array<int,array{time_a_id:int,time_b_id:int}>>
 */
function montarRoundRobin(array $timeIds): array {
    $ids = array_values(array_map('intval', $timeIds));
    if (count($ids) < 2 || count(array_unique($ids)) !== count($ids)) {
        throw new InvalidArgumentException('Round Robin requer times distintos.');
    }
    if (count($ids) % 2 === 1) $ids[] = null;
    $n = count($ids);
    $rodadas = [];
    for ($r = 0; $r < $n - 1; $r++) {
        $jogos = [];
        for ($i = 0; $i < $n / 2; $i++) {
            $a = $ids[$i]; $b = $ids[$n - 1 - $i];
            if ($a !== null && $b !== null) {
                // Alterna mando puramente visual sem alterar os pares.
                $jogos[] = $r % 2 === 0
                    ? ['time_a_id' => (int)$a, 'time_b_id' => (int)$b]
                    : ['time_a_id' => (int)$b, 'time_b_id' => (int)$a];
            }
        }
        $rodadas[] = $jogos;
        $fixo = array_shift($ids);
        $ultimo = array_pop($ids);
        array_unshift($ids, $fixo, $ultimo);
    }
    return $rodadas;
}

function gerarPrimeiraFaseRoundRobin(PDO $db, int $torneioId, string $usuario): array {
    $torneio = getTorneio($db, $torneioId);
    if (!$torneio || !formatoEhRoundRobin($torneio)) throw new RuntimeException('Este torneio não usa o formato todos contra todos.');
    $esperados = formatoParticipantes($torneio);
    $participantes = getParticipantes($db, $torneioId);
    if (count($participantes) !== $esperados) throw new RuntimeException("O todos contra todos deste formato requer exatamente $esperados times ativos (há " . count($participantes) . ').');
    $ids = array_map(fn($p) => (int)$p['time_id'], $participantes);
    $rodadas = montarRoundRobin($ids);

    return torneioTx($db, function (PDO $db) use ($torneioId, $usuario, $rodadas) {
        $existe = $db->prepare("SELECT 1 FROM torneio_fases WHERE torneio_id=? AND tipo='round_robin'");
        $existe->execute([$torneioId]);
        if ($existe->fetchColumn()) throw new RuntimeException('A Primeira Fase Round Robin já foi gerada.');
        $codigos = [];
        foreach ($rodadas as $ri => $jogos) {
            $rodada = $ri + 1;
            $db->prepare("INSERT INTO torneio_fases (torneio_id,tipo,rodada,rotulo,estado,conta_classificacao,gerada_em,confirmada_em,confirmada_por) VALUES (?,'round_robin',?,?,'confirmada',1,datetime('now'),datetime('now'),?)")
               ->execute([$torneioId, $rodada, "Todos contra todos — Rodada $rodada", $usuario]);
            $faseId = (int)$db->lastInsertId();
            $ins = $db->prepare("INSERT INTO torneio_jogos (torneio_id,fase_id,codigo,ordem,time_a_id,time_b_id,status) VALUES (?,?,?,?,?,?,'agendado')");
            foreach ($jogos as $ji => $jogo) {
                $codigo = 'RR' . $rodada . '.' . ($ji + 1);
                $ins->execute([$torneioId, $faseId, $codigo, $ji + 1, $jogo['time_a_id'], $jogo['time_b_id']]);
                $codigos[] = $codigo;
            }
            torneioSnapshot($db, $torneioId, $faseId, 'round_robin_gerado', ['rodada' => $rodada, 'jogos' => $jogos], $usuario);
        }
        $db->prepare("UPDATE torneios SET estado='PRIMEIRA_FASE', atualizado_em=datetime('now') WHERE id=?")->execute([$torneioId]);
        torneioAuditoria($db, $torneioId, $usuario, 'gerar_round_robin', 'torneio_fases', null, null, ['codigos' => $codigos], null);
        return ['codigos' => $codigos, 'rodadas' => count($rodadas)];
    });
}

function validarRoundRobinCompleto(PDO $db, int $torneioId): void {
    $torneio = getTorneio($db, $torneioId);
    if (!$torneio || !formatoEhRoundRobin($torneio)) throw new RuntimeException('Este torneio não usa o formato todos contra todos.');
    $rodadas = formatoRodadas($torneio);
    $jogosEsperados = formatoJogosRoundRobin($torneio);
    $stmt = $db->prepare("SELECT COUNT(DISTINCT f.id) fases, COUNT(j.id) jogos, SUM(CASE WHEN j.status NOT IN ('encerrado','wo','cancelado') THEN 1 ELSE 0 END) abertos FROM torneio_fases f LEFT JOIN torneio_jogos j ON j.fase_id=f.id WHERE f.torneio_id=? AND f.tipo='round_robin'");
    $stmt->execute([$torneioId]); $r = $stmt->fetch();
    if ((int)$r['fases'] !== $rodadas || (int)$r['jogos'] !== $jogosEsperados || (int)$r['abertos'] !== 0) {
        throw new RuntimeException("Encerre as $jogosEsperados partidas das $rodadas rodadas do todos contra todos antes de fechar a classificação.");
    }
}
