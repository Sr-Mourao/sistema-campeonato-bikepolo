import type { CSSProperties } from 'react'
import { BroadcastFrame, BroadcastTitle, Crest, MiniMatch } from '../components/obs/TournamentGraphics'
import { classificacaoOficial, colunaDoDesempate, escolherEtapaClassificacao, type ColunaDesempateOverlay } from '../components/obs/tournamentOverlayData'
import { previewBroadcast } from '../components/obs/tournamentOverlayPreview'
import { CRITERIO_CURTO, CRITERIO_EXPLICACAO } from '../components/torneio/criteriosMeta'
import { useBroadcastIntro } from '../hooks/useBroadcastIntro'
import { useObsDocument } from '../hooks/useObsDocument'
import { useTournamentBroadcast } from '../hooks/useTournamentBroadcast'
import type { StandingRowPublico } from '../services/torneioPublico'
import './TorneioTournamentOverlays.css'
import { TOURNAMENT_PRESENTATION, useTournamentCategory } from '../contexts/TournamentContext'
import { formatoDe } from '../services/formatoTorneio'

const ROTULO_CRITERIO: Record<string, string> = { ...CRITERIO_CURTO, buchholz: 'BUCH' }

function Stat({ coluna, time, children, criterio = false }: {
  coluna?: ColunaDesempateOverlay
  time: StandingRowPublico
  children: React.ReactNode
  criterio?: boolean
}) {
  const decisivo = coluna != null && colunaDoDesempate(time.decisao) === coluna
  return (
    <i
      className={`tc-stat${criterio ? ' tc-stat--criterion' : ''}${decisivo ? ' is-tiebreak' : ''}`}
      title={decisivo && time.decisao ? `Desempate: ${CRITERIO_EXPLICACAO[time.decisao] ?? time.decisao}` : undefined}
    >{children}</i>
  )
}

export default function TorneioOverlayClassificacao() {
  const categoria = useTournamentCategory()
  useObsDocument('OBS · Classificação')
  const { dados } = useTournamentBroadcast()
  const payload = previewBroadcast(window.location.search) ?? dados
  const etapa = payload ? escolherEtapaClassificacao(payload.rodadas) : null
  const intro = useBroadcastIntro(Boolean(payload), 1750)
  if (!payload) return <main className="tg-overlay" />

  const classificacao = classificacaoOficial(payload.classificacao)
  const formato = formatoDe(payload.torneio)
  // Buchholz só no suíço; no todos contra todos a coluna mostra Gols Pró (critério real).
  const mostrarBuch = formato.primeira_fase === 'swiss'
  return (
    <BroadcastFrame className={`tc-classificacao ${formato.repescagem ? '' : 'tc-classificacao--seeds'}`} intro={intro}>
      <section className="tc-standing-panel">
        <BroadcastTitle eyebrow="Primeira fase" title="Classificação" subtitle={`${TOURNAMENT_PRESENTATION[categoria].short} · Curitiba 2026`} />
        <div className="tc-standing-head"><span>Pos</span><b>Equipe</b><strong>Pts</strong><i>J</i><i>V</i><i>E</i><i>SG</i><i>{mostrarBuch ? 'BUCH' : 'GP'}</i><i>FP</i></div>
        <ol className="tc-standing-list">
          {classificacao.map((time, i) => (
            <li key={time.time_id} className={!formato.repescagem || time.classificado_direto ? 'is-direct' : 'is-rep'} style={{ '--order': i } as CSSProperties}>
              {i === 0 && <small className="tc-zone tc-zone--direct">{formato.repescagem ? 'Classificação direta' : 'Seeds da Double'}</small>}
              {formato.repescagem && i === payload.torneio.classificados_diretos && <small className="tc-zone tc-zone--rep">Repescagem</small>}
              <span className="tc-pos">{time.posicao}<sup>º</sup></span>
              <span className="tc-team">
                <Crest nome={time.nome} logo={time.logo} /><b>{time.nome}</b>
                {time.decisao && !colunaDoDesempate(time.decisao) && (
                  <small className="tc-tiebreak-note" title={`Desempate: ${CRITERIO_EXPLICACAO[time.decisao] ?? time.decisao}`}>
                    {ROTULO_CRITERIO[time.decisao] ?? time.decisao}
                  </small>
                )}
              </span>
              <strong>{time.pontos}</strong>
              <Stat time={time}>{time.j}</Stat>
              <Stat time={time} coluna="v">{time.v}</Stat>
              <Stat time={time} coluna="e">{time.e}</Stat>
              <Stat time={time} coluna="sg" criterio>{time.sg > 0 ? `+${time.sg}` : time.sg}</Stat>
              {mostrarBuch
                ? <Stat time={time} coluna="buch" criterio>{time.buchholz}</Stat>
                : <Stat time={time} coluna="gp" criterio>{time.gp}</Stat>}
              <Stat time={time} coluna="fp" criterio>{time.faltas}</Stat>
            </li>
          ))}
        </ol>
      </section>
      <section className="tc-round-panel" data-stage={etapa?.tipo}>
        <header><span>{etapa?.tipo === 'equalizacao' ? 'Fechamento da primeira fase' : 'Situação da rodada'}</span><strong>{etapa?.rotulo ?? 'Primeira fase'}</strong><i>{etapa?.jogos.some(j => j.status === 'em_andamento') ? 'Ao vivo' : 'Resultados e partidas'}</i></header>
        <div className="tc-round-grid">
          {etapa ? etapa.jogos.map((jogo, i) => <MiniMatch key={jogo.codigo} jogo={jogo} order={i} />) : <p className="tc-empty">Aguardando a primeira rodada</p>}
        </div>
      </section>
    </BroadcastFrame>
  )
}
