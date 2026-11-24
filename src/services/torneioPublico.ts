// Cliente do endpoint público do torneio (public/api/torneio-publico.php) — sem
// autenticação, somente leitura.

export interface FasePublica { tipo: string; rodada: number | null; rotulo: string; estado: string; completa: boolean }

export interface TorneioResumo {
  torneio: {
    id: number; nome: string; categoria: string; formato: 'misto_swiss_13'; estado: string
    classificados_diretos: number; vagas_repescagem: number; rodadas_swiss: number
    pontos_vitoria: number; pontos_empate: number; pontos_derrota: number
  }
  fases: FasePublica[]
  criterios: { chave: string; label: string }[]
}

/** Composição do Buchholz (seção 8 do brief de área pública) — mesmos dados já somados
 * pelo backend em calcularClassificacao(), nunca recalculados no front. */
export interface BuchholzAdversario { time_id: number; nome: string; pontos: number }

export interface StandingRowPublico {
  time_id: number; nome: string
  logo?: string | null
  j: number; v: number; e: number; d: number
  gp: number; gc: number; sg: number; faltas: number; pontos: number
  buchholz: number; buchholz_detalhe: BuchholzAdversario[]
  /** Texto pronto do backend explicando o critério que decidiu esta posição frente à
   * linha imediatamente acima (decompoeDecisao() em lib.php) — nunca inferir comparando
   * valores no frontend quando este campo já existe. */
  decisao: string | null
  posicao: number; classificado_direto: boolean; repescagem: boolean
}

export interface FaltaIndividualPublico { membro_id: number; atleta: string; time_id: number; time_nome: string; faltas: number }

export interface JogadorTimePublico { membro_id: number; nome: string; foto_path: string | null }
export interface TimePublico { id: number; nome: string; logo_path: string | null }

export interface JogoPublico {
  codigo: string; bracket: string | null; ordem: number; status: string
  placar_a: number | null; placar_b: number | null; is_bye: number; overtime: number
  horario_previsto: string | null; horario_inicio_real: string | null; horario_fim_real: string | null
  fase_tipo: string; fase_rodada: number | null; fase_rotulo: string
  time_a_nome: string | null; time_b_nome: string | null
  time_a_id: number | null; time_b_id: number | null; vencedor_time_id: number | null
  time_a_origem: string | null; time_b_origem: string | null
  bye_motivo?: string | null
  /** Brasão local (cache-busted) — nunca Poloperator (migração de mídia concluída). */
  time_a_logo: string | null; time_b_logo: string | null
}

export interface CampeaoPublico {
  time_id: number
  nome: string
  logo: string | null
  jogo_codigo: 'GF' | 'GF2'
}

export interface PodioTimePublico {
  posicao: 1 | 2 | 3
  time_id: number
  nome: string
  logo: string | null
}

export interface BroadcastTorneioPublico {
  torneio: {
    id: number; nome: string; categoria: string; formato: 'misto_swiss_13'; estado: string
    classificados_diretos: number; vagas_repescagem: number
  }
  classificacao: StandingRowPublico[]
  rodadas: JogoPublico[]
  repescagem: JogoPublico[]
  double: JogoPublico[]
  campeao: CampeaoPublico | null
}

export interface ArtilheiroPublico { membro_id: number; atleta: string; foto: string | null; time_id: number; time_nome: string; gols: number; posicao: number }
export interface FairPlayPublico { time_id: number; nome: string; jogos: number; faltas: number; media: number; posicao: number }

export interface CampanhaNumeros {
  j: number; v: number; e: number; d: number; gp: number; gc: number; sg: number
  gols_normais: number; gols_outorgados: number; gols_contra: number; faltas: number; fair_play: number
}

export interface JogoCampanhaPublico {
  codigo: string; fase: string; fase_tipo: string; rodada: number | null; etapa: string
  adversario_id: number; adversario: string; adversario_logo: string | null
  gols_pro: number; gols_contra: number; placar: string; resultado: 'V' | 'E' | 'D'; data_hora: string | null
}

