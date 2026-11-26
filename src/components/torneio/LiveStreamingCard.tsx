import { useEffect, useState } from 'react'
import {
  getClockDisplayText,
  type StreamingState,
} from '../../services/streamingState'
import './LiveStreamingCard.css'

export default function LiveStreamingCard() {
  const [liveState, setLiveState] = useState<StreamingState | null>(null)
  const [serverOffset, setServerOffset] = useState(0)
  const [, setTick] = useState(0)

  // 1-second interval for smooth local clock ticking
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // Poll state from server every 3s
  useEffect(() => {
    let active = true

    const fetchState = async () => {
      try {
        let res: Response | null = null
        try {
          res = await fetch('/api/streaming.php?action=state')
        } catch {
          // fallback
        }
        if (!res || !res.ok) {
          try {
            res = await fetch('/api/streaming/state')
          } catch {
            // fallback
          }
        }

        if (res && res.ok && active) {
          if (res.headers.has('X-Server-Time')) {
            const srv = Number(res.headers.get('X-Server-Time'))
            if (srv) setServerOffset(srv - Date.now())
          }
          const data: StreamingState = await res.json()
          setLiveState(data)
        }
      } catch {
        // quiet error
      }
    }

    fetchState()
    const timer = setInterval(fetchState, 3000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [])

  if (!liveState) return null

  // Check if a game is actively taking place:
  // Either tournament is linked, or clock is running, or scores > 0, or events exist
  const isActiveMatch =
    Boolean(liveState.tournament) ||
    liveState.clock.running ||
    (liveState.events && liveState.events.length > 0) ||
    liveState.a.score > 0 ||
    liveState.b.score > 0

  if (!isActiveMatch) return null

  const clockText = getClockDisplayText(liveState.clock, liveState.settings, serverOffset)
  const events = (liveState.events || []).filter(e => !e.fxPending).slice(-5).reverse()

  return (
    <article className="ov-live-card">
      <div className="ov-live-header">
        <div className="ov-live-pulse-badge">
          <span className="ov-live-dot" />
          <span>Ao Vivo na Quadra</span>
        </div>

        <div className="ov-live-clock-badge">
          <span className="ov-live-clock-time">{clockText}</span>
          <span className={`ov-live-clock-status ${liveState.clock.running ? 'run' : 'pause'}`}>
            {liveState.clock.running ? '▶ Em jogo' : '⏸ Pausado'}
          </span>
        </div>
      </div>

      <div className="ov-live-match-meta">
        {liveState.tournament ? (
          <span>
            {liveState.tournament.faseRotulo} <b>·</b> Partida {liveState.tournament.jogoCodigo}
          </span>
        ) : (
          <span>{liveState.label || 'Partida em Andamento'}</span>
        )}
      </div>

      <div className="ov-live-scoreboard">
        <div className="ov-live-team a">
          <span className="ov-live-chip" style={{ background: liveState.a.color }} />
          <span className="ov-live-team-name">{liveState.a.name}</span>
          <span className="ov-live-fouls">faltas: {liveState.a.fouls}</span>
        </div>

        <div className="ov-live-score">
          <span>{liveState.a.score}</span>
          <small>×</small>
          <span>{liveState.b.score}</span>
        </div>

        <div className="ov-live-team b">
          <span className="ov-live-chip" style={{ background: liveState.b.color }} />
          <span className="ov-live-team-name">{liveState.b.name}</span>
          <span className="ov-live-fouls">faltas: {liveState.b.fouls}</span>
        </div>
      </div>

      {events.length > 0 && (
        <div className="ov-live-events">
          <span className="ov-live-events-title">Últimos lances</span>
          <div className="ov-live-events-list">
            {events.map(ev => {
              const min = Math.max(1, Math.floor((ev.gt || 0) / 60000) + 1)
              const isGoal = ev.type === 'goal'
              return (
                <div key={ev.id} className={`ov-live-event-item ${ev.type}`}>
                  <span className="ov-live-ev-time">{min}'</span>
                  <span className={`ov-live-ev-badge ${ev.type}`}>{isGoal ? (ev.own ? 'Contra' : 'Gol') : 'Falta'}</span>
                  <span className="ov-live-ev-team">{ev.team}</span>
                  <span className="ov-live-ev-player">
                    {ev.own ? `contra do ${ev.playerTeam || 'adversário'}` : ev.player || 'Sem autoria'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </article>
  )
}
