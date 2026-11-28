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

/**
 * E-mail fictício (domínio reservado example.com, RFC 2606) para pessoas criadas sem
 * inscrição — mesma regra do scripts/db-seed-pior-2026.php, então os dois caminhos
 * reconhecem a mesma pessoa. Tabela fixa de acentos: iconv//TRANSLIT varia por SO.
 */
function emailFicticioPior(string $nome): string {
    $slug = strtr($nome, ['á'=>'a','à'=>'a','â'=>'a','ã'=>'a','é'=>'e','ê'=>'e','í'=>'i','ó'=>'o','ô'=>'o','õ'=>'o','ú'=>'u','ü'=>'u','ç'=>'c',
                          'Á'=>'A','À'=>'A','Â'=>'A','Ã'=>'A','É'=>'E','Ê'=>'E','Í'=>'I','Ó'=>'O','Ô'=>'O','Õ'=>'O','Ú'=>'U','Ç'=>'C']);
    $slug = strtolower(preg_replace('/[^a-z0-9]+/i', '.', $slug));
    return trim($slug, '.') . '@pior.example.com';
}

/**
 * Plano (sem I/O) para trazer os times e atletas do Poloperator para o cadastro interno —
 * o Poloperator é a base. Nunca apaga nem move ninguém de time: o que diverge vira aviso.
 *
 * @param array $timesExternos  times do Poloperator (id, name, players[id,name,photoPath])
 * @param array $timesInternos  times internos da categoria (id, nome, poloperator_id)
 * @param array $rosterPorTime  [time_id => pessoas (id, nome, poloperator_id)]
 * @param array $pessoasSemTime pessoas da categoria ainda sem time (id, nome, poloperator_id)
 * @param array $apelidos       [nome no Poloperator => apelido interno]
 * @return array{times: array, resumo: array}
 *   times[] = ['externo' => [id,name], 'acao' => 'existe'|'criar', 'interno' => ?[id,nome], 'nome' => string,
 *              'atletas' => [['externo' => [...], 'acao' => 'no_time'|'adicionar'|'criar'|'outro_time'|'ambiguo',
 *                             'pessoa' => ?[id,nome], 'nome' => string, 'outro_time' => ?string]]]
 */
function planejarTimesPoloperator(array $timesExternos, array $timesInternos, array $rosterPorTime, array $pessoasSemTime, array $apelidos = []): array {
    $casados = casarTimesPorElenco($timesExternos, $timesInternos, $rosterPorTime, $apelidos);
    $nomeTime = array_column($timesInternos, 'nome', 'id');
    $timeDaPessoa = [];
    $pessoas = [];
    foreach ($rosterPorTime as $timeId => $roster) {
        foreach ($roster as $p) { $pessoas[] = $p; $timeDaPessoa[$p['id']] = (int)$timeId; }
    }
    foreach ($pessoasSemTime as $p) $pessoas[] = $p;
    $apelidoNorm = [];
    foreach ($apelidos as $ext => $int) $apelidoNorm[normalizaNome($ext)] = $int;

    $resumo = ['times_criar' => 0, 'atletas_criar' => 0, 'atletas_adicionar' => 0, 'avisos' => 0];
    $plano = [];
    foreach ($casados as $mt) {
        $ext = $mt['externo'];
        $timeInternoId = $mt['status'] === 'associado' ? (int)$mt['interno']['id'] : null;
        $item = [
            'externo' => ['id' => $ext['id'] ?? null, 'name' => trim((string)($ext['name'] ?? ''))],
            'acao' => $timeInternoId ? 'existe' : 'criar',
            'interno' => $timeInternoId ? ['id' => $timeInternoId, 'nome' => $nomeTime[$timeInternoId] ?? ''] : null,
            'nome' => $timeInternoId ? ($nomeTime[$timeInternoId] ?? '') : trim((string)($ext['name'] ?? '')),
            'atletas' => [],
        ];
        if (!$timeInternoId) $resumo['times_criar']++;

        foreach (casarComInternos($ext['players'] ?? [], $pessoas, $apelidos) as $pm) {
            $player = $pm['externo'];
            $nomeExt = trim((string)($player['name'] ?? ''));
            $linha = ['externo' => ['id' => $player['id'] ?? null, 'name' => $nomeExt, 'photoPath' => $player['photoPath'] ?? null],
                      'pessoa' => null, 'nome' => $apelidoNorm[normalizaNome($nomeExt)] ?? $nomeExt, 'outro_time' => null];
            if ($pm['status'] === 'ambiguo') {
                $linha['acao'] = 'ambiguo'; $resumo['avisos']++;
            } elseif ($pm['status'] === 'pendente') {
                $linha['acao'] = 'criar'; $resumo['atletas_criar']++;
            } else {
                $pessoa = $pm['interno'];
                $linha['pessoa'] = ['id' => (int)$pessoa['id'], 'nome' => $pessoa['nome']];
                $linha['nome'] = $pessoa['nome'];
                $atual = $timeDaPessoa[$pessoa['id']] ?? null;
                if ($atual === null) { $linha['acao'] = 'adicionar'; $resumo['atletas_adicionar']++; }
                elseif ($timeInternoId !== null && $atual === $timeInternoId) { $linha['acao'] = 'no_time'; }
                else { $linha['acao'] = 'outro_time'; $linha['outro_time'] = $nomeTime[$atual] ?? ''; $resumo['avisos']++; }
            }
            $item['atletas'][] = $linha;
        }
        $plano[] = $item;
    }
    usort($plano, fn($a, $b) => strnatcasecmp($a['nome'], $b['nome'])); // Time 1, Time 2, … Time 10
    return ['times' => $plano, 'resumo' => $resumo];
}
