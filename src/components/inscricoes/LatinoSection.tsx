import { Globe } from 'lucide-react'

interface Props {
  latino: boolean | null
  nacionalidade: string
  onChange: (val: boolean) => void
}

export default function LatinoSection({ latino, nacionalidade, onChange }: Props) {
  const estrangeira = nacionalidade === 'estrangeire'

  return (
    <section className="ins-card">
      <div className="ins-card-header">
        <div className="ins-card-icon"><Globe size={18} /></div>
        <div>
          <div className="ins-card-title">Latinoamericano 2026</div>
          <div className="ins-card-subtitle">Peru — vagas via Campeonato Brasileiro</div>
        </div>
      </div>

      <p style={{ fontSize: 15, color: 'rgba(255,255,255,.65)', marginBottom: 16, lineHeight: 1.5 }}>
        Você pretende disputar vaga para o <strong style={{ color: '#fff' }}>Latinoamericano 2026</strong> através deste campeonato?
      </p>

      {estrangeira && (
        <div className="ins-info-box" style={{ marginBottom: 16 }}>
          Pessoas estrangeiras também podem disputar vaga classificatória através do Campeonato Brasileiro,
          <strong> desde que não possuam vaga garantida por seu país de origem</strong>.
          Ao optar por disputar vaga através do Brasileiro, a pessoa atleta não poderá disputar
          vaga classificatória por outro campeonato nacional.
        </div>
      )}

      <div className="ins-radio-group">
        {([true, false] as const).map(v => (
          <label key={String(v)} className="ins-radio-item">
            <input
              type="radio"
              name="ins-latino"
              checked={latino === v}
              onChange={() => onChange(v)}
            />
            <span className="ins-radio-label">
              <span className="ins-radio-dot" />
              {v ? 'Sim, quero disputar vaga' : 'Não por agora'}
            </span>
          </label>
        ))}
      </div>
    </section>
  )
}
