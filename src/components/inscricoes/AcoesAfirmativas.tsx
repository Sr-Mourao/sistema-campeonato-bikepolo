import { Heart } from 'lucide-react'

interface Props {
  preta: boolean
  parda: boolean
  indigena: boolean
  onChange: (field: 'preta' | 'parda' | 'indigena', val: boolean) => void
}

export default function AcoesAfirmativas({ preta, parda, indigena, onChange }: Props) {
  const temSelecao = preta || parda || indigena

  return (
    <section className="ins-card">
      <div className="ins-card-header">
        <div className="ins-card-icon"><Heart size={18} /></div>
        <div>
          <div className="ins-card-title">Ações Afirmativas</div>
          <div className="ins-card-subtitle">Isenção total da inscrição</div>
        </div>
      </div>

      <div className="ins-info-box ins-info-box--green" style={{ marginBottom: 16 }}>
        As políticas de ações afirmativas têm como objetivo{' '}
        <strong>ampliar o acesso ao campeonato</strong> e fortalecer a diversidade da comunidade de Bike Polo 💛
        <br /><br />
        Pessoas pretas, pardas e indígenas possuem <strong>isenção total da inscrição</strong>.
        Não exigimos comprovação — acreditamos em você.
      </div>

      {[
        { key: 'preta',    val: preta,    label: 'Sou pessoa preta' },
        { key: 'parda',    val: parda,    label: 'Sou pessoa parda' },
        { key: 'indigena', val: indigena, label: 'Sou pessoa indígena' },
      ].map(({ key, val, label }) => (
        <label key={key} className={`ins-check-item${val ? ' ins-check-item--checked' : ''}`} style={{ cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={val}
            onChange={e => onChange(key as 'preta' | 'parda' | 'indigena', e.target.checked)}
          />
          <div className="ins-check-body" style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <div className="ins-check-box" />
            <div className="ins-check-title">{label}</div>
          </div>
        </label>
      ))}

      {temSelecao && (
        <div className="ins-info-box ins-info-box--green" style={{ marginTop: 14 }}>
          💛 <strong>Isenção total aplicada</strong> — sua inscrição esportiva é gratuita.
        </div>
      )}
    </section>
  )
}
