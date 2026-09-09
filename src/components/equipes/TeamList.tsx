import type { EquipeLocal } from '../../services/equipesLocais'
import TeamSection from './TeamSection'

export default function TeamList({ equipes }: { equipes: EquipeLocal[] }) {
  if (equipes.length === 0) {
    return <p className="eq-empty">Nenhuma equipe confirmada ainda por aqui — volte em breve 💛</p>
  }

  return (
    <div className="eq-team-list">
      {equipes.map(equipe => (
        <TeamSection key={equipe.id} equipe={equipe} />
      ))}
    </div>
  )
}
