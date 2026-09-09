import { describe, expect, it } from 'vitest'
import { decidirEntradaCampeao } from './championState'

describe('estado terminal do telão', () => {
  it('não ativa sem campeão oficial ou antes do elenco estar pronto', () => {
    expect(decidirEntradaCampeao(null, null, true, true)).toBe('nenhuma')
    expect(decidirEntradaCampeao(7, null, true, false)).toBe('nenhuma')
  })

  it('abre diretamente no campeão quando a página já carrega encerrada', () => {
    expect(decidirEntradaCampeao(7, null, false, true)).toBe('direta')
  })

  it('faz transição quando o campeão surge durante o polling', () => {
    expect(decidirEntradaCampeao(7, null, true, true)).toBe('transicao')
  })

  it('não reinicia intro nem transição nos polls seguintes', () => {
    expect(decidirEntradaCampeao(7, 7, true, true)).toBe('nenhuma')
  })
})
