import { describe, expect, it } from 'vitest'
import { placaDaMarca, type AmostraMarca } from './sponsorPolarity'

const amostra = (parcial: Partial<AmostraMarca>): AmostraMarca => ({
  opacos: 1000, bordaOpaca: 0, bordaLuminancia: 0, arteClara: 0, arteEscura: 1, ...parcial,
})

describe('placaDaMarca', () => {
  it('dá placa escura para arte branca recortada', () => {
    // velkro/garupa/marino/luli-shield: traço branco sobre fundo transparente.
    expect(placaDaMarca(amostra({ arteClara: 1, arteEscura: 0 }))).toBe('escura')
  })

  it('dá placa clara para arte escura recortada', () => {
    // hito/cuida/fero: traço escuro sobre fundo transparente.
    expect(placaDaMarca(amostra({ arteClara: 0.04, arteEscura: 0.92 }))).toBe('clara')
  })

  it('acompanha o fundo branco embutido em vez de inverter', () => {
    // toniracks/morgana: traço escuro, mas o PNG/JPEG traz fundo branco até a borda.
    expect(placaDaMarca(amostra({ bordaOpaca: 1, bordaLuminancia: 0.94, arteClara: 0.82, arteEscura: 0.13 }))).toBe('clara')
  })

  it('acompanha o fundo preto embutido', () => {
    // 2c2: arte branca sobre fundo preto queimado — a placa escura faz o retângulo sumir.
    expect(placaDaMarca(amostra({ bordaOpaca: 1, bordaLuminancia: 0.05, arteClara: 0.19, arteEscura: 0.77 }))).toBe('escura')
  })

  it('cai em placa clara quando não há pixel algum', () => {
    expect(placaDaMarca(amostra({ opacos: 0 }))).toBe('clara')
  })
})
