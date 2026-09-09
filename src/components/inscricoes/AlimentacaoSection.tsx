import { UtensilsCrossed } from 'lucide-react'
import { CONFIG, type PacoteAlim } from '../../inscricoes.config'
import RestricoesAlimentaresField from '../shared/RestricoesAlimentaresField'

interface Props {
  dia5: PacoteAlim
  dia6: PacoteAlim
  dia7: PacoteAlim
  onChange: (dia: '5' | '6' | '7', val: PacoteAlim) => void
  restricaoTipo: string | null
  restricaoDescricao: string
  onRestricaoChange: (tipo: string | null, descricao: string) => void
}

const DIAS = [
  { key: '5' as const, label: '5', mes: 'SET', diaSemana: 'Sábado' },
  { key: '6' as const, label: '6', mes: 'SET', diaSemana: 'Domingo' },
  { key: '7' as const, label: '7', mes: 'SET', diaSemana: 'Segunda' },
]

const PACOTES: { key: 'completo' | 'almoco'; label: string; desc: string; valor: number }[] = [
  { key: 'completo', label: 'Pacote completo', desc: 'café, almoço e lanche 🌱', valor: CONFIG.VALOR_ALIMENTACAO_COMPLETO },
  { key: 'almoco',   label: 'Apenas almoço',   desc: 'só o almoço',              valor: CONFIG.VALOR_ALIMENTACAO_ALMOCO },
]

function alimVal(p: PacoteAlim) {
  if (p === 'completo') return CONFIG.VALOR_ALIMENTACAO_COMPLETO
  if (p === 'almoco')   return CONFIG.VALOR_ALIMENTACAO_ALMOCO
  return 0
}

export default function AlimentacaoSection({ dia5, dia6, dia7, onChange, restricaoTipo, restricaoDescricao, onRestricaoChange }: Props) {
  const vals: Record<string, PacoteAlim> = { '5': dia5, '6': dia6, '7': dia7 }
  const total = alimVal(dia5) + alimVal(dia6) + alimVal(dia7)

  return (
    <section className="ins-card">
      <div className="ins-card-header">
        <div className="ins-card-icon"><UtensilsCrossed size={18} /></div>
        <div style={{ flex: 1 }}>
          <div className="ins-card-title">
            Alimentação
            <span className="ins-optional-badge">opcional</span>
          </div>
          <div className="ins-card-subtitle">Pacote completo R${CONFIG.VALOR_ALIMENTACAO_COMPLETO}/dia · Almoço R${CONFIG.VALOR_ALIMENTACAO_ALMOCO}/dia</div>
        </div>
      </div>

      <div className="ins-alim-days">
        {DIAS.map(d => {
          const sel = vals[d.key]
          return (
            <div key={d.key} className="ins-alim-day">
              <div className="ins-alim-day-header">
                <span className="ins-alim-day-num">{d.label}</span>
                <span className="ins-alim-day-info">{d.mes} · {d.diaSemana}</span>
              </div>
              <div className="ins-alim-day-opts">
                {PACOTES.map(p => (
                  <button
                    key={p.key}
                    type="button"
                    className={`ins-alim-opt${sel === p.key ? ' ins-alim-opt--active' : ''}`}
                    onClick={() => onChange(d.key, sel === p.key ? null : p.key)}
                  >
                    <span className="ins-alim-opt-label">{p.label}</span>
                    <span className="ins-alim-opt-desc">{p.desc}</span>
                    <span className="ins-alim-opt-price">R$ {p.valor}</span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {total > 0 && (
        <p style={{ marginTop: 14, fontSize: 14, color: 'rgba(255,255,255,.65)', textAlign: 'right' }}>
          Alimentação: <strong style={{ color: 'var(--ins-orange)' }}>R$ {total}</strong>
        </p>
      )}

      <RestricoesAlimentaresField
        tipo={restricaoTipo}
        descricao={restricaoDescricao}
        onChange={onRestricaoChange}
        variant="ins"
      />

      <p className="ins-decide-later">
        Não quer decidir agora? Tudo bem — você pode contratar depois pela
        {' '}<a href="/minha-inscricao" className="ins-decide-later-link">área da pessoa atleta</a>.
      </p>
    </section>
  )
}
