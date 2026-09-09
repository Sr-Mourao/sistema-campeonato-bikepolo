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
