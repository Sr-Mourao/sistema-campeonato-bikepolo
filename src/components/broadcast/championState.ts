export type EntradaCampeao = 'nenhuma' | 'direta' | 'transicao'

/** Decide apenas a coreografia; a existência do campeão já veio pronta do backend. */
export function decidirEntradaCampeao(
  championId: number | null,
  championAtivado: number | null,
  viuEstadoSemCampeao: boolean,
  elencoPronto: boolean,
): EntradaCampeao {
  if (!championId || !elencoPronto || championAtivado === championId) return 'nenhuma'
  return viuEstadoSemCampeao ? 'transicao' : 'direta'
}
