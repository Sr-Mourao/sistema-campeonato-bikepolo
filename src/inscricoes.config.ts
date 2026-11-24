export const CONFIG = {
  VALOR_MISTO: 182,
  DESCONTO_PRIMEIRO_TORNEIO: 0.50,

  VALOR_ALIMENTACAO_COMPLETO: 51,
  VALOR_ALIMENTACAO_ALMOCO: 21,
  VALOR_ALOJAMENTO_DIARIA: 26,

  LIMITE_MISTO: 4,
  UPLOAD_TIMES: true,

  // Alojamento — 03 a 09/09/2026, fonte única (espelha ALOJAMENTO_DIAS_VALIDOS em db.php)
  ALOJAMENTO_DIARIAS: [
    { dia: 3, mes: 'SET', nome: 'Quinta'  },
    { dia: 4, mes: 'SET', nome: 'Sexta'   },
    { dia: 5, mes: 'SET', nome: 'Sábado'  },
    { dia: 6, mes: 'SET', nome: 'Domingo' },
    { dia: 7, mes: 'SET', nome: 'Segunda' },
    { dia: 8, mes: 'SET', nome: 'Terça'   },
    { dia: 9, mes: 'SET', nome: 'Quarta'  },
  ],
} as const

export type Config = typeof CONFIG

export type DescontoTipo = 'ppi' | 'primeiroTorneio' | null

export interface CalcResult {
  valorMistoBase: number
  subtotalBase: number
  descontoValor: number
  descontoTipo: DescontoTipo
  temPPI: boolean
  temPrimeiroTorneio: boolean
  valorEsportivo: number
  valorAlim: number
  diasAlim: number
  valorAloj: number
  diasAloj: number
  total: number
}

export type PacoteAlim = 'completo' | 'almoco' | null

function alimVal(pacote: PacoteAlim, cfg: Config): number {
  if (pacote === 'completo') return cfg.VALOR_ALIMENTACAO_COMPLETO
  if (pacote === 'almoco')   return cfg.VALOR_ALIMENTACAO_ALMOCO
  return 0
}

export function calcTotal(
  state: {
    misto: boolean
    acaoPreta: boolean; acaoParda: boolean
    acaoIndigena: boolean; acaoPrimeiroTorneio: boolean
    alimentacaoDia5: PacoteAlim; alimentacaoDia6: PacoteAlim; alimentacaoDia7: PacoteAlim
    alojamento: boolean
    diasAlojamento: number[]
  },
  cfg: Config = CONFIG
): CalcResult {
  const temPPI = state.acaoPreta || state.acaoParda || state.acaoIndigena
  const temPrimeiroTorneio = state.acaoPrimeiroTorneio && !temPPI

  const valorMistoBase = state.misto ? cfg.VALOR_MISTO : 0
  const subtotalBase   = valorMistoBase

  let valorEsportivo = subtotalBase
  let descontoValor  = 0
  let descontoTipo: DescontoTipo = null

  if (temPPI && subtotalBase > 0) {
    // Isenção total — máxima prioridade
    valorEsportivo = 0
    descontoValor  = subtotalBase
    descontoTipo   = 'ppi'
  } else if (temPrimeiroTorneio) {
    // 50% de desconto sobre o valor esportivo
    valorEsportivo = subtotalBase * (1 - cfg.DESCONTO_PRIMEIRO_TORNEIO)
    descontoValor  = subtotalBase * cfg.DESCONTO_PRIMEIRO_TORNEIO
    descontoTipo   = 'primeiroTorneio'
  }

  const diasAlim = [state.alimentacaoDia5, state.alimentacaoDia6, state.alimentacaoDia7].filter(Boolean).length
  const valorAlim = alimVal(state.alimentacaoDia5, cfg) + alimVal(state.alimentacaoDia6, cfg) + alimVal(state.alimentacaoDia7, cfg)

  const diasAloj = state.alojamento ? state.diasAlojamento.length : 0
  const valorAloj = diasAloj * cfg.VALOR_ALOJAMENTO_DIARIA

  const total = valorEsportivo + valorAlim + valorAloj

  return {
    valorMistoBase, subtotalBase,
    descontoValor, descontoTipo,
    temPPI, temPrimeiroTorneio,
    valorEsportivo, valorAlim, diasAlim, valorAloj, diasAloj, total,
  }
}
