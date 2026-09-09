const OPCOES = [
  { value: 'vegetariano', label: 'Vegetariano',               sub: null },
  { value: 'vegano',      label: 'Vegano',                    sub: null },
  { value: 'lactose',     label: 'Intolerância à lactose',    sub: null },
  { value: 'outra',       label: 'Outra restrição alimentar', sub: null },
  {
    value: 'alergia',
    label: 'Alergia alimentar severa',
    sub:   'não conseguimos garantir ausência de contaminação cruzada',
  },
] as const

const COM_DESCRICAO = new Set(['outra', 'alergia'])

interface Props {
  tipo:      string | null
  descricao: string
  onChange:  (tipo: string | null, descricao: string) => void
  variant:   'ins' | 'atl'
}

export default function RestricoesAlimentaresField({ tipo, descricao, onChange, variant }: Props) {
  const p = variant === 'ins' ? 'ins-rst' : 'atl-rst'
  const precisaDescricao = tipo !== null && COM_DESCRICAO.has(tipo)

  function handleClick(val: string) {
    if (val === tipo) {
      onChange(null, '')
    } else {
      onChange(val, COM_DESCRICAO.has(val) ? descricao : '')
    }
  }

  return (
    <div className={`${p}-wrap`}>
      <p className={`${p}-title`}>Você tem alguma restrição alimentar?</p>

      <div className={`${p}-list`}>
        {OPCOES.map(o => (
          <label
            key={o.value}
            className={`${p}-item${tipo === o.value ? ` ${p}-item--on` : ''}`}
            onClick={e => { e.preventDefault(); handleClick(o.value) }}
          >
            <input type="radio" checked={tipo === o.value} onChange={() => {}} tabIndex={-1} />
            <span className={`${p}-item-body`}>
              <span className={`${p}-item-label`}>{o.label}</span>
              {o.sub && <span className={`${p}-item-sub`}>{o.sub}</span>}
            </span>
          </label>
        ))}
      </div>

      {precisaDescricao && (
        <>
          <label className={`${p}-desc-label`}>Descreva sua restrição alimentar</label>
          <input
            type="text"
            className={`${p}-desc-input`}
            value={descricao}
            onChange={e => onChange(tipo, e.target.value)}
            placeholder="Ex: alergia a amendoim, sem glúten…"
            maxLength={300}
          />
          <p className={`${p}-aviso`}>
            Faremos o possível para considerar as restrições informadas, porém não conseguimos
            garantir ambiente livre de contaminação cruzada ou preparo especializado para alergias severas.
          </p>
        </>
      )}
    </div>
  )
}
