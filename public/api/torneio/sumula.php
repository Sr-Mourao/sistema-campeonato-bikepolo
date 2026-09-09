<?php
/**
 * Súmula digital: ciclo de vida da partida, gols, faltas.
 * Toda escrita passa por transaction + audit log. Eventos são soft-delete
 * (removido=1) — nunca DELETE físico, pra manter o histórico auditável.
 */

require_once __DIR__ . '/lib.php';
require_once __DIR__ . '/bracket.php';

const TORNEIO_STATUS_JOGO = ['agendado', 'atrasado', 'chamado', 'em_andamento', 'encerrado', 'wo', 'cancelado'];

function getJogo(PDO $db, int $torneioId, int $jogoId): ?array {
    $stmt = $db->prepare("
        SELECT j.*, f.tipo AS fase_tipo, f.rodada AS fase_rodada, f.conta_classificacao,
               ta.nome AS time_a_nome, tb.nome AS time_b_nome
        FROM torneio_jogos j JOIN torneio_fases f ON f.id = j.fase_id
        LEFT JOIN times ta ON ta.id = j.time_a_id
        LEFT JOIN times tb ON tb.id = j.time_b_id
        WHERE j.torneio_id = ? AND j.id = ?
    ");
    $stmt->execute([$torneioId, $jogoId]);
    $row = $stmt->fetch();
    return $row ?: null;
}

const TORNEIO_TIPOS_GOL = ['normal', 'sem_autoria', 'gol_contra'];

/**
 * Garante que $timeId está no jogo e que o atleta pertence a esse time E está
 * elegível (inscrição não cancelada). Único ponto de validação de elegibilidade
 * — usado tanto pela súmula manual quanto pela simulação, nunca contornado.
 */
function validaMembroDoTime(PDO $db, array $jogo, int $timeId, int $membroId): void {
    if ($timeId !== (int)$jogo['time_a_id'] && $timeId !== (int)$jogo['time_b_id']) {
        throw new InvalidArgumentException('Esse time não está nesta partida.');
    }
    $stmt = $db->prepare("
        SELECT mt.time_id, i.status
        FROM membros_time mt JOIN inscricoes i ON i.id = mt.inscricao_id
        WHERE mt.id = ?
    ");
    $stmt->execute([$membroId]);
    $row = $stmt->fetch();
    if (!$row || (int)$row['time_id'] !== $timeId) {
        throw new InvalidArgumentException('Esse atleta não pertence a este time.');
    }
    if ($row['status'] === 'cancelado') {
        throw new InvalidArgumentException('Este atleta está com inscrição cancelada e não pode participar da súmula.');
    }
}

/**
 * @param string $tipo 'normal' (exige $membroId elegível do time), 'sem_autoria'
 *                      ou 'gol_contra' (ambos sempre com $membroId = null — sem
 *                      atribuição individual, nunca somam artilharia).
 */
function registrarGol(PDO $db, int $torneioId, int $jogoId, int $timeId, ?int $membroId, string $tipo, ?int $minuto, string $usuario): array {
    return torneioTx($db, function (PDO $db) use ($torneioId, $jogoId, $timeId, $membroId, $tipo, $minuto, $usuario) {
        if (!in_array($tipo, TORNEIO_TIPOS_GOL, true)) throw new InvalidArgumentException('Tipo de gol inválido.');

        $jogo = getJogo($db, $torneioId, $jogoId);
        if (!$jogo) throw new RuntimeException('Partida não encontrada.');
        if ($jogo['status'] === 'encerrado' || $jogo['status'] === 'cancelado') {
            throw new RuntimeException('Partida já encerrada/cancelada — reabra antes de editar eventos.');
        }
        if ($timeId !== (int)$jogo['time_a_id'] && $timeId !== (int)$jogo['time_b_id']) {
            throw new InvalidArgumentException('Esse time não está nesta partida.');
        }

        if ($tipo === 'normal') {
            if ($membroId === null) throw new InvalidArgumentException('Selecione o atleta que fez o gol.');
            validaMembroDoTime($db, $jogo, $timeId, $membroId);
        } else {
            $membroId = null; // sem_autoria e gol_contra nunca têm autor (ver seção 7 do brief)
        }

        $stmt = $db->prepare("
            INSERT INTO torneio_eventos_gol (torneio_id, jogo_id, time_id, membro_id, tipo, contra, minuto, criado_por)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$torneioId, $jogoId, $timeId, $membroId, $tipo, $tipo === 'gol_contra' ? 1 : 0, $minuto, $usuario]);
        $eventoId = (int)$db->lastInsertId();

        torneioAuditoria($db, $torneioId, $usuario, 'registrar_gol', 'torneio_eventos_gol', $eventoId, null,
            ['jogo_id' => $jogoId, 'time_id' => $timeId, 'membro_id' => $membroId, 'tipo' => $tipo], null);

        return ['evento_id' => $eventoId];
    });
}

function registrarFalta(PDO $db, int $torneioId, int $jogoId, int $timeId, int $membroId, string $usuario): array {
    return torneioTx($db, function (PDO $db) use ($torneioId, $jogoId, $timeId, $membroId, $usuario) {
        $jogo = getJogo($db, $torneioId, $jogoId);
        if (!$jogo) throw new RuntimeException('Partida não encontrada.');
        if ($jogo['status'] === 'encerrado' || $jogo['status'] === 'cancelado') {
            throw new RuntimeException('Partida já encerrada/cancelada — reabra antes de editar eventos.');
        }
        validaMembroDoTime($db, $jogo, $timeId, $membroId);

        $stmt = $db->prepare("
            INSERT INTO torneio_eventos_falta (torneio_id, jogo_id, time_id, membro_id, criado_por)
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute([$torneioId, $jogoId, $timeId, $membroId, $usuario]);
        $eventoId = (int)$db->lastInsertId();

        torneioAuditoria($db, $torneioId, $usuario, 'registrar_falta', 'torneio_eventos_falta', $eventoId, null,
            ['jogo_id' => $jogoId, 'time_id' => $timeId, 'membro_id' => $membroId], null);

        return ['evento_id' => $eventoId];
    });
}

function removerEvento(PDO $db, int $torneioId, string $tipo, int $eventoId, string $usuario): void {
    $tabela = $tipo === 'gol' ? 'torneio_eventos_gol' : ($tipo === 'falta' ? 'torneio_eventos_falta' : null);
    if (!$tabela) throw new InvalidArgumentException('Tipo de evento inválido');

    torneioTx($db, function (PDO $db) use ($tabela, $tipo, $torneioId, $eventoId, $usuario) {
        $stmt = $db->prepare("SELECT * FROM $tabela WHERE id = ? AND torneio_id = ?");
        $stmt->execute([$eventoId, $torneioId]);
        $evento = $stmt->fetch();
        if (!$evento) throw new RuntimeException('Evento não encontrado.');
        if ((int)$evento['removido'] === 1) return; // idempotente

        $db->prepare("UPDATE $tabela SET removido = 1, removido_em = datetime('now'), removido_por = ? WHERE id = ?")
           ->execute([$usuario, $eventoId]);

        torneioAuditoria($db, $torneioId, $usuario, "remover_$tipo", $tabela, $eventoId, $evento, ['removido' => true], null);
    });
}

/** Recalcula placar_a/placar_b a partir da soma de eventos de gol não removidos. */
function recalcularPlacarDeEventos(PDO $db, int $torneioId, int $jogoId): array {
    $jogo = getJogo($db, $torneioId, $jogoId);
    if (!$jogo) throw new RuntimeException('Partida não encontrada.');

    $stmt = $db->prepare("SELECT time_id, COUNT(*) n FROM torneio_eventos_gol WHERE jogo_id = ? AND removido = 0 GROUP BY time_id");
    $stmt->execute([$jogoId]);
    $porTime = array_column($stmt->fetchAll(), 'n', 'time_id');

    $placarA = (int)($porTime[$jogo['time_a_id']] ?? 0);
    $placarB = (int)($porTime[$jogo['time_b_id']] ?? 0);

    $db->prepare("UPDATE torneio_jogos SET placar_a = ?, placar_b = ?, atualizado_em = datetime('now') WHERE id = ?")
       ->execute([$placarA, $placarB, $jogoId]);

    return ['placar_a' => $placarA, 'placar_b' => $placarB];
}

/**
 * Atualiza status/placar da partida. Se status='encerrado', calcula o vencedor e:
 * - bloqueia empate em fases eliminatórias (repescagem/double) a menos que $overtime=true
 *   force um vencedor (placar não pode ficar empatado mesmo com overtime — overtime só
 *   sinaliza que o resultado foi decidido em prorrogação/gol de ouro).
 * - dispara resolverPendencias() e, se for o jogo 'GF', talvezGerarGF2().
 */
function atualizarPartida(PDO $db, int $torneioId, int $jogoId, array $campos, string $usuario): array {
    return torneioTx($db, function (PDO $db) use ($torneioId, $jogoId, $campos, $usuario) {
        $jogo = getJogo($db, $torneioId, $jogoId);
        if (!$jogo) throw new RuntimeException('Partida não encontrada.');
        if ((int)$jogo['is_bye'] === 1) throw new RuntimeException('Jogo de bye não pode ser editado como partida.');

        $status = $campos['status'] ?? $jogo['status'];
        if (!in_array($status, TORNEIO_STATUS_JOGO, true)) throw new InvalidArgumentException('Status inválido.');

        $placarA = array_key_exists('placar_a', $campos) ? $campos['placar_a'] : $jogo['placar_a'];
        $placarB = array_key_exists('placar_b', $campos) ? $campos['placar_b'] : $jogo['placar_b'];
        $overtime = array_key_exists('overtime', $campos) ? (bool)$campos['overtime'] : (bool)$jogo['overtime'];

        $vencedorId = null; // qualquer status != 'encerrado' não tem vencedor (evita ficar "preso" num undo/reabertura)
        if ($status === 'encerrado') {
            if ($placarA === null || $placarB === null) {
                throw new RuntimeException('Informe o placar antes de encerrar a partida.');
            }
            $eliminatoria = in_array($jogo['fase_tipo'], ['repescagem', 'double'], true);
            if ($eliminatoria && (int)$placarA === (int)$placarB) {
                throw new RuntimeException('Esta fase é eliminatória — a partida não pode terminar empatada. Registre o resultado da prorrogação/gol de ouro.');
            }
            if ((int)$placarA > (int)$placarB) $vencedorId = $jogo['time_a_id'];
            elseif ((int)$placarB > (int)$placarA) $vencedorId = $jogo['time_b_id'];
            else $vencedorId = null; // empate permitido na classificatória
        }

        $estadoAnterior = [
            'status' => $jogo['status'], 'placar_a' => $jogo['placar_a'], 'placar_b' => $jogo['placar_b'],
            'vencedor_time_id' => $jogo['vencedor_time_id'],
        ];

        // Aviso não-bloqueante (seção 3 do brief de acabamento 3): nunca impede o operador
        // de iniciar a partida, só sinaliza se já existe outra em_andamento — decisão de
        // qual é "a" partida atual é resolvida por resolverPartidaDestaque(), não aqui.
        $aviso = null;
        if ($status === 'em_andamento' && $jogo['status'] !== 'em_andamento') {
            $stmtOutras = $db->prepare("SELECT codigo FROM torneio_jogos WHERE torneio_id = ? AND status = 'em_andamento' AND id != ?");
            $stmtOutras->execute([$torneioId, $jogoId]);
            $outras = $stmtOutras->fetchAll(PDO::FETCH_COLUMN);
            if ($outras) $aviso = 'Já existe outra partida em andamento: ' . implode(', ', $outras) . '. Confira se isso é intencional.';
        }

        // horario_inicio_real: aceita override explícito, senão carimba datetime('now') na
        // primeira vez que a partida entra em 'em_andamento' (é o "INICIAR PARTIDA" da súmula)
        // — nunca sobrescreve um horário já registrado.
        $stmt = $db->prepare("
            UPDATE torneio_jogos
            SET status = ?, placar_a = ?, placar_b = ?, vencedor_time_id = ?, overtime = ?,
                horario_inicio_real = COALESCE(?, CASE WHEN ? = 'em_andamento' THEN COALESCE(horario_inicio_real, datetime('now')) ELSE horario_inicio_real END),
                horario_fim_real = CASE WHEN ? = 'encerrado' THEN COALESCE(horario_fim_real, datetime('now')) ELSE horario_fim_real END,
                observacoes = COALESCE(?, observacoes),
                atualizado_em = datetime('now')
            WHERE id = ?
        ");
        $stmt->execute([
            $status, $placarA, $placarB, $vencedorId, $overtime ? 1 : 0,
            $campos['horario_inicio_real'] ?? null,
            $status,
            $status,
            $campos['observacoes'] ?? null,
            $jogoId,
        ]);

        $estadoNovo = ['status' => $status, 'placar_a' => $placarA, 'placar_b' => $placarB, 'vencedor_time_id' => $vencedorId];
        torneioAuditoria($db, $torneioId, $usuario, 'atualizar_partida', 'torneio_jogos', $jogoId, $estadoAnterior, $estadoNovo, $campos['motivo'] ?? null);

        $resolvidos = [];
        if ($status === 'encerrado') {
            $resolvidos = resolverPendencias($db, $torneioId);
            if ($jogo['codigo'] === 'GF') {
                talvezGerarGF2($db, $torneioId, $usuario);
            }
            if ($jogo['codigo'] === 'GF2') {
                $db->prepare("UPDATE torneios SET estado='FINALIZADO', atualizado_em=datetime('now') WHERE id=?")
                   ->execute([$torneioId]);
            }
        }

        return ['jogo_id' => $jogoId, 'status' => $status, 'vencedor_time_id' => $vencedorId, 'resolvidos' => $resolvidos, 'aviso' => $aviso];
    });
}

/**
 * Times + elenco ELEGÍVEL (via membros_time -> inscricoes -> pessoas) de uma
 * partida, pra montar a súmula. Inscrição cancelada nunca aparece aqui — é o
 * mesmo filtro usado em admin/times.php, e o backend valida de novo em
 * validaMembroDoTime() na hora de gravar (nunca confia só nisto pra segurança).
 */
function getElencoPartida(PDO $db, int $torneioId, int $jogoId): array {
    $jogo = getJogo($db, $torneioId, $jogoId);
    if (!$jogo) throw new RuntimeException('Partida não encontrada.');

    $stmtElenco = $db->prepare("
        SELECT mt.id AS membro_id, mt.time_id, p.nome
        FROM membros_time mt
        JOIN inscricoes i ON i.id = mt.inscricao_id AND i.status != 'cancelado'
        JOIN pessoas p ON p.id = i.pessoa_id
        WHERE mt.time_id IN (?, ?)
        ORDER BY p.nome
    ");
    $stmtElenco->execute([$jogo['time_a_id'], $jogo['time_b_id']]);
    $elenco = $stmtElenco->fetchAll();

    // criado_em precisa de alias distinto (quando) — sem isso o SQLite recusa o ORDER BY
    // do UNION com "1st ORDER BY term does not match any column" por causa dos LEFT JOINs
    // em inscricoes/pessoas, que também têm coluna criado_em (ambiguidade na resolução).
    // `categoria` = gol/falta (o tipo de evento); `tipo` = classificação do gol
    // (normal/sem_autoria/gol_contra), sempre NULL pra faltas.
    $stmtEventos = $db->prepare("
        SELECT 'gol' AS categoria, ev.id, ev.time_id, ev.membro_id, ev.tipo, ev.minuto, ev.criado_em AS quando, p.nome AS atleta
        FROM torneio_eventos_gol ev
        LEFT JOIN membros_time mt ON mt.id = ev.membro_id
        LEFT JOIN inscricoes i ON i.id = mt.inscricao_id
        LEFT JOIN pessoas p ON p.id = i.pessoa_id
        WHERE ev.jogo_id = ? AND ev.removido = 0
        UNION ALL
        SELECT 'falta' AS categoria, ev.id, ev.time_id, ev.membro_id, NULL AS tipo, NULL AS minuto, ev.criado_em AS quando, p.nome AS atleta
        FROM torneio_eventos_falta ev
        LEFT JOIN membros_time mt ON mt.id = ev.membro_id
        LEFT JOIN inscricoes i ON i.id = mt.inscricao_id
        LEFT JOIN pessoas p ON p.id = i.pessoa_id
        WHERE ev.jogo_id = ? AND ev.removido = 0
        ORDER BY quando ASC
    ");
    $stmtEventos->execute([$jogoId, $jogoId]);
    $eventos = $stmtEventos->fetchAll();

    return ['jogo' => $jogo, 'elenco' => $elenco, 'eventos' => $eventos];
}
