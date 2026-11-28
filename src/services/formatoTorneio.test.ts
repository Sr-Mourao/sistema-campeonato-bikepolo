import { describe, expect, it } from 'vitest'
import { FORMATOS, formatoDe, jogosPorRodada } from './formatoTorneio'

describe('formato do torneio no front', () => {
  it('prefere o formato_info do backend', () => {
    expect(formatoDe({ formato: 'misto_swiss_13', formato_info: FORMATOS.misto_round_robin_8 }).chave).toBe('misto_round_robin_8')
  })

  it('cai no catálogo local pela chave e no suíço quando desconhecido', () => {
    expect(formatoDe({ formato: 'misto_round_robin_8' })).toMatchObject({ repescagem: false, rodadas: 7, participantes: 8, jogos_primeira_fase: 28 })
    expect(formatoDe({ formato: 'mtnb_round_robin_5' }).double).toBe('mtnb_5')
    expect(formatoDe(null).chave).toBe('misto_swiss_13')
  })

  it('jogos por rodada: 4 no de 8, 2 no de 5 (folga nunca vira jogo)', () => {
    expect(jogosPorRodada(FORMATOS.misto_round_robin_8)).toBe(4)
    expect(jogosPorRodada(FORMATOS.mtnb_round_robin_5)).toBe(2)
  })
})
