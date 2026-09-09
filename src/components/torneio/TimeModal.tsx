import { useState, useEffect } from 'react'
import { torneioPublico, type JogadorTimePublico, type TimePublico } from '../../services/torneioPublico'
import Avatar from '../equipes/Avatar'
import './timeModal.css'
import { useTournamentCategory } from '../../contexts/TournamentContext'

interface Props {
  timeId: number
  onClose: () => void
}

/** Card/modal público do time — nome + elenco elegível (mesma regra da súmula, cancelados
 * nunca aparecem), com logo e fotos 100% locais (`torneio-publico.php?action=time`, que já
 * devolve `logo_path`/`foto_path` internos com cache-busting). Nunca consulta o
 * Poloperator — migração de mídia concluída, essa dependência de runtime foi removida. */
export default function TimeModal({ timeId, onClose }: Props) {
  const categoria = useTournamentCategory()
  const [dados, setDados] = useState<{ time: TimePublico; elenco: JogadorTimePublico[] } | null>(null)

  useEffect(() => {
    let cancelado = false
    torneioPublico.time(timeId, categoria).then(d => { if (!cancelado) setDados(d) })
    return () => { cancelado = true }
  }, [timeId, categoria])

  return (
    <div className="tmm-overlay" onClick={onClose}>
      <div className="tmm-modal" onClick={e => e.stopPropagation()}>
        <button className="tmm-close" onClick={onClose} aria-label="Fechar">✕</button>

        {!dados && <p className="tmm-hint">Carregando…</p>}
        {dados && (
          <>
            <div className="tmm-header">
              {dados.time.logo_path && <img src={dados.time.logo_path} alt="" className="tmm-logo" />}
              <h3 className="tmm-nome">{dados.time.nome}</h3>
            </div>

            <div className="tmm-lista-title">Jogadores</div>
            {dados.elenco.length === 0 && <p className="tmm-hint">Nenhum atleta elegível cadastrado neste time.</p>}
            <ul className="tmm-jogadores">
              {dados.elenco.map(j => (
                <li key={j.membro_id} className="tmm-jogador">
                  <Avatar nome={j.nome} foto={j.foto_path ?? undefined} className="tmm-jogador-avatar" />
                  <span>{j.nome}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
