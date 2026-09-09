import { BracketMatch, BroadcastFrame, BroadcastTitle, Crest } from '../components/obs/TournamentGraphics'
import { classificadosRepescagem, porCodigo } from '../components/obs/tournamentOverlayData'
import { previewBroadcast } from '../components/obs/tournamentOverlayPreview'
import { useBroadcastIntro } from '../hooks/useBroadcastIntro'
import { useObsDocument } from '../hooks/useObsDocument'
import { useTournamentBroadcast } from '../hooks/useTournamentBroadcast'
import './TorneioTournamentOverlays.css'

const PH: Record<string, [string, string]> = {
  'REP-R1': ['8º colocado', '13º colocado'], 'REP-R2': ['9º colocado', '12º colocado'],
  'REP-R3': ['10º colocado', '11º colocado'], 'REP-R4': ['Vencedor R1', 'Vencedor R2'],
  'REP-R5': ['7º colocado', 'Vencedor R3'],
}

export default function TorneioOverlayRepescagem() {
  useObsDocument('OBS · Repescagem')
  const { dados } = useTournamentBroadcast()
  const payload = previewBroadcast(window.location.search) ?? dados
  const intro = useBroadcastIntro(Boolean(payload), 1700)
  if (!payload) return <main className="tg-overlay" />
  const classificados = classificadosRepescagem(payload.repescagem)
  return (
    <BroadcastFrame className="tc-repescagem" intro={intro}>
      <BroadcastTitle eyebrow="Última rota para a fase final" title="Repescagem" subtitle="10º CBBP · Floripa 2026" />
      <div className="tr-bracket">
        <div className="tr-column tr-column--opening">
          <span className="tr-column-title">Primeira rodada</span>
          {['REP-R1', 'REP-R2', 'REP-R3'].map(c => <BracketMatch key={c} codigo={c} jogo={porCodigo(payload.repescagem, c)} placeholders={PH[c]} />)}
        </div>
        <div className="tr-connectors" aria-hidden="true"><i /><i /><i /></div>
        <div className="tr-column tr-column--decisions">
          <span className="tr-column-title">Jogos decisivos</span>
          {['REP-R4', 'REP-R5'].map(c => <BracketMatch key={c} codigo={c} jogo={porCodigo(payload.repescagem, c)} placeholders={PH[c]} />)}
        </div>
        <aside className="tr-qualified">
          <header><small>Destino</small><strong>Classificados para a Double</strong></header>
          {[0, 1].map(i => {
            const team = classificados[i]
            return <div key={i} className={team ? 'is-defined' : ''}>{team ? <><Crest nome={team.nome} logo={team.logo} /><b>{team.nome}</b><span>Vaga confirmada</span></> : <><span className="tr-slot-mark">{i + 1}</span><b>Vaga em disputa</b></>}</div>
          })}
          <p>O seed segue a classificação oficial da Primeira Fase.</p>
        </aside>
      </div>
    </BroadcastFrame>
  )
}
