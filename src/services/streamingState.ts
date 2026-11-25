/**
 * Streaming State Engine
 * Manages live match state, clock timing, rosters, texts-on-screen,
 * and synchronization between control mesa and OBS streaming overlays.
 */

export interface StreamingPlayer {
  id: string
  name: string
  nivel?: number
}

export interface StreamingTeam {
  id: string | null
  name: string
  short: string
  color: string
  players: StreamingPlayer[]
  score: number
  fouls: number
}

export interface StreamingClock {
  running: boolean
  elapsed: number
  startedAt: number
}

export interface StreamingSettings {
  durMin: number
  mode: 'down' | 'up'
  pos: 'tl' | 'tr' | 'tc' | 'bc'
  scale: number
  useShort: boolean
  goalAnim: 'full' | 'bar' | 'off'
  showFouls: boolean
  autoPause: boolean
  autoPauseMin: number
  brand: string
  /** Pausas técnicas por time por jogo */
  techMax: number
  /** Duração da pausa técnica (min) */
  techMin: number
  /** Duração da pausa mecânica (min, sem limite de quantidade) */
  mechMin: number
  /** Cartão da jogadora após o gol (canto do overlay) */
  pcOn: boolean
  pcSecs: number
  pcMatchGoals: boolean
  pcMatchFouls: boolean
  pcChampGoals: boolean
  pcChampFouls: boolean
}

/** Pausa em andamento de um time, com cronômetro próprio */
export interface TeamPause {
  kind: 'tech' | 'mech'
  durMs: number
  elapsed: number
  startedAt: number
  running: boolean
}

export interface TeamPauseState {
  techUsed: number
  mechUsed: number
  active: TeamPause | null
}

export interface StreamingPauses {
  a: TeamPauseState
  b: TeamPauseState
}

export interface StreamingTextItem {
  id: string
  tpl: 'lower' | 'center' | 'ticker' | 'badge'
  title: string
  sub: string
  secs: number
}

export interface StreamingTexts {
  items: StreamingTextItem[]
  on: {
    lower: string | null
    center: string | null
    ticker: string | null
    badge: string | null
  }
  at: Record<string, number>
}

export interface StreamingFx {
  id: string
  type: 'goal' | 'foul' | 'cancel'
  side?: 'a' | 'b'
  at: number
  team?: string
  short?: string
  color?: string
  player?: string
  of?: 'goal' | 'foul'
  /** Gol contra: player é do time adversário ao que pontuou */
  own?: boolean
  /** Quando a autoria foi definida (para o cartão da jogadora) */
  pat?: number
}

export interface StreamingEvent {
  id: string
  type: 'goal' | 'foul'
  side: 'a' | 'b'
  teamId: string | null
  team: string
  pid: string | null
  player: string
  clock: string
  gt: number
  at: number
  /** Gol contra: conta para `side`, mas quem fez (player) é do outro time */
  own?: boolean
  /** Time de quem fez o lance, quando difere de `team` (gol contra) */
  playerTeam?: string
}

export interface StreamingScheduleItem {
  id: string
  a: string
  b: string
  label: string
  done?: boolean
}

export interface StreamingHistoryItem {
  label: string
  a: string
  b: string
  sa: number
  sb: number
  at: number
  events?: StreamingEvent[]
}

export interface StreamingDevice {
  id: string
  name: string
  role: 'mesa' | 'overlays' | 'completo'
}

export interface StreamingState {
  a: StreamingTeam
  b: StreamingTeam
  label: string
  clock: StreamingClock
  settings: StreamingSettings
  texts: StreamingTexts
  lastBy: Record<string, { id: string; name: string; role: string; at: number }>
  hidden: boolean
  fx: StreamingFx | null
  events: StreamingEvent[]
  schedule: StreamingScheduleItem[]
  current: number
  history: StreamingHistoryItem[]
  pauses: StreamingPauses
  rev: number
  by?: string
}

export const PALETTE_STREAMING = [
  '#de04ac', // Magenta PIOR
  '#ff931e', // Laranja PIOR
  '#5a0781', // Roxo
  '#2a9d55', // Verde
  '#1d7cf2', // Azul
  '#f4b400', // Amarelo
  '#00a6a6', // Ciano
  '#e73697', // Rosa
  '#7e7365', // Cinza
  '#111111', // Preto
]

