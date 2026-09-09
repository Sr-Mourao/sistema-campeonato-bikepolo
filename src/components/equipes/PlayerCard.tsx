import type { AtletaLocal } from '../../services/equipesLocais'
import Avatar from './Avatar'

/**
 * Cidade/país/"desde"/mão dominante existiam quando a foto vinha do Poloperator (que
 * trazia esses campos junto). A fonte agora é 100% interna (times/pessoas) — não há
 * esses campos no cadastro, e não inventamos dado: o card mostra nome + foto.
 */
export default function PlayerCard({ atleta }: { atleta: AtletaLocal }) {
  return (
    <figure className="eq-portrait">
      <div className="eq-portrait-photo">
        <Avatar nome={atleta.name} foto={atleta.photoPath} className="eq-portrait-avatar" />
      </div>
      <figcaption className="eq-portrait-caption">
        <p className="eq-portrait-name">{atleta.name}</p>
      </figcaption>
    </figure>
  )
}
