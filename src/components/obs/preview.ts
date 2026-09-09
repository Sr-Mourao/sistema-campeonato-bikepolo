import type { DestaquePublico, EventoPublico, JogoPublico } from '../../services/torneioPublico'

export type OverlayPreview = 'gol' | 'gol-sem-foto' | 'gol-contra' | 'gol-outorgado' | 'falta'

export function readOverlayPreview(search: string): OverlayPreview | null {
  const value = new URLSearchParams(search).get('preview')
  return value === 'gol' || value === 'gol-sem-foto' || value === 'gol-contra' || value === 'gol-outorgado' || value === 'falta' ? value : null
}

export const PREVIEW_JOGO: JogoPublico = {
  codigo: 'REP-R3', bracket: 'repescagem', ordem: 3, status: 'em_andamento', placar_a: 2, placar_b: 4,
  is_bye: 0, overtime: 0, horario_previsto: null, horario_inicio_real: null, horario_fim_real: null,
  fase_tipo: 'repescagem', fase_rodada: null, fase_rotulo: 'Repescagem',
  time_a_nome: 'Discípulos', time_b_nome: 'Galgos', time_a_id: 101, time_b_id: 102,
  vencedor_time_id: null, time_a_origem: null, time_b_origem: null, time_a_logo: null, time_b_logo: null,
}

/** Preview estritamente em memória: reaproveita mídia já lida quando disponível e nunca grava. */
export function previewEvent(tipo: OverlayPreview, destaque: DestaquePublico | null): EventoPublico {
  const eventos = destaque?.eventos ?? []
  const fotoReal = eventos.find(e => e.categoria === 'gol' && e.tipo === 'normal' && !!e.foto_path)
  const faltaReal = eventos.find(e => e.categoria === 'falta')
  const timeId = destaque?.jogo?.time_a_id ?? PREVIEW_JOGO.time_a_id!

  if (tipo === 'gol' && fotoReal) return { ...fotoReal, event_id: 'preview-gol' }
  if (tipo === 'falta' && faltaReal) return { ...faltaReal, event_id: 'preview-falta' }

  return {
    categoria: tipo === 'falta' ? 'falta' : 'gol',
    tipo: tipo === 'gol-contra' ? 'gol_contra' : tipo === 'gol-outorgado' ? 'sem_autoria' : tipo === 'falta' ? null : 'normal',
    atleta: tipo === 'gol-contra' || tipo === 'gol-outorgado' ? null : tipo === 'falta' ? 'Romero Sarti' : 'Atleta em destaque',
    time_id: timeId,
    quando: new Date().toISOString(),
    event_id: `preview-${tipo}`,
    foto_path: null,
  }
}
