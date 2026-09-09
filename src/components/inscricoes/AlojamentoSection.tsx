import { Building2 } from 'lucide-react'
import { CONFIG } from '../../inscricoes.config'

interface Props {
  selecionados: number[]
  onChange: (dia: number, val: boolean) => void
}

export default function AlojamentoSection({ selecionados, onChange }: Props) {
  const total = selecionados.length * CONFIG.VALOR_ALOJAMENTO_DIARIA

  return (
    <section className="ins-card">
      <div className="ins-card-header">
        <div className="ins-card-icon"><Building2 size={18} /></div>
        <div style={{ flex: 1 }}>
          <div className="ins-card-title">
            Alojamento
            <span className="ins-optional-badge">opcional</span>
          </div>
          <div className="ins-card-subtitle">R$ {CONFIG.VALOR_ALOJAMENTO_DIARIA} por diária</div>
        </div>
      </div>

      <div className="ins-info-box">
        Alojamento <strong>dentro do próprio instituto</strong>, a R$ {CONFIG.VALOR_ALOJAMENTO_DIARIA} por diária.
        Este ano não haverá hospedagem solidária oficial.
      </div>

      <p className="ins-label" style={{ marginBottom: 12 }}>Selecione as diárias desejadas</p>
      <div className="ins-days-grid">
        {CONFIG.ALOJAMENTO_DIARIAS.map(d => (
          <label key={d.dia} className="ins-day-item">
            <input
              type="checkbox"
              checked={selecionados.includes(d.dia)}
              onChange={e => onChange(d.dia, e.target.checked)}
            />
            <span className="ins-day-label">
              <span className="ins-day-label-day">{d.dia}</span>
              <span className="ins-day-label-month">{d.mes} · {d.nome}</span>
              <span className="ins-day-label-price">R$ {CONFIG.VALOR_ALOJAMENTO_DIARIA}</span>
            </span>
          </label>
        ))}
      </div>

      {total > 0 && (
        <p style={{ marginTop: 14, fontSize: 14, color: 'rgba(255,255,255,.65)', textAlign: 'right' }}>
          Alojamento: <strong style={{ color: 'var(--ins-orange)' }}>R$ {total}</strong>
        </p>
      )}

      <p className="ins-decide-later">
        Pode decidir depois — você consegue reservar ou cancelar pela
        {' '}<a href="/minha-inscricao" className="ins-decide-later-link">área da pessoa atleta</a>.
      </p>
    </section>
  )
}
