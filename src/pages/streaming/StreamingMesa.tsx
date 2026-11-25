import { useEffect, useMemo, useRef, useState } from 'react'
import { useStreamingSync } from '../../hooks/useStreamingSync'
import {
  PALETTE_STREAMING,
  SIMULATION_TEAMS,
  exportPoloperatorCsv,
  getClockDisplayText,
} from '../../services/streamingState'
import './StreamingMesa.css'

export default function StreamingMesa() {
  const {
    state,
    teams,
    setTeams,
    device,
    updateDevice,
    serverOnline,
    peers,
    clockOffset,
    toggleClock,
    adjustClock,
    resetClock,
    swapSides,
    addEvent,
    removeEvent,
    assignPlayer,
    setTeam,
    updateSettings,
    setTextActive,
    addTextItem,
    removeTextItem,
    hideAllTexts,
    setHidden,
    setLabel,
    addScheduleGame,
    nextGame,
    resetAllMatch,
    addPlayerToTeam,
    undo,
  } = useStreamingSync()

  const [activeTab, setActiveTab] = useState<'teams' | 'games' | 'results' | 'settings'>('teams')
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [previewSize, setPreviewSize] = useState<'large' | 'small' | 'off'>('large')

  // Modais
  const [pickerSide, setPickerSide] = useState<'a' | 'b' | null>(null)
  const [pickerFilter, setPickerFilter] = useState('')
  const [showDeviceModal, setShowDeviceModal] = useState(false)
  const [deviceForm, setDeviceForm] = useState({ name: device.name, role: device.role })

  // Atribuição de lance pendente ("Quem marcou?")
  const [attrPrompt, setAttrPrompt] = useState<{ id: string; type: 'goal' | 'foul'; side: 'a' | 'b' } | null>(null)
  const [customPlayerInput, setCustomPlayerInput] = useState('')

  // Novo texto na tela
  const [newText, setNewText] = useState<{
    tpl: 'lower' | 'center' | 'ticker' | 'badge'
    title: string
    sub: string
    secs: number
  }>({
    tpl: 'lower',
    title: '',
    sub: '',
    secs: 0,
  })

  // Agendamento de novo jogo
  const [newGameA, setNewGameA] = useState('')
  const [newGameB, setNewGameB] = useState('')
  const [newGameLabel, setNewGameLabel] = useState('')

  // Confirmação antes de excluir/anular lances
  const [confirmDlg, setConfirmDlg] = useState<{ title: string; msg: string; onYes: () => void } | null>(null)

  const describeEvent = (ev: { type: string; team: string; player?: string; clock?: string }) =>
    `${ev.type === 'goal' ? 'Gol' : 'Falta'} · ${ev.team}${ev.player ? ` · ${ev.player}` : ''}${ev.clock ? ` (${ev.clock})` : ''}`

  const askRemoveEvent = (eventId: string) => {
    const ev = state.events.find(e => e.id === eventId)
    if (!ev) return
    setConfirmDlg({
      title: 'Anular lance?',
      msg: `${describeEvent(ev)}. O overlay vai mostrar o aviso de lance anulado.`,
      onYes: () => {
        removeEvent(eventId)
        showToast('Lance anulado')
      },
    })
  }

  const askRemoveLast = (type: 'goal' | 'foul', side: 'a' | 'b') => {
    const ev = [...state.events].reverse().find(e => e.type === type && e.side === side)
    if (!ev) {
      showToast(`Nenhum${type === 'goal' ? ' gol' : 'a falta'} para anular`)
      return
    }
    askRemoveEvent(ev.id)
  }

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(m => (m === msg ? null : m)), 2200)
  }

  // Prévia responsiva: mede o container para escalar o iframe 1920x1080 proporcionalmente
  const previewRef = useRef<HTMLDivElement>(null)
  const [previewScale, setPreviewScale] = useState(0.3)

  useEffect(() => {
    if (previewSize === 'off') return
    const el = previewRef.current
    if (!el) return

    const updateScale = () => {
      const w = el.clientWidth
      if (w > 0) {
        setPreviewScale(w / 1920)
      }
    }

    updateScale()
    const ro = new ResizeObserver(updateScale)
    ro.observe(el)
    window.addEventListener('resize', updateScale)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', updateScale)
    }
  }, [previewSize])
  const [clockTick, setClockTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setClockTick(t => t + 1), 250)
    return () => clearInterval(timer)
  }, [])

  const clockText = useMemo(() => {
    return getClockDisplayText(state.clock, state.settings, clockOffset)
  }, [state.clock, state.settings, clockOffset, clockTick])

  // Atalhos de teclado (1-3 para time A, 7-9 para time B)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se estiver digitando em um input
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return
      }

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        toggleClock()
        showToast(state.clock.running ? '⏸ Pausado' : '▶ Cronômetro rodando')
        return
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        if (undo()) showToast('Desfeito')
        return
      }

      // Atalhos numéricos para gols rápidos
      const key = e.key
      if (['1', '2', '3'].includes(key)) {
        const idx = Number(key) - 1
        const player = state.a.players[idx]
        if (player) {
          addEvent('goal', 'a', player.id)
          showToast(`GOL: ${player.name} (${state.a.name})`)
        }
      } else if (['7', '8', '9'].includes(key)) {
        const idx = Number(key) - 7
        const player = state.b.players[idx]
        if (player) {
          addEvent('goal', 'b', player.id)
          showToast(`GOL: ${player.name} (${state.b.name})`)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [addEvent, state.a.name, state.a.players, state.b.name, state.b.players, state.clock.running, toggleClock, undo])

  // Adição de lance com verificação de jogadoras
  const handleAddEvent = (type: 'goal' | 'foul', side: 'a' | 'b') => {
    const team = state[side]
    // Falta com uma única jogadora: atribui direto. Gol sempre abre a seleção
    // (pode ser gol contra, feito por jogadora do outro time).
    if (type === 'foul' && team.players.length === 1) {
      addEvent(type, side, team.players[0].id)
      showToast(`FALTA: ${team.players[0].name}`)
      return
    }

    const eventId = addEvent(type, side, null)
    setAttrPrompt({ id: eventId, type, side })
  }

  // Confirma atribuição de jogador (own = gol contra)
  const handleConfirmAttr = (pid: string | null, customName?: string, own = false) => {
    if (!attrPrompt) return
    assignPlayer(attrPrompt.id, pid, customName, own)
    setAttrPrompt(null)
    setCustomPlayerInput('')
    showToast(own ? 'Gol contra registrado' : 'Lance atribuído')
  }

  // Exportar Poloperator CSV
  const handleExportCsv = () => {
    const csv = exportPoloperatorCsv(state.events, state)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lances_${state.label ? state.label.replace(/\s+/g, '_') : 'jogo'}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Lances exportados para CSV')
  }

  // Copiar resultados do histórico
  const handleCopyResults = () => {
    if (state.history.length === 0) {
      showToast('Nenhum resultado registrado ainda')
      return
    }
    const lines = state.history.map(h => `${h.label || 'Jogo'}: ${h.a} ${h.sa} x ${h.sb} ${h.b}`)
    navigator.clipboard.writeText(lines.join('\n'))
    showToast('Resultados copiados para a área de transferência')
  }

  // Artilharia agregada e faltas
  const playerStats = useMemo(() => {
    const stats: Record<string, { name: string; team: string; goals: number; ownGoals: number; fouls: number }> = {}

    const all = [...state.events, ...state.history.flatMap(h => h.events || [])]
    for (const ev of all) {
      if (!ev.player) continue
      // Gol contra conta para a jogadora no time dela (playerTeam), não no que pontuou
      const team = ev.own ? ev.playerTeam || ev.team : ev.team
      const key = `${team}_${ev.player}`
      if (!stats[key]) {
        stats[key] = { name: ev.player, team, goals: 0, ownGoals: 0, fouls: 0 }
      }
      if (ev.type === 'goal' && ev.own) stats[key].ownGoals++
      else if (ev.type === 'goal') stats[key].goals++
      if (ev.type === 'foul') stats[key].fouls++
    }

    return Object.values(stats).sort((x, y) => y.goals - x.goals || x.fouls - y.fouls)
  }, [state.events, state.history])

  // Filtragem de times no modal
  const filteredTeams = useMemo(() => {
    if (!pickerFilter.trim()) return teams
    const q = pickerFilter.toLowerCase()
    return teams.filter(t => t.name.toLowerCase().includes(q) || t.short.toLowerCase().includes(q))
  }, [teams, pickerFilter])

  return (
    <div className="stm-page">
      {/* Top Header */}
      <header className="stm-header">
        <h1>MESA DE STREAMING · POLO</h1>

        <span className={`stm-status-badge ${serverOnline ? 'ok' : 'off'}`}>
          {serverOnline ? '● Servidor Conectado' : '○ Sincronização Local'}
        </span>

        <span className="stm-header-sp" />

        <div className="stm-header-actions">
          <a
            href="/streaming/overlay"
            target="_blank"
            rel="noreferrer"
            className="stm-btn mini"
            title="Abrir Overlay 1080p para OBS"
          >
            Overlay OBS 1080p ↗
          </a>
          <a
            href="/streaming/overlay/ajustado"
            target="_blank"
            rel="noreferrer"
            className="stm-btn mini"
            title="Abrir Overlay Ajustado para Mobile"
          >
            Overlay Mobile ↗
          </a>

          <button
            type="button"
            className="stm-btn mini"
            onClick={() => setPreviewSize(p => (p === 'large' ? 'small' : p === 'small' ? 'off' : 'large'))}
          >
            Prévia: {previewSize === 'large' ? 'Grande' : previewSize === 'small' ? 'Faixa' : 'Oculta'}
          </button>

          <button
            type="button"
            className="stm-btn mini"
            onClick={() => {
              setDeviceForm({ name: device.name, role: device.role })
              setShowDeviceModal(true)
            }}
          >
            👤 {device.name} ({device.role})
          </button>
        </div>

        {peers.length > 0 && (
          <div className="stm-peers">
            {peers.map(p => (
              <span key={p.id} className={`stm-peer ${p.id === device.id ? 'me' : ''}`}>
                {p.name} ({p.role})
              </span>
            ))}
          </div>
        )}
      </header>

      {/* Main Grid */}
      <main className="stm-main">
        {/* Painel Esquerdo: Ao Vivo */}
        <section className="stm-card">
          <h2>
            <span>Ao Vivo</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className={`stm-btn mini ${state.hidden ? 'danger' : ''}`}
                onClick={() => setHidden(!state.hidden)}
              >
                {state.hidden ? 'Placar Oculto' : 'Esconder Placar'}
              </button>
              <button type="button" className="stm-btn mini" onClick={() => undo()}>
                Desfazer
              </button>
            </div>
          </h2>

          {/* Sticky Overlay Preview */}
          <div ref={previewRef} className={`stm-preview ${previewSize}`}>
            <iframe
              src="/streaming/overlay?preview=1"
              title="Prévia Overlay"
              style={{ transform: `scale(${previewScale})` }}
            />
          </div>

          {/* Placar & Controles */}
          <div className="stm-scoreline">
            {/* Lado A */}
            <div className="stm-tside a">
              <button
                type="button"
                className="stm-team-btn"
                onClick={() => setPickerSide('a')}
                title="Trocar time A"
              >
                <span className="stm-chip" style={{ background: state.a.color }} />
                <span>{state.settings.useShort ? state.a.short : state.a.name}</span>
              </button>

              <div className="stm-score-block">
                <div className="stm-big-score" style={{ color: state.a.color }}>
                  {state.a.score}
                </div>
                <div className="stm-btnrow">
                  <button
                    type="button"
                    className="stm-btn mini g"
                    onClick={() => handleAddEvent('goal', 'a')}
                  >
                    + Gol
                  </button>
                  <button
                    type="button"
                    className="stm-btn mini"
                    onClick={() => askRemoveLast('goal', 'a')}
                  >
                    −
                  </button>
                </div>
                <div className="stm-fcount">
                  faltas <b>{state.a.fouls}</b>
                  <div className="stm-btnrow" style={{ marginTop: 4 }}>
                    <button
                      type="button"
                      className="stm-btn mini f"
                      onClick={() => handleAddEvent('foul', 'a')}
                    >
                      + Falta
                    </button>
                    <button
                      type="button"
                      className="stm-btn mini"
                      onClick={() => askRemoveLast('foul', 'a')}
                    >
                      −
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Centro: Relógio */}
            <div className="stm-clock-center">
              <div className={`stm-big-clock ${state.clock.running ? '' : 'paused'}`}>
                {clockText}
              </div>

              <div className="stm-btnrow">
                <button type="button" className="stm-btn" onClick={() => adjustClock(-10)}>
                  −10s
                </button>
                <button
                  type="button"
                  className={`stm-btn primary ${state.clock.running ? 'on' : ''}`}
                  onClick={toggleClock}
                >
                  {state.clock.running ? '⏸ Pausar' : '▶ Iniciar'}
                </button>
                <button type="button" className="stm-btn" onClick={() => adjustClock(10)}>
                  +10s
                </button>
              </div>

              <div className="stm-btnrow" style={{ marginTop: 4 }}>
                <button type="button" className="stm-btn mini" onClick={resetClock}>
                  Zerar Tempo
                </button>
                <button type="button" className="stm-btn mini" onClick={swapSides}>
                  ⇄ Inverter Lados
                </button>
              </div>
            </div>

            {/* Lado B */}
            <div className="stm-tside b">
              <button
                type="button"
                className="stm-team-btn"
                onClick={() => setPickerSide('b')}
                title="Trocar time B"
              >
                <span className="stm-chip" style={{ background: state.b.color }} />
                <span>{state.settings.useShort ? state.b.short : state.b.name}</span>
              </button>

              <div className="stm-score-block">
                <div className="stm-big-score" style={{ color: state.b.color }}>
                  {state.b.score}
                </div>
                <div className="stm-btnrow">
                  <button
                    type="button"
                    className="stm-btn mini g"
                    onClick={() => handleAddEvent('goal', 'b')}
                  >
                    + Gol
                  </button>
                  <button
                    type="button"
                    className="stm-btn mini"
                    onClick={() => askRemoveLast('goal', 'b')}
                  >
                    −
                  </button>
                </div>
                <div className="stm-fcount">
                  faltas <b>{state.b.fouls}</b>
                  <div className="stm-btnrow" style={{ marginTop: 4 }}>
                    <button
                      type="button"
                      className="stm-btn mini f"
                      onClick={() => handleAddEvent('foul', 'b')}
                    >
                      + Falta
                    </button>
                    <button
                      type="button"
                      className="stm-btn mini"
                      onClick={() => askRemoveLast('foul', 'b')}
                    >
                      −
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Elencos Ao Vivo com botões rápidos */}
          <div className="stm-rosters">
            {/* Roster A */}
            <div className="stm-roster">
              <div className="stm-rhead">
                <span className="stm-chip" style={{ background: state.a.color }} />
                <span>{state.a.name}</span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Atleta</th>
                    <th style={{ textAlign: 'center' }}>G</th>
                    <th style={{ textAlign: 'center' }}>F</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {state.a.players.map((p, idx) => {
                    const goals = state.events.filter(e => e.type === 'goal' && e.side === 'a' && e.pid === p.id).length
                    const fouls = state.events.filter(e => e.type === 'foul' && e.side === 'a' && e.pid === p.id).length
                    return (
                      <tr key={p.id}>
                        <td>
                          <span className="stm-k">{idx + 1}</span>
                          {p.name}
                        </td>
                        <td className="c gv">{goals}</td>
                        <td className="c fv">{fouls}</td>
                        <td className="btns">
                          <button
                            type="button"
                            className="stm-btn mini g"
                            onClick={() => {
                              addEvent('goal', 'a', p.id)
                              showToast(`GOL: ${p.name}`)
                            }}
                          >
                            +G
                          </button>
                          <button
                            type="button"
                            className="stm-btn mini f"
                            style={{ marginLeft: 4 }}
                            onClick={() => {
                              addEvent('foul', 'a', p.id)
                              showToast(`FALTA: ${p.name}`)
                            }}
                          >
                            +F
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {state.a.players.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ color: 'var(--pal-gray-60, #888)' }}>
                        Nenhum jogador cadastrado neste time.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Roster B */}
            <div className="stm-roster">
              <div className="stm-rhead">
                <span className="stm-chip" style={{ background: state.b.color }} />
                <span>{state.b.name}</span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Atleta</th>
                    <th style={{ textAlign: 'center' }}>G</th>
                    <th style={{ textAlign: 'center' }}>F</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {state.b.players.map((p, idx) => {
                    const goals = state.events.filter(e => e.type === 'goal' && e.side === 'b' && e.pid === p.id).length
                    const fouls = state.events.filter(e => e.type === 'foul' && e.side === 'b' && e.pid === p.id).length
                    return (
                      <tr key={p.id}>
                        <td>
                          <span className="stm-k">{idx + 7}</span>
                          {p.name}
                        </td>
                        <td className="c gv">{goals}</td>
                        <td className="c fv">{fouls}</td>
                        <td className="btns">
                          <button
                            type="button"
                            className="stm-btn mini g"
                            onClick={() => {
                              addEvent('goal', 'b', p.id)
                              showToast(`GOL: ${p.name}`)
                            }}
                          >
                            +G
                          </button>
                          <button
                            type="button"
                            className="stm-btn mini f"
                            style={{ marginLeft: 4 }}
                            onClick={() => {
                              addEvent('foul', 'b', p.id)
                              showToast(`FALTA: ${p.name}`)
                            }}
                          >
                            +F
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {state.b.players.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ color: 'var(--pal-gray-60, #888)' }}>
                        Nenhum jogador cadastrado neste time.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Rótulo e Próximo Jogo */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}>
            <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              Rótulo do jogo (ex.: Semifinal · Jogo 2)
              <input
                type="text"
                className="stm-input"
                value={state.label}
                onChange={e => setLabel(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="stm-btn primary"
              style={{ alignSelf: 'flex-end', height: 38 }}
              onClick={() => {
                nextGame()
                showToast('Avançado para o próximo jogo')
              }}
            >
              Próximo Jogo ▶
            </button>
          </div>

          {/* Lista de lances recentes */}
          <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 16 }}>
            Lances do Jogo ({state.events.length})
          </h3>
          <div className="stm-log">
            {state.events.map(ev => (
              <div key={ev.id} className="stm-ev">
                <span className="t">{ev.clock}</span>
                <span className={`stm-tag ${ev.type}`}>
                  {ev.type === 'goal' ? (ev.own ? 'GOL CONTRA' : 'GOL') : 'FALTA'}
                </span>
                <span className="tm">{ev.team}</span>
                <span style={{ flex: 1, fontWeight: 700 }}>
                  {ev.player || 'Sem autoria'}
                  {ev.own && ev.playerTeam && <small style={{ fontWeight: 400, opacity: 0.7 }}> ({ev.playerTeam})</small>}
                </span>
                <button
                  type="button"
                  className="stm-btn mini danger"
                  onClick={() => askRemoveEvent(ev.id)}
                  title="Excluir lance"
                >
                  ✕
                </button>
              </div>
            ))}
            {state.events.length === 0 && (
              <div style={{ color: 'var(--pal-gray-60, #888)', fontSize: 14, padding: 8 }}>
                Nenhum gol ou falta registrado nesta partida.
              </div>
            )}
          </div>
        </section>

        {/* Painel Direito: Textos na Tela & Abas */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Card: Textos na Tela */}
          <section className="stm-card">
            <h2>
              <span>Textos na Tela</span>
              <button type="button" className="stm-btn mini" onClick={hideAllTexts}>
                Esconder Todos
              </button>
            </h2>

            <div className="stm-txlist">
              {state.texts.items.map(item => {
                const isLive = state.texts.on[item.tpl] === item.id
                return (
                  <div key={item.id} className={`stm-txrow ${isLive ? 'live' : ''}`}>
                    <span className="tpl">
                      {item.tpl === 'lower'
                        ? 'Faixa'
                        : item.tpl === 'center'
                        ? 'Cartão'
                        : item.tpl === 'ticker'
                        ? 'Letreiro'
                        : 'Selo'}
                    </span>
                    <div>
                      <div className="tt">{item.title}</div>
                      {item.sub && <div className="ss">{item.sub}</div>}
                    </div>
                    <button
                      type="button"
                      className={`stm-btn mini ${isLive ? 'primary' : ''}`}
                      onClick={() => {
                        setTextActive(item.tpl, isLive ? null : item.id)
                        showToast(isLive ? 'Texto ocultado' : 'Texto colocado no ar!')
                      }}
                    >
                      {isLive ? 'No Ar' : 'Mostrar'}
                    </button>
                    <button
                      type="button"
                      className="stm-btn mini danger"
                      onClick={() => removeTextItem(item.id)}
                    >
                      ✕
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Formulário: Adicionar Novo Texto */}
            <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr auto', gap: 8, marginTop: 10 }}>
              <select
                className="stm-select"
                value={newText.tpl}
                onChange={e => setNewText(t => ({ ...t, tpl: e.target.value as any }))}
              >
                <option value="lower">Faixa Inferior</option>
                <option value="center">Cartão Central</option>
                <option value="ticker">Letreiro Rolante</option>
                <option value="badge">Selo de Canto</option>
              </select>
              <input
                type="text"
                className="stm-input"
                placeholder="Título (ex.: Intervalo)"
                value={newText.title}
                onChange={e => setNewText(t => ({ ...t, title: e.target.value }))}
              />
              <button
                type="button"
                className="stm-btn primary"
                onClick={() => {
                  if (!newText.title.trim()) return
                  addTextItem(newText)
                  setNewText({ tpl: 'lower', title: '', sub: '', secs: 0 })
                  showToast('Texto adicionado!')
                }}
              >
                + Adicionar
              </button>
              <input
                type="text"
                className="stm-input"
                placeholder="Subtítulo ou mensagem longa do letreiro..."
                style={{ gridColumn: '1 / -1' }}
                value={newText.sub}
                onChange={e => setNewText(t => ({ ...t, sub: e.target.value }))}
              />
            </div>
          </section>

          {/* Abas: Times, Jogos, Resultados, Ajustes */}
          <section className="stm-card">
            <div className="stm-tabs">
              <button
                type="button"
                className={activeTab === 'teams' ? 'sel' : ''}
                onClick={() => setActiveTab('teams')}
              >
                Times
              </button>
              <button
                type="button"
                className={activeTab === 'games' ? 'sel' : ''}
                onClick={() => setActiveTab('games')}
              >
                Jogos
              </button>
              <button
                type="button"
                className={activeTab === 'results' ? 'sel' : ''}
                onClick={() => setActiveTab('results')}
              >
                Resultados
              </button>
              <button
                type="button"
                className={activeTab === 'settings' ? 'sel' : ''}
                onClick={() => setActiveTab('settings')}
              >
                Ajustes
              </button>
            </div>

            {/* Aba Times */}
            {activeTab === 'teams' && (
              <div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <button
                    type="button"
                    className="stm-btn mini"
                    onClick={() => {
                      const newId = `t_${Date.now()}`
                      setTeams(prev => [
                        ...prev,
                        {
                          id: newId,
                          name: `Time ${prev.length + 1}`,
                          short: `T${prev.length + 1}`,
                          color: PALETTE_STREAMING[prev.length % PALETTE_STREAMING.length],
                          players: [],
                          score: 0,
                          fouls: 0,
                        },
                      ])
                      showToast('Time adicionado!')
                    }}
                  >
                    + Novo Time
                  </button>
                  <button
                    type="button"
                    className="stm-btn mini danger"
                    onClick={() => {
                      setTeams(SIMULATION_TEAMS)
                      showToast('Times do 2º PCP Curitiba carregados!')
                    }}
                  >
                    Carregar Times (2º PCP)
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 380, overflowY: 'auto' }}>
                  {teams.map(t => (
                    <div
                      key={t.id}
                      style={{
                        padding: 10,
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 8,
                      }}
                    >
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          type="color"
                          value={t.color}
                          onChange={e => {
                            const col = e.target.value
                            setTeams(prev => prev.map(x => (x.id === t.id ? { ...x, color: col } : x)))
                            if (state.a.id === t.id) setTeam('a', { color: col })
                            if (state.b.id === t.id) setTeam('b', { color: col })
                          }}
                          style={{ width: 34, height: 32, borderRadius: 4, cursor: 'pointer', border: 0 }}
                        />
                        <input
                          type="text"
                          className="stm-input"
                          value={t.name}
                          onChange={e => {
                            const val = e.target.value
                            setTeams(prev => prev.map(x => (x.id === t.id ? { ...x, name: val } : x)))
                            if (state.a.id === t.id) setTeam('a', { name: val })
                            if (state.b.id === t.id) setTeam('b', { name: val })
                          }}
                          style={{ flex: 1 }}
                        />
                        <input
                          type="text"
                          className="stm-input"
                          value={t.short}
                          maxLength={4}
                          onChange={e => {
                            const val = e.target.value
                            setTeams(prev => prev.map(x => (x.id === t.id ? { ...x, short: val } : x)))
                            if (state.a.id === t.id) setTeam('a', { short: val })
                            if (state.b.id === t.id) setTeam('b', { short: val })
                          }}
                          style={{ width: 64, textTransform: 'uppercase' }}
                        />
                      </div>

                      {/* Jogadores do Time */}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                        {t.players.map(p => (
                          <span
                            key={p.id}
                            style={{
                              background: 'rgba(255, 255, 255, 0.08)',
                              borderRadius: 4,
                              padding: '2px 8px',
                              fontSize: 13,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            {p.name}
                            <button
                              type="button"
                              onClick={() => {
                                setTeams(prev =>
                                  prev.map(x =>
                                    x.id === t.id ? { ...x, players: x.players.filter(pl => pl.id !== p.id) } : x,
                                  ),
                                )
                              }}
                              style={{ background: 'none', border: 0, color: '#ef4444', cursor: 'pointer' }}
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                        <input
                          type="text"
                          placeholder="+ Atleta + Enter"
                          className="stm-input"
                          style={{ width: 120, padding: '2px 6px', fontSize: 13 }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              const val = (e.target as HTMLInputElement).value
                              if (val.trim()) {
                                addPlayerToTeam(t.id || '', val.trim())
                                ;(e.target as HTMLInputElement).value = ''
                                showToast('Atleta adicionado ao time!')
                              }
                            }
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Aba Jogos */}
            {activeTab === 'games' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <select
                    className="stm-select"
                    value={newGameA}
                    onChange={e => setNewGameA(e.target.value)}
                  >
                    <option value="">Selecione Time A</option>
                    {teams.map(t => (
                      <option key={t.id} value={t.id || ''}>{t.name}</option>
                    ))}
                  </select>
                  <select
                    className="stm-select"
                    value={newGameB}
                    onChange={e => setNewGameB(e.target.value)}
                  >
                    <option value="">Selecione Time B</option>
                    {teams.map(t => (
                      <option key={t.id} value={t.id || ''}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    className="stm-input"
                    placeholder="Rótulo (ex.: Grupo A · Jogo 1)"
                    style={{ flex: 1 }}
                    value={newGameLabel}
                    onChange={e => setNewGameLabel(e.target.value)}
                  />
                  <button
                    type="button"
                    className="stm-btn primary"
                    onClick={() => {
                      if (!newGameA || !newGameB) return
                      addScheduleGame(newGameA, newGameB, newGameLabel)
                      setNewGameLabel('')
                      showToast('Jogo adicionado à ordem!')
                    }}
                  >
                    + Adicionar
                  </button>
                </div>

                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {state.schedule.map((sc, i) => {
                    const tA = teams.find(t => t.id === sc.a)
                    const tB = teams.find(t => t.id === sc.b)
                    const isCurrent = i === state.current
                    return (
                      <div
                        key={sc.id}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 6,
                          background: isCurrent ? 'rgba(255, 147, 30, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                          border: isCurrent ? '1px solid var(--pal-orange, #ff931e)' : '1px solid rgba(255, 255, 255, 0.08)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          fontSize: 14,
                        }}
                      >
                        <span style={{ fontWeight: 800 }}>#{i + 1}</span>
                        <span style={{ flex: 1 }}>
                          {sc.label ? `${sc.label}: ` : ''}
                          <strong>{tA?.name}</strong> x <strong>{tB?.name}</strong>
                        </span>
                        {isCurrent && <span className="stm-tag goal">Atual</span>}
                      </div>
                    )
                  })}
                  {state.schedule.length === 0 && (
                    <div style={{ color: 'var(--pal-gray-60, #888)', fontSize: 13 }}>
                      Nenhum jogo na fila. Adicione jogos acima.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Aba Resultados */}
            {activeTab === 'results' && (
              <div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <button type="button" className="stm-btn mini" onClick={handleCopyResults}>
                    Copiar Resultados
                  </button>
                  <button type="button" className="stm-btn mini primary" onClick={handleExportCsv}>
                    Exportar Lances (CSV)
                  </button>
                </div>

                {/* Histórico de Jogos */}
                <h4 style={{ fontSize: 13, textTransform: 'uppercase', marginBottom: 6 }}>
                  Histórico de Partidas
                </h4>
                <div style={{ maxHeight: 180, overflowY: 'auto', marginBottom: 16 }}>
                  {state.history.map((h, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '6px 10px',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 14,
                      }}
                    >
                      <span>{h.label || 'Jogo'}: <strong>{h.a}</strong> {h.sa} x {h.sb} <strong>{h.b}</strong></span>
                      <span style={{ color: 'var(--pal-gray-60, #888)', fontSize: 12 }}>
                        {new Date(h.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                  {state.history.length === 0 && (
                    <div style={{ color: 'var(--pal-gray-60, #888)', fontSize: 13 }}>
                      Nenhum jogo finalizado ainda.
                    </div>
                  )}
                </div>

                {/* Artilharia e Faltas */}
                <h4 style={{ fontSize: 13, textTransform: 'uppercase', marginBottom: 6 }}>
                  Artilharia & Faltas
                </h4>
                <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                  <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'left' }}>
                        <th style={{ padding: 4 }}>Atleta</th>
                        <th style={{ padding: 4 }}>Time</th>
                        <th style={{ padding: 4, textAlign: 'center' }}>Gols</th>
                        <th style={{ padding: 4, textAlign: 'center' }} title="Gols contra">GC</th>
                        <th style={{ padding: 4, textAlign: 'center' }}>Faltas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {playerStats.map((st, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                          <td style={{ padding: 4, fontWeight: 700 }}>{st.name}</td>
                          <td style={{ padding: 4, color: 'var(--pal-beige, #ebd7c8)' }}>{st.team}</td>
                          <td style={{ padding: 4, textAlign: 'center', color: '#55e68b', fontWeight: 800 }}>{st.goals}</td>
                          <td style={{ padding: 4, textAlign: 'center', color: '#ff6b6b', fontWeight: 800 }}>{st.ownGoals || ''}</td>
                          <td style={{ padding: 4, textAlign: 'center', color: 'var(--pal-amber-96, #f59e0b)', fontWeight: 800 }}>{st.fouls}</td>
                        </tr>
                      ))}
                      {playerStats.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ color: 'var(--pal-gray-60, #888)', padding: 8 }}>
                            Nenhum lance com autoria registrado.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Aba Ajustes */}
            {activeTab === 'settings' && (
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px 14px', alignItems: 'center', fontSize: 14 }}>
                <span>Duração do jogo</span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    className="stm-input"
                    style={{ width: 70 }}
                    value={state.settings.durMin}
                    onChange={e => updateSettings({ durMin: Number(e.target.value) || 18 })}
                  />
                  <span>minutos</span>
                </div>

                <span>Modo do relógio</span>
                <select
                  className="stm-select"
                  value={state.settings.mode}
                  onChange={e => updateSettings({ mode: e.target.value as any })}
                >
                  <option value="down">Regressivo (conta para baixo)</option>
                  <option value="up">Progressivo (conta para cima)</option>
                </select>

                <span>Posição do placar</span>
                <select
                  className="stm-select"
                  value={state.settings.pos}
                  onChange={e => updateSettings({ pos: e.target.value as any })}
                >
                  <option value="tl">Topo Esquerda</option>
                  <option value="tc">Topo Centro</option>
                  <option value="tr">Topo Direita</option>
                  <option value="bc">Embaixo Centro</option>
                </select>

                <span>Escala</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="range"
                    min={0.6}
                    max={1.6}
                    step={0.05}
                    value={state.settings.scale}
                    onChange={e => updateSettings({ scale: Number(e.target.value) })}
                  />
                  <span>{Math.round(state.settings.scale * 100)}%</span>
                </div>

                <span>Nome no placar</span>
                <select
                  className="stm-select"
                  value={state.settings.useShort ? 'short' : 'full'}
                  onChange={e => updateSettings({ useShort: e.target.value === 'short' })}
                >
                  <option value="full">Nome Completo</option>
                  <option value="short">Sigla</option>
                </select>

                <span>Animação de GOL</span>
                <select
                  className="stm-select"
                  value={state.settings.goalAnim}
                  onChange={e => updateSettings({ goalAnim: e.target.value as any })}
                >
                  <option value="full">Tela Cheia (Centro)</option>
                  <option value="bar">Faixa sob o placar</option>
                  <option value="off">Desligada</option>
                </select>

                <span>Cor de Destaque</span>
                <input
                  type="color"
                  value={state.settings.brand}
                  onChange={e => updateSettings({ brand: e.target.value })}
                  style={{ width: 40, height: 32, borderRadius: 4, cursor: 'pointer', border: 0 }}
                />

                <span>Faltas no placar</span>
                <select
                  className="stm-select"
                  value={state.settings.showFouls ? '1' : '0'}
                  onChange={e => updateSettings({ showFouls: e.target.value === '1' })}
                >
                  <option value="1">Mostrar contador</option>
                  <option value="0">Ocultar</option>
                </select>

                <span>Pausa automática</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={state.settings.autoPause}
                    onChange={e => updateSettings({ autoPause: e.target.checked })}
                  />
                  <span>Pausar em gol/falta nos últimos</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    className="stm-input"
                    style={{ width: 50 }}
                    value={state.settings.autoPauseMin}
                    onChange={e => updateSettings({ autoPauseMin: Number(e.target.value) || 2 })}
                  />
                  <span>min</span>
                </div>

                <div style={{ gridColumn: '1 / -1', marginTop: 12 }}>
                  <button
                    type="button"
                    className="stm-btn danger"
                    onClick={() => {
                      if (window.confirm('Deseja zerar os lances e o tempo do jogo atual?')) {
                        resetAllMatch()
                        showToast('Partida zerada')
                      }
                    }}
                  >
                    Zerar partida atual (lances e relógio)
                  </button>
                </div>
              </div>
            )}
          </section>
        </section>
      </main>

      {/* Modal: Seletor Rápido de Time */}
      {pickerSide && (
        <div className="stm-modal-backdrop" onClick={() => setPickerSide(null)}>
          <div className="stm-modal-box" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, marginBottom: 12, textTransform: 'uppercase' }}>
              Selecionar Time ({pickerSide === 'a' ? 'Esquerda' : 'Direita'})
            </h3>
            <input
              type="text"
              className="stm-input"
              placeholder="Filtrar times..."
              style={{ width: '100%', marginBottom: 12 }}
              value={pickerFilter}
              onChange={e => setPickerFilter(e.target.value)}
              autoFocus
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
              {filteredTeams.map(t => (
                <div
                  key={t.id}
                  onClick={() => {
                    setTeam(pickerSide, { ...t, score: 0, fouls: 0 })
                    setPickerSide(null)
                    setPickerFilter('')
                    showToast(`Time ${t.name} carregado no lado ${pickerSide.toUpperCase()}`)
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: 'rgba(255, 255, 255, 0.06)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <span className="stm-chip" style={{ background: t.color }} />
                  <span style={{ fontWeight: 800, fontSize: 16 }}>{t.name}</span>
                  <span style={{ color: 'var(--pal-gray-60, #888)', marginLeft: 'auto', fontSize: 13 }}>
                    {t.short} · {t.players.length} atletas
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <button type="button" className="stm-btn" onClick={() => setPickerSide(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Identidade do Aparelho */}
      {showDeviceModal && (
        <div className="stm-modal-backdrop" onClick={() => setShowDeviceModal(false)}>
          <div className="stm-modal-box" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, marginBottom: 12, textTransform: 'uppercase' }}>
              Perfil deste Aparelho
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14 }}>
                Nome do aparelho
                <input
                  type="text"
                  className="stm-input"
                  value={deviceForm.name}
                  onChange={e => setDeviceForm(f => ({ ...f, name: e.target.value }))}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14 }}>
                Perfil de operação
                <select
                  className="stm-select"
                  value={deviceForm.role}
                  onChange={e => setDeviceForm(f => ({ ...f, role: e.target.value as any }))}
                >
                  <option value="mesa">Mesa (Tempo, Gols e Faltas)</option>
                  <option value="overlays">Overlays (Textos e visual na tela)</option>
                  <option value="completo">Completo (Controle total)</option>
                </select>
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                <button type="button" className="stm-btn" onClick={() => setShowDeviceModal(false)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="stm-btn primary"
                  onClick={() => {
                    updateDevice(deviceForm)
                    setShowDeviceModal(false)
                    showToast('Perfil atualizado!')
                  }}
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Quem fez o lance? */}
      {attrPrompt && (() => {
        const side = attrPrompt.side
        const other = side === 'a' ? 'b' : 'a'
        const isGoal = attrPrompt.type === 'goal'
        return (
          <div className="stm-modal-backdrop">
            <div className="stm-modal-box stm-attr-modal" role="dialog" aria-modal="true">
              <h3>
                <span className={`stm-tag ${attrPrompt.type}`}>{isGoal ? 'GOL' : 'FALTA'}</span>
                <span className="stm-chip" style={{ background: state[side].color }} />
                {state[side].name}
              </h3>
              <p className="stm-attr-q">{isGoal ? 'Quem marcou?' : 'Quem cometeu?'}</p>
              <div className="stm-attr-grid">
                {state[side].players.map(p => (
                  <button key={p.id} type="button" className="stm-btn primary" onClick={() => handleConfirmAttr(p.id)}>
                    {p.name}
                  </button>
                ))}
              </div>

              {isGoal && state[other].players.length > 0 && (
                <>
                  <p className="stm-attr-q own">Gol contra · jogadora do {state[other].name}</p>
                  <div className="stm-attr-grid">
                    {state[other].players.map(p => (
                      <button key={p.id} type="button" className="stm-btn own" onClick={() => handleConfirmAttr(p.id, undefined, true)}>
                        {p.name}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div className="stm-attr-other">
                <input
                  type="text"
                  className="stm-input"
                  placeholder="Outra jogadora..."
                  value={customPlayerInput}
                  onChange={e => setCustomPlayerInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && customPlayerInput.trim()) handleConfirmAttr(null, customPlayerInput.trim())
                  }}
                />
                <button
                  type="button"
                  className="stm-btn"
                  disabled={!customPlayerInput.trim()}
                  onClick={() => handleConfirmAttr(null, customPlayerInput.trim())}
                >
                  OK
                </button>
              </div>

              <div className="stm-confirm-actions">
                <button
                  type="button"
                  className="stm-btn danger"
                  onClick={() => {
                    removeEvent(attrPrompt.id)
                    setAttrPrompt(null)
                    setCustomPlayerInput('')
                    showToast('Lance cancelado')
                  }}
                >
                  Cancelar lance
                </button>
                <button type="button" className="stm-btn" onClick={() => handleConfirmAttr(null)}>
                  Sem autoria
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal: Confirmação de exclusão/anulação */}
      {confirmDlg && (
        <div className="stm-modal-backdrop" onClick={() => setConfirmDlg(null)}>
          <div className="stm-modal-box stm-confirm" role="alertdialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <h3>{confirmDlg.title}</h3>
            <p>{confirmDlg.msg}</p>
            <div className="stm-confirm-actions">
              <button type="button" className="stm-btn" autoFocus onClick={() => setConfirmDlg(null)}>
                Manter
              </button>
              <button
                type="button"
                className="stm-btn danger"
                onClick={() => {
                  confirmDlg.onYes()
                  setConfirmDlg(null)
                }}
              >
                Sim, anular
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && <div className="stm-toast">{toastMessage}</div>}
    </div>
  )
}
