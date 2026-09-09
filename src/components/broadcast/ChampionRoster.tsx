import type { CSSProperties } from 'react'
import type { JogadorTimePublico } from '../../services/torneioPublico'
import Avatar from '../equipes/Avatar'

export default function ChampionRoster({ atletas, className }: { atletas: JogadorTimePublico[]; className: string }) {
  return (
    <div className={className}>
      {atletas.slice(0, 4).map((atleta, i) => (
        <div key={atleta.membro_id} style={{ '--order': i } as CSSProperties}>
          <span><Avatar nome={atleta.nome} foto={atleta.foto_path ?? undefined} /></span>
          <b>{atleta.nome}</b>
        </div>
      ))}
    </div>
  )
}
