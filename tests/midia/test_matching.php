<?php
// Matching Poloperator ↔ registros internos (migração de mídia) — casarComInternos() e
// aplicarConfirmacoesManuais(). Testes puros, sem rede/arquivo.

function test_normaliza_nome_ignora_acentos_caixa_espacos(): void {
    assertEqualsT('tainha malina', normalizaNome('Tainha Malina'), 'Caixa deve ser ignorada');
    assertEqualsT('poneis malditos', normalizaNome('Pôneis  Malditos'), 'Acento e espaço duplo devem ser normalizados');
    assertEqualsT('joao', normalizaNome('  João  '), 'Espaços nas pontas devem ser removidos');
    echo "OK: test_normaliza_nome_ignora_acentos_caixa_espacos\n";
}

// poloperator_id já gravado tem prioridade sobre nome, mesmo que os nomes não batam mais
// (ex.: time renomeado depois da primeira importação).
function test_casar_por_poloperator_id_tem_prioridade_sobre_nome(): void {
    $externos = [['id' => 'ext-1', 'name' => 'Nome Novo Externo']];
    $internos = [['id' => 5, 'nome' => 'Nome Antigo Interno', 'poloperator_id' => 'ext-1']];
    $matches = casarComInternos($externos, $internos);
    assertEqualsT('associado', $matches[0]['status'], 'Deve casar mesmo com nomes diferentes, via poloperator_id');
    assertEqualsT(5, $matches[0]['interno']['id'], 'Interno correto deve ser o dono do poloperator_id');
    assertEqualsT('poloperator_id', $matches[0]['via'], 'Via deve indicar que foi por poloperator_id');
    echo "OK: test_casar_por_poloperator_id_tem_prioridade_sobre_nome\n";
}

function test_casar_por_nome_unico(): void {
    $externos = [['id' => 'ext-1', 'name' => 'Tainha Malina']];
    $internos = [
        ['id' => 1, 'nome' => 'Tainha Malina', 'poloperator_id' => null],
        ['id' => 2, 'nome' => 'Outro Time', 'poloperator_id' => null],
    ];
    $matches = casarComInternos($externos, $internos);
    assertEqualsT('associado', $matches[0]['status'], 'Nome único deve casar automaticamente');
    assertEqualsT(1, $matches[0]['interno']['id'], 'Deve casar com o time de nome igual');
    assertEqualsT('nome', $matches[0]['via'], 'Via deve indicar que foi por nome');
    echo "OK: test_casar_por_nome_unico\n";
}

// Dois times internos normalizam pro mesmo nome — NUNCA escolhe um por adivinhação.
function test_casar_nome_ambiguo_fica_pendente(): void {
    $externos = [['id' => 'ext-1', 'name' => 'Nemas']];
    $internos = [
        ['id' => 1, 'nome' => 'Nemas', 'poloperator_id' => null],
        ['id' => 2, 'nome' => 'NEMAS', 'poloperator_id' => null], // normaliza igual
    ];
    $matches = casarComInternos($externos, $internos);
    assertEqualsT('ambiguo', $matches[0]['status'], 'Dois candidatos com o mesmo nome normalizado devem ficar ambíguos');
    assertEqualsT(null, $matches[0]['interno'], 'Não deve escolher nenhum candidato por adivinhação');
    echo "OK: test_casar_nome_ambiguo_fica_pendente\n";
}

function test_casar_sem_correspondencia_fica_pendente(): void {
    $externos = [['id' => 'ext-1', 'name' => 'Time Que Não Existe Aqui']];
    $internos = [['id' => 1, 'nome' => 'Outro Time', 'poloperator_id' => null]];
    $matches = casarComInternos($externos, $internos);
    assertEqualsT('pendente', $matches[0]['status'], 'Sem candidato algum deve ficar pendente');
    echo "OK: test_casar_sem_correspondencia_fica_pendente\n";
}

