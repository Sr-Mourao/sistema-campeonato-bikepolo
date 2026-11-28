// Metadados de UI dos critérios de desempate — só rótulos/textos/formatação de exibição,
// NUNCA lógica de comparação (essa vive inteiramente no backend, aplicaCriterio() em
// lib.php). Fonte única compartilhada entre a lista "Critérios de desempate" da Primeira
// Fase e o indicador de desempate por linha da tabela — evita divergência entre as duas
// (seção 12 do brief de ajustes cirúrgicos na tabela pública).
import type { StandingRowPublico } from '../../services/torneioPublico'

/** Rótulo curto pra caber ao lado do nome do time na tabela (nunca o nome completo ali). */
export const CRITERIO_CURTO: Record<string, string> = {
  pontos: 'PTS',
  vitorias: 'V',
  empates: 'E',
  saldo: 'SG',
  gols_pro: 'GP',
  gols_contra_menos: 'GC',
  fair_play: 'FP',
  confronto_direto: 'CD',
  confronto_direto_grupo: 'CD',
  buchholz: 'BH',
  sorteio: 'Sorteio',
}

/** Explicação curta do critério — usada tanto na seção "Critérios de desempate" quanto no
 * tooltip do indicador por linha. */
export const CRITERIO_EXPLICACAO: Record<string, string> = {
  pontos: 'Total de pontos conquistados (vitória/empate/derrota).',
  vitorias: 'Número de vitórias.',
  empates: 'Número de empates.',
  saldo: 'Gols marcados menos gols sofridos.',
  gols_pro: 'Total de gols marcados.',
  gols_contra_menos: 'Menos gols sofridos é melhor.',
  fair_play: 'Menos faltas é melhor.',
  confronto_direto: 'Resultado do confronto direto entre os times empatados.',
  confronto_direto_grupo: 'Pontos somados só nos jogos entre os times empatados (mini-tabela do grupo).',
  buchholz: 'Força dos adversários enfrentados. Maior é melhor.',
  sorteio: 'Critério manual/sorteio, só decide se tudo o resto empatar.',
}

/**
 * Valor formatado do critério pra exibir no tooltip do indicador (ex.: "6", "+4", "2
 * faltas"). Retorna `null` quando o critério não tem um valor escalar direto pra mostrar
 * (confronto_direto/sorteio) — nesses casos o tooltip só explica o critério em texto,
 * nunca inventa um número que o backend não forneceu.
 */
export function valorCriterioFormatado(chave: string, row: StandingRowPublico): string | null {
  switch (chave) {
    case 'pontos': return `${row.pontos}`
    case 'vitorias': return `${row.v}`
    case 'empates': return `${row.e}`
    case 'saldo': return row.sg > 0 ? `+${row.sg}` : `${row.sg}`
    case 'gols_pro': return `${row.gp} gols`
    case 'gols_contra_menos': return `${row.gc} sofridos`
    case 'fair_play': return `${row.faltas} falta${row.faltas === 1 ? '' : 's'}`
    case 'buchholz': return `${row.buchholz}`
    default: return null
  }
}
