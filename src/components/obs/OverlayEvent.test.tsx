import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { EventoPublico } from '../../services/torneioPublico'
import OverlayEvent from './OverlayEvent'
import { PREVIEW_JOGO, previewEvent, readOverlayPreview } from './preview'

const onDone = vi.fn()
const base: EventoPublico = { categoria: 'gol', tipo: 'normal', atleta: 'Dedé Vianna', time_id: 101, quando: '', event_id: 'gol-1', foto_path: null }

describe('OverlayEvent', () => {
  it('gol com foto usa a imagem local', () => {
    const html = renderToStaticMarkup(<OverlayEvent evento={{ ...base, foto_path: '/imgs/atletas/7/foto.webp?v=1' }} jogo={PREVIEW_JOGO} onDone={onDone} />)
    expect(html).toContain('/imgs/atletas/7/foto.webp?v=1')
    expect(html).toContain('Dedé Vianna')
    expect(html).toContain('data-event-kind="gol"')
  })

  it('gol sem foto usa fallback de iniciais', () => {
    const html = renderToStaticMarkup(<OverlayEvent evento={base} jogo={PREVIEW_JOGO} onDone={onDone} />)
    expect(html).toContain('eq-avatar--fallback')
    expect(html).toContain('DV')
  })

  it('Gol Outorgado não inventa atleta e dá protagonismo ao time', () => {
    const html = renderToStaticMarkup(<OverlayEvent evento={{ ...base, tipo: 'sem_autoria', atleta: null }} jogo={PREVIEW_JOGO} onDone={onDone} />)
    expect(html).toContain('Gol outorgado')
    expect(html).toContain('data-event-kind="gol-outorgado"')
    expect(html).toContain('eq-monogram')
    expect(html).not.toContain('Dedé Vianna')
  })

  it('Gol Contra identifica claramente o time beneficiado', () => {
    const html = renderToStaticMarkup(<OverlayEvent evento={{ ...base, tipo: 'gol_contra', atleta: null }} jogo={PREVIEW_JOGO} onDone={onDone} />)
    expect(html).toContain('Gol contra')
    expect(html).toContain('Ponto para Discípulos')
  })

  it('falta usa o card discreto e preserva a identidade', () => {
    const html = renderToStaticMarkup(<OverlayEvent evento={{ ...base, categoria: 'falta', tipo: null }} jogo={PREVIEW_JOGO} onDone={onDone} />)
    expect(html).toContain('obs-foul-card')
    expect(html).toContain('data-event-kind="falta"')
    expect(html).toContain('Dedé Vianna')
  })
})

describe('preview OBS', () => {
  it('aceita apenas previews conhecidos', () => {
    expect(readOverlayPreview('?preview=gol')).toBe('gol')
    expect(readOverlayPreview('?preview=falta')).toBe('falta')
    expect(readOverlayPreview('?preview=qualquer')).toBeNull()
  })

  it('preview é um objeto em memória e respeita autoria por tipo', () => {
    expect(previewEvent('gol-outorgado', null).atleta).toBeNull()
    expect(previewEvent('gol-contra', null).tipo).toBe('gol_contra')
    expect(previewEvent('gol-sem-foto', null).foto_path).toBeNull()
  })
})
