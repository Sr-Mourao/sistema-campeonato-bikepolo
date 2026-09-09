import type { BroadcastTorneioPublico, JogoPublico, StandingRowPublico } from '../../services/torneioPublico'

const nomes = ['Alento', 'Buena Mira', 'Velkro', 'Fero', 'Drop', 'Garupa', 'Hito', 'Lama', 'Alpaca', 'Zeta', 'Cuida', 'Bugio', 'Marino']
const row = (nome: string, i: number): StandingRowPublico => ({
  time_id: i + 1, nome, logo: null, j: 4, v: Math.max(0, 4 - Math.floor(i / 3)), e: i % 2,
  d: Math.floor(i / 4), gp: 10 - Math.floor(i / 2), gc: 3 + i, sg: 7 - i,
  faltas: i + 2, pontos: Math.max(1, 12 - i), buchholz: 20 - i, buchholz_detalhe: [],
  decisao: null, posicao: i + 1, classificado_direto: i < 6, repescagem: i >= 6,
})

const match = (codigo: string, ordem: number, a: number | null, b: number | null, patch: Partial<JogoPublico> = {}): JogoPublico => ({
  codigo, bracket: null, ordem, status: 'agendado', placar_a: null, placar_b: null, is_bye: 0,
  overtime: 0, horario_previsto: null, horario_inicio_real: null, horario_fim_real: null,
  fase_tipo: 'swiss', fase_rodada: 3, fase_rotulo: 'Rodada 3',
  time_a_nome: a == null ? null : nomes[a - 1], time_b_nome: b == null ? null : nomes[b - 1],
  time_a_id: a, time_b_id: b, vencedor_time_id: null, time_a_origem: null, time_b_origem: null,
  time_a_logo: null, time_b_logo: null, ...patch,
})

const encerrado = (codigo: string, ordem: number, a: number, b: number, pa: number, pb: number, patch: Partial<JogoPublico> = {}) =>
  match(codigo, ordem, a, b, { status: 'encerrado', placar_a: pa, placar_b: pb, vencedor_time_id: pa > pb ? a : b, ...patch })

const origem = (codigo: string, resultado: 'vencedor' | 'perdedor' = 'vencedor') => JSON.stringify({ tipo: 'jogo', codigo, resultado })

const rodadas = [
  encerrado('R3-J1', 1, 1, 7, 3, 2), encerrado('R3-J2', 2, 2, 8, 4, 1),
  match('R3-J3', 3, 3, 9, { status: 'em_andamento', placar_a: 2, placar_b: 1 }),
  encerrado('R3-J4', 4, 4, 10, 1, 0), encerrado('R3-J5', 5, 5, 11, 2, 4),
  encerrado('R3-J6', 6, 6, 12, 5, 3), match('R3-BYE', 7, 13, null, { is_bye: 1, status: 'encerrado', bye_motivo: 'rodízio' }),
]

const equalizacao = [
  match('EQ1', 1, 6, 7, { fase_tipo: 'equalizacao', fase_rodada: null, fase_rotulo: 'Equalização', status: 'em_andamento', placar_a: 2, placar_b: 1 }),
  encerrado('EQ2', 2, 8, 9, 3, 4, { fase_tipo: 'equalizacao', fase_rodada: null, fase_rotulo: 'Equalização' }),
]

const classificacaoRevisao = nomes.map(row).map((time, i) => ({
  ...time,
  nome: i === 2 ? 'Associação Bike Polo Continental' : time.nome,
  pontos: [10, 10, 8, 8, 7, 7, 6, 6, 5, 5, 4, 4, 2][i],
  decisao: ['vitorias', null, 'saldo', null, 'buchholz', null, 'fair_play', null, 'confronto_direto', null, 'empates', null, null][i],
}))

const repescagem = [
  encerrado('REP-R1', 1, 8, 13, 3, 1, { fase_tipo: 'repescagem', fase_rodada: null, fase_rotulo: 'Repescagem', bracket: 'repescagem' }),
  encerrado('REP-R2', 2, 9, 12, 2, 1, { fase_tipo: 'repescagem', fase_rodada: null, fase_rotulo: 'Repescagem', bracket: 'repescagem' }),
  encerrado('REP-R3', 3, 10, 11, 1, 4, { fase_tipo: 'repescagem', fase_rodada: null, fase_rotulo: 'Repescagem', bracket: 'repescagem' }),
  match('REP-R4', 4, 8, 9, { fase_tipo: 'repescagem', fase_rodada: null, fase_rotulo: 'Repescagem', bracket: 'repescagem', status: 'em_andamento', placar_a: 2, placar_b: 1, time_a_origem: origem('REP-R1'), time_b_origem: origem('REP-R2') }),
  match('REP-R5', 5, 7, 11, { fase_tipo: 'repescagem', fase_rodada: null, fase_rotulo: 'Repescagem', bracket: 'repescagem', time_b_origem: origem('REP-R3') }),
]

