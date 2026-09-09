import { Trophy, Users } from 'lucide-react'

export type TipoParticipacao = 'atleta' | 'acompanhante'

interface Props {
  value: TipoParticipacao
  onChange: (v: TipoParticipacao) => void
}

export default function TipoParticipacao({ value, onChange }: Props) {
  return (
    <section className="ins-card">
      <div className="ins-card-header" style={{ marginBottom: 16 }}>
        <div>
          <div className="ins-card-title">Participação no Evento</div>
        </div>
      </div>

      <div className="ins-team-opts">
        <label className={`ins-team-opt${value === 'atleta' ? ' ins-team-opt--active' : ''}`}>
          <input
            type="radio"
            name="ins-tipo-participacao"
            value="atleta"
            checked={value === 'atleta'}
            onChange={() => onChange('atleta')}
            style={{ position: 'absolute', opacity: 0, width: 0 }}
          />
          <div className="ins-team-opt-icon"><Trophy size={20} /></div>
          <div className="ins-team-opt-title">Atleta</div>
          <div className="ins-team-opt-desc">Vou disputar um ou mais torneios</div>
        </label>

        <label className={`ins-team-opt${value === 'acompanhante' ? ' ins-team-opt--active' : ''}`}>
          <input
            type="radio"
            name="ins-tipo-participacao"
            value="acompanhante"
            checked={value === 'acompanhante'}
            onChange={() => onChange('acompanhante')}
            style={{ position: 'absolute', opacity: 0, width: 0 }}
          />
          <div className="ins-team-opt-icon"><Users size={20} /></div>
          <div className="ins-team-opt-title">Acompanhante / Apoio</div>
          <div className="ins-team-opt-desc">Vou acompanhar ou apoiar sem disputar torneios</div>
        </label>
      </div>
    </section>
  )
}
