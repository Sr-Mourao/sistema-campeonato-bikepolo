import { describe, expect, it } from 'vitest'
import type { EventoPublico } from '../services/torneioPublico'
import { LiveEventBuffer } from './useEventQueue'

function evento(id: string, categoria: EventoPublico['categoria'] = 'gol'): EventoPublico {
  return { categoria, tipo: categoria === 'gol' ? 'normal' : null, atleta: 'Atleta', time_id: 1, quando: id, event_id: id, foto_path: null }
}

describe('LiveEventBuffer', () => {
  it('inicializa vendo o histórico sem reproduzi-lo', () => {
    const fila = new LiveEventBuffer()
    expect(fila.sync([evento('gol-2'), evento('gol-1')], 'J1', true)).toEqual({ mudouPartida: true, novos: 0 })
    expect(fila.proximo()).toBeNull()
  })

  it('enfileira evento novo uma única vez e polls seguintes não repetem', () => {
    const fila = new LiveEventBuffer()
    fila.sync([evento('gol-1')], 'J1', true)
    fila.sync([evento('gol-2'), evento('gol-1')], 'J1', true)
    expect(fila.proximo()?.event_id).toBe('gol-2')
    fila.sync([evento('gol-2'), evento('gol-1')], 'J1', true)
    expect(fila.proximo()).toBeNull()
  })

  it('um refresh cria outro buffer e também não reproduz histórico', () => {
    const recarregada = new LiveEventBuffer()
    recarregada.sync([evento('gol-3'), evento('gol-2')], 'J1', true)
    expect(recarregada.tamanho()).toBe(0)
  })

  it('preserva ordem cronológica quando dois gols chegam no mesmo polling', () => {
    const fila = new LiveEventBuffer()
    fila.sync([evento('gol-0')], 'J1', true)
    // API entrega DESC: mais novo primeiro.
    fila.sync([evento('gol-2'), evento('gol-1'), evento('gol-0')], 'J1', true)
    expect(fila.proximo()?.event_id).toBe('gol-1')
    expect(fila.proximo()?.event_id).toBe('gol-2')
  })

  it('troca de partida limpa a fila e eventos vistos enquanto inativo não reaparecem', () => {
    const fila = new LiveEventBuffer()
    fila.sync([], 'J1', true)
    fila.sync([evento('gol-1')], 'J1', true)
    expect(fila.tamanho()).toBe(1)
    fila.sync([evento('gol-8')], 'J2', true)
    expect(fila.tamanho()).toBe(0)
    fila.sync([evento('gol-9'), evento('gol-8')], 'J2', false)
    fila.sync([evento('gol-9'), evento('gol-8')], 'J2', true)
    expect(fila.proximo()).toBeNull()
  })

  it('destaque trocado por jogo atrasado não reproduz o histórico da nova partida', () => {
    // Marcar J1 como atrasado joga o destaque para J2, que pode já ter histórico
    // (ex.: fallback para a última encerrada). Nada disso pode virar animação de gol.
    const fila = new LiveEventBuffer()
    fila.sync([evento('j1-gol-1')], 'J1', true)
    fila.sync([evento('j1-gol-2'), evento('j1-gol-1')], 'J1', true)
    expect(fila.tamanho()).toBe(1)

    const troca = fila.sync([evento('j2-gol-3'), evento('j2-gol-2'), evento('j2-gol-1')], 'J2', true)
    expect(troca).toEqual({ mudouPartida: true, novos: 0 })
    expect(fila.tamanho()).toBe(0)
    expect(fila.proximo()).toBeNull()

    // Só o que acontecer de fato depois da troca é que anima.
    fila.sync([evento('j2-gol-4'), evento('j2-gol-3'), evento('j2-gol-2'), evento('j2-gol-1')], 'J2', true)
    expect(fila.proximo()?.event_id).toBe('j2-gol-4')
    expect(fila.proximo()).toBeNull()
  })

  it('ao atingir o teto descarta faltas antigas antes de gols sem reordenar o restante', () => {
    const fila = new LiveEventBuffer()
    fila.sync([], 'J1', true)
    const loteDesc = [evento('gol-7'), evento('gol-6'), evento('gol-5'), evento('gol-4'), evento('gol-3'), evento('falta-2', 'falta'), evento('gol-1')]
    fila.sync(loteDesc, 'J1', true)
    const ids = Array.from({ length: 6 }, () => fila.proximo()?.event_id)
    expect(ids).toEqual(['gol-1', 'gol-3', 'gol-4', 'gol-5', 'gol-6', 'gol-7'])
  })
})
