import type { JogoPublico } from '../../services/torneioPublico'
import TeamLogo from '../equipes/TeamLogo'
import './recentResults.css'

/** 2-3 últimos resultados com mini-brasões — só apresentação, dado já vem pronto
 * (`destaque.ultimos_resultados`, resolvido pelo backend). Reutilizável por um futuro
 * overlay de rodapé no OBS. */
export default function RecentResults({ resultados }: { resultados: JogoPublico[] }) {
  return (
    <div className="bcy-recentes">
      <div className="bcy-footer-title">Últimos resultados</div>
      {resultados.length === 0 && <p className="bcy-footer-vazio">Nenhum resultado ainda.</p>}
      <div className="bcy-recentes-lista">
        {resultados.map(r => (
          <div key={r.codigo} className="bcy-recente-item">
            <TeamLogo nome={r.time_a_nome ?? ''} logo={r.time_a_logo ?? undefined} className="bcy-recente-logo" />
            <span className="bcy-recente-nome">{r.time_a_nome}</span>
            <span className="bcy-recente-placar">{r.placar_a} – {r.placar_b}</span>
            <span className="bcy-recente-nome">{r.time_b_nome}</span>
            <TeamLogo nome={r.time_b_nome ?? ''} logo={r.time_b_logo ?? undefined} className="bcy-recente-logo" />
          </div>
        ))}
      </div>
    </div>
  )
}
