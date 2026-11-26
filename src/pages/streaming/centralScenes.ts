/**
 * Cenas da Central de overlays que o Operador da live pode mandar para dentro do
 * overlay principal (/streaming/overlay). Assim o OBS precisa de uma fonte só.
 *
 * Ficam de fora: as peças de projetor (pódio, awards), que vão para o telão e não
 * para a transmissão, e o Placar/Eventos do torneio, que o próprio overlay
 * principal já faz (placar, gols e faltas).
 */
import { MTNB_OVERLAY_CATALOG, OVERLAY_CATALOG, type OverlayCatalogItem } from '../../components/overlays/overlayCatalog'

export interface CentralScene extends OverlayCatalogItem {
  /** Agrupamento na mesa: Misto ou MTNB */
  torneio: 'Misto' | 'MTNB'
}

const DUPLICADAS = new Set(['Placar', 'Eventos'])

export const CENTRAL_SCENES: CentralScene[] = [
  ...OVERLAY_CATALOG.filter(i => i.destino !== 'PROJETOR' && !DUPLICADAS.has(i.nome)).map(i => ({ ...i, torneio: 'Misto' as const })),
  ...MTNB_OVERLAY_CATALOG.filter(i => !DUPLICADAS.has(i.nome)).map(i => ({ ...i, torneio: 'MTNB' as const })),
]

/**
 * Ao mandar uma cena ao ar, o placar/pausas/alertas do overlay principal devem
 * sumir por padrão? (O operador ainda pode mudar na hora, pela mesa.)
 */
export function defaultHideBoard(scene: CentralScene): boolean {
  // A Emissora é um selo pequeno de canto: convive com o placar.
  // As demais são composições de tela cheia e cobririam o placar.
  return scene.nome !== 'Emissora'
}
