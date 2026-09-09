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
 * @return array lista de ['externo' => ..., 'interno' => ?array, 'status' => 'associado'|'ambiguo'|'pendente', 'via' => ?string]
 */
function casarComInternos(array $externos, array $internos): array {
    $porPoloperatorId = [];
    foreach ($internos as $i) {
        if (!empty($i['poloperator_id'])) $porPoloperatorId[$i['poloperator_id']] = $i;
    }
    $porNome = [];
    foreach ($internos as $i) {
        $porNome[normalizaNome($i['nome'])][] = $i;
    }

    $out = [];
    foreach ($externos as $ext) {
        $porId = $porPoloperatorId[$ext['id']] ?? null;
        if ($porId) {
            $out[] = ['externo' => $ext, 'interno' => $porId, 'status' => 'associado', 'via' => 'poloperator_id'];
            continue;
        }
        $candidatos = $porNome[normalizaNome($ext['name'])] ?? [];
        if (count($candidatos) === 1) {
            $out[] = ['externo' => $ext, 'interno' => $candidatos[0], 'status' => 'associado', 'via' => 'nome'];
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
