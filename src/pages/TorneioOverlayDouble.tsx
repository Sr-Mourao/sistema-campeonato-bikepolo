import type { CSSProperties } from 'react'
import { BracketMatch, BroadcastFrame, BroadcastTitle, Crest } from '../components/obs/TournamentGraphics'
import { partidaOperacionalEmFoco, porCodigo } from '../components/obs/tournamentOverlayData'
import { previewBroadcast } from '../components/obs/tournamentOverlayPreview'
import { useBroadcastIntro } from '../hooks/useBroadcastIntro'
import { useObsDocument } from '../hooks/useObsDocument'
import { useTournamentBroadcast } from '../hooks/useTournamentBroadcast'
import type { JogoPublico } from '../services/torneioPublico'
import './TorneioTournamentOverlays.css'

const PH: Record<string, [string, string]> = {
  QA: ['4º', '5º'], QB: ['3º', '6º'], QC: ['2º', 'Melhor repescado'], QD: ['1º', 'Segundo repescado'],
  SF1: ['Vencedor QD', 'Vencedor QA'], SF2: ['Vencedor QC', 'Vencedor QB'], FA: ['Vencedor SF1', 'Vencedor SF2'],
  B1: ['Perdedor QA', 'Perdedor QB'], B2: ['Perdedor QC', 'Perdedor QD'], B3: ['Vencedor B1', 'Perdedor SF2'],
  B4: ['Vencedor B2', 'Perdedor SF1'], B5: ['Vencedor B3', 'Vencedor B4'], B6: ['Vencedor B5', 'Perdedor FA'],
}

function Connector({ type, tone }: { type: 'forks' | 'fork' | 'parallel' | 'line'; tone: 'win' | 'loss' }) {
  const paths = type === 'forks'
    ? ['M0 12.5H48V25H100', 'M0 37.5H48V25', 'M0 62.5H48V75H100', 'M0 87.5H48V75']
    : type === 'fork'
      ? ['M0 25H48V50H100', 'M0 75H48V50']
      : type === 'parallel'
        ? ['M0 25H100', 'M0 75H100']
        : ['M0 50H100']
  return <svg className={`td-connector td-connector--${tone}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{paths.map(d => <path key={d} d={d} />)}</svg>
}

function Stage({ title, codes, jogos, className, order, focoCodigo, placeholders = PH }: { title: string; codes: string[]; jogos: JogoPublico[]; className: string; order: number; focoCodigo?: string; placeholders?: Record<string,[string,string]> }) {
  return (
    <section className={`td-stage ${className}`} style={{ '--stage-order': order } as CSSProperties}>
      <h3>{title}</h3>
      <div className="td-stage-cards">
        {codes.map((code, i) => <div className="td-match-slot" data-operational={code === focoCodigo ? 'foco' : undefined} key={code} style={{ '--match-order': i } as CSSProperties}><BracketMatch codigo={code} jogo={porCodigo(jogos, code)} placeholders={placeholders[code]} /></div>)}
      </div>
    </section>
  )
}

function Finalist({ label, jogo }: { label: string; jogo?: JogoPublico }) {
  const confirmado = jogo?.status === 'encerrado' && jogo.vencedor_time_id != null
  const ladoA = confirmado && jogo.vencedor_time_id === jogo.time_a_id
  const nome = confirmado ? ((ladoA ? jogo.time_a_nome : jogo.time_b_nome) ?? 'A definir') : 'A definir'
  const logo = confirmado ? (ladoA ? jogo.time_a_logo : jogo.time_b_logo) : null
  return (
    <aside className="td-finalist" data-defined={confirmado ? 'sim' : 'nao'}>
      <small>{label}</small>
      <Crest nome={nome} logo={logo} />
      <strong>{nome}</strong>
      <span>{confirmado ? 'Vaga confirmada' : 'Vaga em disputa'}</span>
    </aside>
  )
}

export default function TorneioOverlayDouble() {
  useObsDocument('OBS · Double Elimination')
  const { dados } = useTournamentBroadcast()
  const payload = previewBroadcast(window.location.search) ?? dados
  const intro = useBroadcastIntro(Boolean(payload), 1900)
  if (!payload) return <main className="tg-overlay" />
  const params = new URLSearchParams(window.location.search)
  const foco = params.has('winners') ? 'winners' : params.has('losers') ? 'losers' : 'all'
  // `payload.double` já chega na ordem operacional canônica do backend. Participantes
  // definidos não antecipam uma partida; STATUS em andamento continua soberano.
  const partidaEmFoco = partidaOperacionalEmFoco(payload.double)
  const focoCodigo = partidaEmFoco?.codigo

  return (
    <BroadcastFrame className={`tc-double tc-double--${foco}`} intro={intro}>
      <BroadcastTitle eyebrow="Fase final" title="Double Elimination" subtitle="2° PCP · Curitiba 2026" />

      {foco !== 'losers' && <section className="td-band td-band--winners">
        <header className="td-band-title"><span>Chave A</span><strong>Winners Bracket</strong></header>
        <div className="td-band-grid td-winners-grid">
          <Stage title="Quartas" codes={['QA', 'QD', 'QB', 'QC']} jogos={payload.double} className="td-stage--four" order={0} focoCodigo={focoCodigo} />
          <Connector type="forks" tone="win" />
          <Stage title="Semifinais" codes={['SF1', 'SF2']} jogos={payload.double} className="td-stage--two" order={1} focoCodigo={focoCodigo} />
          <Connector type="fork" tone="win" />
          <Stage title="Final Winners" codes={['FA']} jogos={payload.double} className="td-stage--one" order={2} focoCodigo={focoCodigo} />
          <Connector type="line" tone="win" />
          <Finalist label="Finalista Winners" jogo={porCodigo(payload.double, 'FA')} />
        </div>
      </section>}

      {foco !== 'winners' && <section className="td-band td-band--losers">
        <header className="td-band-title"><span>Chave B</span><strong>Losers Bracket</strong></header>
        <div className="td-band-grid td-losers-grid">
          <Stage title="Losers 1" codes={['B1', 'B2']} jogos={payload.double} className="td-stage--two" order={0} focoCodigo={focoCodigo} />
          <Connector type="parallel" tone="loss" />
          <Stage title="Losers 2" codes={['B3', 'B4']} jogos={payload.double} className="td-stage--two" order={1} focoCodigo={focoCodigo} />
          <Connector type="fork" tone="loss" />
          <Stage title="Losers 3" codes={['B5']} jogos={payload.double} className="td-stage--one" order={2} focoCodigo={focoCodigo} />
          <Connector type="line" tone="loss" />
          <Stage title="Final Losers" codes={['B6']} jogos={payload.double} className="td-stage--one" order={3} focoCodigo={focoCodigo} />
          <Connector type="line" tone="loss" />
          <Finalist label="Finalista Losers" jogo={porCodigo(payload.double, 'B6')} />
        </div>
      </section>}
    </BroadcastFrame>
  )
}
