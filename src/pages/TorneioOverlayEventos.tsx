import { useState } from 'react'
import OverlayEvent from '../components/obs/OverlayEvent'
import { PREVIEW_JOGO, previewEvent, readOverlayPreview } from '../components/obs/preview'
import { useEventQueue } from '../hooks/useEventQueue'
import { useObsDocument } from '../hooks/useObsDocument'
import { useTournamentLive } from '../hooks/useTournamentLive'
import './TorneioOverlay.css'

export default function TorneioOverlayEventos() {
  useObsDocument('OBS · Eventos do torneio')
  const { destaque } = useTournamentLive()
  const jogo = destaque?.jogo ?? null
  const fila = useEventQueue(destaque?.eventos ?? [], jogo?.codigo ?? null, jogo?.status === 'em_andamento')
  const [previewFinalizado, setPreviewFinalizado] = useState(false)
  const preview = readOverlayPreview(window.location.search)
  const item = preview && !previewFinalizado
    ? { evento: previewEvent(preview, destaque), onDone: () => setPreviewFinalizado(true) }
    : fila
  const jogoDoEvento = jogo ?? (preview ? PREVIEW_JOGO : null)

  return (
    <main className="obs-overlay-root obs-overlay-root--events" data-overlay-idle={item ? 'false' : 'true'}>
      {item && jogoDoEvento && <OverlayEvent key={item.evento.event_id} evento={item.evento} jogo={jogoDoEvento} onDone={item.onDone} />}
    </main>
  )
}
