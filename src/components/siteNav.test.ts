import { describe, expect, it } from 'vitest'
import { SITE_NAV_CTA, SITE_NAV_LINKS, SITE_NAV_SECONDARY_LINKS, hrefOculto, linksVisiveis } from './siteNav'

describe('navegação pública do campeonato', () => {
  it('prioriza resultados e preserva os acessos existentes (mesmo os ocultos)', () => {
    expect(SITE_NAV_LINKS.slice(0, 4).map(link => link.href)).toEqual(['/torneio/resultados', '/torneio', '/equipes', '/torneio?aba=regulamento'])
  })

  it('usa a área da pessoa atleta como CTA e deixa carteira/inscrições secundárias', () => {
    expect(SITE_NAV_CTA).toMatchObject({ label: 'Área da Pessoa Atleta', href: '/minha-inscricao' })
    expect(SITE_NAV_SECONDARY_LINKS.map(link => link.href)).toEqual(['/carteira', '/inscricoes'])
    expect(SITE_NAV_LINKS.some(link => link.href === '/carteira')).toBe(false)
  })

  it('oculta temporariamente Equipes, Regulamento, Apoie, Dúvidas, o menu Mais e a Área da Pessoa Atleta', () => {
    expect(linksVisiveis(SITE_NAV_LINKS).map(link => link.label)).toEqual(['Resultados', 'Torneio', 'Lojinha'])
    expect(linksVisiveis(SITE_NAV_SECONDARY_LINKS)).toEqual([])
    expect(SITE_NAV_CTA.hidden).toBe(true)
    for (const href of ['/equipes', '/torneio?aba=regulamento', '/apoie', '/faq', '/carteira', '/inscricoes', '/minha-inscricao']) {
      expect(hrefOculto(href)).toBe(true)
    }
    for (const href of ['/torneio/resultados', '/torneio', '/lojinha']) expect(hrefOculto(href)).toBe(false)
  })
})