export const SIMULATION_TEAMS: StreamingTeam[] = [
  {
    id: 'sim1',
    name: 'Time 1',
    short: 'T1',
    color: '#de04ac',
    score: 0,
    fouls: 0,
    players: [
      { id: 'sim1p1', name: 'Bene', nivel: 10 },
      { id: 'sim1p2', name: 'emi', nivel: 5 },
      { id: 'sim1p3', name: 'Paulo', nivel: 5 },
    ],
  },
  {
    id: 'sim2',
    name: 'Time 2',
    short: 'T2',
    color: '#ff931e',
    score: 0,
    fouls: 0,
    players: [
      { id: 'sim2p1', name: 'Deivi', nivel: 8 },
      { id: 'sim2p2', name: 'Kwy', nivel: 8 },
      { id: 'sim2p3', name: 'Carla', nivel: 4 },
    ],
  },
  {
    id: 'sim3',
    name: 'Time 3',
    short: 'T3',
    color: '#f4b400',
    score: 0,
    fouls: 0,
    players: [
      { id: 'sim3p1', name: 'Mourao', nivel: 8 },
      { id: 'sim3p2', name: 'Jpg', nivel: 7 },
      { id: 'sim3p3', name: 'Ana', nivel: 4 },
    ],
  },
  {
    id: 'sim4',
    name: 'Time 4',
    short: 'T4',
    color: '#2a9d55',
    score: 0,
    fouls: 0,
    players: [
      { id: 'sim4p1', name: 'Dox', nivel: 8 },
      { id: 'sim4p2', name: 'Vitinho', nivel: 7 },
      { id: 'sim4p3', name: 'Lusca', nivel: 5 },
    ],
  },
  {
    id: 'sim5',
    name: 'Time 5',
    short: 'T5',
    color: '#5a0781',
    score: 0,
    fouls: 0,
    players: [
      { id: 'sim5p1', name: 'gusta', nivel: 8 },
      { id: 'sim5p2', name: 'mat', nivel: 6 },
      { id: 'sim5p3', name: 'Lari', nivel: 6 },
    ],
  },
  {
    id: 'sim6',
    name: 'Time 6',
    short: 'T6',
    color: '#00a6a6',
    score: 0,
    fouls: 0,
    players: [
      { id: 'sim6p1', name: 'Marcos', nivel: 7 },
      { id: 'sim6p2', name: 'Kelvola', nivel: 7 },
      { id: 'sim6p3', name: 'Aguidota', nivel: 6 },
    ],
  },
  {
    id: 'sim7',
    name: 'Time 7',
    short: 'T7',
    color: '#e73697',
    score: 0,
    fouls: 0,
    players: [
      { id: 'sim7p1', name: 'Emily Ethel', nivel: 7 },
      { id: 'sim7p2', name: 'Jantas', nivel: 7 },
      { id: 'sim7p3', name: 'Buratto', nivel: 6 },
    ],
  },
]

export const DEFAULT_STREAMING_TEAMS: StreamingTeam[] = [
  {
    id: 'ver',
    name: 'Time 1',
    short: 'T1',
    color: '#de04ac',
    score: 0,
    fouls: 0,
    players: [],
  },
  {
    id: 'azu',
    name: 'Time 2',
    short: 'T2',
    color: '#ff931e',
    score: 0,
    fouls: 0,
    players: [],
  },
]

export const DEFAULT_STREAMING_STATE: StreamingState = {
  a: {
    id: 'ver',
    name: 'Time 1',
    short: 'T1',
    color: '#de04ac',
    score: 0,
    fouls: 0,
    players: [],
  },
  b: {
    id: 'azu',
    name: 'Time 2',
    short: 'T2',
    color: '#ff931e',
    score: 0,
    fouls: 0,
    players: [],
  },
  label: '',
  clock: {
    running: false,
    elapsed: 0,
    startedAt: 0,
  },
  settings: {
    durMin: 18,
    mode: 'down',
    pos: 'tl',
    scale: 1,
    useShort: false,
    goalAnim: 'full',
    showFouls: true,
    autoPause: true,
    autoPauseMin: 2,
    brand: '#ff931e',
    techMax: 2,
    techMin: 2,
    mechMin: 5,
    pcOn: true,
    pcSecs: 7,
    pcMatchGoals: true,
    pcMatchFouls: true,
    pcChampGoals: true,
    pcChampFouls: false,
  },
  texts: {
    items: [
      { id: 'tx1', tpl: 'lower', title: 'Intervalo', sub: 'O próximo jogo começa em instantes', secs: 0 },
      { id: 'tx2', tpl: 'center', title: 'Grande Final', sub: '2º PCP · Curitiba', secs: 8 },
      { id: 'tx3', tpl: 'ticker', title: 'PIOR', sub: 'Transmissão ao vivo · Curitiba Bike Polo', secs: 0 },
      { id: 'tx4', tpl: 'badge', title: 'Ao vivo', sub: '', secs: 0 },
    ],
    on: { lower: null, center: null, ticker: null, badge: null },
    at: {},
  },
  lastBy: {},
  hidden: false,
  fx: null,
  events: [],
  schedule: [],
  current: -1,
  history: [],
  pauses: {
    a: { techUsed: 0, mechUsed: 0, active: null },
    b: { techUsed: 0, mechUsed: 0, active: null },
  },
  rev: 0,
}

