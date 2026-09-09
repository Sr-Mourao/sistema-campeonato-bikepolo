import type { CampeaoPublico, JogoPublico, StandingRowPublico } from '../../services/torneioPublico'

const EM_CURSO = new Set(['chamado', 'em_andamento'])
const JA_ACONTECEU = new Set(['chamado', 'em_andamento', 'encerrado', 'wo', 'cancelado'])

export const statusPartida = (status: string): string => ({
  agendado: 'A seguir', atrasado: 'Atrasado', chamado: 'Chamado', em_andamento: 'Ao vivo',
  encerrado: 'Final', wo: 'W.O.', cancelado: 'Cancelado',
}[status] ?? 'A definir')

/** Mantém exatamente a ordem oficial recebida; não ordena nem recalcula desempate. */
export function classificacaoOficial(rows: StandingRowPublico[]): StandingRowPublico[] {
  return rows.slice()
}

/**
 * Em andamento vence. Depois, a rodada mais alta que efetivamente começou/terminou.
 * Uma rodada futura apenas agendada não substitui o resultado recém encerrado.
 * Antes do primeiro jogo, mostra a primeira rodada criada.
 */
export function escolherRodada(jogos: JogoPublico[]): { rodada: number; jogos: JogoPublico[] } | null {
  const swiss = jogos.filter(j => j.fase_tipo === 'swiss' && j.fase_rodada != null)
  if (!swiss.length) return null
  const rodadas = new Map<number, JogoPublico[]>()
  for (const jogo of swiss) {
    const rodada = jogo.fase_rodada!
    rodadas.set(rodada, [...(rodadas.get(rodada) ?? []), jogo])
  }
  const numeros = [...rodadas.keys()].sort((a, b) => a - b)
  const emCurso = numeros.filter(n => rodadas.get(n)!.some(j => !j.is_bye && EM_CURSO.has(j.status)))
  const iniciadas = numeros.filter(n => rodadas.get(n)!.some(j => !j.is_bye && JA_ACONTECEU.has(j.status)))
  const rodada = emCurso.at(-1) ?? iniciadas.at(-1) ?? numeros[0]
  return rodada == null ? null : { rodada, jogos: rodadas.get(rodada)! }
}

export type EtapaClassificacao =
  | { tipo: 'rodada'; rotulo: string; rodada: number; jogos: JogoPublico[] }
  | { tipo: 'equalizacao'; rotulo: 'Equalização'; jogos: JogoPublico[] }

/**
 * Assim que suas partidas oficiais existem, a Equalização substitui a última
 * rodada suíça independentemente do status. Nenhum confronto é criado aqui.
 */
export function escolherEtapaClassificacao(jogos: JogoPublico[]): EtapaClassificacao | null {
  const equalizacao = jogos.filter(j => j.fase_tipo === 'equalizacao' && !j.is_bye)
  if (equalizacao.length) return { tipo: 'equalizacao', rotulo: 'Equalização', jogos: equalizacao }

  const rodada = escolherRodada(jogos)
  return rodada ? { tipo: 'rodada', rotulo: `Rodada ${rodada.rodada}`, ...rodada } : null
}

export type ColunaDesempateOverlay = 'v' | 'e' | 'sg' | 'buch' | 'fp'

/** Traduz somente a metadata oficial para a célula editorial do overlay. */
export function colunaDoDesempate(decisao: string | null): ColunaDesempateOverlay | null {
  return ({
    vitorias: 'v', empates: 'e', saldo: 'sg', buchholz: 'buch', fair_play: 'fp',
  } as Record<string, ColunaDesempateOverlay | undefined>)[decisao ?? ''] ?? null
}

export function jogoTemPlacar(jogo: JogoPublico): boolean {
  return !jogo.is_bye && ['em_andamento', 'encerrado', 'wo'].includes(jogo.status)
    && jogo.placar_a != null && jogo.placar_b != null
}

export function porCodigo(jogos: JogoPublico[], codigo: string): JogoPublico | undefined {
  return jogos.find(j => j.codigo === codigo)
}

/**
 * Consome a lista na ordem oficial entregue pelo backend; nunca deriva sequência da
 * coluna Winners/Losers. Em andamento prevalece, depois vem o primeiro agendado pronto.
 */
export function partidaOperacionalEmFoco(jogosOrdenados: JogoPublico[]): JogoPublico | undefined {
  return jogosOrdenados.find(j => j.status === 'em_andamento')
    ?? jogosOrdenados.find(j => j.status === 'agendado' && j.time_a_id != null && j.time_b_id != null)
}

export function classificadosRepescagem(jogos: JogoPublico[]) {
  return ['REP-R4', 'REP-R5'].flatMap(codigo => {
    const jogo = porCodigo(jogos, codigo)
    if (!jogo || jogo.status !== 'encerrado' || jogo.vencedor_time_id == null) return []
    const ladoA = jogo.vencedor_time_id === jogo.time_a_id
    return [{
      time_id: jogo.vencedor_time_id,
      nome: (ladoA ? jogo.time_a_nome : jogo.time_b_nome) ?? 'A definir',
      logo: ladoA ? jogo.time_a_logo : jogo.time_b_logo,
      codigo,
    }]
  })
}

export type EstadoFinal =
  | { tipo: 'aguardando'; jogo: JogoPublico | null }
  | { tipo: 'partida'; jogo: JogoPublico }
  | { tipo: 'campeao'; campeao: CampeaoPublico }

/** O frontend apenas interpreta o campeão confirmado pelo payload oficial. */
export function estadoDaFinal(double: JogoPublico[], campeao: CampeaoPublico | null): EstadoFinal {
  if (campeao) return { tipo: 'campeao', campeao }
  const gf2 = porCodigo(double, 'GF2')
  const gf = porCodigo(double, 'GF')
  const jogo = gf2 ?? gf ?? null
  if (jogo?.time_a_id != null && jogo.time_b_id != null) return { tipo: 'partida', jogo }
  return { tipo: 'aguardando', jogo }
}

export function chaveMudouParaCampeao(anterior: CampeaoPublico | null, atual: CampeaoPublico | null): boolean {
  return anterior === null && atual !== null
}
