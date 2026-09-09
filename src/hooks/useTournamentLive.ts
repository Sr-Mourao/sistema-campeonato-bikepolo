import { useEffect, useState } from 'react'
import { torneioPublico, type DestaquePublico } from '../services/torneioPublico'
import { useTournamentCategory } from '../contexts/TournamentContext'

/** Intervalo histórico do placar fullscreen. Compartilhado pelos overlays sem alteração. */
export const TOURNAMENT_LIVE_POLL_MS = 8000

interface Options {
  categoria?: string
  limiteEventos?: number
  limiteResultados?: number
}

/**
 * Única camada React de leitura do live state público. A seleção da partida continua sendo
 * feita exclusivamente por `resolverPartidaDestaque` no backend, via `destaque()`.
 */
export function useTournamentLive({
  categoria,
  limiteEventos = 20,
  limiteResultados = 5,
}: Options = {}) {
  const categoriaContexto = useTournamentCategory()
  const categoriaEfetiva = categoria ?? categoriaContexto
  const [destaque, setDestaque] = useState<DestaquePublico | null>(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    let cancelado = false

    async function tick() {
      try {
        const atual = await torneioPublico.destaque(categoriaEfetiva, limiteEventos, limiteResultados)
        if (!cancelado) {
          setDestaque(atual)
          setErro(false)
        }
      } catch {
        // Mantém o último frame bom em infra instável; o próximo tick tenta novamente.
        if (!cancelado) setErro(true)
      }
    }

    tick()
    const id = setInterval(tick, TOURNAMENT_LIVE_POLL_MS)
    return () => { cancelado = true; clearInterval(id) }
  }, [categoriaEfetiva, limiteEventos, limiteResultados])

  return { destaque, erro }
}
