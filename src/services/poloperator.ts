export type Torneio = 'brasileiro' | 'mtnb'

export interface Atleta {
  id: string
  name: string
  city?: string
  country?: string
  photoPath?: string
  startYear?: number
  hand?: string
  isCaptain?: boolean
}

export interface Equipe {
  id: string
  name: string
  seed?: number
  city?: string
  logoPath?: string
  players: Atleta[]
}

export interface TorneioInfo {
  name: string
  dateStart: string | null
  dateEnd: string | null
}

export interface TorneioData {
  tournament: TorneioInfo
  teams: Equipe[]
}

export async function fetchEquipes(torneio: Torneio): Promise<TorneioData> {
  const res = await fetch(`/api/poloperator.php?torneio=${torneio}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Erro ao carregar equipes')
  return data as TorneioData
}
