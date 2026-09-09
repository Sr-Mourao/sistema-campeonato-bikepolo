import { useEffect, useState } from 'react'
import type { EventoPublico } from '../../services/torneioPublico'
import Avatar from '../equipes/Avatar'
import './teamReactionChip.css'

const DURACAO_MS: Record<EventoPublico['categoria'], number> = { gol: 2400, falta: 1700 }
const SAIDA_ANTES_MS = 350

/**
 * Reação PEQUENA e integrada ao placar quando um evento novo chega — nunca mais um
 * overlay grande cobrindo a tela (removido a pedido: "sensação de o placar reagindo,
 * não de uma tela nova entrando por cima"). Some sozinha; quem decide QUANDO isto existe
 * é `useEventQueue` (inalterado) — este componente só apresenta por alguns segundos e
 * chama `onDone`.
 */
export default function TeamReactionChip({ evento, onDone }: { evento: EventoPublico; onDone: () => void }) {
  const [saindo, setSaindo] = useState(false)

  useEffect(() => {
    const duracao = DURACAO_MS[evento.categoria]
    const t1 = setTimeout(() => setSaindo(true), duracao - SAIDA_ANTES_MS)
    const t2 = setTimeout(onDone, duracao)
    return () => { clearTimeout(t1); clearTimeout(t2) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uma instância = um evento
  }, [])

  let texto: string
  if (evento.categoria === 'falta') texto = `FALTA · ${evento.atleta ?? '—'}`
  else if (evento.tipo === 'sem_autoria') texto = 'GOL OUTORGADO'
  else if (evento.tipo === 'gol_contra') texto = 'GOL CONTRA'
  else texto = `GOL · ${evento.atleta ?? '—'}`

  // Só mostra avatar quando há um atleta de verdade (nunca inventa um pra outorgado/contra).
  const mostrarAvatar = !!evento.atleta

  return (
    <div className={`bcy-reacao bcy-reacao--${evento.categoria} ${saindo ? 'bcy-reacao--saindo' : ''}`}>
      {mostrarAvatar && <Avatar nome={evento.atleta!} foto={evento.foto_path ?? undefined} className="bcy-reacao-avatar" />}
      <span className="bcy-reacao-texto">{texto}</span>
    </div>
  )
}
