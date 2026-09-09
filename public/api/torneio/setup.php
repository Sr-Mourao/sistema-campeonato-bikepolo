<?php
/**
 * Criação de torneio a partir do preset oficial, e reset de resultados pra testes.
 *
 * Não existe mais modo sandbox: o torneio tem um único estado. Pra testar do
 * zero, `zerarResultados()` apaga jogos/eventos/propagação e mantém config,
 * critérios e participantes — equivalente a "voltar pro início da competição".
 */

require_once __DIR__ . '/lib.php';
require_once __DIR__ . '/formato.php';

const PRESET_BRASILEIRO_2026 = [
    'nome' => 'Brasileiro Bike Polo 2026 — 13 times',
    'rodadas_swiss' => 4,
    'equalizacao_habilitada' => 1,
    'classificados_diretos' => 6,
    'vagas_repescagem' => 2,
    'pontos_vitoria' => 3,
    'pontos_empate' => 1,
    'pontos_derrota' => 0,
    'permite_empate_classificatoria' => 1,
    'criterios' => TORNEIO_CRITERIOS_DEFAULT,
];

const PRESET_MTNB_2026 = [
    'nome' => '4º Brasileiro MTNB', 'rodadas_swiss' => 0,
    'equalizacao_habilitada' => 0, 'classificados_diretos' => 5,
    'vagas_repescagem' => 0, 'pontos_vitoria' => 3,
    'pontos_empate' => 1, 'pontos_derrota' => 0,
    'permite_empate_classificatoria' => 1,
    'criterios' => TORNEIO_CRITERIOS_DEFAULT,
];

/**
 * Cria um torneio novo aplicando o preset oficial e inscrevendo automaticamente
 * todos os times de `times.categoria = $categoria` como participantes (fonte
 * oficial — não duplica cadastro).
 */
function criarTorneioPreset(PDO $db, string $categoria, string $usuario, ?string $nomeOverride = null): int {
    $categoria = strtolower(trim($categoria));
    if (!in_array($categoria, ['misto', 'mtnb'], true)) throw new InvalidArgumentException('Categoria de torneio inválida.');
    return torneioTx($db, function (PDO $db) use ($categoria, $usuario, $nomeOverride) {
        $ehMtnb = strtolower($categoria) === 'mtnb';
        $preset = $ehMtnb ? PRESET_MTNB_2026 : PRESET_BRASILEIRO_2026;
        $formato = formatoPorCategoria($categoria);
        $presetSlug = $ehMtnb ? 'mtnb_2026_round_robin_5' : 'brasileiro_2026_13times';

        $stmt = $db->prepare("
            INSERT INTO torneios
                (nome, categoria, formato, preset, estado, rodadas_swiss, equalizacao_habilitada,
                 classificados_diretos, vagas_repescagem, pontos_vitoria, pontos_empate, pontos_derrota,
                 permite_empate_classificatoria, criado_por)
            VALUES (?, ?, ?, ?, 'CONFIGURACAO', ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $nomeOverride ?? $preset['nome'], $categoria, $formato, $presetSlug,
            $preset['rodadas_swiss'], $preset['equalizacao_habilitada'],
            $preset['classificados_diretos'], $preset['vagas_repescagem'],
            $preset['pontos_vitoria'], $preset['pontos_empate'], $preset['pontos_derrota'],
            $preset['permite_empate_classificatoria'], $usuario,
        ]);
        $torneioId = (int)$db->lastInsertId();

        salvarCriterios($db, $torneioId, $preset['criterios']);

        $times = $db->prepare("SELECT id FROM times WHERE categoria = ? ORDER BY nome");
        $times->execute([$categoria]);
        $ids = array_column($times->fetchAll(), 'id');

        $stmtP = $db->prepare("INSERT INTO torneio_participantes (torneio_id, time_id, seed) VALUES (?, ?, ?)");
        foreach ($ids as $i => $tid) $stmtP->execute([$torneioId, $tid, $i + 1]);

        torneioAuditoria($db, $torneioId, $usuario, 'criar_torneio', 'torneios', $torneioId, null,
            ['categoria' => $categoria, 'times' => count($ids)], null);

        return $torneioId;
    });
}

/**
 * Zera resultados/progresso pra permitir testar o torneio do zero.
 * Apaga: jogos (todas as fases geradas), eventos de gol/falta, snapshots.
 * Preserva: torneios (config), torneio_criterios, torneio_participantes,
 * times/pessoas/inscricoes/membros_time (nunca tocados).
 * O log de auditoria é preservado (o próprio reset vira uma entrada nele) —
 * é histórico permanente, não "resultado" do torneio.
 */
function zerarResultados(PDO $db, int $torneioId, string $usuario): void {
    $t = getTorneio($db, $torneioId);
    if (!$t) throw new RuntimeException('Torneio não encontrado.');

    torneioTx($db, function (PDO $db) use ($torneioId, $usuario) {
        $db->prepare("DELETE FROM torneio_eventos_gol WHERE torneio_id = ?")->execute([$torneioId]);
        $db->prepare("DELETE FROM torneio_eventos_falta WHERE torneio_id = ?")->execute([$torneioId]);
        $db->prepare("DELETE FROM torneio_snapshots WHERE torneio_id = ?")->execute([$torneioId]); // antes de fases: snapshots.fase_id referencia torneio_fases
        $db->prepare("DELETE FROM torneio_jogos WHERE torneio_id = ?")->execute([$torneioId]);
        $db->prepare("DELETE FROM torneio_fases WHERE torneio_id = ?")->execute([$torneioId]);
        $db->prepare("UPDATE torneios SET estado = 'CONFIGURACAO', atualizado_em = datetime('now') WHERE id = ?")->execute([$torneioId]);
        torneioAuditoria($db, $torneioId, $usuario, 'zerar_resultados', 'torneios', $torneioId, null, null,
            'Reset administrativo — jogos, eventos e fases geradas apagados; config e participantes preservados.');
    });
}
