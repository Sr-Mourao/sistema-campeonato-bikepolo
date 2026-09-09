export const CONFIG = {
  VALOR_MISTO: 182,
  VALOR_MTNB: 52,
  // Quando MTNB também está selecionado, Misto passa a R$90
  VALOR_MISTO_COM_MTNB: 90,
  DESCONTO_PRIMEIRO_TORNEIO: 0.50,

  VALOR_ALIMENTACAO_COMPLETO: 51,
  VALOR_ALIMENTACAO_ALMOCO: 21,
  VALOR_ALOJAMENTO_DIARIA: 26,

  LIMITE_MISTO: 4,
  LIMITE_MTNB: 3,
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

export type DescontoTipo = 'ppi' | 'mtnb' | 'primeiroTorneio' | null

export interface CalcResult {
  valorMistoBase: number
  valorMtnbBase: number
  subtotalBase: number
  descontoValor: number
  descontoTipo: DescontoTipo
  temPPI: boolean
  temIncentivoMtnb: boolean
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
    misto: boolean; mtnb: boolean
    acaoPreta: boolean; acaoParda: boolean
    acaoIndigena: boolean; acaoPrimeiroTorneio: boolean
    alimentacaoDia5: PacoteAlim; alimentacaoDia6: PacoteAlim; alimentacaoDia7: PacoteAlim
    alojamento: boolean
    diasAlojamento: number[]
    // aceita acoesAtivas legado (ignorado)
    acoesAtivas?: boolean
  },
  cfg: Config = CONFIG
): CalcResult {
  const temPPI = state.acaoPreta || state.acaoParda || state.acaoIndigena
  // Incentivo MTNB: só aplica quando AMBAS estão selecionadas
  const temIncentivoMtnb = state.misto && state.mtnb
  // PT não acumula com incentivo MTNB
  const temPrimeiroTorneio = state.acaoPrimeiroTorneio && !temIncentivoMtnb

  const valorMistoBase = state.misto ? cfg.VALOR_MISTO : 0
  const valorMtnbBase  = state.mtnb  ? cfg.VALOR_MTNB  : 0
  const subtotalBase   = valorMistoBase + valorMtnbBase

  let valorEsportivo = subtotalBase
  let descontoValor  = 0
  let descontoTipo: DescontoTipo = null

  if (temPPI && subtotalBase > 0) {
    // Isenção total — máxima prioridade
    valorEsportivo = 0
    descontoValor  = subtotalBase
    descontoTipo   = 'ppi'
  } else if (temIncentivoMtnb) {
    // Misto vira R$90 quando MTNB selecionado
    valorEsportivo = cfg.VALOR_MISTO_COM_MTNB + cfg.VALOR_MTNB
    descontoValor  = subtotalBase - valorEsportivo  // 180+50 - 90+50 = 90
    descontoTipo   = 'mtnb'
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
    valorMistoBase, valorMtnbBase, subtotalBase,
    descontoValor, descontoTipo,
    temPPI, temIncentivoMtnb, temPrimeiroTorneio,
    valorEsportivo, valorAlim, diasAlim, valorAloj, diasAloj, total,
  }
}
