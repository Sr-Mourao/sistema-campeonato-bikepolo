import { useEffect, useState } from 'react'
import { torneioPublico, type BroadcastTorneioPublico } from '../services/torneioPublico'
import { TOURNAMENT_LIVE_POLL_MS } from './useTournamentLive'
import { useTournamentCategory } from '../contexts/TournamentContext'

/** Leitura agregada dos overlays de fase, no mesmo ritmo histórico do placar. */
export function useTournamentBroadcast(categoria?: string) {
  const categoriaContexto = useTournamentCategory()
  const categoriaEfetiva = categoria ?? categoriaContexto
  const [dados, setDados] = useState<BroadcastTorneioPublico | null>(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    let cancelado = false
    async function tick() {
      try {
        const atuais = await torneioPublico.broadcast(categoriaEfetiva)
        if (!cancelado) { setDados(atuais); setErro(false) }
      } catch {
        if (!cancelado) setErro(true)
      }
    }
    tick()
    const id = setInterval(tick, TOURNAMENT_LIVE_POLL_MS)
    return () => { cancelado = true; clearInterval(id) }
  }, [categoriaEfetiva])

  return { dados, erro }
}
