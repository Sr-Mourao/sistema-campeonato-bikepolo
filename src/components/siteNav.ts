export interface SiteNavLink {
  label: string
  href: string
  /**
   * Oculto TEMPORARIAMENTE nesta versão (2° Pior) — reativar depois removendo a flag.
   * Só some do menu e dos atalhos da Home; a rota continua funcionando se acessada direto.
   */
  hidden?: boolean
}

export const SITE_NAV_LINKS: SiteNavLink[] = [
  { label: 'Resultados', href: '/torneio/resultados' },
  { label: 'Torneio', href: '/torneio' },
  { label: 'Equipes', href: '/equipes', hidden: true }, // reativar depois
  { label: 'Regulamento', href: '/torneio?aba=regulamento', hidden: true }, // reativar depois
  { label: 'Lojinha', href: '/lojinha' },
  { label: 'Apoie', href: '/apoie', hidden: true }, // reativar depois
  { label: 'Dúvidas', href: '/faq', hidden: true }, // reativar depois
]

export const SITE_NAV_CTA: SiteNavLink = {
  label: 'Área da Pessoa Atleta',
  href: '/minha-inscricao',
  hidden: true, // reativar depois
}

/** Itens do menu "Mais". */
export const SITE_NAV_SECONDARY_LINKS: SiteNavLink[] = [
  { label: 'Carteira', href: '/carteira', hidden: true }, // reativar depois
  { label: 'Inscrições', href: '/inscricoes', hidden: true }, // reativar depois
]

export function linksVisiveis(links: SiteNavLink[]): SiteNavLink[] {
  return links.filter(link => !link.hidden)
}

const HREFS_OCULTOS = new Set(
  [...SITE_NAV_LINKS, SITE_NAV_CTA, ...SITE_NAV_SECONDARY_LINKS].filter(link => link.hidden).map(link => link.href),
)

/** true se o destino está oculto no menu — usado pelos atalhos da Home e do Hero. */
export function hrefOculto(href: string): boolean {
  return HREFS_OCULTOS.has(href)
}