// Confirmação manual só preenche o que ficou pendente/ambíguo — nunca sobrescreve um match
// já automático (a confirmação do admin é só pra fechar lacunas, não pra "corrigir" o resto).
function test_aplicar_confirmacoes_manuais_preenche_pendencia_sem_sobrescrever_associado(): void {
    $externos = [
        ['id' => 'ext-auto', 'name' => 'Time Certo'],
        ['id' => 'ext-pendente', 'name' => 'Nome Que Não Bate'],
    ];
    $internos = [
        ['id' => 1, 'nome' => 'Time Certo', 'poloperator_id' => null],
        ['id' => 2, 'nome' => 'Time Real Da Pendencia', 'poloperator_id' => null],
    ];
    $matches = casarComInternos($externos, $internos);
    assertEqualsT('associado', $matches[0]['status'], 'Pré-condição: primeiro já deve ter casado sozinho');
    assertEqualsT('pendente', $matches[1]['status'], 'Pré-condição: segundo deve estar pendente');

    $internosPorId = array_column($internos, null, 'id');
    // Tenta (indevidamente) sobrescrever o já-associado E confirma o pendente — só o pendente pode mudar.
    $confirmadas = casarComInternos($externos, $internos);
    $confirmadas = aplicarConfirmacoesManuais($confirmadas, ['ext-auto' => 2, 'ext-pendente' => 2], $internosPorId);

    assertEqualsT(1, $confirmadas[0]['interno']['id'], 'Match já automático nunca é sobrescrito por confirmação manual');
    assertEqualsT('associado', $confirmadas[1]['status'], 'Pendente confirmado manualmente deve virar associado');
    assertEqualsT(2, $confirmadas[1]['interno']['id'], 'Pendente deve associar ao interno_id confirmado');
    assertEqualsT('manual', $confirmadas[1]['via'], 'Via deve indicar associação manual');

    echo "OK: test_aplicar_confirmacoes_manuais_preenche_pendencia_sem_sobrescrever_associado\n";
}

// Apelido: nome completo no Poloperator casa com o apelido do cadastro interno.
function test_casar_por_apelido_quando_nome_difere(): void {
    $externos = [['id' => 'ext-1', 'name' => 'Larissa Torres'], ['id' => 'ext-2', 'name' => 'Mourão '], ['id' => 'ext-3', 'name' => 'Sem Apelido']];
    $internos = [
        ['id' => 1, 'nome' => 'Lari', 'poloperator_id' => null],
        ['id' => 2, 'nome' => 'Mourao', 'poloperator_id' => null],
    ];
    $m = casarComInternos($externos, $internos, ['Larissa Torres' => 'Lari']);
    assertEqualsT(['associado', 1, 'apelido'], [$m[0]['status'], $m[0]['interno']['id'], $m[0]['via']], 'Apelido deve casar Larissa Torres → Lari');
    assertEqualsT(['associado', 2, 'nome'], [$m[1]['status'], $m[1]['interno']['id'], $m[1]['via']], 'Acento/espaço ainda casam direto pelo nome');
    assertEqualsT('pendente', $m[2]['status'], 'Sem nome nem apelido fica pendente, nunca adivinhado');
    echo "OK: test_casar_por_apelido_quando_nome_difere\n";
}

// O nome direto tem prioridade: o apelido só é consultado quando não há candidato pelo nome.
function test_apelido_nao_sobrepoe_nome_direto(): void {
    $externos = [['id' => 'ext-1', 'name' => 'Ana']];
    $internos = [['id' => 1, 'nome' => 'Ana', 'poloperator_id' => null], ['id' => 2, 'nome' => 'Outra', 'poloperator_id' => null]];
    $m = casarComInternos($externos, $internos, ['Ana' => 'Outra']);
    assertEqualsT([1, 'nome'], [$m[0]['interno']['id'], $m[0]['via']], 'Nome direto vence o apelido');
    echo "OK: test_apelido_nao_sobrepoe_nome_direto\n";
}

