import { Star } from 'lucide-react'

interface Props {
  checked: boolean
  desativado?: boolean  // quando Misto+MTNB selecionado (incentivo MTNB já está ativo)
  onChange: (val: boolean) => void
}

export default function PrimeiroTorneioSection({ checked, desativado, onChange }: Props) {
  return (
    <section className="ins-card">
      <div className="ins-card-header">
        <div className="ins-card-icon"><Star size={18} /></div>
        <div>
          <div className="ins-card-title">Incentivo para Primeiro Torneio</div>
          <div className="ins-card-subtitle">50% de desconto para quem estreia</div>
        </div>
      </div>

      <div className="ins-info-box ins-info-box--green" style={{ marginBottom: 16 }}>
        Queremos incentivar novas pessoas na comunidade 💛
        <br /><br />
        Se este for seu primeiro torneio oficial de Bike Polo, você recebe{' '}
        <strong>50% de desconto na inscrição</strong>.
      </div>

      <label
        className={`ins-check-item${checked ? ' ins-check-item--checked' : ''}${desativado ? ' ins-check-item--disabled' : ''}`}
        style={{ cursor: desativado ? 'not-allowed' : 'pointer' }}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={desativado}
          onChange={e => onChange(e.target.checked)}
        />
        <div className="ins-check-body" style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <div className="ins-check-box" />
          <div className="ins-check-title">Este será meu primeiro torneio de Bike Polo</div>
        </div>
      </label>

      {desativado && (
        <div className="ins-info-box" style={{ marginTop: 12 }}>
          O incentivo de primeiro torneio não se acumula com o incentivo MTNB.
          Como você está inscrite em ambas as categorias, o incentivo MTNB já está aplicado.
        </div>
      )}

      {checked && !desativado && (
        <div className="ins-info-box ins-info-box--green" style={{ marginTop: 14 }}>
          🌟 <strong>50% de desconto aplicado</strong> na sua inscrição esportiva.
        </div>
      )}
    </section>
  )
}
