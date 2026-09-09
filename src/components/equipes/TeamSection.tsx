import type { EquipeLocal } from '../../services/equipesLocais'
import { corDaEquipe } from './Avatar'
import TeamLogo from './TeamLogo'
import PlayerCard from './PlayerCard'

export default function TeamSection({ equipe }: { equipe: EquipeLocal }) {
  const cor = corDaEquipe(equipe.name)

  return (
    <section className="eq-team" id={String(equipe.id)} style={{ '--eq-team-cor': cor } as React.CSSProperties}>
      <div className="eq-team-banner">
        <div className="eq-team-emblem">
          <TeamLogo nome={equipe.name} logo={equipe.logoPath} className="eq-team-emblem-img" />
        </div>
        <div className="eq-team-banner-text">
          <h3 className="eq-team-name">{equipe.name}</h3>
        </div>
      </div>

      <div className="eq-team-roster">
        {equipe.players.map(atleta => (
          <PlayerCard key={atleta.id} atleta={atleta} />
        ))}
      </div>
    </section>
  )
}
