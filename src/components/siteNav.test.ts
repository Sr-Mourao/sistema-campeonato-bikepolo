import { describe, expect, it } from 'vitest'
import { SITE_NAV_CTA, SITE_NAV_LINKS, SITE_NAV_SECONDARY_LINKS } from './siteNav'

describe('navegação pública do campeonato', () => {
  it('prioriza resultados e preserva os acessos existentes', () => {
    expect(SITE_NAV_LINKS.slice(0, 4).map(link => link.href)).toEqual(['/torneio/resultados', '/torneio', '/equipes', '/torneio?aba=regulamento'])
  })

  it('usa a área da pessoa atleta como CTA e deixa carteira/inscrições secundárias', () => {
    expect(SITE_NAV_CTA).toEqual({ label: 'Área da Pessoa Atleta', href: '/minha-inscricao' })
    expect(SITE_NAV_SECONDARY_LINKS.map(link => link.href)).toEqual(['/carteira', '/inscricoes'])
    expect(SITE_NAV_LINKS.some(link => link.href === '/carteira')).toBe(false)
  })
})
