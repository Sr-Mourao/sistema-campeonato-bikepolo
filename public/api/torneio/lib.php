<?php
require_once __DIR__ . '/ordem.php';

/**
 * Motor esportivo do torneio — fonte canônica de cálculo.
 *
 * Regras centrais (ver PLAN.md / brief do módulo):
 * - Bye NÃO conta como partida: não soma J/V/E/D/GP/GC/SG/Pontos/Faltas, não gera
 *   estatística, e não entra na lista de "adversários enfrentados" pra Buchholz.
 * - Equalização conta normalmente (mesma fase de "conta_classificacao").
 * - Classificação = fases com torneio_fases.conta_classificacao = 1 (swiss + equalização
 *   por padrão), jogos com status = 'encerrado' e is_bye = 0.
 * - Critérios de desempate são configuráveis e ordenados (torneio_criterios.ordem).
 *
 * Todas as funções aqui são puras em relação a efeitos colaterais, exceto as que
 * têm "persist"/"confirmar"/"registrar" no nome — essas escrevem no banco dentro
 * de transactions. Nenhuma função aqui decide "o que fazer" sozinha: geração de
 * rodada/fase sempre passa por uma etapa de sugestão (sem side effects) seguida de
 * confirmação explícita do admin.
 */

const TORNEIO_CRITERIOS_VALIDOS = [
    'pontos', 'vitorias', 'empates', 'saldo', 'gols_pro', 'gols_contra_menos',
    'fair_play', 'confronto_direto', 'buchholz', 'sorteio',
];

const TORNEIO_CRITERIOS_LABEL = [
    'pontos'              => 'Pontos',
    'vitorias'             => 'Vitórias',
    'empates'              => 'Empates',
    'saldo'                => 'Saldo de gols',
    'gols_pro'             => 'Gols marcados',
    'gols_contra_menos'    => 'Menos gols sofridos',
    'fair_play'            => 'Fair Play (menos faltas)',
    'confronto_direto'     => 'Confronto direto',
    'buchholz'             => 'Força de tabela (Buchholz)',
    'sorteio'              => 'Critério manual / sorteio',
];

// true = maior valor é melhor (↑) · false = menor valor é melhor (↓, ex: faltas)
const TORNEIO_CRITERIOS_DIRECAO = [
    'pontos'            => true,
    'vitorias'          => true,
    'empates'           => true,
    'saldo'             => true,
    'gols_pro'          => true,
    'gols_contra_menos' => false, // menos gols sofridos é melhor
    'fair_play'         => false, // menos faltas é melhor
    'confronto_direto'  => null,  // resolvido contextualmente, não por valor escalar
    'buchholz'          => true,
    'sorteio'           => null,
];

const TORNEIO_CRITERIOS_DEFAULT = [
    'pontos', 'vitorias', 'saldo', 'gols_pro', 'fair_play',
    'gols_contra_menos', 'confronto_direto', 'buchholz', 'sorteio',
];

/** Reentrante: se já existe uma transaction em andamento (chamada aninhada), não abre outra. */
function torneioTx(PDO $db, callable $fn) {
    $jaEmTransacao = $db->inTransaction();
    if (!$jaEmTransacao) $db->beginTransaction();
    try {
        $out = $fn($db);
        if (!$jaEmTransacao) $db->commit();
        return $out;
    } catch (\Throwable $e) {
        if (!$jaEmTransacao && $db->inTransaction()) $db->rollBack();
        throw $e;
    }
}

// ─────────────────────────────────────────────────────────────────────────
// Auditoria e snapshots
// ─────────────────────────────────────────────────────────────────────────

