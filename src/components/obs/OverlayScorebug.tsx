import type { JogoPublico } from '../../services/torneioPublico'
import TeamLogo from '../equipes/TeamLogo'
import LiveScore from '../broadcast/LiveScore'
import LiveStatus from '../broadcast/LiveStatus'

function Team({ lado, nome, logo }: { lado: 'a' | 'b'; nome: string; logo: string | null }) {
  return (
    <div className={`obs-scorebug-team obs-scorebug-team--${lado}`}>
      <span className="obs-scorebug-logo-frame"><TeamLogo nome={nome} logo={logo ?? undefined} className="obs-scorebug-logo" /></span>
      <span className="obs-scorebug-team-name">{nome}</span>
    </div>
  )
}

export default function OverlayScorebug({ jogo }: { jogo: JogoPublico | null }) {
  if (!jogo) return null

  const preJogo = jogo.status === 'agendado' || jogo.status === 'atrasado' || jogo.status === 'chamado'
  return (
    <div key={jogo.codigo} className="obs-scorebug" data-match-code={jogo.codigo}>
      <div className="obs-scorebug-main">
        <Team lado="a" nome={jogo.time_a_nome ?? 'A definir'} logo={jogo.time_a_logo} />
        <div className="obs-scorebug-score">
          {preJogo ? <span className="obs-scorebug-vs">VS</span> : <LiveScore placarA={jogo.placar_a ?? 0} placarB={jogo.placar_b ?? 0} />}
        </div>
        <Team lado="b" nome={jogo.time_b_nome ?? 'A definir'} logo={jogo.time_b_logo} />
      </div>
      <div className="obs-scorebug-meta">
        <span className="obs-scorebug-brand">10º CBBP <i>·</i> FLORIPA 2026</span>
        <span className="obs-scorebug-context">{jogo.fase_rotulo} <i>·</i> {jogo.codigo}</span>
        <LiveStatus status={jogo.status} />
      </div>
    </div>
  )
}
