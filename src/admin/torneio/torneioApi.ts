// Camada fina sobre adminGet/adminPost pro módulo de torneio — tipagem dos
// contratos que public/api/admin/torneio/*.php e public/api/torneio-publico.php
// devolvem. Nenhum cálculo esportivo acontece aqui — tudo vem pronto do backend
// (fonte canônica), o frontend só exibe e edita antes de confirmar.
//
// Não existe mais conceito de sandbox: um torneio só tem um estado real.

import { adminGet, adminPost, AdminApiError } from '../adminApi'
import type { FormatoChave, FormatoInfo } from '../../services/formatoTorneio'

/**
 * Normalizador único de erro pra toda a área de torneio — nunca deixa
 * "[object Object]" vazar pra tela. Trata string, Error, AdminApiError/
 * AdminApiStrictError (message/debug), e qualquer objeto com campo
 * message/error reconhecível. Só cai no fallback genérico se não conseguir
 * extrair nada legível.
 */
export function getErrorMessage(error: unknown, fallback = 'Ocorreu um erro inesperado.'): string {
  if (typeof error === 'string') return error
  if (error instanceof AdminApiError) return error.message
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    const e = error as { message?: unknown; error?: unknown; debug?: unknown }
    if (typeof e.message === 'string' && e.message) return e.message
    if (typeof e.error === 'string' && e.error) return e.error
    if (typeof e.debug === 'string' && e.debug) return e.debug
  }
  return fallback
}

export interface Torneio {
  id: number
  nome: string
  categoria: string
  formato: FormatoChave
  formato_info?: FormatoInfo
  preset: string | null
  estado: string
  rodadas_swiss: number
  equalizacao_habilitada: number
  classificados_diretos: number
  vagas_repescagem: number
  pontos_vitoria: number
  pontos_empate: number
  pontos_derrota: number
  criado_em: string
}

export interface TorneioDetalhe extends Torneio {
  participantes: { time_id: number; seed: number | null; nome: string; categoria: string }[]
  criterios: string[]
  fases: Fase[]
  /** true quando há mais de uma partida marcada 'em_andamento' ao mesmo tempo (inconsistência operacional). */
  multiplas_em_andamento: boolean
  jogos_em_andamento: string[]
  /** Partida atual/próxima resolvida no backend por STATUS > ordem operacional. */
  jogo_destaque_codigo: string | null
}

export interface Fase {
  tipo: 'swiss' | 'round_robin' | 'equalizacao' | 'repescagem' | 'double'
  rodada: number | null
  rotulo: string
  estado: 'pendente' | 'sugerida' | 'confirmada' | 'em_andamento' | 'encerrada'
  /** true só quando a fase está confirmada E todas as partidas reais dela já encerraram — fonte canônica vinda do backend. */
  completa: boolean
  gerada_em?: string | null
  confirmada_em?: string | null
  confirmada_por?: string | null
}

export interface Jogo {
  id: number
  torneio_id: number
  fase_id: number
  codigo: string
  bracket: 'winners' | 'losers' | 'final' | 'repescagem' | null
  ordem: number
  time_a_id: number | null
  time_b_id: number | null
  time_a_nome: string | null
  time_b_nome: string | null
  time_a_origem: string | null
  time_b_origem: string | null
  is_bye: number
  bye_motivo: string | null
  status: 'agendado' | 'atrasado' | 'chamado' | 'em_andamento' | 'encerrado' | 'wo' | 'cancelado'
  placar_a: number | null
  placar_b: number | null
  vencedor_time_id: number | null
  wo: number
  overtime: number
  horario_previsto: string | null
  horario_inicio_real: string | null
  horario_fim_real: string | null
  observacoes: string | null
  fase_tipo: string
  fase_rodada: number | null
  fase_rotulo: string
  fase_estado: string
}

export interface ParPareamento {
  time_a_id: number
  time_b_id: number
  motivos: string[]
  rematch: boolean
  codigo?: string
}

export interface SugestaoSwiss {
  rodada: number
  bye: { time_id: number; nome: string | null; motivo: string }
  pares: ParPareamento[]
  avisos: string[]
}

export interface SugestaoEqualizacao {
  pares: ParPareamento[]
  avisos: string[]
}

export interface StandingRow {
  time_id: number
  nome: string
  j: number; v: number; e: number; d: number
  gp: number; gc: number; sg: number
  faltas: number
  pontos: number
  buchholz: number
  byes: number
  posicao: number
  decisao: string | null
  classificado_direto?: boolean
  repescagem?: boolean
}

