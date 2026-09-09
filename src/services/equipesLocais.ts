// Cliente de public/api/equipes.php — fonte 100% interna de times/atletas (substitui
// poloperator.ts na renderização pública de /equipes; ver migração de mídia). O tipo
// `Torneio` continua vindo de poloperator.ts (só o seletor 'brasileiro'|'mtnb', sem
// runtime dependency nenhuma nisso).
export type { Torneio } from './poloperator'
import type { Torneio } from './poloperator'

export interface AtletaLocal {
  id: number
  name: string
  photoPath?: string
}

export interface EquipeLocal {
  id: number
  name: string
  logoPath?: string
  players: AtletaLocal[]
}

export interface TorneioLocalData {
  tournament: { name: string; categoria: string }
  teams: EquipeLocal[]
}

export async function fetchEquipesLocais(torneio: Torneio): Promise<TorneioLocalData> {
  const res = await fetch(`/api/equipes.php?torneio=${torneio}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Erro ao carregar equipes')
  return data as TorneioLocalData
}