export function emptyPauses(): StreamingPauses {
  return {
    a: { techUsed: 0, mechUsed: 0, active: null },
    b: { techUsed: 0, mechUsed: 0, active: null },
  }
}

export function pauseElapsedMs(p: TeamPause, serverOffset = 0): number {
  return p.elapsed + (p.running ? Date.now() + serverOffset - p.startedAt : 0)
}

/** Tempo restante da pausa; negativo quando estourou */
export function pauseRemainingMs(p: TeamPause, serverOffset = 0): number {
  return p.durMs - pauseElapsedMs(p, serverOffset)
}

/** "01:42", ou "+00:12" quando passou do tempo */
export function formatPauseTime(remainingMs: number): string {
  return remainingMs >= 0 ? formatClockTime(remainingMs) : `+${formatClockTime(-remainingMs)}`
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 8)
}

export function normPlayers(list: unknown): StreamingPlayer[] {
  if (!Array.isArray(list)) return []
  return list
    .map(p => {
      if (typeof p === 'string') return { id: uid(), name: p }
      if (p && typeof p === 'object' && 'name' in p) {
        const item = p as { id?: string; name: unknown; nivel?: unknown }
        return {
          id: item.id || uid(),
          name: String(item.name || ''),
          nivel: typeof item.nivel === 'number' ? item.nivel : undefined,
        }
      }
      return null
    })
    .filter((p): p is StreamingPlayer => p !== null && p.name.trim().length > 0)
}

export function normTeams(list: unknown): StreamingTeam[] {
  if (!Array.isArray(list)) return []
  return list.map(t => {
    const raw = t as Partial<StreamingTeam>
    return {
      id: raw.id || uid(),
      name: String(raw.name || 'Time'),
      short: String(raw.short || (raw.name ? raw.name.slice(0, 3).toUpperCase() : 'TIM')),
      color: String(raw.color || '#ff931e'),
      score: typeof raw.score === 'number' ? raw.score : 0,
      fouls: typeof raw.fouls === 'number' ? raw.fouls : 0,
      players: normPlayers(raw.players),
    }
  })
}

export function recomputeScores(state: StreamingState): void {
  for (const side of ['a', 'b'] as const) {
    state[side].score = state.events.filter(e => e.type === 'goal' && e.side === side).length
    state[side].fouls = state.events.filter(e => e.type === 'foul' && e.side === side).length
  }
}

export function hydrateStreamingState(o: unknown): StreamingState {
  const d = JSON.parse(JSON.stringify(DEFAULT_STREAMING_STATE)) as StreamingState
  if (!o || typeof o !== 'object') return d

  const src = o as Record<string, unknown>
  for (const key of Object.keys(d) as (keyof StreamingState)[]) {
    if (src[key] === undefined) continue
    const targetVal = d[key]
    const srcVal = src[key]
    if (targetVal && typeof targetVal === 'object' && !Array.isArray(targetVal)) {
      if (srcVal && typeof srcVal === 'object' && !Array.isArray(srcVal)) {
        Object.assign(targetVal, srcVal)
      }
    } else if (Array.isArray(targetVal)) {
      if (Array.isArray(srcVal)) {
        // @ts-expect-error dynamic assign
        d[key] = srcVal
      }
    } else {
      // @ts-expect-error dynamic assign
      d[key] = srcVal
    }
  }

  d.texts.on = Object.assign({ lower: null, center: null, ticker: null, badge: null }, d.texts?.on || {})
  d.texts.at = d.texts.at || {}

  const basePauses = emptyPauses()
  for (const side of ['a', 'b'] as const) {
    d.pauses[side] = { ...basePauses[side], ...(d.pauses?.[side] || {}) }
  }

  for (const side of ['a', 'b'] as const) {
    d[side].players = normPlayers(d[side].players)
  }

  for (const e of d.events) {
    if (e.pid === undefined && e.player) {
      const p = d[e.side]?.players.find(x => x.name === e.player)
      e.pid = p ? p.id : null
    }
  }

  recomputeScores(d)
  return d
}

