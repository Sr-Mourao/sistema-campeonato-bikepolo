import { fmtHora, descreveEventoPublico, ladoDoEvento, type EventoPublico, type JogoPublico } from '../../services/torneioPublico'
import { IconGol, IconFalta } from '../broadcast/icons'
import './eventTimeline.css'

interface Props {
  jogo: Pick<JogoPublico, 'time_a_id' | 'time_b_id'>
  eventos: EventoPublico[]
  className?: string
}

/**
 * Timeline lateralizada compartilhada (seção 7 do brief de acabamento 3) — nunca
 * mostra nome de time (a posição já indica o lado). Usada pelo card público, pela
 * rota /torneio/placar e pelo histórico de partida encerrada.
 */
export default function EventTimeline({ jogo, eventos, className }: Props) {
  if (eventos.length === 0) return null
  return (
    <div className={`evt-timeline ${className ?? ''}`}>
      {eventos.map(e => {
        const lado = ladoDoEvento(e, jogo)
        return (
          <div key={e.event_id} className={`evt-row evt-row--${lado}`}>
            <div className="evt-content">
              <span className="evt-icon">{e.categoria === 'falta' ? <IconFalta size={14} /> : <IconGol size={14} />}</span>
              <span className="evt-desc">{descreveEventoPublico(e)}</span>
              <span className="evt-time">{fmtHora(e.quando)}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