// Os apelidos oficiais do 2° Pior cobrem exatamente os atletas do Poloperator cujo nome difere.
function test_apelidos_pior_2026_casam_nomes_do_poloperator(): void {
    $internos = [];
    foreach (['Jpg', 'Emily Ethel', 'Marcos', 'Ana', 'Dox', 'Fábio', 'Carla', 'Mendonça', 'Lari', 'Buratto', 'Mat', 'Kwy', 'Jay', 'Mourao', 'Aguidota', 'Vitinho', 'Gusta', 'Jantas', 'Lusca', 'Emi', 'Paulo'] as $i => $n) {
        $internos[] = ['id' => $i + 1, 'nome' => $n, 'poloperator_id' => null];
    }
    $nomesPolo = ['João Pedro Gnoatto Lopes', 'Emily Ethel Chika', 'Marcos Normelio Antunes da Costa ', 'Ana Carolina Alencar de Barros', 'Dox Lucchin',
        'Fábio Luiz Kuntze', 'Carla Thais Maiewski ', 'Lucas Mendonça', 'Larissa Torres', 'Rafael Buratto', 'Mati', 'Kwy', 'JAY', 'Mourão ', 'Aguidota', 'Vitinho', 'Gusta', 'Jantas', 'Luqueta', 'Emiliane Mayumi Ito', 'Paulo Borba '];
    $externos = array_map(fn($n, $i) => ['id' => "p$i", 'name' => $n], $nomesPolo, array_keys($nomesPolo));
    $m = casarComInternos($externos, $internos, POLOPERATOR_APELIDOS['brasileiro']);
    foreach ($m as $i => $r) assertEqualsT($i + 1, $r['interno']['id'] ?? null, "'{$nomesPolo[$i]}' deve casar com '{$internos[$i]['nome']}'");
    echo "OK: test_apelidos_pior_2026_casam_nomes_do_poloperator\n";
}

// Numeração diferente: "Time 7" no Poloperator tem o elenco do nosso "Time 2" → casa pelo elenco.
function test_times_casam_pelo_elenco_e_nao_pelo_numero(): void {
    $externos = [
        ['id' => 'pt7', 'name' => 'Time 7', 'players' => [['id' => 'k', 'name' => 'Kwy'], ['id' => 'm', 'name' => 'Mati'], ['id' => 'j', 'name' => 'JAY']]],
        ['id' => 'pt8', 'name' => 'Time 8', 'players' => []],
    ];
    $internos = [
        ['id' => 2, 'nome' => 'Time 2', 'poloperator_id' => null],
        ['id' => 7, 'nome' => 'Time 7', 'poloperator_id' => 'pt7'], // id antigo gravado errado
        ['id' => 8, 'nome' => 'Time 8', 'poloperator_id' => null],
    ];
    $roster = [
        2 => [['id' => 21, 'nome' => 'Kwy', 'poloperator_id' => null], ['id' => 22, 'nome' => 'Mat', 'poloperator_id' => null], ['id' => 23, 'nome' => 'Jay', 'poloperator_id' => null]],
        7 => [['id' => 71, 'nome' => 'Vitinho', 'poloperator_id' => null]],
        8 => [['id' => 81, 'nome' => 'Gusta', 'poloperator_id' => null]],
    ];
    $m = casarTimesPorElenco($externos, $internos, $roster, ['Mati' => 'Mat']);
    assertEqualsT([2, 'elenco'], [$m[0]['interno']['id'], $m[0]['via']], 'Time 7 do Poloperator = nosso Time 2 pelo elenco, mesmo com id antigo errado');
    assertEqualsT([8, 'nome'], [$m[1]['interno']['id'], $m[1]['via']], 'sem atletas, cai no nome');
    echo "OK: test_times_casam_pelo_elenco_e_nao_pelo_numero\n";
}

// Empate de votos entre dois times internos nunca é decidido por adivinhação.
function test_elenco_empatado_nao_adivinha(): void {
    $externos = [['id' => 'x', 'name' => 'Sem Par', 'players' => [['id' => 'a', 'name' => 'Ana'], ['id' => 'b', 'name' => 'Bia']]]];
    $internos = [['id' => 1, 'nome' => 'T1', 'poloperator_id' => null], ['id' => 2, 'nome' => 'T2', 'poloperator_id' => null]];
    $roster = [1 => [['id' => 11, 'nome' => 'Ana', 'poloperator_id' => null]], 2 => [['id' => 21, 'nome' => 'Bia', 'poloperator_id' => null]]];
    $m = casarTimesPorElenco($externos, $internos, $roster);
    assertEqualsT('pendente', $m[0]['status'], 'empate 1×1 fica pendente');
    echo "OK: test_elenco_empatado_nao_adivinha\n";
}
