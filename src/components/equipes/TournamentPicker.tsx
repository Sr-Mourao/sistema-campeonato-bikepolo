import type { Torneio } from '../../services/poloperator'

interface Props {
  onEscolher: (torneio: Torneio) => void
}

const OPCOES: { torneio: Torneio; subtitulo: string; cor: 'orange' | 'green'; svg: string; svgAlt: string }[] = [
  { torneio: 'brasileiro', subtitulo: 'Categoria Misto', cor: 'orange', svg: '/identidade/10BR.svg', svgAlt: '2° Pior Campeonato de Bici Polo' },
]

export default function TournamentPicker({ onEscolher }: Props) {
  return (
    <div className="eq-picker">
      {OPCOES.map(o => (
        <button
          key={o.torneio}
          type="button"
          className={`eq-picker-panel eq-picker-panel--${o.cor}`}
          onClick={() => onEscolher(o.torneio)}
        >
          <div className="eq-picker-photo">
            <span className="eq-picker-subtitulo">{o.subtitulo}</span>
          </div>
          <div className="eq-picker-band">
            <img src={o.svg} alt={o.svgAlt} className="eq-picker-svg" />
            <span className="eq-picker-cta">Ver equipes →</span>
          </div>
        </button>
      ))}
    </div>
  )
}
