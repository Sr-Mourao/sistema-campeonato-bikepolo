// Espelho de public/api/torneio/formato.php (TORNEIO_FORMATOS / formatoInfo()).
// O backend sempre envia `formato_info`; o catálogo local só cobre payloads antigos
// ou de pré-visualização. Toda decisão de aba/texto por formato passa por aqui —
// nunca por comparação com o nome do formato espalhada pelos componentes.

export type FormatoChave = 'misto_swiss_13' | 'mtnb_round_robin_5' | 'misto_round_robin_8'

export interface FormatoInfo {
  chave: FormatoChave
  nome: string
  primeira_fase: 'swiss' | 'round_robin'
  repescagem: boolean
  equalizacao: boolean
  rodadas: number
  participantes: number
  jogos_primeira_fase: number | null
  double: 'repescagem_8' | 'mtnb_5' | 'direta_8'
}

export const FORMATOS: Record<FormatoChave, FormatoInfo> = {
  misto_swiss_13: {
    chave: 'misto_swiss_13', nome: '2° Pior Campeonato de Bici Polo Misto', primeira_fase: 'swiss',
    repescagem: true, equalizacao: true, rodadas: 4, participantes: 13, jogos_primeira_fase: null, double: 'repescagem_8',
  },
  mtnb_round_robin_5: {
    chave: 'mtnb_round_robin_5', nome: '4º Brasileiro MTNB', primeira_fase: 'round_robin',
    repescagem: false, equalizacao: false, rodadas: 5, participantes: 5, jogos_primeira_fase: 10, double: 'mtnb_5',
  },
  misto_round_robin_8: {
    chave: 'misto_round_robin_8', nome: '2° Pior Campeonato de Bici Polo', primeira_fase: 'round_robin',
    repescagem: false, equalizacao: false, rodadas: 7, participantes: 8, jogos_primeira_fase: 28, double: 'direta_8',
  },
}

export function formatoDe(t: { formato?: string | null; formato_info?: FormatoInfo | null } | null | undefined): FormatoInfo {
  if (t?.formato_info) return t.formato_info
  return FORMATOS[(t?.formato ?? '') as FormatoChave] ?? FORMATOS.misto_swiss_13
}

/** Jogos por rodada no todos contra todos (folga do número ímpar nunca vira jogo). */
export function jogosPorRodada(f: FormatoInfo): number {
  return Math.floor(f.participantes / 2)
}
