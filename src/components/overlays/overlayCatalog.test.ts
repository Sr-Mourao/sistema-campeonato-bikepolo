import { describe, expect, it } from 'vitest'
import { OVERLAY_CATALOG, MTNB_OVERLAY_CATALOG, STREAMING_OVERLAY_CATALOG, catalogoDoFormato, overlayUrl } from './overlayCatalog'

describe('central de overlays', () => {
  it('separa as nove Browser Sources e as seis telas de palco read-only', () => {
    expect(OVERLAY_CATALOG.map(item => item.path)).toEqual([
      '/torneio/overlay/placar', '/torneio/overlay/eventos', '/torneio/overlay/emissora',
      '/torneio/overlay/confronto', '/torneio/overlay/classificacao', '/torneio/overlay/repescagem',
      '/torneio/overlay/double', '/torneio/overlay/final', '/torneio/overlay/intervalo',
      '/overlays/podio', '/overlays/awards', '/overlays/awards/mvp',
      '/overlays/awards/wow', '/overlays/awards/revelacao', '/overlays/awards/jesse',
    ])
    expect(OVERLAY_CATALOG.filter(item => item.grupo === 'Projeção / Palco')).toHaveLength(6)
    expect(OVERLAY_CATALOG.filter(item => item.destino === 'PROJETOR')).toHaveLength(6)
  })

  it('esconde só o overlay de Repescagem quando o formato não tem Repescagem', () => {
    const semRep = catalogoDoFormato(OVERLAY_CATALOG, false).map(item => item.path)
    expect(semRep).not.toContain('/torneio/overlay/repescagem')
    expect(semRep).toHaveLength(OVERLAY_CATALOG.length - 1)
    expect(catalogoDoFormato(OVERLAY_CATALOG, true)).toEqual(OVERLAY_CATALOG)
  })

  it('gera URL absoluta com o origin atual, sem domínio hardcoded', () => {
    expect(overlayUrl('/torneio/overlay/placar', 'https://transmissao.exemplo')).toBe('https://transmissao.exemplo/torneio/overlay/placar')
  })

  it('oferece seis URLs estáveis próprias do MTNB e nenhuma repescagem', () => {
    expect(MTNB_OVERLAY_CATALOG).toHaveLength(6)
    expect(MTNB_OVERLAY_CATALOG.every(item => item.path.startsWith('/torneio/mtnb/overlay/'))).toBe(true)
    expect(MTNB_OVERLAY_CATALOG.some(item => item.path.includes('repescagem'))).toBe(false)
  })

  it('oferece as URLs do sistema de streaming ao vivo e mesa de controle', () => {
    expect(STREAMING_OVERLAY_CATALOG).toHaveLength(3)
    expect(STREAMING_OVERLAY_CATALOG.map(i => i.path)).toEqual([
      '/streaming/overlay',
      '/streaming/overlay/ajustado',
      '/streaming/mesa',
    ])
  })
})
