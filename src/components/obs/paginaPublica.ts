/** Página pública do torneio — a origem vem do ambiente, nunca fixada no código. */
export const CAMINHO_PUBLICO = '/torneio/misto?aba=visao-geral'

export function urlPublica(origem = typeof window === 'undefined' ? '' : window.location.origin) {
  return `${origem}${CAMINHO_PUBLICO}`
}