export interface Artilheiro {
  membro_id: number; atleta: string; time_id: number; time_nome: string
  gols: number; jogos_com_gol: number; posicao: number
}

export interface FairPlayRow {
  time_id: number; nome: string; jogos: number; faltas: number; media: number; posicao: number
}

export interface Estatisticas {
  classificacao: StandingRow[]
  artilharia: Artilheiro[]
  fair_play: FairPlayRow[]
  faltas_individuais: { membro_id: number; atleta: string; time_id: number; time_nome: string; faltas: number }[]
  criterios: string[]
}

export type TipoGol = 'normal' | 'sem_autoria' | 'gol_contra'

export interface ElencoMembro { membro_id: number; time_id: number; nome: string }
export interface EventoSumula {
  categoria: 'gol' | 'falta'; id: number; time_id: number; membro_id: number | null
  tipo: TipoGol | null; minuto: number | null; quando: string; atleta: string | null
}
export interface SumulaData { jogo: Jogo; elenco: ElencoMembro[]; eventos: EventoSumula[] }

export interface AuditRow {
  id: number; usuario: string; acao: string; entidade: string; entidade_id: number | null
  estado_anterior: unknown; estado_novo: unknown; motivo: string | null
  revertido: number; revertido_em: string | null; revertido_por: string | null
  criado_em: string; pode_desfazer: boolean
}

const CRITERIOS_LABEL: Record<string, string> = {
  pontos: 'Pontos', vitorias: 'Vitórias', empates: 'Empates', saldo: 'Saldo de gols',
  gols_pro: 'Gols marcados', gols_contra_menos: 'Menos gols sofridos',
  fair_play: 'Fair Play (menos faltas)', confronto_direto: 'Confronto direto',
  confronto_direto_grupo: 'Confronto direto (jogos entre os empatados)',
  buchholz: 'Força de tabela (Buchholz)', sorteio: 'Critério manual / sorteio',
}
const CRITERIOS_DIRECAO: Record<string, '↑ mais é melhor' | '↓ menos é melhor' | ''> = {
  pontos: '↑ mais é melhor', vitorias: '↑ mais é melhor', empates: '↑ mais é melhor',
  saldo: '↑ mais é melhor', gols_pro: '↑ mais é melhor', buchholz: '↑ mais é melhor',
  gols_contra_menos: '↓ menos é melhor', fair_play: '↓ menos é melhor',
  confronto_direto: '', confronto_direto_grupo: '', sorteio: '',
}
export function criterioLabel(c: string): string { return CRITERIOS_LABEL[c] ?? c }
export function criterioDirecao(c: string): string { return CRITERIOS_DIRECAO[c] ?? '' }
export const TODOS_CRITERIOS = Object.keys(CRITERIOS_LABEL)

const API = '/api/admin/torneio'

