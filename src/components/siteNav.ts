export interface SiteNavLink {
  label: string
  href: string
}

export const SITE_NAV_LINKS: SiteNavLink[] = [
  { label: 'Resultados', href: '/torneio/resultados' },
  { label: 'Torneio', href: '/torneio' },
  { label: 'Equipes', href: '/equipes' },
  { label: 'Regulamento', href: '/torneio?aba=regulamento' },
  { label: 'Lojinha', href: '/lojinha' },
  { label: 'Apoie', href: '/apoie' },
  { label: 'Dúvidas', href: '/faq' },
]

export const SITE_NAV_CTA: SiteNavLink = {
  label: 'Área da Pessoa Atleta',
  href: '/minha-inscricao',
}

export const SITE_NAV_SECONDARY_LINKS: SiteNavLink[] = [
  { label: 'Carteira', href: '/carteira' },
  { label: 'Inscrições', href: '/inscricoes' },
]
