import { useState } from 'react'
import { createPortal } from 'react-dom'
import { FileText, X } from 'lucide-react'
import { TERMOS } from '../../content/termosParticipacao'

interface Props {
  aceito: boolean
  onChange: (v: boolean) => void
  error?: string
}

export default function TermosParticipacao({ aceito, onChange, error }: Props) {
  const [modalAberto, setModalAberto] = useState(false)

  const modal = modalAberto
    ? createPortal(
        <div className="ins-modal-overlay" onClick={() => setModalAberto(false)}>
          <div className="ins-modal ins-modal--termos" onClick={e => e.stopPropagation()}>
            <div className="ins-modal-termos-header">
              <h2 className="ins-modal-termos-title">
                Termos de Participação — 10º Campeonato Brasileiro de Bike Polo
              </h2>
              <button type="button" className="ins-modal-termos-close" onClick={() => setModalAberto(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="ins-termos-content">
              {TERMOS.map((bloco, i) => (
                <div key={i} className="ins-termos-bloco">
                  {bloco.titulo && <p className="ins-termos-titulo">{bloco.titulo}</p>}
                  {bloco.texto && <p className="ins-termos-texto">{bloco.texto}</p>}
                </div>
              ))}
            </div>

            <div className="ins-modal-termos-footer">
              <button
                type="button"
                className="ins-modal-btn-primary"
                style={{ marginBottom: 0 }}
                onClick={() => { onChange(true); setModalAberto(false) }}
              >
                Li e concordo
              </button>
              <button
                type="button"
                className="ins-modal-btn-secondary"
                onClick={() => setModalAberto(false)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )
    : null

  return (
    <section className="ins-card">
      <div className="ins-card-header">
        <div className="ins-card-icon"><FileText size={18} /></div>
        <div>
          <div className="ins-card-title">Termos de Participação</div>
        </div>
      </div>

      <div className="ins-termos-leia">
        <button type="button" className="ins-termos-btn-ler" onClick={() => setModalAberto(true)}>
          <FileText size={13} /> Ler termos completos
        </button>
      </div>

      <label className={`ins-check-item${aceito ? ' ins-check-item--checked' : ''}${error ? ' ins-check-item--error' : ''}`}>
        <input type="checkbox" checked={aceito} onChange={e => onChange(e.target.checked)} />
        <div className="ins-check-body" style={{ display: 'flex', alignItems: 'flex-start', gap: 13 }}>
          <div className="ins-check-box" />
          <div>
            <div className="ins-check-title">Li e concordo com os Termos de Participação</div>
          </div>
        </div>
      </label>

      {error && <p className="ins-error-msg" style={{ marginTop: 8 }}>{error}</p>}

      {modal}
    </section>
  )
}
