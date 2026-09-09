// Tipos e funções puras da chave compartilhada — separados de BracketView.tsx
// (que só exporta componentes) pra não quebrar o Fast Refresh do Vite.

export interface BracketJogo {
  codigo: string
  time_a_nome: string | null
  time_b_nome: string | null
  time_a_id?: number | null
  time_b_id?: number | null
  placar_a: number | null
  placar_b: number | null
  vencedor_time_id?: number | null
  status: string
  time_a_origem?: string | null
  time_b_origem?: string | null
  id?: number
}

export type BracketColDef = [titulo: string, codigos: string[]]

/** Extrai um texto de origem legível de um JSON {"tipo":"jogo","codigo":"QD","resultado":"vencedor"}. */
export function origemLabel(origemJson?: string | null): string | null {
  if (!origemJson) return null
  try {
    const o = JSON.parse(origemJson) as { tipo?: string; codigo?: string; resultado?: string }
    if (o.tipo === 'jogo' && o.codigo) return `${o.resultado === 'perdedor' ? 'Perdedor' : 'Vencedor'} de ${o.codigo}`
  } catch { /* origem malformada — trata como indefinida */ }
  return null
}

export function porCodigo(lista: BracketJogo[], codigo: string): BracketJogo | undefined {
  return lista.find(j => j.codigo === codigo)
}
