<?php
/**
 * Simulação — ferramenta operacional do torneio normal (não existe mais um
 * contexto "sandbox" separado). Simular uma partida usa EXATAMENTE os mesmos
 * endpoints/funções que a súmula manual usa (registrarGol, registrarFalta,
 * atualizarPartida) — nunca escreve placar/estatística direto no banco. Isso
 * garante que súmula, standings, artilharia e fair play sempre derivam da
 * mesma fonte de eventos, seja o jogo preenchido manualmente ou simulado.
 */

require_once __DIR__ . '/lib.php';
require_once __DIR__ . '/sumula.php';

/** Placar pequeno e plausível pra bike polo (0–0 até ~5–5, raramente mais). */
function placarAleatorio(bool $permiteEmpate): array {
    $a = random_int(0, 5);
    $b = random_int(0, 5);
    if (!$permiteEmpate && $a === $b) {
        if (random_int(0, 1) === 0) $a++; else $b++;
    }
    return [$a, $b];
}

/** Membros elegíveis (inscrição não cancelada) de um time — mesmo filtro de getElencoPartida(). */
function elencoElegivel(PDO $db, int $timeId): array {
    $stmt = $db->prepare("
        SELECT mt.id FROM membros_time mt
        JOIN inscricoes i ON i.id = mt.inscricao_id AND i.status != 'cancelado'
        WHERE mt.time_id = ?
    ");
    $stmt->execute([$timeId]);
    return array_map('intval', array_column($stmt->fetchAll(), 'id'));
}

function nomeDoTime(PDO $db, int $timeId): string {
    $stmt = $db->prepare("SELECT nome FROM times WHERE id = ?");
    $stmt->execute([$timeId]);
    return (string)($stmt->fetchColumn() ?: "time #$timeId");
}

/** Gera $qtd eventos de gol pra $timeId, cada um com autor elegível sorteado (ou sem_autoria). */
function gerarGolsSimulados(PDO $db, int $torneioId, int $jogoId, int $timeId, int $qtd, array $elegiveis, string $usuario): void {
    for ($i = 0; $i < $qtd; $i++) {
        $temAutor = random_int(1, 100) <= 85; // maioria dos gols tem autor
        $membroId = $temAutor ? $elegiveis[array_rand($elegiveis)] : null;
        registrarGol($db, $torneioId, $jogoId, $timeId, $membroId, $membroId !== null ? 'normal' : 'sem_autoria', null, $usuario);
    }
}

/** Gera uma quantidade pequena e aleatória de faltas pra $timeId, sempre com autor elegível. */
function gerarFaltasSimuladas(PDO $db, int $torneioId, int $jogoId, int $timeId, array $elegiveis, string $usuario): void {
    $qtd = random_int(0, 3);
    for ($i = 0; $i < $qtd; $i++) {
        registrarFalta($db, $torneioId, $jogoId, $timeId, $elegiveis[array_rand($elegiveis)], $usuario);
    }
}

/**
 * Simula UMA partida real, do mesmo jeito que um operador faria na súmula:
 * gols individuais (com autoria válida), faltas individuais, depois encerra.
 * A soma dos eventos de gol bate exatamente com o placar final (mesmo número
 * gerado é usado nos dois lugares).
 */
function simularPartida(PDO $db, int $torneioId, int $jogoId, string $usuario): array {
    return torneioTx($db, function (PDO $db) use ($torneioId, $jogoId, $usuario) {
        $jogo = getJogo($db, $torneioId, $jogoId);
        if (!$jogo) throw new RuntimeException('Partida não encontrada.');
        if ((int)$jogo['is_bye'] === 1) throw new RuntimeException('Jogo de bye não pode ser simulado.');
        if ($jogo['status'] === 'encerrado' || $jogo['status'] === 'cancelado') {
            throw new RuntimeException('Esta partida já está encerrada — reabra antes de simular de novo.');
        }
        if ($jogo['time_a_id'] === null || $jogo['time_b_id'] === null) {
            throw new RuntimeException('Os times desta partida ainda não foram definidos (aguardando fase anterior).');
        }

        $timeAId = (int)$jogo['time_a_id'];
        $timeBId = (int)$jogo['time_b_id'];
        $elegiveisA = elencoElegivel($db, $timeAId);
        $elegiveisB = elencoElegivel($db, $timeBId);
        if (!$elegiveisA) throw new RuntimeException('Nenhum jogador elegível encontrado para o time ' . nomeDoTime($db, $timeAId) . ' — não é possível simular.');
        if (!$elegiveisB) throw new RuntimeException('Nenhum jogador elegível encontrado para o time ' . nomeDoTime($db, $timeBId) . ' — não é possível simular.');

        $eliminatoria = in_array($jogo['fase_tipo'], ['repescagem', 'double'], true);
        [$placarA, $placarB] = placarAleatorio(!$eliminatoria);

        gerarGolsSimulados($db, $torneioId, $jogoId, $timeAId, $placarA, $elegiveisA, $usuario);
        gerarGolsSimulados($db, $torneioId, $jogoId, $timeBId, $placarB, $elegiveisB, $usuario);
        gerarFaltasSimuladas($db, $torneioId, $jogoId, $timeAId, $elegiveisA, $usuario);
        gerarFaltasSimuladas($db, $torneioId, $jogoId, $timeBId, $elegiveisB, $usuario);

        atualizarPartida($db, $torneioId, $jogoId, [
            'status' => 'encerrado', 'placar_a' => $placarA, 'placar_b' => $placarB,
            'motivo' => 'Partida simulada (eventos gerados automaticamente, mesmo fluxo da súmula manual).',
        ], $usuario);

        return [
            'jogo_id' => $jogoId, 'codigo' => $jogo['codigo'],
            'placar_a' => $placarA, 'placar_b' => $placarB,
            'resumo' => "{$jogo['codigo']}: " . nomeDoTime($db, $timeAId) . " {$placarA} × {$placarB} " . nomeDoTime($db, $timeBId),
        ];
    });
}

/**
 * Simula todas as partidas ainda pendentes de uma fase (rodada suíça, equalização,
 * repescagem ou double) — pula byes e jogos sem os dois times ainda definidos.
 * Usada pelo botão "Simular partidas pendentes". Retorna só strings legíveis.
 */
function simularPartidasPendentes(PDO $db, int $torneioId, int $faseId, string $usuario): array {
    $stmt = $db->prepare("
        SELECT id FROM torneio_jogos
        WHERE torneio_id = ? AND fase_id = ? AND is_bye = 0
              AND status NOT IN ('encerrado', 'cancelado')
              AND time_a_id IS NOT NULL AND time_b_id IS NOT NULL
        ORDER BY ordem
    ");
    $stmt->execute([$torneioId, $faseId]);
    $ids = array_column($stmt->fetchAll(), 'id');

    if (!$ids) return ['Nenhuma partida pendente nesta fase.'];

    $log = [];
    foreach ($ids as $jogoId) {
        $r = simularPartida($db, $torneioId, (int)$jogoId, $usuario);
        $log[] = $r['resumo'];
    }
    return $log;
}
