import { useEffect, useState } from 'react'
import OverlayScorebug from '../components/obs/OverlayScorebug'
import { PREVIEW_JOGO } from '../components/obs/preview'
import { useObsDocument } from '../hooks/useObsDocument'
import { useTournamentLive } from '../hooks/useTournamentLive'
import './TorneioOverlay.css'

/** Coreografia de entrada do scorebug — some depois de rodar. */
const INTRO_MS = 1250

export default function TorneioOverlayPlacar() {
  useObsDocument('OBS · Placar do torneio')
  const { destaque } = useTournamentLive()
  const preview = new URLSearchParams(window.location.search).has('preview')
  const jogo = destaque?.jogo ?? (preview ? PREVIEW_JOGO : null)

  /**
   * A intro é da Browser Source: roda uma única vez, quando o confronto real aparece
   * (nunca sobre placar/status provisório) e nunca de novo a cada polling. Como o estado
   * vive na rota, atualizações e remontagens do scorebug não a disparam outra vez.
   */
  /* A intro roda enquanto houver confronto e ela ainda não tiver terminado. `pronto` é
     booleano, então o polling (que devolve objetos novos a cada rodada) não a reinicia,
     e `introFinalizada` nunca volta atrás: um novo mount da Browser Source é a única
     forma de vê-la de novo. */
  const [introFinalizada, setIntroFinalizada] = useState(false)
  const pronto = Boolean(jogo)
  const introAtiva = pronto && !introFinalizada

  useEffect(() => {
    if (!introAtiva) return
    const fim = setTimeout(() => setIntroFinalizada(true), INTRO_MS)
    return () => clearTimeout(fim)
  }, [introAtiva])

  return (
    <main
      className="obs-overlay-root obs-overlay-root--scorebug"
      data-intro={introAtiva ? 'ativa' : undefined}
    >
      <OverlayScorebug jogo={jogo} />
    </main>
  )
}
