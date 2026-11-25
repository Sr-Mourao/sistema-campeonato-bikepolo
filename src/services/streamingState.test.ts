import { describe, expect, it } from 'vitest'
import {
  DEFAULT_STREAMING_STATE,
  SIMULATION_TEAMS,
  calculateElapsed,
  exportPoloperatorCsv,
  formatPauseTime,
  formatClockTime,
  getClockDisplayText,
  hydrateStreamingState,
  normPlayers,
  normTeams,
  pauseRemainingMs,
  playerStatsFor,
  recomputeScores,
  type StreamingEvent,
  type StreamingState,
} from './streamingState'

describe('streamingState service', () => {
  it('hydrates default state cleanly when given null or empty object', () => {
    const s1 = hydrateStreamingState(null)
    expect(s1.a.name).toBe('Time 1')
    expect(s1.b.name).toBe('Time 2')
    expect(s1.settings.durMin).toBe(18)
    expect(s1.texts.items.length).toBeGreaterThan(0)

    const s2 = hydrateStreamingState({})
    expect(s2.a.name).toBe('Time 1')
    expect(s2.clock.running).toBe(false)
  })

  it('normalizes players properly', () => {
    const players = normPlayers(['Bene', { name: 'emi', nivel: 5 }, null, { invalid: true }, ''])
    expect(players).toHaveLength(2)
    expect(players[0].name).toBe('Bene')
    expect(players[1].name).toBe('emi')
    expect(players[1].nivel).toBe(5)
  })

  it('normalizes teams properly', () => {
    const teams = normTeams([
      { id: 't1', name: 'Curitiba', color: '#ff931e', players: ['Felipe'] },
      { name: 'Floripa' },
    ])
    expect(teams).toHaveLength(2)
    expect(teams[0].short).toBe('CUR')
    expect(teams[0].players).toHaveLength(1)
    expect(teams[1].short).toBe('FLO')
  })

  it('recomputes scores and fouls correctly from events', () => {
    const state: StreamingState = JSON.parse(JSON.stringify(DEFAULT_STREAMING_STATE))
    state.events = [
      { id: '1', type: 'goal', side: 'a', teamId: 't1', team: 'T1', pid: 'p1', player: 'Bene', clock: '17:00', gt: 60000, at: 1000 },
      { id: '2', type: 'goal', side: 'a', teamId: 't1', team: 'T1', pid: 'p2', player: 'emi', clock: '15:00', gt: 180000, at: 2000 },
      { id: '3', type: 'foul', side: 'a', teamId: 't1', team: 'T1', pid: 'p1', player: 'Bene', clock: '14:00', gt: 240000, at: 3000 },
      { id: '4', type: 'goal', side: 'b', teamId: 't2', team: 'T2', pid: 'p3', player: 'Deivi', clock: '12:00', gt: 360000, at: 4000 },
      { id: '5', type: 'foul', side: 'b', teamId: 't2', team: 'T2', pid: 'p3', player: 'Deivi', clock: '10:00', gt: 480000, at: 5000 },
      { id: '6', type: 'foul', side: 'b', teamId: 't2', team: 'T2', pid: 'p4', player: 'Kwy', clock: '08:00', gt: 600000, at: 6000 },
    ]
    recomputeScores(state)
    expect(state.a.score).toBe(2)
    expect(state.a.fouls).toBe(1)
    expect(state.b.score).toBe(1)
    expect(state.b.fouls).toBe(2)
  })

  it('formats clock times correctly', () => {
    expect(formatClockTime(0)).toBe('00:00')
    expect(formatClockTime(65000)).toBe('01:05')
    expect(formatClockTime(1080000)).toBe('18:00')
  })

  it('calculates elapsed time and countdown text', () => {
    const clock = { running: false, elapsed: 120000, startedAt: 0 }
    const settings = { ...DEFAULT_STREAMING_STATE.settings, durMin: 18, mode: 'down' as const }
    expect(calculateElapsed(clock)).toBe(120000)
    expect(getClockDisplayText(clock, settings)).toBe('16:00')

    const countUpSettings = { ...settings, mode: 'up' as const }
    expect(getClockDisplayText(clock, countUpSettings)).toBe('02:00')
  })

  it('exports Poloperator CSV properly formatted', () => {
    const events: StreamingEvent[] = [
      {
        id: 'ev1',
        type: 'goal',
        side: 'a',
        teamId: 'sim1',
        team: 'Time 1',
        pid: 'p1',
        player: 'Bene',
        clock: '17:15',
        gt: 45000,
        at: 1732485600000,
      },
      {
        id: 'ev2',
        type: 'foul',
        side: 'b',
        teamId: 'sim2',
        team: 'Time "Especial"',
        pid: 'p2',
        player: 'Deivi',
        clock: '16:00',
        gt: 120000,
        at: 1732485675000,
      },
    ]

    const csv = exportPoloperatorCsv(events, DEFAULT_STREAMING_STATE)
    const lines = csv.split('\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toContain('id,tipo,tempo_jogo_ms,relogio,lado,time_id,time_nome,atleta_id,atleta_nome,data_hora_epoch')
    expect(lines[1]).toContain('"ev1","goal",45000,"17:15","a","sim1","Time 1","p1","Bene"')
    expect(lines[2]).toContain('"Time ""Especial"""')
  })

  it('contains simulation teams with players', () => {
    expect(SIMULATION_TEAMS.length).toBe(7)
    expect(SIMULATION_TEAMS[0].name).toBe('Time 1')
    expect(SIMULATION_TEAMS[0].players.length).toBeGreaterThan(0)
  })
})

describe('pausas dos times', () => {
  it('estado antigo sem pausas recebe o padrão', () => {
    const s = hydrateStreamingState({ a: { name: 'X' }, rev: 3 })
    expect(s.pauses.a).toEqual({ techUsed: 0, mechUsed: 0, active: null })
    expect(s.settings.techMax).toBe(2)
    expect(s.settings.mechMin).toBe(5)
  })

  it('calcula restante, pausado e estouro', () => {
    const now = Date.now()
    const p = { kind: 'tech' as const, durMs: 120000, elapsed: 30000, startedAt: now - 10000, running: true }
    expect(Math.round(pauseRemainingMs(p) / 1000)).toBe(80)
    expect(pauseRemainingMs({ ...p, running: false })).toBe(90000)
    expect(formatPauseTime(90000)).toBe('01:30')
    expect(formatPauseTime(-12000)).toBe('+00:12')
  })

  it('CSV marca gol contra', () => {
    const ev = { id: 'e', type: 'goal', side: 'a', teamId: 't', team: 'T', pid: 'p', player: 'P', clock: '10:00', gt: 1, at: 2, own: true } as StreamingEvent
    expect(exportPoloperatorCsv([ev]).split('\n')[1].endsWith(',1')).toBe(true)
  })
})

describe('cartão da jogadora', () => {
  it('soma jogo e campeonato por nome + time, separando gol contra', () => {
    const base = { teamId: null, pid: null, clock: '', gt: 0, at: 0 }
    const s = hydrateStreamingState({})
    s.events = [
      { ...base, id: '1', type: 'goal', side: 'a', team: 'T1', player: 'Ana' },
      { ...base, id: '2', type: 'foul', side: 'a', team: 'T1', player: 'Ana' },
      { ...base, id: '3', type: 'goal', side: 'b', team: 'T2', player: 'Ana', own: true, playerTeam: 'T1' },
      { ...base, id: '4', type: 'goal', side: 'b', team: 'T2', player: 'Ana' },
    ] as StreamingEvent[]
    s.history = [{ label: 'J1', a: 'T1', b: 'T3', sa: 1, sb: 0, at: 0, events: [{ ...base, id: '0', type: 'goal', side: 'a', team: 'T1', player: 'Ana' } as StreamingEvent] }]
    expect(playerStatsFor(s, 'Ana', 'T1')).toEqual({ matchGoals: 1, matchFouls: 1, matchOwnGoals: 1, champGoals: 2, champFouls: 1 })
    expect(playerStatsFor(s, 'Ana', 'T2').matchGoals).toBe(1)
  })
})
