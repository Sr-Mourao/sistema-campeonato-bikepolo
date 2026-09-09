import ChampionRoster from './ChampionRoster'
import { Crest } from '../obs/TournamentGraphics'
import type { CampeaoPublico, JogadorTimePublico } from '../../services/torneioPublico'
import { TOURNAMENT_PRESENTATION, useTournamentCategory } from '../../contexts/TournamentContext'

export default function PlacarChampion({ campeao, elenco }: { campeao: CampeaoPublico; elenco: JogadorTimePublico[] }) {
  const categoria = useTournamentCategory()
  const identidade = TOURNAMENT_PRESENTATION[categoria]
  return (
    <main className="plc-champion">
      <div className="pcc-backdrop" aria-hidden="true" />
      <div className="pcc-lines" aria-hidden="true" />
      <div className="pcc-sweep" aria-hidden="true" />
      <header className="pcc-brand"><img src="/identidade/logo.svg" alt="" /><span>{identidade.official}<br /><b>Floripa · 2026</b></span></header>
      <div className="pcc-crest-stage"><div className="pcc-crest"><Crest nome={campeao.nome} logo={campeao.logo} /></div></div>
      <section className="pcc-copy"><small>{categoria === 'mtnb' ? identidade.official : 'Campeão Brasileiro'}</small><strong>{categoria === 'mtnb' ? 'Floripa · 2026' : 'de Bike Polo'}</strong><b>{campeao.nome}</b></section>
      <ChampionRoster className="pcc-roster" atletas={elenco} />
      <img className="pcc-floripa" src="/imgs/logos/bikeplofloripabranco.png" alt="Bike Polo Floripa" />
    </main>
  )
}