export function calculateElapsed(clock: StreamingClock, serverOffset = 0): number {
  return clock.elapsed + (clock.running ? Date.now() + serverOffset - clock.startedAt : 0)
}

export interface PlayerStats {
  matchGoals: number
  matchFouls: number
  matchOwnGoals: number
  champGoals: number
  champFouls: number
}

/** Time de quem fez o lance (no gol contra é o adversário de quem pontuou) */
export function eventPlayerTeam(ev: StreamingEvent): string {
  return ev.own ? ev.playerTeam || ev.team : ev.team
}

/**
 * Números da jogadora no jogo atual e no campeonato (jogo atual + histórico
 * desta mesa). Identifica pela dupla nome + time.
 */
export function playerStatsFor(state: StreamingState, player: string, team: string): PlayerStats {
  const mine = (ev: StreamingEvent) => ev.player === player && eventPlayerTeam(ev) === team
  const match = state.events.filter(mine)
  const champ = [...match, ...state.history.flatMap(h => h.events || []).filter(mine)]
  return {
    matchGoals: match.filter(e => e.type === 'goal' && !e.own).length,
    matchFouls: match.filter(e => e.type === 'foul').length,
    matchOwnGoals: match.filter(e => e.type === 'goal' && e.own).length,
    champGoals: champ.filter(e => e.type === 'goal' && !e.own).length,
    champFouls: champ.filter(e => e.type === 'foul').length,
  }
}

/** Há quantos ms o efeito aconteceu, no relógio do servidor */
export function fxAgeMs(fx: { at: number } | null | undefined, serverOffset = 0): number {
  return fx ? Date.now() + serverOffset - fx.at : Infinity
}

export function formatClockTime(ms: number): string {
  const t = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(t / 60)
  const seconds = t % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function getClockDisplayText(clock: StreamingClock, settings: StreamingSettings, serverOffset = 0): string {
  const durMs = (settings.durMin || 18) * 60000
  const el = calculateElapsed(clock, serverOffset)
  if (settings.mode === 'up') {
    return formatClockTime(el)
  }
  return formatClockTime(durMs - Math.min(el, durMs))
}

export function exportPoloperatorCsv(events: StreamingEvent[], _state?: StreamingState): string {
  const header = ['id', 'tipo', 'tempo_jogo_ms', 'relogio', 'lado', 'time_id', 'time_nome', 'atleta_id', 'atleta_nome', 'data_hora_epoch', 'gol_contra'].join(',')
  const rows = events.map(e => {
    return [
      `"${e.id}"`,
      `"${e.type}"`,
      e.gt,
      `"${e.clock}"`,
      `"${e.side}"`,
      `"${e.teamId || ''}"`,
      `"${(e.team || '').replace(/"/g, '""')}"`,
      `"${e.pid || ''}"`,
      `"${(e.player || '').replace(/"/g, '""')}"`,
      e.at,
      e.own ? 1 : 0,
    ].join(',')
  })
  return [header, ...rows].join('\n')
}

const DEVICE_STORAGE_KEY = 'polo.device.v2'

export function getStreamingDevice(): StreamingDevice {
  if (typeof window === 'undefined') {
    return { id: 'srv001', name: 'Servidor', role: 'completo' }
  }
  try {
    const raw = localStorage.getItem(DEVICE_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StreamingDevice>
      if (parsed.id && parsed.name && parsed.role) {
        return parsed as StreamingDevice
      }
    }
  } catch {
    // fallback
  }

  const id = uid() + uid()
  const ua = navigator.userAgent
  const prefix = /android/i.test(ua) ? 'Android ' : /iphone|ipad/i.test(ua) ? 'iPhone ' : 'PC '
  const dev: StreamingDevice = {
    id,
    name: prefix + id.slice(0, 3).toUpperCase(),
    role: 'completo',
  }
  try {
    localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(dev))
  } catch {
    // ignore
  }
  return dev
}

export function setStreamingDevice(dev: StreamingDevice): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(dev))
  } catch {
    // ignore
  }
}
