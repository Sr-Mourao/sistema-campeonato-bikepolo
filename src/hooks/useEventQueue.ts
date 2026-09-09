import { useEffect, useRef, useState } from 'react'
import type { EventoPublico } from '../services/torneioPublico'

const CAP_FILA = 6
/** Failsafe: se `onDone` nunca disparar por algum motivo, a fila avança sozinha depois
 * desse tempo — nunca trava esperando pra sempre (página fica aberta por horas). */
const TIMEOUT_FALLBACK_MS = 6000

/** Núcleo testável da fila. O endpoint devolve eventos do mais novo para o mais antigo;
 * a apresentação os inverte ao enfileirar para preservar a ordem real de ocorrência. */
export class LiveEventBuffer {
  private vistos = new Set<string>()
  private fila: EventoPublico[] = []
  private matchKey: string | null = null

  sync(eventos: EventoPublico[], matchKey: string | null, ativo: boolean): { mudouPartida: boolean; novos: number } {
    if (matchKey !== this.matchKey) {
      this.matchKey = matchKey
      this.vistos = new Set(eventos.map(e => e.event_id))
      this.fila = []
      return { mudouPartida: true, novos: 0 }
    }

    const novos = eventos.filter(e => !this.vistos.has(e.event_id)).reverse()
    for (const evento of novos) this.vistos.add(evento.event_id)

    if (ativo && novos.length > 0) {
      this.fila.push(...novos)
      while (this.fila.length > CAP_FILA) {
        const primeiraFalta = this.fila.findIndex(e => e.categoria === 'falta')
        if (primeiraFalta >= 0) this.fila.splice(primeiraFalta, 1)
        else this.fila.shift()
      }
    }

    return { mudouPartida: false, novos: novos.length }
  }

  proximo(): EventoPublico | null {
    return this.fila.shift() ?? null
  }

  tamanho(): number { return this.fila.length }
}

export interface EventoNaFila {
  evento: EventoPublico
  /** Chamar quando a animação terminar — libera o próximo item da fila. */
  onDone: () => void
}

/**
 * Detecta eventos NOVOS numa lista que já vem inteira a cada poll (nunca duplica
 * polling — só reage à referência de `eventos` que a página já busca) e devolve, um de
 * cada vez, qual deve estar animando agora. Puramente de apresentação: não sabe de rede,
 * não decide status/placar — por isso é reutilizável tal como está por um futuro overlay
 * OBS de evento (mesmo hook, mesmos dados).
 *
 * - Ao montar ou trocar `matchKey` (partida em destaque mudou): marca TODOS os eventos
 *   atuais como já vistos SEM enfileirar nada — nunca reproduz histórico ao abrir a
 *   página ou trocar de jogo.
 * - A cada novo `eventos` da MESMA partida: só o que for realmente novo (por `event_id`,
 *   nunca índice/timestamp) entra na fila — e só se `ativo` (a página decide isso,
 *   tipicamente `status === 'em_andamento'`; partida encerrada nunca reanima).
 * - Fila com teto pequeno; se estourar, descarta faltas antes de gols (prioriza o que
 *   importa mais — seção 21 do brief), sempre mantendo os mais recentes.
 */
export function useEventQueue(eventos: EventoPublico[], matchKey: string | null, ativo: boolean): EventoNaFila | null {
  const [atual, setAtual] = useState<EventoPublico | null>(null)
  const buffer = useRef(new LiveEventBuffer())

  // Detecta eventos novos, alimenta a fila e — se não houver nada animando agora —
  // já puxa o próximo item pra dentro de `atual`. Depende de `atual` de propósito: é
  // assim que, quando `onDone`/failsafe zera `atual`, este efeito roda de novo e drena
  // o próximo item (sem precisar espelhar `atual` num ref só pra ler dentro do efeito).
  useEffect(() => {
    const resultado = buffer.current.sync(eventos, matchKey, ativo)
    if (resultado.mudouPartida) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- troca de stream invalida imediatamente o item da partida anterior
      if (atual !== null) setAtual(null)
      return
    }

    const proximo = atual === null ? buffer.current.proximo() : null
    if (proximo) setAtual(proximo)
  }, [eventos, matchKey, ativo, atual])

  // Failsafe: nunca deixa a fila travada esperando um onDone que não veio. Usa a forma
  // funcional de setAtual (compara pelo event_id fechado no closure) — nunca precisa de
  // ref só pra ler o valor atual dentro do timeout.
  useEffect(() => {
    if (!atual) return
    const eventId = atual.event_id
    const t = setTimeout(() => {
      setAtual(prev => (prev?.event_id === eventId ? null : prev))
    }, TIMEOUT_FALLBACK_MS)
    return () => clearTimeout(t)
  }, [atual])

  return atual ? { evento: atual, onDone: () => setAtual(null) } : null
}