export const torneioApi = {
  listar: () => adminGet<{ torneios: Torneio[] }>(`${API}/torneio.php`),
  detalhe: (id: number) => adminGet<TorneioDetalhe>(`${API}/torneio.php?id=${id}`),
  criarPreset: (categoria: string) => adminPost<{ id: number }>(`${API}/torneio.php`, { action: 'criar_preset', categoria }),
  zerarResultados: (torneio_id: number) => adminPost<{ ok: true }>(`${API}/torneio.php`, { action: 'zerar_resultados', torneio_id }),
  salvarCriterios: (torneio_id: number, criterios: string[]) => adminPost<{ ok: true }>(`${API}/torneio.php`, { action: 'salvar_criterios', torneio_id, criterios }),
  fecharClassificacao: (torneio_id: number) => adminPost<{ ok: true; classificacao: StandingRow[] }>(`${API}/torneio.php`, { action: 'fechar_classificacao', torneio_id }),
  gerarRepescagem: (torneio_id: number) => adminPost<{ ok: true }>(`${API}/torneio.php`, { action: 'gerar_repescagem', torneio_id }),
  gerarDouble: (torneio_id: number) => adminPost<{ ok: true }>(`${API}/torneio.php`, { action: 'gerar_double', torneio_id }),
  gerarRoundRobin: (torneio_id: number) => adminPost<{ ok: true; codigos: string[]; rodadas: number }>(`${API}/round-robin.php`, { torneio_id }),

  sugerirSwiss: (torneio_id: number, rodada: number, opts?: { modo?: string; bye_time_id?: number }) => {
    const qs = new URLSearchParams({ torneio_id: String(torneio_id), rodada: String(rodada) })
    if (opts?.modo) qs.set('modo', opts.modo)
    if (opts?.bye_time_id) qs.set('bye_time_id', String(opts.bye_time_id))
    return adminGet<SugestaoSwiss>(`${API}/swiss.php?${qs.toString()}`)
  },
  confirmarSwiss: (torneio_id: number, rodada: number, bye: SugestaoSwiss['bye'], pares: ParPareamento[]) =>
    adminPost<{ ok: true; codigos: string[] }>(`${API}/swiss.php`, { torneio_id, rodada, bye, pares }),

  sugerirEqualizacao: (torneio_id: number) => adminGet<SugestaoEqualizacao>(`${API}/equalizacao.php?torneio_id=${torneio_id}`),
  confirmarEqualizacao: (torneio_id: number, pares: ParPareamento[]) =>
    adminPost<{ ok: true }>(`${API}/equalizacao.php`, { torneio_id, pares }),

  jogos: (torneio_id: number, filtros?: { fase_tipo?: string; rodada?: number; status?: string; fase_id?: number }) => {
    const qs = new URLSearchParams({ torneio_id: String(torneio_id) })
    if (filtros?.fase_tipo) qs.set('fase_tipo', filtros.fase_tipo)
    if (filtros?.rodada) qs.set('rodada', String(filtros.rodada))
    if (filtros?.status) qs.set('status', filtros.status)
    if (filtros?.fase_id) qs.set('fase_id', String(filtros.fase_id))
    return adminGet<{ jogos: Jogo[] }>(`${API}/jogos.php?${qs.toString()}`)
  },

  sumula: (torneio_id: number, jogo_id: number) => adminGet<SumulaData>(`${API}/sumula.php?torneio_id=${torneio_id}&jogo_id=${jogo_id}`),
  registrarGol: (torneio_id: number, jogo_id: number, time_id: number, membro_id: number | null, tipo: TipoGol, minuto?: number | null) =>
    adminPost<{ ok: true; evento_id: number }>(`${API}/sumula.php`, { action: 'gol', torneio_id, jogo_id, time_id, membro_id, tipo, minuto }),
  registrarFalta: (torneio_id: number, jogo_id: number, time_id: number, membro_id: number) =>
    adminPost<{ ok: true; evento_id: number }>(`${API}/sumula.php`, { action: 'falta', torneio_id, jogo_id, time_id, membro_id }),
  removerEvento: (torneio_id: number, tipo: 'gol' | 'falta', evento_id: number) =>
    adminPost<{ ok: true }>(`${API}/sumula.php`, { action: 'remover_evento', torneio_id, tipo, evento_id }),
  recalcularPlacar: (torneio_id: number, jogo_id: number) =>
    adminPost<{ ok: true; placar_a: number; placar_b: number }>(`${API}/sumula.php`, { action: 'recalcular_placar', torneio_id, jogo_id }),
  atualizarPartida: (torneio_id: number, jogo_id: number, campos: Record<string, unknown>) =>
    adminPost<{ ok: true; status: string; vencedor_time_id: number | null; resolvidos: string[]; aviso: string | null }>(`${API}/sumula.php`, { action: 'atualizar_partida', torneio_id, jogo_id, campos }),

  estatisticas: (torneio_id: number, escopo: 'classificatoria' | 'torneio' = 'torneio') =>
    adminGet<Estatisticas>(`${API}/estatisticas.php?torneio_id=${torneio_id}&escopo=${escopo}`),

  /** Simula UMA partida real usando os mesmos endpoints/eventos da súmula manual. */
  simularPartida: (torneio_id: number, jogo_id: number) =>
    adminPost<{ ok: true; codigo: string; placar_a: number; placar_b: number; resumo: string }>(`${API}/simulador.php`, { action: 'partida', torneio_id, jogo_id }),
  /** Simula todas as partidas ainda pendentes de uma fase (rodada/equalização/repescagem/double). */
  simularPartidasPendentes: (torneio_id: number, fase_id: number) =>
    adminPost<{ ok: true; log: string[] }>(`${API}/simulador.php`, { action: 'fase', torneio_id, fase_id }),

  auditoria: (torneio_id: number) => adminGet<{ log: AuditRow[]; snapshots: unknown[] }>(`${API}/audit.php?torneio_id=${torneio_id}`),
  desfazer: (torneio_id: number, audit_id: number) => adminPost<{ ok: true }>(`${API}/audit.php`, { torneio_id, audit_id }),
}