export interface CampanhaPublica {
  primeira_fase: CampanhaNumeros; repescagem: CampanhaNumeros; double: CampanhaNumeros; total: CampanhaNumeros
  fases_disputadas: string[]; jogos: JogoCampanhaPublico[]
}

export interface PessoaResultadoPublico { membro_id: number; nome: string; foto_path: string | null }

export interface ColocacaoFinalPublica {
  posicao: number; time_id: number; nome: string; logo: string | null
  posicao_primeira_fase: number; etapa_final: string; explicacao: string; ordenado_por_classificacao_primeira_fase: boolean
  elenco: PessoaResultadoPublico[]; campanha: CampanhaPublica
}

export interface AwardVencedorPublico { pessoa_id: number; nome: string; foto: string | null; time: string | null; time_logo?: string | null; votos?: number; posicao?: number; percentual?: number }
export interface AwardResultadoPublico {
  codigo: string; nome: string; descricao: string; vencedores: AwardVencedorPublico[]
  empate: boolean; total_votos?: number; maior_quantidade?: number; origem: 'votacao_interna' | 'cadastro_oficial'
  votacao?: { total_votos_validos: number; distribuicao: AwardVencedorPublico[] }
}

export interface ResultadosPublicos {
  competicao: { id: number; categoria: 'misto'; nome: string; titulo_publico: string; estado: string; encerrado: boolean }
  campeao_definido: boolean; classificacao_final_completa: boolean
  classificacao_final: ColocacaoFinalPublica[]
  primeira_fase: {
    classificacao: (StandingRowPublico & { seed: number; jogos: JogoCampanhaPublico[] })[]
    origem: 'snapshot_oficial' | 'motor_oficial'; capturado_em: string | null
    criterios: { chave: string; label: string }[]
  }
  campanhas: { time_id: number; nome: string; logo: string | null; elenco: PessoaResultadoPublico[]; campanha: CampanhaPublica }[]
  metadata: { regra_colocacao: string; campanha_reordena: false; fair_play_representacao: string; zona_classificatoria: null | { codigo: string; ate_posicao: number; nome: string; url: string } }
  artilharia: ArtilheiroPublico[]; fair_play_times: FairPlayPublico[]
  awards: { status: string; categorias: AwardResultadoPublico[] }
}

/**
 * Evento enxuto da súmula pro feed público (seção 5/7 do brief) — sem membro_id/elenco,
 * sem nome de time: a posição (esquerda/direita) na timeline já indica o time, comparando
 * `time_id` com `jogo.time_a_id`/`time_b_id` (ver `ladoDoEvento`).
 */
export interface EventoPublico {
  categoria: 'gol' | 'falta'
  tipo: 'normal' | 'sem_autoria' | 'gol_contra' | null
  atleta: string | null
  time_id: number
  quando: string
  /** Chave estável ("gol-42"/"falta-17") — SEMPRE usar esta pra detectar evento novo,
   * nunca índice de array (dois polls podem devolver o mesmo evento em posições diferentes). */
  event_id: string
  /** Foto local do atleta (cache-busted), null se não houver ou o evento não tiver atleta
   * (gol outorgado/gol contra). Nunca Poloperator. */
  foto_path: string | null
}

/**
 * Destaque atual do torneio — fonte única (backend `resolverPartidaDestaque`, seção 22 do
 * brief) consumida IGUAL pela home /torneio e pela rota /torneio/placar. Nunca reimplementar
 * a escolha de "qual partida mostrar" em componente React.
 */
export interface DestaquePublico {
  jogo: JogoPublico | null
  eventos: EventoPublico[]
  ultimos_resultados: JogoPublico[]
  proximo_jogo: JogoPublico | null
  multiplas_em_andamento: boolean
  /** Mesmo campeão definitivo resolvido para o overlay /final pelo backend. */
  campeao: CampeaoPublico | null
}

/** Normaliza "YYYY-MM-DD HH:MM:SS" (UTC, formato do SQLite) e devolve só HH:MM local. */
export function fmtHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(iso) ? iso.replace(' ', 'T') + 'Z' : iso
  const d = new Date(normalized)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
}

