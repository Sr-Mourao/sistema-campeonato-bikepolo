import type { Patrocinador } from '../../hooks/usePatrocinadores'

export const SPONSOR_DURATION_MS = 8000

export interface SponsorAsset {
  nome: string
  slug: string
  src: string
  url?: string
}

/** O intervalo usa exclusivamente os arquivos originais locais, nunca os SVGs derivados. */
export function localSponsorAssets(lista: Patrocinador[]): SponsorAsset[] {
  return lista.flatMap(p => {
    const original = p.logoOriginal
    if (!original?.startsWith('/imgs/logos/originais/')) return []
    return [{ nome: p.nome, slug: p.slug, src: original, url: p.url.trim() || undefined }]
  })
}
