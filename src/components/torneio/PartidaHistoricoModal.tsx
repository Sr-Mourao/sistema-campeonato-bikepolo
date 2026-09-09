import { useState, useEffect } from 'react'
import { torneioPublico, type JogoPublico, type EventoPublico } from '../../services/torneioPublico'
import EventTimeline from './EventTimeline'
import './partidaHistoricoModal.css'
import { useTournamentCategory } from '../../contexts/TournamentContext'

const STATUS_LABEL: Record<string, string> = {
  agendado: 'Agendado', atrasado: 'Atrasado', em_andamento: 'Em andamento',
  encerrado: 'Encerrado', wo: 'W.O.', cancelado: 'Cancelado',
}

/** Detalhe de uma partida já realizada (seção 14) — mesma timeline lateralizada, sem gols/faltas por time em coluna separada. */
export default function PartidaHistoricoModal({ codigo, onClose }: { codigo: string; onClose: () => void }) {
  const categoria = useTournamentCategory()
  const [jogo, setJogo] = useState<JogoPublico | null>(null)
  const [eventos, setEventos] = useState<EventoPublico[] | null>(null)

  useEffect(() => {
    let cancelado = false
    torneioPublico.jogo(codigo, categoria).then(j => { if (!cancelado) setJogo(j) })
    torneioPublico.eventosRecentes(codigo, 50, categoria).then(d => { if (!cancelado) setEventos(d.eventos) })
    return () => { cancelado = true }
  }, [codigo, categoria])

  return (
    <div className="phm-overlay" onClick={onClose}>
      <div className="phm-modal" onClick={e => e.stopPropagation()}>
        <button className="phm-close" onClick={onClose} aria-label="Fechar">✕</button>
        {!jogo && <p className="phm-hint">Carregando…</p>}
        {jogo && (
          <>
            <div className="phm-fase">{jogo.fase_rotulo}</div>
            <div className="phm-jogo">{jogo.time_a_nome} <span>×</span> {jogo.time_b_nome}</div>
            <div className="phm-placar">{jogo.placar_a ?? '–'} × {jogo.placar_b ?? '–'}</div>
            <div className="phm-status">{STATUS_LABEL[jogo.status] ?? jogo.status}</div>

            <h4 className="phm-historico-title">Histórico da partida</h4>
            {eventos === null && <p className="phm-hint">Carregando eventos…</p>}
            {eventos && eventos.length === 0 && <p className="phm-hint">Não há eventos detalhados registrados para esta partida.</p>}
            {eventos && eventos.length > 0 && <EventTimeline jogo={jogo} eventos={eventos} />}
          </>
        )}
      </div>
    </div>
  )
}