function torneioAuditoria(
    PDO $db, int $torneioId, string $usuario, string $acao, string $entidade,
    ?int $entidadeId, mixed $estadoAnterior, mixed $estadoNovo, ?string $motivo
): int {
    $stmt = $db->prepare("
        INSERT INTO torneio_audit_log
            (torneio_id, usuario, acao, entidade, entidade_id, estado_anterior, estado_novo, motivo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $torneioId, $usuario, $acao, $entidade, $entidadeId,
        $estadoAnterior !== null ? json_encode($estadoAnterior, JSON_UNESCAPED_UNICODE) : null,
        $estadoNovo !== null ? json_encode($estadoNovo, JSON_UNESCAPED_UNICODE) : null,
        $motivo,
    ]);
    return (int)$db->lastInsertId();
}

function torneioSnapshot(PDO $db, int $torneioId, ?int $faseId, string $tipo, array $dados, ?string $usuario): int {
    $stmt = $db->prepare("
        INSERT INTO torneio_snapshots (torneio_id, fase_id, tipo, dados, criado_por)
        VALUES (?, ?, ?, ?, ?)
    ");
    $stmt->execute([$torneioId, $faseId, $tipo, json_encode($dados, JSON_UNESCAPED_UNICODE), $usuario]);
    return (int)$db->lastInsertId();
}

// ─────────────────────────────────────────────────────────────────────────
// Torneio / participantes / critérios
// ─────────────────────────────────────────────────────────────────────────

function getTorneio(PDO $db, int $torneioId): ?array {
    $stmt = $db->prepare("SELECT * FROM torneios WHERE id = ?");
    $stmt->execute([$torneioId]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function getParticipantes(PDO $db, int $torneioId): array {
    $stmt = $db->prepare("
        SELECT tp.time_id, tp.seed, t.nome, t.categoria
        FROM torneio_participantes tp
        JOIN times t ON t.id = tp.time_id
        WHERE tp.torneio_id = ? AND tp.ativo = 1
        ORDER BY COALESCE(tp.seed, 999), t.nome
    ");
    $stmt->execute([$torneioId]);
    return $stmt->fetchAll();
}

/**
 * Elenco ELEGÍVEL de um time isolado (não ligado a uma partida específica) — mesmo
 * filtro de elegibilidade de `getElencoPartida()` (public/api/torneio/sumula.php):
 * inscrição cancelada nunca aparece. Usado pelo card/modal público do time (seção 17-19
 * do brief de área pública) — nunca reimplementar esse filtro em outro lugar.
 */
function getElencoTime(PDO $db, int $timeId): array {
    $stmt = $db->prepare("
        SELECT mt.id AS membro_id, p.nome, p.foto_path, p.foto_atualizado_em
        FROM membros_time mt
        JOIN inscricoes i ON i.id = mt.inscricao_id AND i.status != 'cancelado'
        JOIN pessoas p ON p.id = i.pessoa_id
        WHERE mt.time_id = ?
        ORDER BY p.nome
    ");
    $stmt->execute([$timeId]);
    return $stmt->fetchAll();
}

function getCriterios(PDO $db, int $torneioId): array {
    $stmt = $db->prepare("SELECT criterio FROM torneio_criterios WHERE torneio_id = ? ORDER BY ordem ASC");
    $stmt->execute([$torneioId]);
    $rows = array_column($stmt->fetchAll(), 'criterio');
    return $rows ?: TORNEIO_CRITERIOS_DEFAULT;
}

function salvarCriterios(PDO $db, int $torneioId, array $criterios): void {
    foreach ($criterios as $c) {
        if (!in_array($c, TORNEIO_CRITERIOS_VALIDOS, true)) {
            throw new InvalidArgumentException("Critério inválido: $c");
        }
    }
    torneioTx($db, function (PDO $db) use ($torneioId, $criterios) {
        $db->prepare("DELETE FROM torneio_criterios WHERE torneio_id = ?")->execute([$torneioId]);
        $stmt = $db->prepare("INSERT INTO torneio_criterios (torneio_id, ordem, criterio) VALUES (?, ?, ?)");
        foreach (array_values($criterios) as $i => $c) {
            $stmt->execute([$torneioId, $i + 1, $c]);
        }
    });
}

// ─────────────────────────────────────────────────────────────────────────
// Standings — fonte canônica
// ─────────────────────────────────────────────────────────────────────────

/**
 * Calcula a classificação (swiss + equalização, ou o que estiver marcado
 * conta_classificacao=1). Bye nunca entra nas somas. Retorna lista ordenada
 * com decomposição de critérios aplicados entre posições adjacentes.
 */
function calcularClassificacao(PDO $db, int $torneioId): array {
    $torneio = getTorneio($db, $torneioId);
    if (!$torneio) throw new RuntimeException('Torneio não encontrado');

    $participantes = getParticipantes($db, $torneioId);
    $stats = [];
    foreach ($participantes as $p) {
        $stats[$p['time_id']] = [
            'time_id' => $p['time_id'], 'nome' => $p['nome'],
            'j' => 0, 'v' => 0, 'e' => 0, 'd' => 0,
            'gp' => 0, 'gc' => 0, 'sg' => 0, 'faltas' => 0, 'pontos' => 0.0,
            'byes' => 0, 'adversarios' => [],
        ];
    }

    $stmt = $db->prepare("
        SELECT j.* FROM torneio_jogos j
        JOIN torneio_fases f ON f.id = j.fase_id
        WHERE j.torneio_id = ? AND f.conta_classificacao = 1
    ");
    $stmt->execute([$torneioId]);
    $jogos = $stmt->fetchAll();

    $confrontos = []; // "a-b" (a<b) => ['vencedor'=>time_id|null (empate)]

    foreach ($jogos as $j) {
        $a = $j['time_a_id']; $b = $j['time_b_id'];
        if ((int)$j['is_bye'] === 1) {
            if ($a !== null && isset($stats[$a])) $stats[$a]['byes']++;
            continue; // bye NUNCA soma nada além do contador informativo
        }
        if ($j['status'] !== 'encerrado') continue;
        if ($a === null || $b === null || !isset($stats[$a]) || !isset($stats[$b])) continue;

        $pa = (int)$j['placar_a']; $pb = (int)$j['placar_b'];

        $stats[$a]['j']++; $stats[$b]['j']++;
        $stats[$a]['gp'] += $pa; $stats[$a]['gc'] += $pb;
        $stats[$b]['gp'] += $pb; $stats[$b]['gc'] += $pa;
        $stats[$a]['adversarios'][] = $b;
        $stats[$b]['adversarios'][] = $a;

        $key = $a < $b ? "$a-$b" : "$b-$a";
        if ($pa > $pb) {
            $stats[$a]['v']++; $stats[$b]['d']++;
            $confrontos[$key] = ['vencedor' => $a];
        } elseif ($pb > $pa) {
            $stats[$b]['v']++; $stats[$a]['d']++;
            $confrontos[$key] = ['vencedor' => $b];
        } else {
            $stats[$a]['e']++; $stats[$b]['e']++;
            $confrontos[$key] = ['vencedor' => null];
        }
    }

    // Faltas (só das fases que contam pra classificação)
    $stmt = $db->prepare("
        SELECT ev.time_id, COUNT(*) n
        FROM torneio_eventos_falta ev
        JOIN torneio_jogos j ON j.id = ev.jogo_id
        JOIN torneio_fases f ON f.id = j.fase_id
        WHERE ev.torneio_id = ? AND ev.removido = 0 AND f.conta_classificacao = 1
        GROUP BY ev.time_id
    ");
    $stmt->execute([$torneioId]);
    foreach ($stmt->fetchAll() as $row) {
        if (isset($stats[$row['time_id']])) $stats[$row['time_id']]['faltas'] = (int)$row['n'];
    }

    foreach ($stats as &$s) {
        $s['sg'] = $s['gp'] - $s['gc'];
        $s['pontos'] = $s['v'] * (float)$torneio['pontos_vitoria']
                     + $s['e'] * (float)$torneio['pontos_empate']
                     + $s['d'] * (float)$torneio['pontos_derrota'];
    }
    unset($s);

    // Buchholz: soma dos pontos ATUAIS dos adversários efetivamente enfrentados (sem bye).
    // `buchholz_detalhe` guarda a composição (adversário + pontos) pra transparência pública
    // (seção 8 do brief de área pública) — é só exposição do que já foi somado acima, nunca
    // um recálculo paralelo.
    foreach ($stats as &$s) {
        $soma = 0.0;
        $detalhe = [];
        foreach ($s['adversarios'] as $advId) {
            if (isset($stats[$advId])) {
                $soma += $stats[$advId]['pontos'];
                $detalhe[] = ['time_id' => $advId, 'nome' => $stats[$advId]['nome'], 'pontos' => $stats[$advId]['pontos']];
            }
        }
        $s['buchholz'] = $soma;
        $s['buchholz_detalhe'] = $detalhe;
    }
    unset($s);

    $criterios = getCriterios($db, $torneioId);
    $lista = array_values($stats);

    usort($lista, function ($a, $b) use ($criterios, $confrontos) {
        return compararTimesClassificacao($a, $b, $criterios, $confrontos);
    });

    $pos = 1;
    foreach ($lista as &$row) {
        $row['posicao'] = $pos++;
        $row['decisao'] = decompoeDecisao($row, $lista, $criterios, $confrontos);
        unset($row['adversarios']);
    }
    unset($row);

    return $lista;
}

/** Comparador determinístico time A vs time B segundo a ordem de critérios configurada. */
function compararTimesClassificacao(array $a, array $b, array $criterios, array $confrontos): int {
    foreach ($criterios as $crit) {
        $r = aplicaCriterio($crit, $a, $b, $confrontos);
        if ($r !== 0) return $r;
    }
    // Sorteio / manual — fallback determinístico e auditável (ordem por id)
    return $a['time_id'] <=> $b['time_id'];
}

function aplicaCriterio(string $crit, array $a, array $b, array $confrontos): int {
    switch ($crit) {
        case 'pontos':             return $b['pontos'] <=> $a['pontos'];
        case 'vitorias':           return $b['v'] <=> $a['v'];
        case 'empates':            return $b['e'] <=> $a['e'];
        case 'saldo':              return $b['sg'] <=> $a['sg'];
        case 'gols_pro':           return $b['gp'] <=> $a['gp'];
        case 'gols_contra_menos':  return $a['gc'] <=> $b['gc']; // menos é melhor
        case 'fair_play':          return $a['faltas'] <=> $b['faltas']; // menos é melhor
        case 'buchholz':           return $b['buchholz'] <=> $a['buchholz'];
        case 'confronto_direto':
            $key = $a['time_id'] < $b['time_id'] ? $a['time_id'] . '-' . $b['time_id'] : $b['time_id'] . '-' . $a['time_id'];
            if (!isset($confrontos[$key]) || $confrontos[$key]['vencedor'] === null) return 0; // não jogaram ou empate
            if ($confrontos[$key]['vencedor'] === $a['time_id']) return -1;
            if ($confrontos[$key]['vencedor'] === $b['time_id']) return 1;
            return 0;
        case 'sorteio':             return 0; // resolvido no fallback final (id)
        default:                    return 0;
    }
}

/**
 * Chave do critério (ex. "buchholz") que efetivamente separou ESTA linha da linha
 * imediatamente ABAIXO dela — nunca da linha acima. A indicação pertence a quem foi
 * colocado À FRENTE pelo critério, não a quem perdeu o desempate (seção 1 do brief de
 * tabela pública da Primeira Fase). Funciona para grupos de 3+ empatados porque cada linha
 * só explica sua própria margem sobre a próxima — comparação direta pelo MESMO comparador
 * usado pra ordenar (aplicaCriterio), nunca uma segunda implementação.
 *
 * Só retorna uma chave quando o critério responsável NÃO é o primeiro da ordem configurada
 * — se o primeiro critério (ex. Pontos) já separa as duas linhas, isso é a ordenação
 * primária normal, não um desempate, e não deve gerar indicação nenhuma (seção 8 do brief:
 * não mostrar hint sem necessidade). O frontend recebe a CHAVE crua (não um texto
 * formatado) e decide rótulo curto/tooltip a partir dela — nunca hardcode um critério
 * específico aqui nem lá.
 */
function decompoeDecisao(array $row, array $lista, array $criterios, array $confrontos): ?string {
    $idx = null;
    foreach ($lista as $i => $r) if ($r['time_id'] === $row['time_id']) { $idx = $i; break; }
    if ($idx === null || $idx === count($lista) - 1) return null; // última linha: nada abaixo pra explicar
    $abaixo = $lista[$idx + 1];
    foreach ($criterios as $i => $crit) {
        $r = aplicaCriterio($crit, $row, $abaixo, $confrontos);
        if ($r !== 0) {
            return $i === 0 ? null : $crit; // critério primário = ordenação normal, não desempate
        }
    }
    return null; // tudo empatado até o fallback de id — nenhum critério configurado pra apontar
}

// ─────────────────────────────────────────────────────────────────────────
// Artilharia / Fair Play
// ─────────────────────────────────────────────────────────────────────────

/**
 * Artilharia — soma apenas eventos tipo='normal' (gol com autoria confirmada).
 * 'sem_autoria' e 'gol_contra' nunca entram aqui (não têm dono a quem creditar).
 * @param string $escopo 'classificatoria' | 'torneio'
 */
function calcularArtilharia(PDO $db, int $torneioId, string $escopo = 'torneio'): array {
    $filtroFase = $escopo === 'classificatoria' ? "AND f.conta_classificacao = 1" : "";
    $stmt = $db->prepare("
        SELECT
            mt.id AS membro_id, p.nome AS atleta, p.foto_path, p.foto_atualizado_em,
            t.id AS time_id, t.nome AS time_nome,
            COUNT(*) AS gols,
            COUNT(DISTINCT ev.jogo_id) AS jogos_com_gol
        FROM torneio_eventos_gol ev
        JOIN torneio_jogos j ON j.id = ev.jogo_id
        JOIN torneio_fases f ON f.id = j.fase_id
        JOIN membros_time mt ON mt.id = ev.membro_id
        JOIN inscricoes i ON i.id = mt.inscricao_id
        JOIN pessoas p ON p.id = i.pessoa_id
        JOIN times t ON t.id = ev.time_id
        WHERE ev.torneio_id = ? AND ev.removido = 0 AND ev.tipo = 'normal' $filtroFase
        GROUP BY mt.id
        ORDER BY gols DESC, atleta ASC
    ");
    $stmt->execute([$torneioId]);
    $out = [];
    $pos = 1;
    foreach ($stmt->fetchAll() as $row) {
        $row['gols'] = (int)$row['gols'];
        $row['posicao'] = $pos++;
        $row['foto'] = urlComCacheBust($row['foto_path'] ?? null, $row['foto_atualizado_em'] ?? null);
        unset($row['foto_path'], $row['foto_atualizado_em']);
        $out[] = $row;
    }
    return $out;
}

/** @param string $escopo 'classificatoria' | 'torneio' */
function calcularFairPlayTimes(PDO $db, int $torneioId, string $escopo = 'torneio'): array {
    $filtroFase = $escopo === 'classificatoria' ? "AND f.conta_classificacao = 1" : "";
    $participantes = getParticipantes($db, $torneioId);
    $stmt = $db->prepare("
        SELECT j.torneio_id, ev.time_id, COUNT(*) n
        FROM torneio_eventos_falta ev
        JOIN torneio_jogos j ON j.id = ev.jogo_id
        JOIN torneio_fases f ON f.id = j.fase_id
        WHERE ev.torneio_id = ? AND ev.removido = 0 $filtroFase
        GROUP BY ev.time_id
    ");
    $stmt->execute([$torneioId]);
    $faltasPorTime = array_column($stmt->fetchAll(), 'n', 'time_id');

    $stmtJ = $db->prepare("
        SELECT time_a_id, time_b_id FROM torneio_jogos j
        JOIN torneio_fases f ON f.id = j.fase_id
        WHERE j.torneio_id = ? AND j.is_bye = 0 AND j.status = 'encerrado' $filtroFase
    ");
    $stmtJ->execute([$torneioId]);
    $jogosPorTime = [];
    foreach ($stmtJ->fetchAll() as $row) {
        foreach ([$row['time_a_id'], $row['time_b_id']] as $tid) {
            if ($tid !== null) $jogosPorTime[$tid] = ($jogosPorTime[$tid] ?? 0) + 1;
        }
    }

    $out = [];
    foreach ($participantes as $p) {
        $tid = $p['time_id'];
        $faltas = (int)($faltasPorTime[$tid] ?? 0);
        $jogos = (int)($jogosPorTime[$tid] ?? 0);
        $out[] = [
            'time_id' => $tid, 'nome' => $p['nome'],
            'jogos' => $jogos, 'faltas' => $faltas,
            'media' => $jogos > 0 ? round($faltas / $jogos, 2) : 0.0,
        ];
    }
    usort($out, fn($a, $b) => $a['faltas'] <=> $b['faltas']); // menos faltas = melhor
    $pos = 1;
    foreach ($out as &$r) { $r['posicao'] = $pos++; }
    return $out;
}

function calcularFaltasIndividuais(PDO $db, int $torneioId, string $escopo = 'torneio'): array {
    $filtroFase = $escopo === 'classificatoria' ? "AND f.conta_classificacao = 1" : "";
    $stmt = $db->prepare("
        SELECT mt.id AS membro_id, p.nome AS atleta, t.id AS time_id, t.nome AS time_nome, COUNT(*) AS faltas
        FROM torneio_eventos_falta ev
        JOIN torneio_jogos j ON j.id = ev.jogo_id
        JOIN torneio_fases f ON f.id = j.fase_id
        JOIN membros_time mt ON mt.id = ev.membro_id
        JOIN inscricoes i ON i.id = mt.inscricao_id
        JOIN pessoas p ON p.id = i.pessoa_id
        JOIN times t ON t.id = ev.time_id
        WHERE ev.torneio_id = ? AND ev.removido = 0 $filtroFase
        GROUP BY mt.id
        ORDER BY faltas DESC, atleta ASC
    ");
    $stmt->execute([$torneioId]);
    return array_map(fn($r) => $r + ['faltas' => (int)$r['faltas']], $stmt->fetchAll());
}

/**
 * Fonte canônica de "qual partida deve estar em destaque agora" — status manda mais
 * que ordem de programação (brief de acabamento 3, regra de ouro: STATUS > ORDEM).
 * Usada tanto pelo endpoint público (home /torneio e /torneio/placar) quanto pelo
 * admin (aviso de múltiplas partidas em andamento). Nunca duplicar esta regra em
 * componente React — toda tela consome o resultado dela, nenhuma reimplementa.
 *
 * Prioridade: 1) em_andamento (>1? pega a de início real mais recente, sinaliza) ·
 * 2) próxima agendado (ordem de calendário) · 3) fallback: última encerrada.
 *
 * `atrasado` NÃO é candidato: marcar um jogo como atrasado é justamente a forma de
 * dizer "não é este que está no ar agora", liberando o placar para o próximo agendado
 * sem precisar iniciar o jogo seguinte só para ele aparecer. O status continua existindo
 * e visível na programação; quando o jogo for realmente acontecer, vira em_andamento e
 * reassume o destaque com prioridade absoluta.
 *
 * @return array{jogo: ?array, multiplas_em_andamento: bool, todas_em_andamento: array, todas: array}
 */
function resolverPartidaDestaque(PDO $db, int $torneioId): array {
    $stmt = $db->prepare("
        SELECT j.*, f.tipo AS fase_tipo, f.rodada AS fase_rodada, f.rotulo AS fase_rotulo,
               ta.nome AS time_a_nome, tb.nome AS time_b_nome,
               ta.logo_path AS time_a_logo_path, ta.logo_atualizado_em AS time_a_logo_atualizado_em,
               tb.logo_path AS time_b_logo_path, tb.logo_atualizado_em AS time_b_logo_atualizado_em
        FROM torneio_jogos j
        JOIN torneio_fases f ON f.id = j.fase_id
        LEFT JOIN times ta ON ta.id = j.time_a_id
        LEFT JOIN times tb ON tb.id = j.time_b_id
        WHERE j.torneio_id = ? AND j.is_bye = 0
        ORDER BY f.id ASC, j.ordem ASC
    ");
    $stmt->execute([$torneioId]);
    $todas = $stmt->fetchAll();

    $porStatus = fn(string $status) => array_values(array_filter($todas, fn($j) => $j['status'] === $status));

    $emAndamento = $porStatus('em_andamento');
    if ($emAndamento) {
        // Nunca decide por ordem — se houver mais de uma (não deveria, operacionalmente),
        // prioriza a de início real mais recente e sinaliza a inconsistência pro admin.
        usort($emAndamento, fn($a, $b) => strcmp((string)($b['horario_inicio_real'] ?? $b['criado_em']), (string)($a['horario_inicio_real'] ?? $a['criado_em'])));
        return ['jogo' => $emAndamento[0], 'multiplas_em_andamento' => count($emAndamento) > 1, 'todas_em_andamento' => $emAndamento, 'todas' => $todas];
    }

    // Uma partida futura pode existir topologicamente sem ter recebido ainda os dois
    // participantes. Ela não entra na fila operacional até estar efetivamente pronta.
    $agendados = array_values(array_filter($porStatus('agendado'), fn($j) => $j['time_a_id'] !== null && $j['time_b_id'] !== null));
    if ($agendados) return ['jogo' => $agendados[0], 'multiplas_em_andamento' => false, 'todas_em_andamento' => [], 'todas' => $todas];

    $encerradas = $porStatus('encerrado');
    if ($encerradas) {
        usort($encerradas, fn($a, $b) => strcmp((string)($b['horario_fim_real'] ?? $b['atualizado_em']), (string)($a['horario_fim_real'] ?? $a['atualizado_em'])));
        return ['jogo' => $encerradas[0], 'multiplas_em_andamento' => false, 'todas_em_andamento' => [], 'todas' => $todas];
    }

    return ['jogo' => null, 'multiplas_em_andamento' => false, 'todas_em_andamento' => [], 'todas' => $todas];
}

/**
 * Próximo jogo AGENDADO depois do destaque atual, na ordem de calendário — nunca
 * outra partida em_andamento (a faixa "próximo jogo" da tela de placar não pode
 * exibir uma que já está rolando). Sem destaque ou sem próximo agendado: null.
 */
function resolverProximoJogo(array $todas, ?array $destaque): ?array {
    if (!$destaque) return null;
    $achouDestaque = false;
    foreach ($todas as $j) {
        if (!$achouDestaque) {
            if ((int)$j['id'] === (int)$destaque['id']) $achouDestaque = true;
            continue;
        }
        if ($j['status'] === 'agendado' && $j['time_a_id'] !== null && $j['time_b_id'] !== null) return $j;
    }
    return null;
}

/**
 * Fonte canônica do campeão definitivo para todas as superfícies de leitura.
 * Se GF2 existe, somente ela pode decidir; sem GF2, a GF só decide quando o
 * torneio já foi marcado FINALIZADO. Nenhuma progressão é calculada aqui.
 */
function resolverCampeaoOficial(array $torneio, array $jogos): ?array {
    $porCodigo = [];
    foreach ($jogos as $jogo) {
        if (in_array($jogo['codigo'] ?? null, ['GF', 'GF2'], true)) $porCodigo[$jogo['codigo']] = $jogo;
    }

    if (isset($porCodigo['GF2'])) {
        $gf2 = $porCodigo['GF2'];
        if (($gf2['status'] ?? null) !== 'encerrado' || ($gf2['vencedor_time_id'] ?? null) === null) return null;
        $jogoTitulo = $gf2;
    } else {
        $gf = $porCodigo['GF'] ?? null;
        if (($torneio['estado'] ?? null) !== 'FINALIZADO' || !$gf || ($gf['status'] ?? null) !== 'encerrado' || ($gf['vencedor_time_id'] ?? null) === null) return null;
        $jogoTitulo = $gf;
    }

    $ladoA = (int)$jogoTitulo['vencedor_time_id'] === (int)$jogoTitulo['time_a_id'];
    return [
        'time_id' => (int)$jogoTitulo['vencedor_time_id'],
        'nome' => $ladoA ? $jogoTitulo['time_a_nome'] : $jogoTitulo['time_b_nome'],
        'logo_path' => $ladoA ? ($jogoTitulo['time_a_logo_path'] ?? null) : ($jogoTitulo['time_b_logo_path'] ?? null),
        'logo_atualizado_em' => $ladoA ? ($jogoTitulo['time_a_logo_atualizado_em'] ?? null) : ($jogoTitulo['time_b_logo_atualizado_em'] ?? null),
        'jogo_codigo' => $jogoTitulo['codigo'],
    ];
}

/**
 * Pódio final da Double, derivado exclusivamente dos resultados oficiais já
 * persistidos. 1º/2º vêm do jogo que decidiu o título (GF ou GF2); 3º é o
 * eliminado em B6, a Final da Losers. Não recalcula progressão.
 */
function resolverPodioOficial(array $torneio, array $jogos): array {
    $campeao = resolverCampeaoOficial($torneio, $jogos);
    if (!$campeao) return [];

    $porCodigo = [];
    foreach ($jogos as $jogo) $porCodigo[$jogo['codigo'] ?? ''] = $jogo;
    $decisao = isset($porCodigo['GF2']) ? $porCodigo['GF2'] : ($porCodigo['GF'] ?? null);
    $b6 = $porCodigo['B6'] ?? null;
    if (!$decisao || ($decisao['status'] ?? null) !== 'encerrado') return [];

    $dadosTime = static function (int $timeId, array $fontes): ?array {
        foreach ($fontes as $jogo) {
            if (!$jogo) continue;
            foreach (['a', 'b'] as $lado) {
                if ((int)($jogo["time_{$lado}_id"] ?? 0) !== $timeId) continue;
                return [
                    'time_id' => $timeId,
                    'nome' => $jogo["time_{$lado}_nome"] ?? ('Time ' . $timeId),
                    'logo_path' => $jogo["time_{$lado}_logo_path"] ?? null,
                    'logo_atualizado_em' => $jogo["time_{$lado}_logo_atualizado_em"] ?? null,
                ];
            }
        }
        return null;
    };

    $campeaoId = (int)$campeao['time_id'];
    $viceId = (int)$decisao['time_a_id'] === $campeaoId ? (int)$decisao['time_b_id'] : (int)$decisao['time_a_id'];
    $terceiroId = 0;
    if ($b6 && ($b6['status'] ?? null) === 'encerrado' && ($b6['vencedor_time_id'] ?? null) !== null) {
        $terceiroId = (int)$b6['time_a_id'] === (int)$b6['vencedor_time_id'] ? (int)$b6['time_b_id'] : (int)$b6['time_a_id'];
    }

    $podio = [];
    foreach ([[1, $campeaoId], [2, $viceId], [3, $terceiroId]] as [$posicao, $timeId]) {
        if ($timeId <= 0) continue;
        $time = $dadosTime($timeId, [$decisao, $b6]);
        if ($time) $podio[] = array_merge(['posicao' => $posicao], $time);
    }
    return $podio;
}
