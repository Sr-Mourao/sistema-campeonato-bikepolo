import { describe, expect, it } from 'vitest'
import { cenasDaCentral } from './centralScenes'
import { previewBroadcast } from '../../components/obs/tournamentOverlayPreview'
import { cruzamentosDaDouble } from '../../components/obs/tournamentOverlayData'
import { formatoDe } from '../../services/formatoTorneio'

describe('cenas da Central na mesa de streaming', () => {
  it('sem Repescagem, a cena de Repescagem vira Cruzamentos da Double (mesma URL)', () => {
    const cena = cenasDaCentral(false).find(c => c.path === '/torneio/overlay/repescagem')
    expect(cena?.nome).toBe('Cruzamentos da Double')
    expect(cenasDaCentral(true).find(c => c.path === '/torneio/overlay/repescagem')?.nome).toBe('Repescagem')
  })

  it('não oferece placar/eventos duplicados nem telas de projetor', () => {
    const nomes = cenasDaCentral(false).map(c => c.nome)
    expect(nomes).not.toContain('Placar')
    expect(nomes).not.toContain('Eventos')
    expect(cenasDaCentral(false).some(c => c.destino === 'PROJETOR')).toBe(false)
  })
})

describe('dados de ensaio dos overlays', () => {
  it('o ensaio padrão é o 2° Pior: 8 times, todos contra todos, Double 1×8, 2×7, 3×6, 4×5', () => {
    const p = previewBroadcast('?preview=1')!
    expect(formatoDe(p.torneio)).toMatchObject({ repescagem: false, participantes: 8 })
    expect(p.classificacao).toHaveLength(8)
    expect(p.repescagem).toEqual([])
    expect(p.rodadas.every(j => j.fase_tipo === 'round_robin')).toBe(true)
    const q = Object.fromEntries(cruzamentosDaDouble(p.classificacao, p.double).map(c => [c.codigo, [c.a.seed, c.b.seed, c.a.time_id, c.b.time_id]]))
    expect(q).toEqual({ QD: [1, 8, 1, 8], QC: [2, 7, 2, 7], QB: [3, 6, 3, 6], QA: [4, 5, 4, 5] })
  })

  it('o formato antigo (suíço + Repescagem) continua disponível em ?preview=suico', () => {
    const p = previewBroadcast('?preview=suico')!
    expect(formatoDe(p.torneio).repescagem).toBe(true)
    expect(p.repescagem.length).toBeGreaterThan(0)
  })
})
