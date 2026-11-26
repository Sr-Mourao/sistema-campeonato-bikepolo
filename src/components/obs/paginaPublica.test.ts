import { describe, expect, it } from 'vitest'
import { urlPublica } from './paginaPublica'

describe('urlPublica', () => {
  it('monta a URL a partir da origem do ambiente', () => {
    expect(urlPublica('https://brasileiro.bikepolo.site')).toBe('https://brasileiro.bikepolo.site/torneio?aba=visao-geral')
    expect(urlPublica('http://localhost:5173')).toBe('http://localhost:5173/torneio?aba=visao-geral')
  })
})