const double = [
  encerrado('QA', 1, 4, 5, 3, 1, { fase_tipo: 'double', bracket: 'winners', fase_rodada: null, fase_rotulo: 'Double Elimination' }),
  encerrado('QB', 2, 3, 6, 2, 4, { fase_tipo: 'double', bracket: 'winners', fase_rodada: null, fase_rotulo: 'Double Elimination' }),
  encerrado('QC', 3, 2, 8, 3, 2, { fase_tipo: 'double', bracket: 'winners', fase_rodada: null, fase_rotulo: 'Double Elimination' }),
  encerrado('QD', 4, 1, 7, 4, 1, { fase_tipo: 'double', bracket: 'winners', fase_rodada: null, fase_rotulo: 'Double Elimination' }),
  encerrado('B1', 5, 5, 3, 2, 1, { fase_tipo: 'double', bracket: 'losers', fase_rodada: null, fase_rotulo: 'Double Elimination' }),
  encerrado('B2', 6, 8, 7, 1, 3, { fase_tipo: 'double', bracket: 'losers', fase_rodada: null, fase_rotulo: 'Double Elimination' }),
  match('SF1', 7, 1, 4, { fase_tipo: 'double', bracket: 'winners', fase_rodada: null, fase_rotulo: 'Double Elimination', status: 'em_andamento', placar_a: 2, placar_b: 1 }),
  match('SF2', 8, 2, 6, { fase_tipo: 'double', bracket: 'winners', fase_rodada: null, fase_rotulo: 'Double Elimination' }),
  match('B3', 9, 5, null, { fase_tipo: 'double', bracket: 'losers', fase_rodada: null, fase_rotulo: 'Double Elimination', time_b_origem: origem('SF2', 'perdedor') }),
  match('B4', 10, 7, null, { fase_tipo: 'double', bracket: 'losers', fase_rodada: null, fase_rotulo: 'Double Elimination', time_b_origem: origem('SF1', 'perdedor') }),
  match('FA', 11, null, null, { fase_tipo: 'double', bracket: 'winners', fase_rodada: null, fase_rotulo: 'Double Elimination', time_a_origem: origem('SF1'), time_b_origem: origem('SF2') }),
  match('B5', 12, null, null, { fase_tipo: 'double', bracket: 'losers', fase_rodada: null, fase_rotulo: 'Double Elimination', time_a_origem: origem('B3'), time_b_origem: origem('B4') }),
  match('B6', 13, null, null, { fase_tipo: 'double', bracket: 'losers', fase_rodada: null, fase_rotulo: 'Double Elimination', time_a_origem: origem('B5'), time_b_origem: origem('FA', 'perdedor') }),
  match('GF', 14, null, null, { fase_tipo: 'double', bracket: 'final', fase_rodada: null, fase_rotulo: 'Double Elimination', time_a_origem: origem('FA'), time_b_origem: origem('B6') }),
]

export const PREVIEW_BROADCAST: BroadcastTorneioPublico = {
  torneio: { id: 1, nome: '10º Campeonato Brasileiro de Bike Polo', categoria: 'misto', formato: 'misto_swiss_13', estado: 'DOUBLE', classificados_diretos: 6, vagas_repescagem: 2 },
  classificacao: nomes.map(row), rodadas, repescagem, double, campeao: null,
}

export function previewBroadcast(search: string): BroadcastTorneioPublico | null {
  const params = new URLSearchParams(search)
  if (!params.has('preview')) return null
  if (params.get('preview') === 'campeao') return { ...PREVIEW_BROADCAST, campeao: { time_id: 1, nome: nomes[0], logo: '/imgs/times/1/logo.webp', jogo_codigo: 'GF' } }
  if (params.get('preview') === 'final') {
    return { ...PREVIEW_BROADCAST, double: [...double.filter(j => j.codigo !== 'GF'), match('GF', 14, 1, 5, { status: 'em_andamento', placar_a: 4, placar_b: 2, fase_tipo: 'double', bracket: 'final', fase_rodada: null, fase_rotulo: 'Grande Final' })] }
  }
  if (params.get('preview') === 'classificacao-revisao') {
    return { ...PREVIEW_BROADCAST, classificacao: classificacaoRevisao, rodadas: [...rodadas, ...equalizacao] }
  }
  return PREVIEW_BROADCAST
}
