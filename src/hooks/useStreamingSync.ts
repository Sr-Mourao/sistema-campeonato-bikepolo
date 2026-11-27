import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_STREAMING_STATE,
  DEFAULT_STREAMING_TEAMS,
  SIMULATION_TEAMS,
  calculateElapsed,
  emptyPauses,
  getClockDisplayText,
  getStreamingDevice,
  hydrateStreamingState,
  normTeams,
  recomputeScores,
  setStreamingDevice,
  uid,
  type StreamingDevice,
  type StreamingEvent,
  type StreamingPlayer,
  type StreamingSettings,
  type StreamingState,
  type StreamingTeam,
  type StreamingTextItem,
  applyHistoryEdit,
  type StreamingTextTpl,
  type HistoryEventPatch,
  type StreamingTournamentLink,
  type StreamingScene,
} from '../services/streamingState'
import { shouldApplyRemoteState, shouldFallbackToPython, syncErrorFromPush } from '../services/streamingSyncRules'

const STORAGE_STATE_KEY = 'polo.streaming.state.v2'
const STORAGE_TEAMS_KEY = 'polo.streaming.teams.v2'
const CHANNEL_NAME = 'polo_streaming_sync'

/**
 * Comunica com o backend: o endpoint PHP (/api/streaming.php, produção) e, só se
 * ele não existir (erro de rede ou 404), o servidor Python do modo LAN.
 * Respostas de erro do PHP (ex.: 500 porque o banco não grava) são devolvidas
 * como vieram, para aparecerem na mesa.
 */
async function callStreamingApi(endpoint: 'state' | 'teams' | 'hello' | 'ping', init?: RequestInit): Promise<Response> {
  const res = await fetch(`/api/streaming.php?action=${endpoint}`, init).catch(() => null)
  if (!shouldFallbackToPython(res)) return res as Response
  return fetch(`/api/streaming/${endpoint}`, init)
}

export interface PeerDevice {
  id: string
  name: string
  role: string
  seen: number
}

export interface StreamingSyncOptions {
  /**
   * Página que só exibe (overlay do OBS/Streamlabs, Intervalo): espelha o
   * servidor sempre, mesmo que o rev dele seja menor que o do localStorage, e
   * não escreve no localStorage/BroadcastChannel (não pode atropelar a mesa
   * aberta no mesmo navegador, nem pela prévia em iframe).
   */
  mirror?: boolean
}

