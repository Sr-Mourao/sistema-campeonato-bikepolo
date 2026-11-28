import { useEffect, useMemo, useRef, useState } from 'react'
import { useStreamingSync } from '../../hooks/useStreamingSync'
import {
  PALETTE_STREAMING,
  SIMULATION_TEAMS,
  getClockDisplayText,
  pausedForText,
  POPUP_MS,
  textAgeMs,
  type StreamingTextTpl,
  type StreamingPlayer,
  type StreamingTeam,
} from '../../services/streamingState'
import { torneioApi, type Jogo, type Torneio, type TipoGol } from '../../admin/torneio/torneioApi'
import PausePanel from './PausePanel'
import { cenasDaCentral, defaultHideBoard } from './centralScenes'
import { torneioPublico } from '../../services/torneioPublico'
import { formatoDe } from '../../services/formatoTorneio'
import './StreamingMesa.css'

const ROLE_LABEL: Record<string, string> = { mesa: 'Árbitro', overlays: 'Operador da live', completo: 'Completo' }

export default function StreamingMesa() {
  const {
    state,
    teams,
    setTeams,
    device,
    updateDevice,
    serverOnline,
    syncError,
    peers,
    clockOffset,
    toggleClock,
    adjustClock,
    resetClock,
    swapSides,
    addEvent,
    removeEvent,
    assignPlayer,
    moveEventSide,
    setTeam,
    setScene,
    editHistoryEvent,
    updateSettings,
    setTextActive,
    addTextItem,
    removeTextItem,
    hideAllTexts,
    setHidden,
    setLabel,
    addScheduleGame,
    nextGame,
    linkTournamentMatch,
    unlinkTournamentMatch,
    resetAllMatch,
    startPause,
    togglePauseTimer,
    adjustPause,
    endPause,
    addPlayerToTeam,
    undo,
  } = useStreamingSync()

  const askAnnulPause = (side: 'a' | 'b') => {
    const p = state.pauses[side].active
    if (!p) return
    setConfirmDlg({
      title: 'Anular pausa?',
      msg: `${p.kind === 'tech' ? 'Pausa técnica' : 'Pausa mecânica'} · ${state[side].name}. Ela não será contada para o time.`,
      onYes: () => {
        endPause(side, true)
        showToast('Pausa anulada')
      },
    })
  }

  // Partida encerrada aberta na aba Resultados (índice no histórico)
  const [histOpen, setHistOpen] = useState<number | null>(null)

  // Cenas da Central com dados simulados (?preview=1), para ensaiar a live
  const [centralPreview, setCentralPreview] = useState(false)
  // 2° Pior: sem Repescagem → a cena vira "Cruzamentos da Double". Sem resposta do backend, mantém o catálogo completo.
  const [comRepescagem, setComRepescagem] = useState(true)
  useEffect(() => {
    torneioPublico.resumo('misto').then(r => setComRepescagem(formatoDe(r.torneio).repescagem)).catch(() => {})
  }, [])
  // Ensaio usa os dados de teste do formato atual (8 times, sem Repescagem).
  const cenas = cenasDaCentral(centralPreview ? false : comRepescagem)
  const [activeTab, setActiveTab] = useState<'teams' | 'games' | 'results' | 'settings'>('teams')
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [previewSize, setPreviewSize] = useState<'large' | 'small' | 'off'>('large')

  // Modais
  const [pickerSide, setPickerSide] = useState<'a' | 'b' | null>(null)
  const [pickerFilter, setPickerFilter] = useState('')
  const [showDeviceModal, setShowDeviceModal] = useState(false)
  const [deviceForm, setDeviceForm] = useState({ name: device.name, role: device.role })

  // Atribuição de lance pendente ("Quem marcou?")
  // edit = corrigindo um lance já registrado (não é lance novo)
  const [attrPrompt, setAttrPrompt] = useState<{ id: string; type: 'goal' | 'foul'; side: 'a' | 'b'; edit?: boolean } | null>(null)
  const [customPlayerInput, setCustomPlayerInput] = useState('')

  // Novo texto na tela
  const [newText, setNewText] = useState<{
    tpl: StreamingTextTpl
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

  // Integração com Torneio Oficial
  const [torneiosList, setTorneiosList] = useState<Torneio[]>([])
  const [selectedTorneioId, setSelectedTorneioId] = useState<number | null>(null)
  const [torneioJogos, setTorneioJogos] = useState<Jogo[]>([])
  const [showMatchPicker, setShowMatchPicker] = useState(false)
  const [showFinalizeModal, setShowFinalizeModal] = useState(false)
  const [loadingTournament, setLoadingTournament] = useState(false)
  const [submittingSumula, setSubmittingSumula] = useState(false)
  const [finalizeOvertime, setFinalizeOvertime] = useState(false)
  const [finalizeNotes, setFinalizeNotes] = useState('')

  // Confirmação antes de excluir/anular lances
  // typeWord: ação grave, só libera o botão depois de digitar a palavra
  const [confirmDlg, setConfirmDlg] = useState<{ title: string; msg: string; yes?: string; typeWord?: string; onYes: () => void } | null>(null)
  const [confirmTyped, setConfirmTyped] = useState('')
  const askRestartMatch = () => {
    setConfirmTyped('')
    setConfirmDlg({
      title: 'Reiniciar a partida?',
      msg: `Zera placar, faltas, todos os ${state.events.length} lances, pausas e relógio de ${state.a.name} x ${state.b.name}. Os times continuam.`,
      yes: 'Reiniciar partida',
      typeWord: 'ZERAR',
      onYes: () => {
        resetAllMatch()
        showToast('Partida reiniciada')
      },
    })
  }

  const loadGameIntoMesa = async (torneioId: number, torneioNome: string, jogo: Jogo) => {
    setLoadingTournament(true)
    try {
      const sumulaData = await torneioApi.sumula(torneioId, jogo.id)
      if (!sumulaData) {
        showToast('Não foi possível carregar os dados da súmula')
        return
      }
      const elenco = sumulaData.elenco || []

      const playersA: StreamingPlayer[] = elenco
        .filter(m => m.time_id === jogo.time_a_id)
        .map(m => ({ id: `p_${m.membro_id}`, name: m.nome, membroId: m.membro_id }))

      const playersB: StreamingPlayer[] = elenco
        .filter(m => m.time_id === jogo.time_b_id)
        .map(m => ({ id: `p_${m.membro_id}`, name: m.nome, membroId: m.membro_id }))

      const teamA: StreamingTeam = {
        id: `t_${jogo.time_a_id}`,
        name: jogo.time_a_nome || 'Time A',
        short: (jogo.time_a_nome || 'TMA').slice(0, 3).toUpperCase(),
        color: PALETTE_STREAMING[0],
        score: 0,
        fouls: 0,
        players: playersA,
      }

      const teamB: StreamingTeam = {
        id: `t_${jogo.time_b_id}`,
        name: jogo.time_b_nome || 'Time B',
        short: (jogo.time_b_nome || 'TMB').slice(0, 3).toUpperCase(),
        color: PALETTE_STREAMING[1],
        score: 0,
        fouls: 0,
        players: playersB,
      }

      if (jogo.status === 'agendado' || jogo.status === 'chamado') {
        try {
          await torneioApi.atualizarPartida(torneioId, jogo.id, { status: 'em_andamento' })
        } catch {
          // ignora aviso se já houver outra em andamento
        }
      }

      linkTournamentMatch(
        {
          torneioId,
          torneioNome,
          jogoId: jogo.id,
          jogoCodigo: jogo.codigo,
          faseRotulo: jogo.fase_rotulo,
          faseTipo: jogo.fase_tipo,
          timeAId: jogo.time_a_id!,
          timeBId: jogo.time_b_id!,
        },
        teamA,
        teamB,
        `${jogo.fase_rotulo} · ${jogo.codigo}`,
      )

      showToast(`Partida ${jogo.codigo} carregada na mesa!`)
      setShowMatchPicker(false)
    } catch (err) {
      showToast('Erro ao carregar partida: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setLoadingTournament(false)
    }
  }

  const loadNextTournamentMatch = async () => {
    setLoadingTournament(true)
    try {
      const res = await torneioApi.listar()
      const list = res?.torneios || []
      if (list.length === 0) {
        showToast('Nenhum torneio cadastrado')
        return
      }
      const activeT = list.find(t => t.estado !== 'FINALIZADO') || list[0]
      const detalhe = await torneioApi.detalhe(activeT.id)

      const jogosRes = await torneioApi.jogos(activeT.id)
      const validJogos = jogosRes?.jogos ? jogosRes.jogos.filter(j => j.is_bye === 0 && j.time_a_id && j.time_b_id) : []

      let targetJogo: Jogo | null = null
      if (detalhe?.jogo_destaque_codigo) {
        targetJogo = validJogos.find(j => j.codigo === detalhe.jogo_destaque_codigo) || null
      }

      if (!targetJogo) {
        targetJogo = validJogos.find(j => j.status === 'em_andamento')
          || validJogos.find(j => j.status === 'chamado')
          || validJogos.find(j => j.status === 'agendado')
          || null
      }

      if (!targetJogo) {
        showToast('Nenhuma partida agendada encontrada no torneio')
        return
      }

      await loadGameIntoMesa(activeT.id, activeT.nome, targetJogo)
    } catch (err) {
      showToast('Erro ao buscar próxima partida: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setLoadingTournament(false)
    }
  }

  const openMatchPicker = async () => {
    setLoadingTournament(true)
    try {
      const res = await torneioApi.listar()
      const list = res?.torneios || []
      setTorneiosList(list)
      if (list.length > 0) {
        const tid = selectedTorneioId || (state.tournament?.torneioId ?? list.find(t => t.estado !== 'FINALIZADO')?.id ?? list[0].id)
        setSelectedTorneioId(tid)
        const jRes = await torneioApi.jogos(tid)
        setTorneioJogos(jRes?.jogos ? jRes.jogos.filter(j => j.is_bye === 0 && j.time_a_id && j.time_b_id) : [])
      }
      setShowMatchPicker(true)
    } catch (err) {
      showToast('Erro ao listar jogos: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setLoadingTournament(false)
    }
  }

  const handleSelectTorneioTab = async (torneioId: number) => {
    setSelectedTorneioId(torneioId)
    setLoadingTournament(true)
    try {
      const jRes = await torneioApi.jogos(torneioId)
      setTorneioJogos(jRes?.jogos ? jRes.jogos.filter(j => j.is_bye === 0 && j.time_a_id && j.time_b_id) : [])
    } catch (err) {
      showToast('Erro ao carregar jogos: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setLoadingTournament(false)
    }
  }

  const askUnlinkMatch = () => setConfirmDlg({
    title: 'Desvincular partida do torneio?',
    msg: 'A mesa voltará ao modo avulso/simulação. Os lances atuais não serão enviados ao torneio.',
    yes: 'Sim, desvincular',
    onYes: () => {
      unlinkTournamentMatch()
      showToast('Partida desvinculada do torneio')
    },
  })

  const handleFinalizeAndSubmit = async () => {
    if (!state.tournament) return
    const tourney = state.tournament
    setSubmittingSumula(true)
    try {
      // 1. Enviar gols
      for (const ev of state.events) {
        if (ev.type === 'goal' && !ev.fxPending) {
          const teamId = ev.side === 'a' ? tourney.timeAId : tourney.timeBId
          const tipo: TipoGol = ev.own ? 'gol_contra' : (ev.membroId ? 'normal' : 'sem_autoria')
          const minuto = Math.max(1, Math.floor((ev.gt || 0) / 60000) + 1)
          await torneioApi.registrarGol(
            tourney.torneioId,
            tourney.jogoId,
            teamId,
            ev.membroId || null,
            tipo,
            minuto,
          )
        }
      }

      // 2. Enviar faltas que tenham membro_id
      for (const ev of state.events) {
        if (ev.type === 'foul' && !ev.fxPending) {
          const teamId = ev.side === 'a' ? tourney.timeAId : tourney.timeBId
          if (ev.membroId) {
            await torneioApi.registrarFalta(
              tourney.torneioId,
              tourney.jogoId,
              teamId,
              ev.membroId,
            )
          }
        }
      }

      // 3. Encerrar partida no torneio
      await torneioApi.atualizarPartida(tourney.torneioId, tourney.jogoId, {
        status: 'encerrado',
        placar_a: state.a.score,
        placar_b: state.b.score,
        overtime: finalizeOvertime ? 1 : 0,
        observacoes: finalizeNotes.trim() || undefined,
      })

      // 4. Salvar no histórico local e limpar mesa
      resetAllMatch()
      unlinkTournamentMatch()
      setShowFinalizeModal(false)
      setFinalizeNotes('')
      setFinalizeOvertime(false)
      showToast(`Partida ${tourney.jogoCodigo} encerrada e oficializada no torneio!`)
    } catch (err) {
      showToast('Erro ao oficializar resultado: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setSubmittingSumula(false)
    }
  }

  // Ações que mexem no jogo todo: pedem confirmação (um toque sem querer no celular)
  const askNextGame = () => {
    if (state.tournament) {
      setShowFinalizeModal(true)
      return
    }
    setConfirmDlg({
      title: 'Encerrar este jogo?',
      msg: `${state.a.name} ${state.a.score} x ${state.b.score} ${state.b.name} vai para o histórico, e o placar, as faltas, os lances e o relógio são zerados.`,
      yes: 'Sim, próximo jogo',
      onYes: () => {
        nextGame()
        showToast('Avançado para o próximo jogo')
      },
    })
  }
  const askResetClock = () => setConfirmDlg({
    title: 'Zerar o tempo?',
    msg: 'O relógio volta ao início. Placar e lances continuam.',
    yes: 'Sim, zerar',
    onYes: resetClock,
  })
  const askSwapSides = () => setConfirmDlg({
    title: 'Inverter os lados?',
    msg: `${state.b.name} passa para a esquerda e ${state.a.name} para a direita, na mesa e no overlay.`,
    yes: 'Sim, inverter',
    onYes: swapSides,
  })
  // Algum modal aberto: atalhos de teclado ficam desligados
  const modalOpen = !!(attrPrompt || confirmDlg || pickerSide || showDeviceModal || showMatchPicker || showFinalizeModal)

  const evLabel = (ev: { type: string; own?: boolean; pauseKind?: string }) =>
    ev.type === 'goal' ? (ev.own ? 'Gol contra' : 'Gol') : ev.type === 'pause' ? (ev.pauseKind === 'mech' ? 'Pausa mecânica' : 'Pausa técnica') : 'Falta'
  const describeEvent = (ev: { type: string; team: string; player?: string; clock?: string; own?: boolean; pauseKind?: string }) =>
    `${evLabel(ev)} · ${ev.team}${ev.player ? ` · ${ev.player}` : ''}${ev.clock ? ` (${ev.clock})` : ''}`

  const s_pauseAtiva = (ev: { id: string; side: 'a' | 'b' }) => state.pauses[ev.side].active?.eventId === ev.id
  const askRemoveEvent = (eventId: string) => {
    const ev = state.events.find(e => e.id === eventId)
    if (!ev) return
    setConfirmDlg({
      title: 'Anular lance?',
      msg: ev.type === 'pause'
        ? `${describeEvent(ev)}. A pausa volta a ficar disponível para o time${s_pauseAtiva(ev) ? ' e o cronômetro dela é encerrado' : ''}.`
        : `${describeEvent(ev)}. O overlay vai mostrar o aviso de lance anulado.`,
      onYes: () => {
        removeEvent(eventId)
        showToast(ev.type === 'pause' ? 'Pausa anulada e devolvida ao time' : 'Lance anulado')
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
  // Só na mesa: há quanto tempo o jogo está parado
  const pausedFor = pausedForText(state.clock, clockOffset) // re-render a cada 250 ms pelo clockTick

  // Atalhos de teclado (1-3 para time A, 7-9 para time B)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se estiver digitando em um input
      // Esc fecha o modal de cima (o lance novo continua pendente, ✎ reabre)
      if (e.key === 'Escape') {
        if (confirmDlg) setConfirmDlg(null)
        else if (attrPrompt) setAttrPrompt(null)
        return
      }
      // Com um modal aberto, nenhuma tecla mexe no jogo por trás dele — nem o
      // Espaço/Enter "clicando" no botão que ficou com foco (ex.: o "+ Gol")
      if (modalOpen) {
        const inModal = (e.target as HTMLElement)?.closest?.('.stm-modal-backdrop')
        if (!inModal && (e.key === ' ' || e.key === 'Enter')) e.preventDefault()
        return
      }
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
  }, [addEvent, attrPrompt, confirmDlg, modalOpen, state.a.name, state.a.players, state.b.name, state.b.players, state.clock.running, toggleClock, undo])

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
    showToast(attrPrompt.edit ? 'Lance corrigido' : own ? 'Gol contra registrado' : 'Lance atribuído')
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
    const stats: Record<string, { name: string; team: string; goals: number; fouls: number }> = {}

    const all = [...state.events, ...state.history.flatMap(h => h.events || [])]
    for (const ev of all) {
      // Gol contra é do time, não tem autora: fica fora da artilharia
      if (!ev.player || ev.own) continue
      const team = ev.team
      const key = `${team}_${ev.player}`
      if (!stats[key]) {
        stats[key] = { name: ev.player, team, goals: 0, fouls: 0 }
      }
      if (ev.type === 'goal') stats[key].goals++
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
    <div className={`stm-page role-${device.role}`}>
      {/* O servidor não gravou o último envio: a transmissão está parada no placar anterior */}
      {syncError && (
        <div className="stm-sync-error" role="alert">
          NÃO SINCRONIZADO — a transmissão não está recebendo: {syncError}
        </div>
      )}

      {/* Top Header */}
      <header className="stm-header">
        <h1>MESA DE STREAMING · POLO</h1>

        <span className={`stm-status-badge ${serverOnline ? 'ok' : 'off'}`}>
          {serverOnline ? '● Servidor Conectado' : '○ Sincronização Local'}
        </span>
        <span className="stm-origin" title="Endereço em que esta mesa está operando">
          {window.location.origin}
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
          {/* Modo da tela: cada função vê só o que precisa */}
          <div className="stm-modes" role="group" aria-label="Modo da mesa">
            {([
              ['mesa', '📱 Árbitro', 'Modo árbitro: só placar, tempo e pausas'],
              ['overlays', '🎬 Live', 'Operador da live: textos na tela e cenas da Central'],
              ['completo', '🖥 Completo', 'Modo completo'],
            ] as const).map(([role, label, toast]) => (
              <button
                key={role}
                type="button"
                className={`stm-btn mini ${device.role === role ? 'on' : ''}`}
                aria-pressed={device.role === role}
                onClick={() => {
                  updateDevice({ role })
                  showToast(toast)
                }}
              >
                {label}
              </button>
            ))}
          </div>

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
            👤 {device.name} · {ROLE_LABEL[device.role] ?? device.role}
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

          {/* Banner de Integração com o Torneio */}
          {state.tournament ? (
            <div className="stm-tourney-bar">
              <div className="stm-tourney-info">
                <span className="stm-tourney-badge">🏆 Torneio</span>
                <span>
                  <b>{state.tournament.torneioNome}</b> · {state.tournament.faseRotulo} (<b>{state.tournament.jogoCodigo}</b>)
                </span>
              </div>
              <div className="stm-tourney-actions">
                <button
                  type="button"
                  className="stm-btn mini primary"
                  onClick={() => setShowFinalizeModal(true)}
                  title="Revisar súmula e oficializar resultado"
                >
                  🏁 Finalizar Partida
                </button>
                <button
                  type="button"
                  className="stm-btn mini"
                  onClick={openMatchPicker}
                  title="Trocar partida vinculada"
                >
                  Trocar Jogo
                </button>
                <button
                  type="button"
                  className="stm-btn mini"
                  onClick={askUnlinkMatch}
                  title="Desvincular do torneio (modo avulso)"
                >
                  Desvincular
                </button>
              </div>
            </div>
          ) : (
            <div className="stm-tourney-bar unlinked">
              <div className="stm-tourney-info">
                <span className="stm-tourney-badge off">Modo Avulso</span>
                <span>Nenhum jogo do torneio vinculado à mesa.</span>
              </div>
              <div className="stm-tourney-actions">
                <button
                  type="button"
                  className="stm-btn mini primary"
                  disabled={loadingTournament}
                  onClick={loadNextTournamentMatch}
                  title="Carregar automaticamente a próxima partida da fila do torneio"
                >
                  {loadingTournament ? 'Carregando…' : '📥 Carregar Próxima Partida'}
                </button>
                <button
                  type="button"
                  className="stm-btn mini"
                  disabled={loadingTournament}
                  onClick={openMatchPicker}
                  title="Escolher uma partida específica da tabela"
                >
                  Selecionar Jogo…
                </button>
              </div>
            </div>
          )}

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
              {pausedFor && <div className="stm-paused-for">⏸ parado há {pausedFor}</div>}

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
                <button type="button" className="stm-btn mini" onClick={askResetClock}>
                  Zerar Tempo
                </button>
                <button type="button" className="stm-btn mini" onClick={askSwapSides}>
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

          {/* Pausas dos times */}
          <div className="stm-pauses">
            {(['a', 'b'] as const).map(side => (
              <PausePanel
                key={side}
                side={side}
                team={state[side]}
                pause={state.pauses[side]}
                settings={state.settings}
                clockOffset={clockOffset}
                onStart={(sd, kind) => {
                  startPause(sd, kind)
                  showToast(`${kind === 'tech' ? 'Pausa técnica' : 'Pausa mecânica'}: ${state[sd].name}`)
                }}
                onToggle={togglePauseTimer}
                onAdjust={adjustPause}
                onEnd={sd => endPause(sd)}
                onAnnul={askAnnulPause}
              />
            ))}
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
          <div className="stm-label-row" style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}>
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
              onClick={askNextGame}
            >
              {state.tournament ? '🏁 Finalizar Partida' : 'Próximo Jogo ▶'}
            </button>
          </div>

          {/* Lista de lances recentes */}
          <h3 className="stm-log-title" style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 16 }}>
            Lances do Jogo ({state.events.length})
          </h3>
          <div className="stm-log">
            {[...state.events].reverse().map(ev => (
              <div key={ev.id} className="stm-ev">
                <span className="t">{ev.clock}</span>
                <span className={`stm-tag ${ev.type}`}>
                  {ev.type === 'pause' ? (ev.pauseKind === 'mech' ? 'PAUSA MEC.' : 'PAUSA TÉC.') : ev.type === 'goal' ? (ev.own ? 'GOL CONTRA' : 'GOL') : 'FALTA'}
                </span>
                <span className="tm">{ev.team}</span>
                <span style={{ flex: 1, fontWeight: 700 }}>
                  {ev.type === 'pause' ? (s_pauseAtiva(ev) ? '⏱ em andamento' : 'pedida pelo time') : ev.fxPending ? '⏳ definir jogadora' : ev.own ? `${ev.player || 'contra'} (${ev.playerTeam || 'adversário'})` : ev.player || 'Sem autoria'}
                </span>
                {ev.type !== 'pause' && (
                  <button
                    type="button"
                    className="stm-btn mini"
                    onClick={() => ev.type !== 'pause' && setAttrPrompt({ id: ev.id, type: ev.type, side: ev.side, edit: true })}
                    title="Corrigir lance (jogadora ou time)"
                  >
                    ✎
                  </button>
                )}
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
                Nenhum lance registrado nesta partida.
              </div>
            )}
          </div>

          {/* Reiniciar: discreto, no fim da coluna, e pede para digitar ZERAR */}
          <div className="stm-danger-zone">
            <button type="button" className="stm-btn mini" onClick={askRestartMatch}>
              ↺ Reiniciar partida (zera lances)
            </button>
          </div>
        </section>

        {/* Painel Direito: Textos na Tela & Abas */}
        <section className="stm-side" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                // Pop-up sai sozinho: depois do tempo dele, o botão volta a "Mostrar" (e repete)
                const isLive = state.texts.on[item.tpl] === item.id &&
                  (item.tpl !== 'popup' || textAgeMs(state.texts.at.popup, clockOffset) < POPUP_MS)
                return (
                  <div key={item.id} className={`stm-txrow ${isLive ? 'live' : ''}`}>
                    <span className="tpl">
                      {item.tpl === 'lower'
                        ? 'Faixa'
                        : item.tpl === 'center'
                        ? 'Cartão'
                        : item.tpl === 'ticker'
                        ? 'Letreiro'
                        : item.tpl === 'popup'
                        ? 'Pop-up'
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
            <div className="stm-newtext" style={{ display: 'grid', gridTemplateColumns: '130px minmax(0, 1fr) auto', gap: 8, marginTop: 10 }}>
              <select
                className="stm-select"
                value={newText.tpl}
                onChange={e => setNewText(t => ({ ...t, tpl: e.target.value as any }))}
              >
                <option value="lower">Faixa Inferior</option>
                <option value="center">Cartão Central</option>
                <option value="ticker">Letreiro Rolante</option>
                <option value="badge">Selo de Canto</option>
                <option value="popup">Pop-up animado</option>
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

          {/* Card: Cenas da Central — vão para dentro do overlay principal */}
          <section className="stm-card stm-central">
            <h2>
              <span>Cenas da Central</span>
              {state.scene && (
                <button type="button" className="stm-btn mini danger" onClick={() => setScene(null)}>
                  ■ Tirar do ar
                </button>
              )}
            </h2>
            {state.scene ? (
              <div className="stm-central-live">
                <span className="stm-central-dot" /> No ar: <b>{state.scene.nome}</b>
                <label>
                  <input
                    type="checkbox"
                    checked={state.scene.hideBoard}
                    onChange={e => state.scene && setScene({ ...state.scene, hideBoard: e.target.checked })}
                  />
                  esconder placar
                </label>
              </div>
            ) : (
              <p className="stm-central-hint">Escolha uma cena para mandar ao overlay principal. O OBS não precisa de outra fonte.</p>
            )}
            <label className="stm-central-preview">
              <input type="checkbox" checked={centralPreview} onChange={e => setCentralPreview(e.target.checked)} />
              ensaiar com dados de teste (não usa o banco do torneio)
            </label>
            {(['Misto'] as const).map(torneio => (
              <div key={torneio} className="stm-central-group">
                <h3>{torneio}</h3>
                {cenas.filter(c => c.torneio === torneio).map(c => {
                  const path = centralPreview ? `${c.path}?preview=1` : c.path
                  const onAir = state.scene?.path.split('?')[0] === c.path
                  return (
                    <div key={c.path} className={`stm-central-row ${onAir ? 'on' : ''}`}>
                      <div>
                        <b>{c.nome}</b>
                        <small>{c.descricao}</small>
                      </div>
                      <button
                        type="button"
                        className={`stm-btn mini ${onAir ? 'danger' : 'primary'}`}
                        onClick={() =>
                          onAir
                            ? setScene(null)
                            : setScene({ path, nome: `${c.nome} · ${torneio}${centralPreview ? ' (teste)' : ''}`, hideBoard: defaultHideBoard(c), at: Date.now() })
                        }
                      >
                        {onAir ? '■ Tirar' : '▶ No ar'}
                      </button>
                    </div>
                  )
                })}
              </div>
            ))}
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
                      <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ color: 'var(--pal-gray-60, #888)', fontSize: 12 }}>
                          {new Date(h.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <button type="button" className="stm-btn mini" onClick={() => setHistOpen(i)}>
                          Abrir
                        </button>
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
                        <th style={{ padding: 4, textAlign: 'center' }}>Faltas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {playerStats.map((st, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                          <td style={{ padding: 4, fontWeight: 700 }}>{st.name}</td>
                          <td style={{ padding: 4, color: 'var(--pal-beige, #ebd7c8)' }}>{st.team}</td>
                          <td style={{ padding: 4, textAlign: 'center', color: '#55e68b', fontWeight: 800 }}>{st.goals}</td>
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
                <span>Pausas técnicas</span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="number" min={0} max={9} className="stm-input" style={{ width: 60 }}
                    value={state.settings.techMax ?? 2}
                    onChange={e => updateSettings({ techMax: Math.max(0, Number(e.target.value) || 0) })}
                  />
                  <span>por time, de</span>
                  <input
                    type="number" min={0.5} step={0.5} className="stm-input" style={{ width: 70 }}
                    value={state.settings.techMin ?? 2}
                    onChange={e => updateSettings({ techMin: Math.max(0.5, Number(e.target.value) || 2) })}
                  />
                  <span>min</span>
                </div>

                <span>Pausa mecânica</span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="number" min={0.5} step={0.5} className="stm-input" style={{ width: 70 }}
                    value={state.settings.mechMin ?? 5}
                    onChange={e => updateSettings({ mechMin: Math.max(0.5, Number(e.target.value) || 5) })}
                  />
                  <span>min (sem limite de quantidade)</span>
                </div>

                <span>Cores do overlay</span>
                <select
                  className="stm-select"
                  value={state.settings.colorMode ?? 'times'}
                  onChange={e => updateSettings({ colorMode: e.target.value as 'times' | 'idv' })}
                >
                  <option value="times">Cores dos times (como cadastradas)</option>
                  <option value="idv">Padrão do site (IDV PIOR)</option>
                </select>

                <span>Cartão da jogadora</span>
                <div style={{ display: 'flex', gap: '6px 12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input type="checkbox" checked={state.settings.pcOn ?? true} onChange={e => updateSettings({ pcOn: e.target.checked })} />
                    mostrar
                  </label>
                  <input
                    type="number" min={0} max={30} className="stm-input" style={{ width: 60 }}
                    aria-label="Segundos depois da animação de gol"
                    value={state.settings.pcDelay ?? 5}
                    onChange={e => updateSettings({ pcDelay: Math.min(30, Math.max(0, Number(e.target.value) || 0)) })}
                  />
                  <span>s depois da animação de gol, por</span>
                  <input
                    type="number" min={2} max={30} className="stm-input" style={{ width: 60 }}
                    aria-label="Segundos na tela"
                    value={state.settings.pcSecs ?? 7}
                    onChange={e => updateSettings({ pcSecs: Math.max(2, Number(e.target.value) || 7) })}
                  />
                  <span>s</span>
                  {([
                    ['pcMatchGoals', 'gols no jogo'],
                    ['pcMatchFouls', 'faltas no jogo'],
                    ['pcChampGoals', 'gols no campeonato'],
                    ['pcChampFouls', 'faltas no campeonato'],
                  ] as const).map(([key, label]) => (
                    <label key={key} style={{ display: 'flex', gap: 4, alignItems: 'center', opacity: state.settings.pcOn === false ? 0.5 : 1 }}>
                      <input
                        type="checkbox"
                        disabled={state.settings.pcOn === false}
                        checked={!!state.settings[key]}
                        onChange={e => updateSettings({ [key]: e.target.checked })}
                      />
                      {label}
                    </label>
                  ))}
                </div>

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

                <span>Siglas do jogo</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {(['a', 'b'] as const).map(side => (
                    <label key={side} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span className="stm-chip" style={{ background: state[side].color }} />
                      <span style={{ maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{state[side].name}</span>
                      <input
                        type="text"
                        className="stm-input"
                        maxLength={4}
                        aria-label={`Sigla de ${state[side].name}`}
                        value={state[side].short}
                        onChange={e => {
                          // Sigla do jogo atual (e do cadastro do time, se existir)
                          const val = e.target.value.toUpperCase()
                          setTeam(side, { short: val })
                          setTeams(prev => prev.map(x => (x.id === state[side].id ? { ...x, short: val } : x)))
                        }}
                        style={{ width: 70, textTransform: 'uppercase', fontWeight: 800 }}
                      />
                    </label>
                  ))}
                </div>

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
                    onClick={askRestartMatch}
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
                  <option value="mesa">Assistente de árbitro (tempo, gols, faltas e pausas)</option>
                  <option value="overlays">Operador da live (textos na tela e cenas da Central)</option>
                  <option value="completo">Completo (controle total)</option>
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
                {attrPrompt.edit && <span>Corrigir</span>}
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

              {isGoal && (
                <>
                  <p className="stm-attr-q own">Gol contra · quem fez ({state[other].name})</p>
                  <div className="stm-attr-grid">
                    {state[other].players.map(p => (
                      <button key={p.id} type="button" className="stm-btn own" onClick={() => handleConfirmAttr(p.id, undefined, true)}>
                        {p.name}
                      </button>
                    ))}
                    <button type="button" className="stm-btn own" onClick={() => handleConfirmAttr(null, undefined, true)}>
                      Não sei quem
                    </button>
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

              {attrPrompt.edit ? (
                <div className="stm-confirm-actions">
                  <button
                    type="button"
                    className="stm-btn"
                    title="O lance foi registrado no time errado"
                    onClick={() => {
                      moveEventSide(attrPrompt.id)
                      setAttrPrompt({ ...attrPrompt, side: other })
                      showToast(`Lance movido para ${state[other].name}`)
                    }}
                  >
                    ⇄ Mover para {state[other].name}
                  </button>
                  <button type="button" className="stm-btn" onClick={() => handleConfirmAttr(null)}>
                    Sem autoria
                  </button>
                  <button type="button" className="stm-btn primary" onClick={() => setAttrPrompt(null)}>
                    Fechar
                  </button>
                </div>
              ) : (
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
              )}
            </div>
          </div>
        )
      })()}

      {/* Modal: Confirmação de exclusão/anulação */}
      {/* Partida encerrada: ver e corrigir os lances (o placar é recalculado pelos lances) */}
      {histOpen !== null && state.history[histOpen] && (() => {
        const h = state.history[histOpen]
        const evs = h.events || []
        return (
          <div className="stm-modal-backdrop" onClick={() => setHistOpen(null)}>
            <div className="stm-modal-box stm-hist" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
              <h3>{h.label || 'Jogo'} · {h.a} <b>{h.sa} x {h.sb}</b> {h.b}</h3>
              <p className="stm-central-hint">Corrija a autoria, troque o time de um lance ou apague. O placar acompanha.</p>
              <div className="stm-log">
                {evs.map(ev => (
                  <div key={ev.id} className="stm-ev">
                    <span className="t">{ev.clock}</span>
                    <span className={`stm-tag ${ev.type}`}>{evLabel(ev).toUpperCase()}</span>
                    <span className="tm">{ev.team}</span>
                    {ev.type === 'pause' ? (
                      <span style={{ flex: 1, opacity: 0.7 }}>pedida pelo time</span>
                    ) : (
                      <input
                        key={`${ev.id}:${ev.player}`}
                        className="stm-input"
                        style={{ flex: 1, minWidth: 0 }}
                        defaultValue={ev.player}
                        placeholder="Sem autoria"
                        aria-label="Jogadora"
                        onBlur={e => {
                          if (e.target.value.trim() !== ev.player) {
                            editHistoryEvent(histOpen, ev.id, { player: e.target.value })
                            showToast('Lance corrigido')
                          }
                        }}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                      />
                    )}
                    {ev.type !== 'pause' && (
                      <button
                        type="button"
                        className="stm-btn mini"
                        title={`Mover para ${ev.side === 'a' ? h.b : h.a}`}
                        onClick={() => {
                          editHistoryEvent(histOpen, ev.id, { moveSide: true })
                          showToast(`Lance movido para ${ev.side === 'a' ? h.b : h.a}`)
                        }}
                      >
                        ⇄
                      </button>
                    )}
                    <button
                      type="button"
                      className="stm-btn mini danger"
                      title="Apagar lance"
                      onClick={() =>
                        setConfirmDlg({
                          title: 'Apagar lance da partida encerrada?',
                          msg: `${describeEvent(ev)}. O placar final é recalculado.`,
                          yes: 'Sim, apagar',
                          onYes: () => {
                            editHistoryEvent(histOpen, ev.id, null)
                            showToast('Lance apagado')
                          },
                        })
                      }
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {evs.length === 0 && <div style={{ opacity: 0.6, padding: 8 }}>Esta partida não tem lances salvos.</div>}
              </div>
              <div className="stm-confirm-actions">
                <button type="button" className="stm-btn primary" onClick={() => setHistOpen(null)}>
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {confirmDlg && (
        <div className="stm-modal-backdrop" onClick={() => setConfirmDlg(null)}>
          <div className="stm-modal-box stm-confirm" role="alertdialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <h3>{confirmDlg.title}</h3>
            <p>{confirmDlg.msg}</p>
            {confirmDlg.typeWord && (
              <label className="stm-confirm-type">
                Para confirmar, digite <b>{confirmDlg.typeWord}</b>
                <input
                  type="text"
                  className="stm-input"
                  autoComplete="off"
                  value={confirmTyped}
                  onChange={e => setConfirmTyped(e.target.value)}
                />
              </label>
            )}
            <div className="stm-confirm-actions">
              <button type="button" className="stm-btn" autoFocus onClick={() => setConfirmDlg(null)}>
                Manter
              </button>
              <button
                type="button"
                className="stm-btn danger"
                disabled={!!confirmDlg.typeWord && confirmTyped.trim().toUpperCase() !== confirmDlg.typeWord}
                onClick={() => {
                  confirmDlg.onYes()
                  setConfirmDlg(null)
                }}
              >
                {confirmDlg.yes ?? 'Sim, anular'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Selecionar Partida do Torneio */}
      {showMatchPicker && (
        <div className="stm-modal-backdrop" onClick={() => setShowMatchPicker(false)}>
          <div className="stm-modal-box stm-match-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>🏆 Selecionar Partida do Torneio</h3>
              <button type="button" className="stm-btn mini" onClick={() => setShowMatchPicker(false)}>✕</button>
            </div>

            {torneiosList.length > 1 && (
              <div style={{ display: 'flex', gap: 6, margin: '12px 0 6px', overflowX: 'auto' }}>
                {torneiosList.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    className={`stm-btn mini ${t.id === selectedTorneioId ? 'primary' : ''}`}
                    onClick={() => handleSelectTorneioTab(t.id)}
                  >
                    {t.nome} ({t.categoria})
                  </button>
                ))}
              </div>
            )}

            <div className="stm-match-list">
              {loadingTournament && <div style={{ padding: 20, textAlign: 'center', opacity: 0.7 }}>Carregando partidas…</div>}

              {!loadingTournament && torneioJogos.length === 0 && (
                <div style={{ padding: 20, textAlign: 'center', opacity: 0.7 }}>
                  Nenhuma partida com times definidos encontrada.
                </div>
              )}

              {!loadingTournament && torneioJogos.map(j => {
                const isCurrent = state.tournament?.jogoId === j.id
                const isLive = j.status === 'em_andamento'
                return (
                  <button
                    key={j.id}
                    type="button"
                    className={`stm-match-item ${isCurrent ? 'current' : ''}`}
                    onClick={() => {
                      const t = torneiosList.find(x => x.id === (selectedTorneioId || j.torneio_id))
                      loadGameIntoMesa(j.torneio_id, t?.nome || 'Torneio', j)
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="stm-tag" style={{ background: isLive ? 'var(--pal-orange, #ff931e)' : undefined }}>
                          {j.codigo}
                        </span>
                        <span style={{ fontSize: 13, opacity: 0.8 }}>{j.fase_rotulo}</span>
                        {isCurrent && <span style={{ color: 'var(--pal-magenta, #de04ac)', fontWeight: 800, fontSize: 12 }}>● ATIVO NA MESA</span>}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>
                        {j.time_a_nome} <span style={{ opacity: 0.6 }}>×</span> {j.time_b_nome}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 12, opacity: 0.8 }}>
                      <div>Status: <b>{j.status}</b></div>
                      {j.placar_a != null && j.placar_b != null && (
                        <div style={{ fontWeight: 800, fontSize: 14 }}>{j.placar_a} × {j.placar_b}</div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <button type="button" className="stm-btn" onClick={() => setShowMatchPicker(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Revisão e Envio da Súmula para o Torneio */}
      {showFinalizeModal && state.tournament && (() => {
        const tourney = state.tournament
        const isKnockout = tourney.faseTipo === 'repescagem' || tourney.faseTipo === 'double'
        const isTied = state.a.score === state.b.score
        const goals = state.events.filter(e => e.type === 'goal' && !e.fxPending)
        const fouls = state.events.filter(e => e.type === 'foul' && !e.fxPending)
        const missingFoulMember = fouls.some(f => !f.membroId)

        return (
          <div className="stm-modal-backdrop" onClick={() => !submittingSumula && setShowFinalizeModal(false)}>
            <div className="stm-modal-box stm-finalize-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
              <h3 style={{ margin: 0 }}>🏁 Finalizar e Oficializar Partida</h3>
              <p style={{ margin: '4px 0 12px', fontSize: 14, opacity: 0.8 }}>
                {tourney.torneioNome} · {tourney.faseRotulo} (<b>{tourney.jogoCodigo}</b>)
              </p>

              <div className="stm-finalize-body">
                {/* Placar Final */}
                <div className="stm-review-box">
                  <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7 }}>Placar Final</div>
                  <div className="stm-review-score">
                    <span style={{ color: state.a.color }}>{state.a.name}</span>{' '}
                    <span>{state.a.score} × {state.b.score}</span>{' '}
                    <span style={{ color: state.b.color }}>{state.b.name}</span>
                  </div>
                </div>

                {/* Validação de empate em eliminatória */}
                {isKnockout && isTied && (
                  <div style={{ padding: 10, background: 'rgba(255, 75, 75, 0.2)', border: '1px solid #ff4b4b', borderRadius: 8, color: '#ffb3b3', fontSize: 13 }}>
                    ⚠️ <b>Fase eliminatória empatada:</b> A partida não pode terminar empatada. Marque o Golden Goal / Prorrogação na mesa antes de oficializar.
                  </div>
                )}

                {/* Prorrogação */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer', padding: '4px 0' }}>
                  <input
                    type="checkbox"
                    checked={finalizeOvertime}
                    onChange={e => setFinalizeOvertime(e.target.checked)}
                  />
                  <span>Decidido em Prorrogação / Golden Goal (overtime)</span>
                </label>

                {/* Gols Registrados */}
                <div className="stm-review-box">
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                    ⚽ Gols Registrados ({goals.length})
                  </div>
                  {goals.length === 0 ? (
                    <div style={{ fontSize: 13, opacity: 0.6 }}>Nenhum gol registrado.</div>
                  ) : (
                    <table className="stm-review-table">
                      <thead>
                        <tr>
                          <th>Min</th>
                          <th>Time</th>
                          <th>Autoria</th>
                          <th>Tipo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {goals.map(g => (
                          <tr key={g.id}>
                            <td>{Math.max(1, Math.floor((g.gt || 0) / 60000) + 1)}'</td>
                            <td style={{ fontWeight: 700 }}>{g.team}</td>
                            <td>{g.player || 'Sem autoria'}</td>
                            <td>{g.own ? 'Gol Contra' : g.membroId ? 'Atleta Vinculado' : 'Sem autoria'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Faltas Registradas */}
                <div className="stm-review-box">
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                    ⚠️ Faltas Registradas ({fouls.length})
                  </div>
                  {missingFoulMember && (
                    <div style={{ fontSize: 12, color: 'var(--pal-amber-96, #f59e0b)', marginBottom: 6 }}>
                      Aviso: algumas faltas não possuem atleta associado e não serão atribuídas a um atleta específico no relatório individual de Fair Play.
                    </div>
                  )}
                  {fouls.length === 0 ? (
                    <div style={{ fontSize: 13, opacity: 0.6 }}>Nenhuma falta registrada.</div>
                  ) : (
                    <table className="stm-review-table">
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Atleta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fouls.map(f => (
                          <tr key={f.id}>
                            <td style={{ fontWeight: 700 }}>{f.team}</td>
                            <td>{f.player || 'Sem atleta'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Observações */}
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                  Observações da Súmula (opcional)
                  <input
                    type="text"
                    className="stm-input"
                    placeholder="Ex.: Cartões, intercorrências, etc."
                    value={finalizeNotes}
                    onChange={e => setFinalizeNotes(e.target.value)}
                  />
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  className="stm-btn"
                  disabled={submittingSumula}
                  onClick={() => setShowFinalizeModal(false)}
                >
                  Voltar para a Mesa
                </button>
                <button
                  type="button"
                  className="stm-btn primary"
                  disabled={submittingSumula || (isKnockout && isTied)}
                  onClick={handleFinalizeAndSubmit}
                >
                  {submittingSumula ? 'Enviando ao Torneio…' : 'Confirmar e Enviar para o Torneio'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Toast Notification */}
      {toastMessage && <div className="stm-toast">{toastMessage}</div>}
    </div>
  )
}
