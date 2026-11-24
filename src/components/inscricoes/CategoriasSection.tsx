import { Trophy } from 'lucide-react'
import { CONFIG } from '../../inscricoes.config'

interface Props {
  genero: string
  misto: boolean
  onChange: (field: 'misto', value: boolean) => void
  error?: string
}

export default function CategoriasSection({ misto, onChange, error }: Props) {
  return (
    <section className="ins-card">
      <div className="ins-card-header">
        <div className="ins-card-icon"><Trophy size={18} /></div>
        <div>
          <div className="ins-card-title">Categorias</div>
          <div className="ins-card-subtitle">Qual torneio você pretende disputar?</div>
        </div>
      </div>

      {/* Misto */}
      <label className="ins-check-item" style={{ cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={misto}
          onChange={e => onChange('misto', e.target.checked)}
        />
        <div className="ins-check-body" style={{ display: 'flex', alignItems: 'flex-start', gap: 13 }}>
          <div className="ins-check-box" />
          <div>
            <div className="ins-check-title">
              Brasileiro Misto
              <span className="ins-discount-badge">
                R$ {CONFIG.VALOR_MISTO}
              </span>
            </div>
            <div className="ins-check-desc">
              Equipes de {CONFIG.LIMITE_MISTO} pessoas com pelo menos 1 pessoa de gênero dissidente.
              Dias 5 e 6 de Setembro.
            </div>
          </div>
        </div>
      </label>

      {error && <p className="ins-error-msg" style={{ marginTop: 8 }}>{error}</p>}
    </section>
  )
}
