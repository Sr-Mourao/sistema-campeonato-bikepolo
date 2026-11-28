import type { CSSProperties } from 'react'
import { BracketMatch, BroadcastFrame, BroadcastTitle, Crest } from '../components/obs/TournamentGraphics'
import { classificadosRepescagem, cruzamentosDaDouble, jogoTemPlacar, porCodigo, statusPartida, type CruzamentoDouble } from '../components/obs/tournamentOverlayData'
import { previewBroadcast } from '../components/obs/tournamentOverlayPreview'
import { useBroadcastIntro } from '../hooks/useBroadcastIntro'
import { useObsDocument } from '../hooks/useObsDocument'
import { useTournamentBroadcast } from '../hooks/useTournamentBroadcast'
import { formatoDe } from '../services/formatoTorneio'
import type { BroadcastTorneioPublico } from '../services/torneioPublico'
import './TorneioTournamentOverlays.css'

const PH: Record<string, [string, string]> = {
  'REP-R1': ['8º colocado', '13º colocado'], 'REP-R2': ['9º colocado', '12º colocado'],
  'REP-R3': ['10º colocado', '11º colocado'], 'REP-R4': ['Vencedor R1', 'Vencedor R2'],
  'REP-R5': ['7º colocado', 'Vencedor R3'],
}

/**
 * Mesma URL do OBS (/torneio/overlay/repescagem) para os dois formatos:
 * - com Repescagem (suíço de 13): a chave REP-R1..R5 e os 2 classificados;
 * - sem Repescagem (2° Pior, 8 times): os cruzamentos da Double (1×8, 2×7, 3×6, 4×5),
 *   ponte entre a 1ª fase e a Double — projeção pela classificação até a Double existir.
 */
export default function TorneioOverlayRepescagem() {
  const { dados } = useTournamentBroadcast()
  const payload = previewBroadcast(window.location.search) ?? dados
  const semRepescagem = payload ? !formatoDe(payload.torneio).repescagem : false
  useObsDocument(semRepescagem ? 'OBS · Cruzamentos da Double' : 'OBS · Repescagem')
  const intro = useBroadcastIntro(Boolean(payload), 1700)
  if (!payload) return <main className="tg-overlay" />
  if (semRepescagem) return <CruzamentosDouble payload={payload} intro={intro} />

  const classificados = classificadosRepescagem(payload.repescagem)
  return (
    <BroadcastFrame className="tc-repescagem" intro={intro}>
      <BroadcastTitle eyebrow="Última rota para a fase final" title="Repescagem" subtitle="2° PCP · Curitiba 2026" />
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

function CruzamentosDouble({ payload, intro }: { payload: BroadcastTorneioPublico; intro: boolean }) {
  const formato = formatoDe(payload.torneio)
  const cruzamentos = cruzamentosDaDouble(payload.classificacao, payload.double)
  const porCodigoCruz = new Map(cruzamentos.map(c => [c.codigo, c]))
  const primeiraFase = payload.rodadas.filter(j => j.fase_tipo === 'round_robin' && !j.is_bye)
  const disputados = primeiraFase.filter(j => ['encerrado', 'wo', 'cancelado'].includes(j.status)).length
  const total = formato.jogos_primeira_fase ?? primeiraFase.length
  const estado = payload.torneio.estado
  const fase = payload.double.length > 0 ? 'double' : estado === 'CLASSIFICACAO_FECHADA' ? 'fechada' : 'projecao'
  const situacao = fase === 'double'
    ? { titulo: 'Double em andamento', texto: 'Confrontos oficiais das quartas da Winners.' }
    : fase === 'fechada'
      ? { titulo: 'Seeds confirmados', texto: 'Classificação da 1ª fase fechada. Estes são os confrontos oficiais.' }
      : { titulo: 'Projeção', texto: `Pela classificação atual · ${disputados} de ${total} jogos da 1ª fase disputados.` }

  return (
    <BroadcastFrame className="tc-cruzamentos" intro={intro}>
      <BroadcastTitle eyebrow="Da primeira fase para a Double" title="Cruzamentos" subtitle="2° PCP · Curitiba 2026" />
      <div className="tx-bracket" data-fase={fase}>
        {([['Rumo à SF1', ['QD', 'QA']], ['Rumo à SF2', ['QC', 'QB']]] as const).map(([titulo, codigos], col) => (
          <div className="tr-column tx-column" key={titulo}>
            <span className="tr-column-title">{titulo}</span>
            {codigos.map((c, i) => <CardCruzamento key={c} cruzamento={porCodigoCruz.get(c)!} fase={fase} order={col * 2 + i} />)}
          </div>
        ))}
        <aside className="tr-qualified tx-info">
          <header><small>{situacao.titulo}</small><strong>Os 8 entram na Double</strong></header>
          <p className="tx-info-lead">{situacao.texto}</p>
          <ul>
            <li><b>1º × 8º</b>melhor campanha enfrenta a pior</li>
            <li><b>Sem repescagem</b>todos os {formato.participantes} times seguem vivos</li>
            <li><b>2 vidas</b>1ª derrota leva à Losers; a 2ª elimina</li>
          </ul>
        </aside>
      </div>
    </BroadcastFrame>
  )
}

function CardCruzamento({ cruzamento, fase, order }: { cruzamento: CruzamentoDouble; fase: 'projecao' | 'fechada' | 'double'; order: number }) {
  const { jogo } = cruzamento
  const temPlacar = jogo ? jogoTemPlacar(jogo) : false
  const finalizado = jogo?.status === 'encerrado'
  const status = jogo ? statusPartida(jogo.status) : fase === 'fechada' ? 'Confirmado' : 'Projeção'
  const lado = (l: 'a' | 'b') => {
    const t = cruzamento[l]
    const venceu = finalizado && jogo?.vencedor_time_id != null && jogo.vencedor_time_id === t.time_id
    const nome = t.nome ?? `${t.seed}º colocado`
    return (
      <div className={venceu ? 'is-winner' : finalizado ? 'is-loser' : ''}>
        <Crest nome={nome} logo={t.logo} /><strong><small className="tx-seed">{t.seed}º</small>{nome}</strong>
        <em>{temPlacar ? (l === 'a' ? jogo?.placar_a : jogo?.placar_b) : '—'}</em>
      </div>
    )
  }
  return (
    <article className="tg-bracket-match tx-match" data-status={jogo?.status ?? 'indefinido'} data-defined={cruzamento.a.time_id != null && cruzamento.b.time_id != null ? 'sim' : 'nao'} style={{ '--match-order': order } as CSSProperties}>
      <header><b>{cruzamento.codigo}</b><span>{status}</span></header>
      {lado('a')}
      {lado('b')}
    </article>
  )
}
