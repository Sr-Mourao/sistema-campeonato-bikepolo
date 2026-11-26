import { useEffect, useMemo, useRef, useState } from 'react'
import { useObsDocument } from '../../hooks/useObsDocument'
import { useStreamingSync } from '../../hooks/useStreamingSync'
import {
  calculateElapsed,
  eventPlayerTeam,
  playerStatsFor,
  formatPauseTime,
  fxAgeMs,
  pauseRemainingMs,
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

  // Alerta de lance na faixa inferior (Strip). Derivado da idade do fx: antes
  // havia um setTimeout que qualquer atualização de estado cancelava, e a faixa
  // ficava presa na tela.
  const strip = (() => {
    const fx = state.fx
    if (!fx) return null
    const age = fxAgeMs(fx, clockOffset)
    const team = fx.short || fx.team || ''
    const who = fx.player ? ` · ${fx.player}` : ''
    if (fx.type === 'foul' && age < 4800) return { cancel: false, tag: 'FALTA', cls: '', text: team + who }
    const bar = state.settings.goalAnim === 'bar'
    if (fx.type === 'goal' && fx.own) {
      // Gol contra: a animação não diz quem foi; a autora aparece só aqui,
      // depois da animação (ou junto dela, no modo faixa)
      const from = bar ? 0 : 4900
      if (age < from || age >= from + 5000) return null
      const other = fx.side === 'a' ? state.b : state.a
      const otherName = other.short || other.name
      const by = fx.player ? `${fx.player} (${otherName})` : otherName
      return { cancel: false, tag: 'GOL CONTRA', cls: 'goal', text: by }
    }
    if (fx.type === 'goal' && bar && age < 4800) {
      return { cancel: false, tag: 'GOL', cls: 'goal', text: team + who }
    }
    // Lance anulado: aparece no canto inferior direito (.str-annul), não na faixa
    return null
  })()

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
    if (fxAgeMs(fx, clockOffset) > 6000) return

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
    }, 4800)

    return () => clearTimeout(timer)
  }, [state.fx?.id, state.settings.goalAnim])

  // Jogadora pode ser escolhida na mesa depois que a animação começou: lê do fx atual
  const liveFx = state.fx && state.fx.id === goalGfx.id ? state.fx : null

  // Cores: as dos times (como cadastradas) ou o padrão da IDV do site
  const idv = state.settings.colorMode === 'idv'
  const sideColor = (side: 'a' | 'b') =>
    idv ? (side === 'a' ? 'var(--pal-magenta)' : 'var(--pal-orange)') : state[side].color

  // Aviso grande de lance anulado (derivado do fx; o ticker de 250 ms re-renderiza)
  const annul = state.fx?.type === 'cancel' && fxAgeMs(state.fx, clockOffset) < 4500 ? state.fx : null

  // Cartão da jogadora: sobe pcDelay s depois da animação de gol (gol contra não tem autora)
  const card = (() => {
    const fx = state.fx
    const st = state.settings
    if (annul || !st.pcOn || !fx || fx.type !== 'goal' || fx.own || !fx.player) return null
    const ev = state.events.find(e => e.id === fx.id)
    if (!ev || !ev.player) return null
    const now = fx.at + fxAgeMs(fx, clockOffset)
    // o fx nasce quando a jogadora é escolhida, junto com a animação
    const start = fx.at + Math.max(0, st.pcDelay ?? 5) * 1000
    if (now < start || now > start + (st.pcSecs || 7) * 1000) return null
    const team = eventPlayerTeam(ev)
    const color = sideColor(team === state.b.name ? 'b' : 'a')
    const s = playerStatsFor(state, ev.player, team)
    const items: [number, string][] = []
    if (st.pcMatchGoals) items.push([s.matchGoals, s.matchGoals === 1 ? 'gol no jogo' : 'gols no jogo'])
    if (st.pcMatchFouls) items.push([s.matchFouls, s.matchFouls === 1 ? 'falta no jogo' : 'faltas no jogo'])
    if (st.pcChampGoals) items.push([s.champGoals, s.champGoals === 1 ? 'gol no campeonato' : 'gols no campeonato'])
    if (st.pcChampFouls) items.push([s.champFouls, s.champFouls === 1 ? 'falta no campeonato' : 'faltas no campeonato'])
    return { name: ev.player, team, color, own: !!ev.own, items }
  })()

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
      className={`str-overlay-root ${idv ? 'str-idv' : ''}`}
      style={{
        ...scaleStyle,
        // @ts-expect-error CSS variable
        '--str-a': sideColor('a') || '#de04ac',
        '--str-b': sideColor('b') || '#ff931e',
        '--str-gc': idv && state.fx?.type === 'goal' ? sideColor(state.fx.side || 'a') : goalGfx.color,
        '--str-brand': idv ? 'var(--pal-orange)' : state.settings.brand || '#ff931e',
      }}
    >
      {/* Placar permanente */}
      <div className={`str-board ${posClass} ${state.hidden ? 'hidden' : ''}`}>
        {state.label && <div className="str-label">{state.label}</div>}

        <div className="str-bar">
          {idv && <img className="str-idv-logo" src="/identidade/logo.svg" alt="" />}
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
        <div className={`str-strip ${strip ? 'show' : ''} ${strip?.cancel ? 'cancel' : ''}`}>
          <div className="str-strip-inner">
            {strip && <span className={`tag ${strip.cls}`}>{strip.tag}</span>}{' '}
            {strip?.text && <span>{strip.text}</span>}
          </div>
        </div>
        {/* Pausas dos times: cronômetro de cada time em pausa */}
        <div className="str-pauses">
          {(['a', 'b'] as const).map(side => {
            const p = state.pauses[side].active
            if (!p) return null
            const remaining = pauseRemainingMs(p, clockOffset)
            const pct = p.durMs > 0 ? Math.max(0, Math.min(100, (remaining / p.durMs) * 100)) : 0
            return (
              <div
                key={side}
                className={`str-pause ${remaining < 0 ? 'over' : ''} ${p.running ? '' : 'held'}`}
                style={{ '--tc': sideColor(side) } as React.CSSProperties}
              >
                <i className="dot" />
                <span className="k">
                  {p.kind === 'tech' ? `Pausa técnica ${state.pauses[side].techUsed}/${state.settings.techMax ?? 2}` : 'Pausa mecânica'}
                </span>
                <span className="tm">{side === 'a' ? teamAName : teamBName}</span>
                <span className="tt">{formatPauseTime(remaining)}</span>
                <div className="bar"><b style={{ width: `${pct}%` }} /></div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 1. Faixa inferior */}      <div id="strLower" className={`str-tx ${activeTexts.lower ? 'on' : ''}`}>
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

      {/* Lance anulado */}
      <div className={`str-annul ${annul ? 'on' : ''}`} style={{ '--str-ac': (annul && idv ? sideColor(annul.side || 'a') : annul?.color) || '#ff3b3b' } as React.CSSProperties}>
        <div className="x">✕</div>
        <div className="t">{annul?.of === 'foul' ? 'Falta anulada' : 'Gol anulado'}</div>
        <div className="s">{[annul?.team, annul?.player].filter(Boolean).join(' · ')}</div>
      </div>

      {/* Cartão da jogadora */}
      <div className={`str-pcard ${card ? 'on' : ''}`} style={{ '--tc': card?.color || '#ff931e' } as React.CSSProperties}>
        <div className="k">{card?.own ? 'Gol contra' : 'Gol'}</div>
        <div className="n">{card?.name}</div>
        <div className="tm">{card?.team}</div>
        {card && card.items.length > 0 && (
          <div className="st">
            {card.items.map(([v, label]) => (
              <span key={label}><b>{v}</b> {label}</span>
            ))}
          </div>
        )}
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
        {idv && <img className="str-gfx-lobo" src="/identidade/lobo.svg" alt="" />}
        <div className="core">
          <div className="gol">{liveFx?.own ? 'GOL CONTRA' : 'GOL!'}</div>
          <div className="tm">{goalGfx.team}</div>
          {!liveFx?.own && (liveFx?.player || goalGfx.player) && <div className="pl on">{liveFx?.player || goalGfx.player}</div>}
          <div className="sc"><b>{goalGfx.score}</b></div>
        </div>
      </div>
    </main>
  )
}