/** 'a' ou 'b' conforme o time do evento — decide o lado na timeline lateralizada (seção 7). */
export function ladoDoEvento(e: EventoPublico, jogo: Pick<JogoPublico, 'time_a_id' | 'time_b_id'>): 'a' | 'b' {
  return e.time_id === jogo.time_a_id ? 'a' : 'b'
}

/** "Sem autoria" nunca aparece pro público — vira "Gol Outorgado" (seção 9 do brief), enum interno intacto. */
export function descreveEventoPublico(e: EventoPublico): string {
  if (e.categoria === 'falta') return `Falta · ${e.atleta ?? '—'}`
  if (e.tipo === 'gol_contra') return 'Gol contra'
  if (e.tipo === 'sem_autoria') return 'Gol Outorgado'
  return e.atleta ?? '—'
}

/** Cartão amarelo pra falta (nunca mais "●" genérico — seção 8), bola pra gol. */
export function iconeEvento(e: EventoPublico): string {
  return e.categoria === 'falta' ? '🟨' : '⚽'
}

async function get<T>(action: string, params: Record<string, string | number> = {}): Promise<T> {
  const qs = new URLSearchParams({ action, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) })
  const res = await fetch(`/api/torneio-publico.php?${qs.toString()}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Erro ao carregar dados do torneio')
  return data as T
}

export const torneioPublico = {
  resultados: (categoria: 'misto' = 'misto') => get<ResultadosPublicos>('resultados', { categoria }),
  broadcast: (categoria = 'misto') => get<BroadcastTorneioPublico>('broadcast', { categoria }),
  resumo: (categoria = 'misto') => get<TorneioResumo>('resumo', { categoria }),
  classificacao: (categoria = 'misto') => get<{ classificacao: StandingRowPublico[]; criterios: string[] }>('classificacao', { categoria }),
  podio: (categoria = 'misto') => get<{ podio: PodioTimePublico[] }>('podio', { categoria }),
  jogos: (categoria = 'misto', filtros?: { fase_tipo?: string; rodada?: number; codigo?: string }) =>
    get<{ jogos: JogoPublico[] }>('jogos', { categoria, ...filtros } as Record<string, string | number>),
  artilharia: (categoria = 'misto', escopo: 'classificatoria' | 'torneio' = 'torneio') =>
    get<{ artilharia: ArtilheiroPublico[] }>('artilharia', { categoria, escopo }),
  fairplay: (categoria = 'misto', escopo: 'classificatoria' | 'torneio' = 'torneio') =>
    get<{ fair_play: FairPlayPublico[] }>('fairplay', { categoria, escopo }),
  faltasIndividuais: (categoria = 'misto', escopo: 'classificatoria' | 'torneio' = 'torneio') =>
    get<{ faltas_individuais: FaltaIndividualPublico[] }>('faltas_individuais', { categoria, escopo }),
  chaves: (categoria = 'misto') => get<{ repescagem: JogoPublico[]; double: JogoPublico[] }>('chaves', { categoria }),

  /** Roster público elegível de um time (seções 17-19 do brief) — cancelados nunca aparecem. */
  time: (timeId: number, categoria = 'misto') =>
    get<{ time: TimePublico; elenco: JogadorTimePublico[] }>('time', { categoria, time_id: timeId }),

  /** Estado atual (status/placar) de UMA partida — pro polling leve do card ao vivo. */
  jogo: (codigo: string, categoria = 'misto') =>
    get<{ jogos: JogoPublico[] }>('jogos', { categoria, codigo }).then(d => d.jogos[0] ?? null),
  eventosRecentes: (codigo: string, limite = 5, categoria = 'misto') =>
    get<{ eventos: EventoPublico[] }>('eventos', { categoria, codigo, limite }),

  /**
   * Fonte única de "qual partida está em destaque agora" (status > ordem — seção 22 do
   * brief). Home /torneio e rota /torneio/placar chamam EXATAMENTE este método, nunca uma
   * lógica própria de seleção.
   */
  destaque: (categoria = 'misto', limiteEventos = 5, limiteResultados = 3) =>
    get<DestaquePublico>('destaque', { categoria, limite_eventos: limiteEventos, limite_resultados: limiteResultados }),
}
