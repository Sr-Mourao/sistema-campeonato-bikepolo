import { Trophy } from 'lucide-react'
import { CONFIG } from '../../inscricoes.config'

interface Props {
  genero: string
  misto: boolean
  mtnb: boolean
  onChange: (field: 'misto' | 'mtnb', value: boolean) => void
  error?: string
}

const MTNB_BLOQUEADO_POR_GENERO = ['Homem cis']

export default function CategoriasSection({ genero, misto, mtnb, onChange, error }: Props) {
  const mtnbBloqueado = MTNB_BLOQUEADO_POR_GENERO.includes(genero)
  const incentivoMtnb = misto && mtnb  // quando ambos selecionados, Misto vai a R$90

  const valorMistoExibido = incentivoMtnb ? CONFIG.VALOR_MISTO_COM_MTNB : CONFIG.VALOR_MISTO

  return (
    <section className="ins-card">
      <div className="ins-card-header">
        <div className="ins-card-icon"><Trophy size={18} /></div>
        <div>
          <div className="ins-card-title">Categorias</div>
          <div className="ins-card-subtitle">Quais torneios você pretende disputar?</div>
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
                R$ {valorMistoExibido}
              </span>
              {incentivoMtnb && (
                <span
                  className="ins-discount-badge"
                  style={{ borderColor: 'rgba(76,224,168,0.4)', background: 'rgba(30,147,101,0.15)', color: '#4CE0A8', textDecoration: 'none' }}
                >
                  <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>R$ {CONFIG.VALOR_MISTO}</span> → R$ {CONFIG.VALOR_MISTO_COM_MTNB}
                </span>
              )}
            </div>
            <div className="ins-check-desc">
              Equipes de {CONFIG.LIMITE_MISTO} pessoas com pelo menos 1 pessoa de gênero dissidente.
              Dias 5 e 6 de Setembro.
            </div>
          </div>
        </div>
      </label>

      {/* MTNB */}
      <label className={`ins-check-item${mtnbBloqueado ? ' ins-check-item--disabled' : ''}`} style={{ cursor: mtnbBloqueado ? 'not-allowed' : 'pointer' }}>
        <input
          type="checkbox"
          checked={mtnb && !mtnbBloqueado}
          disabled={mtnbBloqueado}
          onChange={e => onChange('mtnb', e.target.checked)}
        />
        <div className="ins-check-body" style={{ display: 'flex', alignItems: 'flex-start', gap: 13 }}>
          <div className="ins-check-box" />
          <div>
            <div className="ins-check-title">
              Brasileiro MTNB
              <span className="ins-discount-badge">R$ {CONFIG.VALOR_MTNB}</span>
            </div>
            <div className="ins-check-desc">
              Categoria voltada para mulheres, pessoas trans e pessoas não-bináries.
              Equipes de {CONFIG.LIMITE_MTNB} pessoas. Dia 7 de Setembro.
            </div>
          </div>
        </div>
      </label>

      {incentivoMtnb && (
        <div className="ins-info-box ins-info-box--green" style={{ marginTop: 12 }}>
          ✨ <strong>Incentivo MTNB:</strong> ao se inscrever no MTNB, o Misto passa a custar R$ {CONFIG.VALOR_MISTO_COM_MTNB}. Total: R$ {CONFIG.VALOR_MISTO_COM_MTNB + CONFIG.VALOR_MTNB}.
        </div>
      )}

      {mtnbBloqueado && (
        <div className="ins-info-box" style={{ marginTop: 12 }}>
          Esta categoria é destinada a mulheres, pessoas trans e não-bináries 💛
        </div>
      )}

      {error && <p className="ins-error-msg" style={{ marginTop: 8 }}>{error}</p>}
    </section>
  )
}
