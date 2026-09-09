// Metadados ESTÁTICOS de exibição das chaves de Repescagem e Double Elimination —
// só rótulos/textos, nenhuma regra de pontuação ou geração de confronto. Espelham
// exatamente o formato já implementado em public/api/torneio/bracket.php
// (gerarRepescagem()/gerarDouble()): são usados apenas para desenhar a chave ANTES
// de a fase existir no banco (placeholders conceituais, seções 10/11 do brief de
// área pública). Assim que a fase é gerada, os dados reais (nome do time, origemLabel)
// sempre têm prioridade sobre este texto — ver bracketPlaceholder() nos consumidores.

export type BracketColDef = [titulo: string, codigos: string[]]

/** REP-R1..R5 → [ladoA, ladoB] conceituais, calculados a partir da config real do torneio
 * (classificados_diretos) — nunca um número fixo hardcoded independente da configuração. */
export function repescagemPlaceholders(diretos: number): Record<string, [string, string]> {
  return {
    'REP-R1': [`${diretos + 2}º`, `${diretos + 7}º`],
    'REP-R2': [`${diretos + 3}º`, `${diretos + 6}º`],
    'REP-R3': [`${diretos + 4}º`, `${diretos + 5}º`],
    'REP-R4': ['Vencedor R1', 'Vencedor R2'],
    'REP-R5': [`${diretos + 1}º`, 'Vencedor R3'],
  }
}

/** Rótulo curto do código pra exibição (REP-R1 → R1) — só nesta UI, nunca no código interno. */
export function rotuloCurtoRepescagem(codigo: string): string {
  return codigo.replace('REP-', '')
}

export const REP_COLS: BracketColDef[] = [
  ['Rodada 1', ['REP-R1', 'REP-R2', 'REP-R3']],
  ['Repescados', ['REP-R4', 'REP-R5']],
]

export const WIN_COLS: BracketColDef[] = [
  ['Quartas', ['QA', 'QB', 'QC', 'QD']],
  ['Semifinal', ['SF1', 'SF2']],
  ['Final Winners', ['FA']],
]

export const LOS_COLS: BracketColDef[] = [
  ['Losers R1', ['B1', 'B2']],
  ['Losers R2', ['B3', 'B4']],
  ['Losers R3', ['B5']],
  ['Losers R4', ['B6']],
]

export const MTNB_WIN_COLS: BracketColDef[] = [
  ['Play-in', ['P1']], ['Entrada do 1º', ['W1', 'W2']], ['Final Winners', ['WF']],
]
export const MTNB_LOS_COLS: BracketColDef[] = [
  ['Losers 1', ['L1']], ['Losers 2', ['L2']], ['Final Losers', ['LF']],
]
export const MTNB_DOUBLE_PLACEHOLDERS: Record<string, [string, string] | [string]> = {
  P1: ['5º', '4º'], W1: ['1º', 'Vencedor P1'], W2: ['2º', '3º'],
  WF: ['Vencedor W1', 'Vencedor W2'], L1: ['Perdedor P1', 'Perdedor W2'],
  L2: ['Vencedor L1', 'Perdedor W1'], LF: ['Vencedor L2', 'Perdedor WF'],
  GF: ['Vencedor WF (Winners)', 'Vencedor LF (Losers)'], GF2: ['Revanche da Grande Final — decide o campeonato'],
}

/**
 * Confrontos conceituais da Double Elimination — 1-6 são sempre os 6 melhores colocados
 * da classificatória (posição absoluta, não depende de classificados_diretos). QC/QD usam
 * "melhor/segundo seed entre os repescados" (reseeding pela Primeira Fase — NUNCA o
 * caminho REP-R4/REP-R5 percorrido, ver seedsRepescados() em bracket.php), nunca "vencedor
 * REP-R4"/"vencedor REP-R5" — isso sugeriria uma vantagem que R4 não tem sobre R5. */
export const DOUBLE_PLACEHOLDERS: Record<string, [string, string] | [string]> = {
  QA: ['4º', '5º'],
  QB: ['3º', '6º'],
  QC: ['2º', 'Melhor seed entre os repescados'],
  QD: ['1º', 'Segundo seed entre os repescados'],
  SF1: ['Vencedor QD', 'Vencedor QA'],
  SF2: ['Vencedor QC', 'Vencedor QB'],
  FA: ['Vencedor SF1', 'Vencedor SF2'],
  B1: ['Perdedor QA', 'Perdedor QB'],
  B2: ['Perdedor QC', 'Perdedor QD'],
  B3: ['Vencedor B1', 'Perdedor SF2'],
  B4: ['Vencedor B2', 'Perdedor SF1'],
  B5: ['Vencedor B3', 'Vencedor B4'],
  B6: ['Vencedor B5', 'Perdedor FA'],
  GF: ['Vencedor FA (Winners)', 'Vencedor B6 (Losers)'],
  GF2: ['Revanche da Grande Final — decide o campeão'],
}
