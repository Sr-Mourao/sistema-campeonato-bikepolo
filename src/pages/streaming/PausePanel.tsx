import {
  formatPauseTime,
  pauseRemainingMs,
  type StreamingSettings,
  type StreamingTeam,
  type TeamPauseState,
} from '../../services/streamingState'

interface Props {
  side: 'a' | 'b'
  team: StreamingTeam
  pause: TeamPauseState
  settings: StreamingSettings
  clockOffset: number
  onStart: (side: 'a' | 'b', kind: 'tech' | 'mech') => void
  onToggle: (side: 'a' | 'b') => void
  onAdjust: (side: 'a' | 'b', sec: number) => void
  onEnd: (side: 'a' | 'b') => void
  onAnnul: (side: 'a' | 'b') => void
}

/** Controle das pausas de um time: técnica (limitada) e mecânica, com cronômetro próprio */
export default function PausePanel({ side, team, pause, settings, clockOffset, onStart, onToggle, onAdjust, onEnd, onAnnul }: Props) {
  const techMax = settings.techMax ?? 2
  const techLeft = Math.max(0, techMax - pause.techUsed)
  const p = pause.active

  if (!p) {
    return (
      <div className="stm-pause" style={{ '--tc': team.color } as React.CSSProperties}>
        <div className="stm-pause-head">
          <span className="stm-chip" style={{ background: team.color }} />
          <b>{team.name}</b>
          <span className="stm-pause-count">técnicas {pause.techUsed}/{techMax} · mecânicas {pause.mechUsed}</span>
        </div>
        <div className="stm-pause-btns">
          <button type="button" className="stm-btn" disabled={techLeft === 0} onClick={() => onStart(side, 'tech')}>
            ⏱ Técnica ({settings.techMin ?? 2} min)
            <small>{techLeft === 0 ? 'esgotadas' : `restam ${techLeft}`}</small>
          </button>
          <button type="button" className="stm-btn" onClick={() => onStart(side, 'mech')}>
            🔧 Mecânica ({settings.mechMin ?? 5} min)
          </button>
        </div>
      </div>
    )
  }

  const remaining = pauseRemainingMs(p, clockOffset)
  const over = remaining < 0
  return (
    <div className={`stm-pause active ${over ? 'over' : ''}`} style={{ '--tc': team.color } as React.CSSProperties}>
      <div className="stm-pause-head">
        <span className="stm-chip" style={{ background: team.color }} />
        <b>{team.name}</b>
        <span className="stm-tag pause">{p.kind === 'tech' ? `PAUSA TÉCNICA ${pause.techUsed}/${techMax}` : 'PAUSA MECÂNICA'}</span>
      </div>
      <div className={`stm-pause-clock ${p.running ? '' : 'paused'}`}>{formatPauseTime(remaining)}</div>
      <div className="stm-pause-btns">
        <button type="button" className="stm-btn" onClick={() => onAdjust(side, -30)}>−30s</button>
        <button type="button" className="stm-btn" onClick={() => onToggle(side)}>{p.running ? '⏸' : '▶'}</button>
        <button type="button" className="stm-btn" onClick={() => onAdjust(side, 30)}>+30s</button>
      </div>
      <div className="stm-pause-btns">
        <button type="button" className="stm-btn primary" onClick={() => onEnd(side)}>Encerrar pausa</button>
        <button type="button" className="stm-btn danger" onClick={() => onAnnul(side)} title="Pausa marcada por engano: não conta">
          Anular
        </button>
      </div>
    </div>
  )
}