export function useStreamingSync(options: StreamingSyncOptions = {}) {
  const [device, setDevice] = useState<StreamingDevice>(() => getStreamingDevice())
  // O perfil 'overlays' também espelha: é um aparelho que só acompanha a transmissão
  const mirror = !!options.mirror || device.role === 'overlays'
  const [state, setState] = useState<StreamingState>(() => {
    if (mirror || typeof window === 'undefined') return DEFAULT_STREAMING_STATE
    try {
      const raw = localStorage.getItem(STORAGE_STATE_KEY)
      if (raw) return hydrateStreamingState(JSON.parse(raw))
    } catch {
      // ignore
    }
    return DEFAULT_STREAMING_STATE
  })

  const [teams, setTeams] = useState<StreamingTeam[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_STREAMING_TEAMS
    try {
      const raw = localStorage.getItem(STORAGE_TEAMS_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length > 0) return normTeams(parsed)
      }
    } catch {
      // ignore
    }
    return SIMULATION_TEAMS
  })

  const [serverOnline, setServerOnline] = useState(false)
  // Última falha ao gravar o estado no servidor (= o overlay da transmissão não recebe)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [peers, setPeers] = useState<PeerDevice[]>([])
  const [clockOffset, setClockOffset] = useState(0)

  const channelRef = useRef<BroadcastChannel | null>(null)
  const undoStackRef = useRef<string[]>([])
  const sendingRef = useRef(false)
  const pendingPushRef = useRef<StreamingState | null>(null)
  const lastPushedRevRef = useRef<number | null>(null)
  const pushToServerRef = useRef<((st: StreamingState) => Promise<void>) | null>(null)
  const serverRevRef = useRef<number | null>(null)
  const clockOffsetRef = useRef(0)


  // Atualiza persistência e BroadcastChannel
  const broadcastAndSave = useCallback((newState: StreamingState, newTeams?: StreamingTeam[]) => {
    try {
      localStorage.setItem(STORAGE_STATE_KEY, JSON.stringify(newState))
      if (newTeams) {
        localStorage.setItem(STORAGE_TEAMS_KEY, JSON.stringify(newTeams))
      }
    } catch {
      // ignore storage quota error
    }

    if (channelRef.current) {
      try {
        channelRef.current.postMessage({
          type: 'SYNC_STATE',
          state: newState,
          teams: newTeams,
          sender: device.id,
        })
      } catch {
        // channel error
      }
    }
  }, [device.id])

  // HTTP API Push
  // Um envio por vez. Mutações que chegam durante um envio não são
  // descartadas: guardamos só a mais recente e mandamos assim que o envio
  // atual terminar (antes, o segundo clique rápido nunca chegava ao servidor
  // e o OBS ficava com o placar defasado).
  const pushToServer = useCallback(async (st: StreamingState) => {
    if (typeof window === 'undefined') return
    if (sendingRef.current) {
      if (!pendingPushRef.current || st.rev > pendingPushRef.current.rev) pendingPushRef.current = st
      return
    }
    // O updater do setState pode rodar duas vezes (StrictMode): não reenvia a mesma revisão.
    if (lastPushedRevRef.current !== null && st.rev <= lastPushedRevRef.current) return
    sendingRef.current = true
    lastPushedRevRef.current = st.rev
    try {
      const t0 = Date.now()
      const res = await callStreamingApi('state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(st),
      })

      if (res.headers.has('X-Server-Time')) {
        const srv = Number(res.headers.get('X-Server-Time'))
        if (srv) {
          const off = srv - (t0 + Date.now()) / 2
          clockOffsetRef.current = off
          setClockOffset(off)
        }
      }

      const pushError = await syncErrorFromPush(res)
      if (pushError !== undefined) setSyncError(pushError)

      if (res.ok) {
        serverRevRef.current = st.rev
        setServerOnline(true)
      } else if (res.status === 409) {
        // Conflito de versão: carrega o mais novo e descarta o pendente, que era baseado no antigo
        const fresh = await res.json()
        const hydrated = hydrateStreamingState(fresh)
        serverRevRef.current = hydrated.rev
        lastPushedRevRef.current = hydrated.rev
        pendingPushRef.current = null
        setState(hydrated)
        broadcastAndSave(hydrated)
        setServerOnline(true)
      } else {
        setServerOnline(false)
      }
    } catch (err) {
      setSyncError((await syncErrorFromPush(null, err)) ?? null)
      setServerOnline(false)
    } finally {
      sendingRef.current = false
      const pending = pendingPushRef.current
      pendingPushRef.current = null
      if (pending) void pushToServerRef.current?.(pending)
    }
  }, [broadcastAndSave])

  useEffect(() => {
    pushToServerRef.current = pushToServer
  }, [pushToServer])

  // Realiza uma mutação de estado
  const mutate = useCallback((fn: (prev: StreamingState) => StreamingState, opts: { undoable?: boolean; stampDomain?: string } = {}) => {
    setState(current => {
      if (opts.undoable !== false) {
        undoStackRef.current.push(JSON.stringify(current))
        if (undoStackRef.current.length > 50) undoStackRef.current.shift()
      }

      const next = fn(JSON.parse(JSON.stringify(current)))
      next.rev = (next.rev || 0) + 1
      next.by = device.id

      if (opts.stampDomain) {
        next.lastBy = next.lastBy || {}
        next.lastBy[opts.stampDomain] = {
          id: device.id,
          name: device.name,
          role: device.role,
          at: Date.now() + clockOffsetRef.current,
        }
      }

      recomputeScores(next)
      broadcastAndSave(next)
      pushToServer(next)
      return next
    })
  }, [broadcastAndSave, device.id, device.name, device.role, pushToServer])

  // Inicializa BroadcastChannel e event listeners
  useEffect(() => {
    if (typeof window === 'undefined') return

    if ('BroadcastChannel' in window) {
      const bc = new BroadcastChannel(CHANNEL_NAME)
      channelRef.current = bc

      bc.onmessage = (event) => {
        const data = event.data
        if (!data || data.sender === device.id) return
        if (data.type === 'SYNC_STATE' && data.state) {
          if (!mirror) setState(hydrateStreamingState(data.state))
          if (data.teams) setTeams(normTeams(data.teams))
        }
      }
    }

    const onStorage = (e: StorageEvent) => {
      if (!mirror && e.key === STORAGE_STATE_KEY && e.newValue) {
        try {
          setState(hydrateStreamingState(JSON.parse(e.newValue)))
        } catch {
          // ignore
        }
      }
      if (e.key === STORAGE_TEAMS_KEY && e.newValue) {
        try {
          setTeams(normTeams(JSON.parse(e.newValue)))
        } catch {
          // ignore
        }
      }
    }

    window.addEventListener('storage', onStorage)

    // Polling no servidor de streaming: é o que leva o estado da mesa até
    // navegadores separados (OBS, celulares). 1 s para gols e relógio
    // aparecerem rápido na transmissão.
    let lastMirrorPayload: string | undefined
    let active = true
    let polling = false
    const interval = setInterval(async () => {
      if (polling) return
      polling = true
      try {
        const ping = await callStreamingApi('ping').catch(() => null)
        if (ping && ping.ok) {
          setServerOnline(true)
          // envia hello
          const helloRes = await callStreamingApi('hello', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: device.id, name: device.name, role: device.role }),
          }).catch(() => null)

          if (helloRes && helloRes.ok) {
            const peerList = await helloRes.json()
            if (Array.isArray(peerList)) setPeers(peerList)
          }

          // Puxa o estado do servidor (regras em shouldApplyRemoteState)
          const stRes = await callStreamingApi('state').catch(() => null)
          if (stRes && stRes.ok) {
            if (mirror) {
              const raw = await stRes.text()
              if (active && raw !== lastMirrorPayload) {
                const remote = JSON.parse(raw)
                setState(remote === null ? DEFAULT_STREAMING_STATE : hydrateStreamingState(remote))
                lastMirrorPayload = raw
              }
            } else {
              const remote = await stRes.json()
              const remoteRev: number | undefined = remote?.rev
              if (active && remoteRev && (!serverRevRef.current || remoteRev > serverRevRef.current)) {
                serverRevRef.current = remoteRev
                setState(current => {
                  if (shouldApplyRemoteState(remoteRev, current.rev)) {
                    const hyd = hydrateStreamingState(remote)
                    broadcastAndSave(hyd)
                    return hyd
                  }
                  return current
                })
              }
            }
          }
        } else {
          setServerOnline(false)
        }
      } catch {
        setServerOnline(false)
      } finally {
        polling = false
      }
    }, 1000)

    return () => {
      active = false
      channelRef.current?.close()
      channelRef.current = null
      window.removeEventListener('storage', onStorage)
      clearInterval(interval)
    }
  }, [broadcastAndSave, device.id, device.name, device.role, mirror])

  // Desfazer (Undo)
  const undo = useCallback(() => {
    const prev = undoStackRef.current.pop()
    if (!prev) return false
    try {
      const parsed = JSON.parse(prev)
      const hyd = hydrateStreamingState(parsed)
      hyd.rev = (state.rev || 0) + 1
      hyd.by = device.id
      setState(hyd)
      broadcastAndSave(hyd)
      pushToServer(hyd)
      return true
    } catch {
      return false
    }
  }, [broadcastAndSave, device.id, pushToServer, state.rev])

  // Relógio
  const toggleClock = useCallback(() => {
    mutate(s => {
      const isRunning = !s.clock.running
      if (!isRunning && s.clock.running) {
        s.clock = {
          running: false,
          elapsed: calculateElapsed(s.clock, clockOffsetRef.current),
          startedAt: 0,
          pausedAt: Date.now() + clockOffsetRef.current,
        }
      } else if (isRunning && !s.clock.running) {
        const durMs = (s.settings.durMin || 18) * 60000
        const currentElapsed = s.clock.elapsed
        if (s.settings.mode !== 'up' && currentElapsed >= durMs) {
          s.clock.elapsed = 0
        }
        s.clock.running = true
        s.clock.startedAt = Date.now() + clockOffsetRef.current
        delete s.clock.pausedAt
      }
      return s
    }, { stampDomain: 'jogo' })
  }, [mutate])

  const adjustClock = useCallback((sec: number) => {
    mutate(s => {
      const durMs = (s.settings.durMin || 18) * 60000
      const down = s.settings.mode !== 'up'
      const extra = s.clock.running ? Date.now() + clockOffsetRef.current - s.clock.startedAt : 0
      let nextElapsed = s.clock.elapsed + (down ? -sec : sec) * 1000
      nextElapsed = Math.max(-extra, nextElapsed)
      if (down) nextElapsed = Math.min(durMs - extra, nextElapsed)
      s.clock.elapsed = nextElapsed
      return s
    }, { stampDomain: 'jogo' })
  }, [mutate])

  const resetClock = useCallback(() => {
    mutate(s => {
      s.clock = { running: false, elapsed: 0, startedAt: 0 }
      return s
    }, { stampDomain: 'jogo' })
  }, [mutate])

  const swapSides = useCallback(() => {
    mutate(s => {
      const prevA = s.a
      s.a = s.b
      s.b = prevA
      return s
    }, { stampDomain: 'jogo' })
  }, [mutate])

  // Adiciona gol ou falta
  const addEvent = useCallback((type: 'goal' | 'foul', side: 'a' | 'b', pid?: string | null) => {
    const newEventId = uid()
    mutate(s => {
      const team = s[side]
      const player = pid ? team.players.find(p => p.id === pid) : null
      const clockStr = getClockDisplayText(s.clock, s.settings, clockOffsetRef.current)
      const currentElapsed = calculateElapsed(s.clock, clockOffsetRef.current)
      const currentTime = Date.now() + clockOffsetRef.current

      const event: StreamingEvent = {
        id: newEventId,
        type,
        side,
        teamId: team.id,
        team: team.name,
        pid: player ? player.id : null,
        player: player ? player.name : '',
        clock: clockStr,
        gt: Math.round(Math.max(0, currentElapsed)),
        at: currentTime,
        membroId: player?.membroId ?? null,
      }

      // Sem jogadora definida, o lance fica pendente: não soma no placar nem
      // dispara animação até a mesa escolher quem fez (assignPlayer).
      if (!player) event.fxPending = true
      s.events.push(event)

      if (player) {
        s.fx = {
          id: newEventId,
          type,
          side,
          at: currentTime,
          team: team.name,
          short: team.short,
          color: team.color,
          player: player.name,
        }
      }

      // Regra de auto-pause nos minutos finais
      const durMs = (s.settings.durMin || 18) * 60000
      const remainingMs = durMs - currentElapsed
      if (s.settings.autoPause && s.clock.running && remainingMs > 0 && remainingMs <= (s.settings.autoPauseMin || 2) * 60000) {
        s.clock = {
          running: false,
          elapsed: currentElapsed,
          startedAt: 0,
        }
      }

      return s
    }, { stampDomain: 'jogo' })
    return newEventId
  }, [mutate])

  const removeEvent = useCallback((eventId: string) => {
    mutate(s => {
      const ev = s.events.find(e => e.id === eventId)
      s.events = s.events.filter(e => e.id !== eventId)
      if (ev?.type === 'pause') {
        const ps = s.pauses[ev.side]
        if (ev.pauseKind === 'tech') ps.techUsed = Math.max(0, ps.techUsed - 1)
        else ps.mechUsed = Math.max(0, ps.mechUsed - 1)
        if (ps.active?.eventId === ev.id) ps.active = null
        return s
      }
      // Lance pendente nunca apareceu no overlay: não há o que anunciar como anulado
      if (ev && !ev.fxPending) {
        s.fx = {
          id: uid(),
          type: 'cancel',
          of: ev.type,
          side: ev.side,
          at: Date.now() + clockOffsetRef.current,
          team: ev.team,
          color: (s[ev.side] || {}).color || '#ff931e',
          player: ev.player || '',
        }
      }
      return s
    }, { stampDomain: 'jogo' })
  }, [mutate])

  const removeLast = useCallback((type: 'goal' | 'foul', side: 'a' | 'b') => {
    mutate(s => {
      for (let i = s.events.length - 1; i >= 0; i--) {
        const ev = s.events[i]
        if (ev.type === type && ev.side === side) {
          s.events.splice(i, 1)
          s.fx = {
            id: uid(),
            type: 'cancel',
            of: ev.type,
            side: ev.side,
            at: Date.now() + clockOffsetRef.current,
            team: ev.team,
            color: (s[ev.side] || {}).color || '#ff931e',
            player: ev.player || '',
          }
          break
        }
      }
      return s
    }, { stampDomain: 'jogo' })
  }, [mutate])

  const removeLastOf = useCallback((type: 'goal' | 'foul', side: 'a' | 'b', pid: string | null) => {
    mutate(s => {
      for (let i = s.events.length - 1; i >= 0; i--) {
        const ev = s.events[i]
        if (ev.type === type && ev.side === side && (pid ? ev.pid === pid : !ev.pid)) {
          s.events.splice(i, 1)
          s.fx = {
            id: uid(),
            type: 'cancel',
            of: ev.type,
            side: ev.side,
            at: Date.now() + clockOffsetRef.current,
            team: ev.team,
            color: (s[ev.side] || {}).color || '#ff931e',
            player: ev.player || '',
          }
          break
        }
      }
      return s
    }, { stampDomain: 'jogo' })
  }, [mutate])

  // own = gol contra: a jogadora é do time adversário ao lado que pontuou
  const assignPlayer = useCallback((eventId: string, pid: string | null, customName?: string, own = false) => {
    mutate(s => {
      const ev = s.events.find(e => e.id === eventId)
      if (!ev || ev.type === 'pause') return s
      const playerSide = own ? (ev.side === 'a' ? 'b' : 'a') : ev.side
      const p = pid ? s[playerSide]?.players.find(x => x.id === pid) : null
      ev.pid = p ? p.id : (pid || null)
      ev.player = p ? p.name : (customName || '')
      ev.membroId = p?.membroId ?? null
      if (own && ev.type === 'goal') {
        ev.own = true
        ev.playerTeam = s[playerSide].name
      } else {
        delete ev.own
        delete ev.playerTeam
      }
      if (ev.fxPending) {
        // Jogadora escolhida: agora sim o lance conta e a animação sai
        delete ev.fxPending
        const team = s[ev.side]
        s.fx = {
          id: ev.id,
          type: ev.type,
          side: ev.side,
          at: Date.now() + clockOffsetRef.current,
          team: team.name,
          short: team.short,
          color: team.color,
          player: ev.player,
          own: !!ev.own,
        }
      } else if (s.fx && s.fx.id === eventId) {
        // Correção de um lance já anunciado: atualiza o nome sem repetir a animação
        s.fx.player = ev.player
        s.fx.own = !!ev.own
      }
      return s
    }, { stampDomain: 'jogo' })
  }, [mutate])

  /** Correção: passa o lance para o outro time (limpa a autoria, que era do time errado) */
  const moveEventSide = useCallback((eventId: string) => {
    mutate(s => {
      const ev = s.events.find(e => e.id === eventId)
      if (!ev) return s
      ev.side = ev.side === 'a' ? 'b' : 'a'
      ev.teamId = s[ev.side].id
      ev.team = s[ev.side].name
      ev.pid = null
      ev.player = ''
      delete ev.own
      delete ev.playerTeam
      return s
    }, { stampDomain: 'jogo' })
  }, [mutate])

  const setTeam = useCallback((side: 'a' | 'b', teamData: Partial<StreamingTeam>) => {
    mutate(s => {
      s[side] = {
        ...s[side],
        ...teamData,
        players: teamData.players ? normTeams([{ ...s[side], ...teamData }])[0].players : s[side].players,
      }
      return s
    }, { stampDomain: 'jogo' })
  }, [mutate])

  const updateSettings = useCallback((newSettings: Partial<StreamingSettings>) => {
    mutate(s => {
      s.settings = { ...s.settings, ...newSettings }
      return s
    }, { stampDomain: 'ov' })
  }, [mutate])

  const setTextActive = useCallback((tpl: StreamingTextTpl, textId: string | null) => {
    mutate(s => {
      s.texts.on[tpl] = textId
      if (textId) {
        s.texts.at[tpl] = Date.now() + clockOffsetRef.current
      } else {
        delete s.texts.at[tpl]
      }
      return s
    }, { stampDomain: 'ov' })
  }, [mutate])

  const addTextItem = useCallback((item: Omit<StreamingTextItem, 'id'>) => {
    mutate(s => {
      s.texts.items.push({ ...item, id: uid() })
      return s
    }, { stampDomain: 'ov' })
  }, [mutate])

  const updateTextItem = useCallback((id: string, updates: Partial<StreamingTextItem>) => {
    mutate(s => {
      const target = s.texts.items.find(t => t.id === id)
      if (target) Object.assign(target, updates)
      return s
    }, { stampDomain: 'ov' })
  }, [mutate])

  const removeTextItem = useCallback((id: string) => {
    mutate(s => {
      s.texts.items = s.texts.items.filter(t => t.id !== id)
      for (const tpl of ['lower', 'center', 'ticker', 'badge', 'popup'] as const) {
        if (s.texts.on[tpl] === id) s.texts.on[tpl] = null
      }
      return s
    }, { stampDomain: 'ov' })
  }, [mutate])

  const hideAllTexts = useCallback(() => {
    mutate(s => {
      s.texts.on = { lower: null, center: null, ticker: null, badge: null, popup: null }
      s.texts.at = {}
      return s
    }, { stampDomain: 'ov' })
  }, [mutate])

  const setHidden = useCallback((hidden: boolean) => {
    mutate(s => {
      s.hidden = hidden
      return s
    }, { stampDomain: 'ov' })
  }, [mutate])

  const setLabel = useCallback((label: string) => {
    mutate(s => {
      s.label = label
      return s
    }, { stampDomain: 'jogo' })
  }, [mutate])

  const addScheduleGame = useCallback((aId: string, bId: string, label: string) => {
    mutate(s => {
      const nome = (id: string) => teams.find(t => t.id === id)?.name
      s.schedule.push({ id: uid(), a: aId, b: bId, label, aName: nome(aId), bName: nome(bId) })
      return s
    }, { stampDomain: 'jogo' })
  }, [mutate, teams])

  const nextGame = useCallback(() => {
    mutate(s => {
      // Salva o jogo atual no histórico se houver lances
      if (s.events.length > 0 || s.a.score > 0 || s.b.score > 0) {
        s.history.unshift({
          label: s.label || 'Jogo',
          a: s.a.name,
          b: s.b.name,
          sa: s.a.score,
          sb: s.b.score,
          at: Date.now() + clockOffsetRef.current,
          events: [...s.events],
        })
      }

      // Avança na agenda se houver próximo
      const nextIdx = s.current + 1
      if (nextIdx < s.schedule.length) {
        const match = s.schedule[nextIdx]
        const teamA = teams.find(t => t.id === match.a)
        const teamB = teams.find(t => t.id === match.b)
        if (teamA) s.a = { ...teamA, score: 0, fouls: 0 }
        if (teamB) s.b = { ...teamB, score: 0, fouls: 0 }
        s.label = match.label
        s.current = nextIdx
        match.done = true
      }

      // Zera cronômetro e eventos
      s.clock = { running: false, elapsed: 0, startedAt: 0 }
      s.events = []
      s.fx = null
      s.a.score = 0
      s.a.fouls = 0
      s.b.score = 0
      s.b.fouls = 0
      s.pauses = emptyPauses()
      return s
    }, { stampDomain: 'jogo' })
  }, [mutate, teams])

  // ── Pausas dos times (técnica limitada, mecânica ilimitada) ─────────────
  const startPause = useCallback((side: 'a' | 'b', kind: 'tech' | 'mech') => {
    mutate(s => {
      const ps = s.pauses[side]
      if (ps.active) return s
      if (kind === 'tech' && ps.techUsed >= (s.settings.techMax ?? 2)) return s
      const now = Date.now() + clockOffsetRef.current
      // Para o relógio do jogo durante a pausa
      if (s.clock.running) {
        s.clock = { running: false, elapsed: calculateElapsed(s.clock, clockOffsetRef.current), startedAt: 0, pausedAt: now }
      }
      const min = kind === 'tech' ? s.settings.techMin ?? 2 : s.settings.mechMin ?? 5
      // O pedido entra na lista de lances: se foi engano, a mesa anula por lá e a pausa volta ao time
      const eventId = uid()
      s.events.push({
        id: eventId,
        type: 'pause',
        pauseKind: kind,
        side,
        teamId: s[side].id,
        team: s[side].name,
        pid: null,
        player: '',
        clock: getClockDisplayText(s.clock, s.settings, clockOffsetRef.current),
        gt: Math.round(Math.max(0, calculateElapsed(s.clock, clockOffsetRef.current))),
        at: now,
      })
      ps.active = { kind, durMs: min * 60000, elapsed: 0, startedAt: now, running: true, eventId }
      if (kind === 'tech') ps.techUsed++
      else ps.mechUsed++
      return s
    }, { stampDomain: 'jogo' })
  }, [mutate])

  const togglePauseTimer = useCallback((side: 'a' | 'b') => {
    mutate(s => {
      const p = s.pauses[side].active
      if (!p) return s
      const now = Date.now() + clockOffsetRef.current
      if (p.running) {
        p.elapsed += now - p.startedAt
        p.running = false
        p.startedAt = 0
      } else {
        p.running = true
        p.startedAt = now
      }
      return s
    }, { stampDomain: 'jogo' })
  }, [mutate])

  /** Ajusta o tempo restante da pausa em `sec` segundos (+ dá mais tempo) */
  const adjustPause = useCallback((side: 'a' | 'b', sec: number) => {
    mutate(s => {
      const p = s.pauses[side].active
      if (p) p.durMs = Math.max(0, p.durMs + sec * 1000)
      return s
    }, { stampDomain: 'jogo' })
  }, [mutate])

  /** Encerra a pausa. refund=true anula (devolve a pausa ao time, para corrigir engano) */
  const endPause = useCallback((side: 'a' | 'b', refund = false) => {
    mutate(s => {
      const ps = s.pauses[side]
      if (!ps.active) return s
      if (refund) {
        if (ps.active.kind === 'tech') ps.techUsed = Math.max(0, ps.techUsed - 1)
        else ps.mechUsed = Math.max(0, ps.mechUsed - 1)
        const linked = ps.active.eventId
        if (linked) s.events = s.events.filter(e => e.id !== linked)
      }
      ps.active = null
      return s
    }, { stampDomain: 'jogo' })
  }, [mutate])

  const linkTournamentMatch = useCallback((
    tournament: StreamingTournamentLink,
    teamA: StreamingTeam,
    teamB: StreamingTeam,
    label?: string,
  ) => {
    mutate(s => {
      s.tournament = tournament
      s.a = { ...teamA, score: 0, fouls: 0 }
      s.b = { ...teamB, score: 0, fouls: 0 }
      s.label = label || `${tournament.faseRotulo} · ${tournament.jogoCodigo}`
      s.clock = { running: false, elapsed: 0, startedAt: 0 }
      s.events = []
      s.fx = null
      s.pauses = emptyPauses()
      return s
    }, { stampDomain: 'jogo' })
  }, [mutate])

  /** Põe uma cena da Central no ar no overlay principal (null tira do ar) */
  const setScene = useCallback((scene: StreamingScene | null) => {
    mutate(s => {
      s.scene = scene
      return s
    }, { stampDomain: 'ov' })
  }, [mutate])

  /** Corrige (ou apaga, com patch null) um lance de uma partida já encerrada */
  const editHistoryEvent = useCallback((historyIndex: number, eventId: string, patch: HistoryEventPatch) => {
    mutate(s => {
      const h = s.history[historyIndex]
      if (h) s.history[historyIndex] = applyHistoryEdit(h, eventId, patch)
      return s
    }, { stampDomain: 'jogo' })
  }, [mutate])

  const unlinkTournamentMatch = useCallback(() => {
    mutate(s => {
      s.tournament = null
      return s
    }, { stampDomain: 'jogo' })
  }, [mutate])

  const resetAllMatch = useCallback(() => {
    mutate(s => {
      s.clock = { running: false, elapsed: 0, startedAt: 0 }
      s.events = []
      s.fx = null
      s.a.score = 0
      s.a.fouls = 0
      s.b.score = 0
      s.b.fouls = 0
      s.pauses = emptyPauses()
      return s
    }, { stampDomain: 'jogo' })
  }, [mutate])

  const addPlayerToTeam = useCallback((teamId: string, name: string) => {
    if (!name.trim()) return null
    const newPlayer: StreamingPlayer = { id: uid(), name: name.trim() }
    setTeams(prev => {
      const updated = prev.map(t => {
        if (t.id === teamId) {
          return { ...t, players: [...t.players, newPlayer] }
        }
        return t
      })
      broadcastAndSave(state, updated)
      return updated
    })

    // Sincroniza se o time for o time A ou time B ativo
    mutate(s => {
      for (const side of ['a', 'b'] as const) {
        if (s[side].id === teamId) {
          s[side].players = [...s[side].players, newPlayer]
        }
      }
      return s
    })

    return newPlayer
  }, [broadcastAndSave, mutate, state])

  const updateDevice = useCallback((updated: Partial<StreamingDevice>) => {
    const nextDev = { ...device, ...updated }
    setDevice(nextDev)
    setStreamingDevice(nextDev)
  }, [device])

  return {
    state,
    teams,
    setTeams,
    device,
    updateDevice,
    serverOnline,
    syncError,
    mirror,
    peers,
    clockOffset,
    // Actions
    toggleClock,
    adjustClock,
    resetClock,
    swapSides,
    addEvent,
    removeEvent,
    removeLast,
    removeLastOf,
    assignPlayer,
    moveEventSide,
    setTeam,
    updateSettings,
    setTextActive,
    addTextItem,
    updateTextItem,
    removeTextItem,
    hideAllTexts,
    setHidden,
    setLabel,
    setScene,
    editHistoryEvent,
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
  }
}
