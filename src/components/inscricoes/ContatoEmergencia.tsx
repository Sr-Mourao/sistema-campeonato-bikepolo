import { Phone } from 'lucide-react'

export interface ContatoEmergenciaValues {
  nome: string
  relacao: string
  telefone: string
}

interface Props {
  values: ContatoEmergenciaValues
  errors: Partial<Record<keyof ContatoEmergenciaValues, string>>
  onChange: (field: keyof ContatoEmergenciaValues, value: string) => void
}

export default function ContatoEmergencia({ values, errors, onChange }: Props) {
  return (
    <section className="ins-card">
      <div className="ins-card-header">
        <div className="ins-card-icon"><Phone size={18} /></div>
        <div>
          <div className="ins-card-title">Contato de Emergência</div>
          <div className="ins-card-subtitle">
            Estas informações serão utilizadas apenas em caso de necessidade durante o evento.
          </div>
        </div>
      </div>

      <div className="ins-field">
        <label className="ins-label">Nome do contato</label>
        <input
          className={`ins-input${errors.nome ? ' ins-input--error' : ''}`}
          type="text"
          value={values.nome}
          onChange={e => onChange('nome', e.target.value)}
          placeholder="Nome completo"
        />
        {errors.nome && <p className="ins-error-msg">{errors.nome}</p>}
      </div>

      <div className="ins-field">
        <label className="ins-label">Relação</label>
        <input
          className={`ins-input${errors.relacao ? ' ins-input--error' : ''}`}
          type="text"
          value={values.relacao}
          onChange={e => onChange('relacao', e.target.value)}
          placeholder="Ex: mãe, pai, cônjuge, amige…"
        />
        {errors.relacao && <p className="ins-error-msg">{errors.relacao}</p>}
      </div>

      <div className="ins-field" style={{ marginBottom: 0 }}>
        <label className="ins-label">Telefone / WhatsApp</label>
        <input
          className={`ins-input${errors.telefone ? ' ins-input--error' : ''}`}
          type="tel"
          value={values.telefone}
          onChange={e => onChange('telefone', e.target.value)}
          placeholder="(XX) XXXXX-XXXX"
        />
        {errors.telefone && <p className="ins-error-msg">{errors.telefone}</p>}
      </div>
    </section>
  )
}
