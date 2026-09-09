import { Heart } from 'lucide-react'

export interface InformacoesSaudeValues {
  possuiPlanoSaude: boolean | null
  planoSaude: string
  numeroCarteirinha: string
}

interface Props {
  values: InformacoesSaudeValues
  onChange: (field: keyof InformacoesSaudeValues, value: boolean | null | string) => void
}

export default function InformacoesSaude({ values, onChange }: Props) {
  return (
    <section className="ins-card">
      <div className="ins-card-header">
        <div className="ins-card-icon"><Heart size={18} /></div>
        <div>
          <div className="ins-card-title">Informações de Saúde</div>
        </div>
      </div>

      <div className="ins-field">
        <label className="ins-label">Possui plano de saúde?</label>
        <div className="ins-radio-group">
          {([true, false] as const).map(v => (
            <label key={String(v)} className="ins-radio-item">
              <input
                type="radio"
                name="ins-plano-saude"
                checked={values.possuiPlanoSaude === v}
                onChange={() => onChange('possuiPlanoSaude', v)}
              />
              <span className="ins-radio-label">
                <span className="ins-radio-dot" />
                {v ? 'Sim' : 'Não'}
              </span>
            </label>
          ))}
        </div>
      </div>

      {values.possuiPlanoSaude === true && (
        <>
          <div className="ins-field">
            <label className="ins-label">Nome do plano</label>
            <input
              className="ins-input"
              type="text"
              value={values.planoSaude}
              onChange={e => onChange('planoSaude', e.target.value)}
              placeholder="Ex: Unimed, Bradesco Saúde…"
            />
          </div>

          <div className="ins-field" style={{ marginBottom: 0 }}>
            <label className="ins-label">
              Número da carteirinha{' '}
              <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.06em', textTransform: 'none' }}>
                (opcional)
              </span>
            </label>
            <input
              className="ins-input"
              type="text"
              value={values.numeroCarteirinha}
              onChange={e => onChange('numeroCarteirinha', e.target.value)}
              placeholder="Número da carteirinha"
            />
          </div>
        </>
      )}
    </section>
  )
}
