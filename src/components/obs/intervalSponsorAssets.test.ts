import { describe, expect, it } from 'vitest'
import type { Patrocinador } from '../../hooks/usePatrocinadores'
import { localSponsorAssets, SPONSOR_DURATION_MS } from './intervalSponsorAssets'

describe('localSponsorAssets', () => {
  it('preserva a ordem e aceita somente arquivos da pasta originais', () => {
    const lista: Patrocinador[] = [
      { nome: 'Local', slug: 'local', logo: '/imgs/logos/local.svg', logoOriginal: '/imgs/logos/originais/local.png', url: 'https://local.test' },
      { nome: 'Camaleão Drinks', slug: 'camaleao', logoOriginal: '/imgs/logos/originais/camaleao.png', url: 'https://www.bebacamaleao.com.br' },
      { nome: 'Remoto', slug: 'remoto', logoOriginal: 'https://exemplo.test/logo.png', url: '' },
      { nome: 'Somente SVG', slug: 'svg', logo: '/imgs/logos/svg.svg', url: '' },
      { nome: 'Outra pasta', slug: 'outra', logoOriginal: '/imgs/logos/outra.png', url: '' },
    ]

    expect(localSponsorAssets(lista)).toEqual([
      { nome: 'Local', slug: 'local', src: '/imgs/logos/originais/local.png', url: 'https://local.test' },
      { nome: 'Camaleão Drinks', slug: 'camaleao', src: '/imgs/logos/originais/camaleao.png', url: 'https://www.bebacamaleao.com.br' },
    ])
  })

  it('mantém cada marca por oito segundos', () => {
    expect(SPONSOR_DURATION_MS).toBe(8000)
  })
})
