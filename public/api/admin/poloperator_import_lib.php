<?php
/**
 * Matching Poloperator ↔ registros internos — lógica PURA (sem I/O de rede/arquivo),
 * reaproveitada tanto pelo preview (só relatório) quanto pela importação real (preview +
 * escreve). Ordem de preferência (seção 4 do brief de migração de mídia):
 *   1) poloperator_id já gravado numa associação anterior;
 *   2) nome normalizado ÚNICO entre os candidatos;
 *   3) sem match confiável → 'pendente'/'ambiguo', nunca herdado por adivinhação.
 * Requer normalizaNome() de public/api/midia/lib.php.
 */

/**
 * Casa uma lista de entidades externas (times OU atletas de UM time já associado — nunca
 * atletas sitewide) com candidatos internos. Ambos os lados precisam de `id`+`nome`
 * (externo usa a chave `name`, interno usa `nome`); interno também aceita
 * `poloperator_id` opcional (de uma associação anterior).
 *
 * @param array $externos lista de ['id' => string, 'name' => string, ...]
 * @param array $internos lista de ['id' => int, 'nome' => string, 'poloperator_id' => ?string, ...]
 * @param array $apelidos [nome externo => nome interno] (ex.: POLOPERATOR_APELIDOS) — consultado
 *                        só quando o nome externo não casa direto; via = 'apelido'.
 * @return array lista de ['externo' => ..., 'interno' => ?array, 'status' => 'associado'|'ambiguo'|'pendente', 'via' => ?string]
 */
function casarComInternos(array $externos, array $internos, array $apelidos = []): array {
    $porPoloperatorId = [];
    foreach ($internos as $i) {
        if (!empty($i['poloperator_id'])) $porPoloperatorId[$i['poloperator_id']] = $i;
    }
    $porNome = [];
    foreach ($internos as $i) {
        $porNome[normalizaNome($i['nome'])][] = $i;
    }
    $apelidoPorNome = [];
    foreach ($apelidos as $externo => $interno) $apelidoPorNome[normalizaNome($externo)] = normalizaNome($interno);

    $out = [];
    foreach ($externos as $ext) {
        $porId = $porPoloperatorId[$ext['id']] ?? null;
        if ($porId) {
            $out[] = ['externo' => $ext, 'interno' => $porId, 'status' => 'associado', 'via' => 'poloperator_id'];
            continue;
        }
        $nomeExt = normalizaNome($ext['name']);
        $candidatos = $porNome[$nomeExt] ?? [];
        $via = 'nome';
        if (!$candidatos && isset($apelidoPorNome[$nomeExt])) {
            $candidatos = $porNome[$apelidoPorNome[$nomeExt]] ?? [];
            $via = 'apelido';
        }
        if (count($candidatos) === 1) {
            $out[] = ['externo' => $ext, 'interno' => $candidatos[0], 'status' => 'associado', 'via' => $via];
        } elseif (count($candidatos) > 1) {
            $out[] = ['externo' => $ext, 'interno' => null, 'status' => 'ambiguo', 'via' => null];
        } else {
            $out[] = ['externo' => $ext, 'interno' => null, 'status' => 'pendente', 'via' => null];
        }
    }
    return $out;
}

/**
 * Aplica associações manuais confirmadas pelo admin (vindas do body da requisição) sobre
 * matches que o casamento automático deixou como 'ambiguo'/'pendente'. NUNCA sobrescreve
 * um match já 'associado' automaticamente — a confirmação manual só preenche lacunas.
 *
 * @param array $matches saída de casarComInternos()
 * @param array $confirmacoesPorExternoId [externo_id => interno_id]
 * @param array $internosPorId [interno_id => registro interno completo]
 */
function aplicarConfirmacoesManuais(array $matches, array $confirmacoesPorExternoId, array $internosPorId): array {
    foreach ($matches as &$m) {
        if ($m['status'] === 'associado') continue;
        $externoId = $m['externo']['id'] ?? null;
        if ($externoId !== null && isset($confirmacoesPorExternoId[$externoId], $internosPorId[$confirmacoesPorExternoId[$externoId]])) {
            $m['interno'] = $internosPorId[$confirmacoesPorExternoId[$externoId]];
            $m['status'] = 'associado';
            $m['via'] = 'manual';
        }
    }
    unset($m);
    return $matches;
}

/** Resumo numérico de uma lista de matches (times OU atletas) pro relatório do admin. */
function resumirMatches(array $matches, string $chaveImagemExterna): array {
    $encontrados = count($matches);
    $associados = 0; $pendentes = 0; $comImagem = 0;
    foreach ($matches as $m) {
        if ($m['status'] === 'associado') $associados++;
        else $pendentes++;
        if (!empty($m['externo'][$chaveImagemExterna])) $comImagem++;
    }
    return [
        'encontrados' => $encontrados,
        'associados' => $associados,
        'pendentes' => $pendentes,
        'com_imagem_externa' => $comImagem,
    ];
}

/**
 * Casa times externos com internos pelo ELENCO: cada atleta externo é casado com as pessoas
 * internas (poloperator_id > nome > apelido) e o time interno com mais atletas casados vence.
 * Vale mais que o nome e que um poloperator_id de time já gravado — a numeração do
 * Poloperator pode estar diferente da numeração interna durante ajustes na plataforma.
 * Sem nenhum atleta casado, ou empate entre dois times, mantém o casamento por id/nome.
 *
 * @param array $rosterPorTime [time_interno_id => lista de pessoas (id, nome, poloperator_id)]
 */
function casarTimesPorElenco(array $timesExternos, array $timesInternos, array $rosterPorTime, array $apelidos = []): array {
    $base = casarComInternos($timesExternos, $timesInternos);
    $internoPorId = array_column($timesInternos, null, 'id');
    $pessoas = [];
    $timeDaPessoa = [];
    foreach ($rosterPorTime as $timeId => $roster) {
        foreach ($roster as $p) { $pessoas[] = $p; $timeDaPessoa[$p['id']] = $timeId; }
    }
    foreach ($base as $i => $m) {
        $votos = [];
        foreach (casarComInternos($m['externo']['players'] ?? [], $pessoas, $apelidos) as $pm) {
            if ($pm['status'] !== 'associado') continue;
            $t = $timeDaPessoa[$pm['interno']['id']];
            $votos[$t] = ($votos[$t] ?? 0) + 1;
        }
        if (!$votos) continue;
        arsort($votos);
        $contagens = array_values($votos);
        if (count($contagens) > 1 && $contagens[0] === $contagens[1]) continue; // empate: não adivinha
        $vencedor = array_key_first($votos);
        if (!isset($internoPorId[$vencedor])) continue;
        $base[$i] = ['externo' => $m['externo'], 'interno' => $internoPorId[$vencedor], 'status' => 'associado', 'via' => 'elenco'];
    }
    return $base;
}
