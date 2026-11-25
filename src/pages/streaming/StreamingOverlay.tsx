import { useEffect, useMemo, useRef, useState } from 'react'
import { useObsDocument } from '../../hooks/useObsDocument'
import { useStreamingSync } from '../../hooks/useStreamingSync'
import {
  calculateElapsed,
  getClockDisplayText,
} from '../../services/streamingState'
import './StreamingOverlay.css'

export default function StreamingOverlay() {
  useObsDocument('OBS · Placar Streaming')
  const { state, clockOffset } = useStreamingSync()

  // Background chroma-key option
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search)
    if (qs.get('bg') === 'green') {
      document.body.style.background = '#00ff00'
    } else {
      document.body.style.background = 'transparent'
    }
  }, [])

  // Relógio com ticker a cada segundo
  const [clockTick, setClockTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setClockTick(t => t + 1), 250)
    return () => clearInterval(timer)
  }, [])

  const clockText = useMemo(() => {
    return getClockDisplayText(state.clock, state.settings, clockOffset)
  }, [state.clock, state.settings, clockOffset, clockTick])

  const durMs = (state.settings.durMin || 18) * 60000
  const elapsed = calculateElapsed(state.clock, clockOffset)
  const isClockEnded = state.settings.mode !== 'up' && elapsed >= durMs

  // Bump & Pop animations
  const prevScores = useRef({ a: state.a.score, b: state.b.score })
  const prevFouls = useRef({ a: state.a.fouls, b: state.b.fouls })
  const [popScore, setPopScore] = useState<{ a: boolean; b: boolean }>({ a: false, b: false })
  const [bumpFoul, setBumpFoul] = useState<{ a: boolean; b: boolean }>({ a: false, b: false })

  useEffect(() => {
    if (state.a.score > prevScores.current.a) {
      setPopScore(p => ({ ...p, a: true }))
      setTimeout(() => setPopScore(p => ({ ...p, a: false })), 800)
    }
    if (state.b.score > prevScores.current.b) {
      setPopScore(p => ({ ...p, b: true }))
      setTimeout(() => setPopScore(p => ({ ...p, b: false })), 800)
    }
    prevScores.current = { a: state.a.score, b: state.b.score }

    if (state.a.fouls > prevFouls.current.a) {
      setBumpFoul(f => ({ ...f, a: true }))
      setTimeout(() => setBumpFoul(f => ({ ...f, a: false })), 600)
    }
    if (state.b.fouls > prevFouls.current.b) {
      setBumpFoul(f => ({ ...f, b: true }))
      setTimeout(() => setBumpFoul(f => ({ ...f, b: false })), 600)
    }
    prevFouls.current = { a: state.a.fouls, b: state.b.fouls }
  }, [state.a.score, state.b.score, state.a.fouls, state.b.fouls])

  // Alerta de lance na faixa inferior (Strip)
  const [strip, setStrip] = useState<{ show: boolean; cancel: boolean; html: string }>({
    show: false,
    cancel: false,
    html: '',
  })
  const lastFxId = useRef<string | null>(null)

  useEffect(() => {
    const fx = state.fx
    if (!fx || fx.id === lastFxId.current) return
    lastFxId.current = fx.id

    if (fx.type === 'foul') {
      const teamName = fx.short || fx.team || ''
      const playerName = fx.player ? ` · ${fx.player}` : ''
      setStrip({
        show: true,
        cancel: false,
        html: `<span class="tag">FALTA</span> <span>${teamName}${playerName}</span>`,
      })
      const timer = setTimeout(() => setStrip(s => ({ ...s, show: false })), 4800)
      return () => clearTimeout(timer)
    }

    if (fx.type === 'goal' && state.settings.goalAnim === 'bar') {
      const teamName = fx.short || fx.team || ''
      const playerName = fx.player ? ` · ${fx.player}` : ''
      setStrip({
        show: true,
        cancel: false,
        html: `<span class="tag goal">${fx.own ? 'GOL CONTRA' : 'GOL'}</span> <span>${teamName}${playerName}</span>`,
      })
      const timer = setTimeout(() => setStrip(s => ({ ...s, show: false })), 4800)
      return () => clearTimeout(timer)
    }

    if (fx.type === 'cancel') {
      const label = fx.of === 'goal' ? 'GOL CANCELADO' : 'FALTA CANCELADA'
      setStrip({
        show: true,
        cancel: true,
        html: `<span class="tag cancel">✕ ${label}</span>`,
      })
      const timer = setTimeout(() => setStrip(s => ({ ...s, show: false })), 3600)
      return () => clearTimeout(timer)
    }
  }, [state.fx, state.settings.goalAnim])

  // Animação de GOL em tela cheia (GFX)
  const [goalGfx, setGoalGfx] = useState<{
    play: boolean
    id: string
    team: string
    player: string
    score: string
    color: string
  }>({
    play: false,
    id: '',
    team: '',
    player: '',
    score: '',
    color: '#de04ac',
  })

  useEffect(() => {
    const fx = state.fx
    if (!fx || fx.type !== 'goal' || state.settings.goalAnim !== 'full') return

    setGoalGfx({
      play: true,
      id: fx.id,
      team: fx.team || '',
      player: fx.player || '',
      score: `${state.a.score} x ${state.b.score}`,
      color: fx.color || '#de04ac',
    })

    const timer = setTimeout(() => {
      setGoalGfx(g => ({ ...g, play: false }))
    }, 4000)

    return () => clearTimeout(timer)
  }, [state.fx?.id, state.settings.goalAnim])

  // Jogadora pode ser escolhida na mesa depois que a animação começou: lê do fx atual
  const liveFx = state.fx && state.fx.id === goalGfx.id ? state.fx : null

  // Textos na tela ativos
  const activeTexts = useMemo(() => {
    const onMap = state.texts.on
    const items = state.texts.items
    return {
      lower: items.find(t => t.id === onMap.lower) ?? null,
      center: items.find(t => t.id === onMap.center) ?? null,
      ticker: items.find(t => t.id === onMap.ticker) ?? null,
      badge: items.find(t => t.id === onMap.badge) ?? null,
    }
  }, [state.texts])

  // Posição e escala
  const posClass = `str-pos-${state.settings.pos || 'tl'}`
  const scaleStyle = { '--str-s': state.settings.scale || 1 } as React.CSSProperties

  const teamAName = state.settings.useShort ? state.a.short : state.a.name
  const teamBName = state.settings.useShort ? state.b.short : state.b.name

  return (
    <main
      className="str-overlay-root"
      style={{
        ...scaleStyle,
        // @ts-expect-error CSS variable
        '--str-a': state.a.color || '#de04ac',
        '--str-b': state.b.color || '#ff931e',
        '--str-gc': goalGfx.color,
        '--str-brand': state.settings.brand || '#ff931e',
      }}
    >
      {/* Placar permanente */}
      <div className={`str-board ${posClass} ${state.hidden ? 'hidden' : ''}`}>
        {state.label && <div className="str-label">{state.label}</div>}

        <div className="str-bar">
          {/* Lado A */}
          <div className="str-team a">
            <div className="str-chip" />
            <span>{teamAName}</span>
            {state.settings.showFouls && state.a.fouls > 0 && (
              <span className={`str-fb ${bumpFoul.a ? 'bump' : ''}`}>
                F:{state.a.fouls}
              </span>
            )}
          </div>

          <div className={`str-score a ${popScore.a ? 'pop' : ''}`}>
            <span>{state.a.score}</span>
          </div>

          {/* Relógio */}
          <div className={`str-clock ${isClockEnded ? 'ended' : state.clock.running ? '' : 'paused'}`}>
            {clockText}
          </div>

          {/* Lado B */}
          <div className={`str-score b ${popScore.b ? 'pop' : ''}`}>
            <span>{state.b.score}</span>
          </div>

          <div className="str-team b">
            {state.settings.showFouls && state.b.fouls > 0 && (
              <span className={`str-fb ${bumpFoul.b ? 'bump' : ''}`}>
                F:{state.b.fouls}
              </span>
            )}
            <span>{teamBName}</span>
            <div className="str-chip" />
          </div>
        </div>

        {/* Faixa inferior de alerta sob o placar */}
        <div className={`str-strip ${strip.show ? 'show' : ''} ${strip.cancel ? 'cancel' : ''}`}>
          <div
            className="str-strip-inner"
            dangerouslySetInnerHTML={{ __html: strip.html }}
          />
        </div>
      </div>

      {/* 1. Faixa inferior */}
      <div id="strLower" className={`str-tx ${activeTexts.lower ? 'on' : ''}`}>
        <div className="t">{activeTexts.lower?.title}</div>
        <div className="s">{activeTexts.lower?.sub}</div>
      </div>

      {/* 2. Cartão central */}
      <div id="strCenter" className={`str-tx ${activeTexts.center ? 'on' : ''}`}>
        <div className="card">
          <div className="t">{activeTexts.center?.title}</div>
          <div className="bar" />
          <div className="s">{activeTexts.center?.sub}</div>
        </div>
      </div>

      {/* 3. Letreiro rolante */}
      <div id="strTicker" className={`str-tx ${activeTexts.ticker ? 'on' : ''}`}>
        <div className="t">{activeTexts.ticker?.title}</div>
        <div className="lane">
          <div className="run">
            <span>{activeTexts.ticker?.sub}</span>
            <span>{activeTexts.ticker?.sub}</span>
          </div>
        </div>
      </div>

      {/* 4. Selo de canto */}
      <div id="strBadge" className={`str-tx ${activeTexts.badge ? 'on' : ''}`}>
        <i />
        <span className="tt">{activeTexts.badge?.title}</span>
        <span className="s">{activeTexts.badge?.sub}</span>
      </div>

      {/* Animação de GOL em tela cheia */}
      <div id="strGfx" className={goalGfx.play ? 'play' : ''}>
        <div className="dim" />
        <div className="band b2" />
        <div className="band b1" />
        <div className="band b3" />
        <div className="band b4" />
        <div className="rings"><i /><i /><i /></div>
        <div className="flash" />
        <div className="core">
          <div className="gol">{liveFx?.own ? 'GOL CONTRA' : 'GOL!'}</div>
          <div className="tm">{goalGfx.team}</div>
          {(liveFx?.player || goalGfx.player) && <div className="pl on">{liveFx?.player || goalGfx.player}</div>}
          <div className="sc"><b>{goalGfx.score}</b></div>
        </div>
      </div>
    </main>
  )
}
