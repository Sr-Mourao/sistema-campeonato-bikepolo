<?php
/**
 * Sequência operacional oficial da Double Elimination.
 *
 * Esta ordem é deliberadamente independente da topologia usada para desenhar as
 * chaves Winners/Losers. `torneio_jogos.ordem` é a ordem de programação consumida
 * pelo resolvedor canônico, endpoints públicos, admin, telão e overlays.
 */
const TORNEIO_ORDEM_OPERACIONAL_DOUBLE = [
    'QA' => 1, 'QB' => 2, 'QC' => 3, 'QD' => 4,
    'B1' => 5, 'B2' => 6,
    'SF1' => 7, 'SF2' => 8,
    'B3' => 9, 'B4' => 10,
    'FA' => 11,
    'B5' => 12,
    'B6' => 13,
    'GF' => 14,
    'GF2' => 15,
];

const TORNEIO_ORDEM_OPERACIONAL_DOUBLE_MTNB = [
    'P1' => 1, 'W2' => 2, 'W1' => 3, 'L1' => 4,
    'WF' => 5, 'L2' => 6, 'LF' => 7, 'GF' => 8, 'GF2' => 9,
];

function ordemOperacionalDouble(string $codigo, string $formato = 'misto_swiss_13'): ?int {
    $ordens = $formato === 'mtnb_round_robin_5' ? TORNEIO_ORDEM_OPERACIONAL_DOUBLE_MTNB : TORNEIO_ORDEM_OPERACIONAL_DOUBLE;
    return $ordens[$codigo] ?? null;
}

/** Corrige Doubles já persistidas sem tocar em bracket, origens ou resultados. */
function normalizarOrdemOperacionalDouble(PDO $db, ?int $torneioId = null): void {
    $stmtT = $db->prepare('SELECT id, categoria, formato FROM torneios' . ($torneioId !== null ? ' WHERE id=?' : ''));
    $stmtT->execute($torneioId !== null ? [$torneioId] : []);
    $update = $db->prepare("UPDATE torneio_jogos SET ordem=? WHERE torneio_id=? AND codigo=? AND fase_id IN (SELECT id FROM torneio_fases WHERE torneio_id=? AND tipo='double')");
    foreach ($stmtT->fetchAll() as $t) {
        $formato = $t['formato'] ?: (strtolower((string)$t['categoria']) === 'mtnb' ? 'mtnb_round_robin_5' : 'misto_swiss_13');
        $ordens = $formato === 'mtnb_round_robin_5' ? TORNEIO_ORDEM_OPERACIONAL_DOUBLE_MTNB : TORNEIO_ORDEM_OPERACIONAL_DOUBLE;
        foreach ($ordens as $codigo => $ordem) $update->execute([$ordem, $t['id'], $codigo, $t['id']]);
    }
}
