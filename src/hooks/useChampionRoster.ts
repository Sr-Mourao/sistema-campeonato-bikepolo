import { useEffect, useState } from 'react'
import { torneioPublico, type JogadorTimePublico } from '../services/torneioPublico'
import { useTournamentCategory } from '../contexts/TournamentContext'

interface RosterState { timeId: number; elenco: JogadorTimePublico[] }

/** Elenco público oficial compartilhado pelas duas peças de campeão. */
export function useChampionRoster(timeId: number | null, preview?: JogadorTimePublico[]) {
  const categoria = useTournamentCategory()
  const [state, setState] = useState<RosterState | null>(null)

  useEffect(() => {
    if (!timeId || preview) return
    let cancelado = false
    torneioPublico.time(timeId, categoria)
      .then(r => { if (!cancelado) setState({ timeId, elenco: r.elenco }) })
      .catch(() => { if (!cancelado) setState({ timeId, elenco: [] }) })
    return () => { cancelado = true }
  }, [timeId, preview, categoria])

  if (preview) return preview
  return state?.timeId === timeId ? state.elenco : null
}
