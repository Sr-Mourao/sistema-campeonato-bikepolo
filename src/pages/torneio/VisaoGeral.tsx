import { useEffect, useMemo, useState } from 'react'
import {
  descreveEventoPublico, fmtHora, torneioPublico,
  type DestaquePublico, type EventoPublico, type FasePublica,
  type JogoPublico, type StandingRowPublico, type TorneioResumo,
} from '../../services/torneioPublico'
import Avatar from '../../components/equipes/Avatar'
import TeamLogo from '../../components/equipes/TeamLogo'
import { IconFalta, IconGol } from '../../components/broadcast/icons'
import { origemLabel } from '../../components/torneio/bracketHelpers'
import PartidaHistoricoModal from '../../components/torneio/PartidaHistoricoModal'
import type { AbaKey } from '../Torneio'
import './VisaoGeral.css'
import { useTournamentCategory } from '../../contexts/TournamentContext'

const POLL_MS = 12000
const ENCERRADO = new Set(['encerrado', 'wo', 'cancelado'])
const CODIGOS_WINNERS = new Set(['QA', 'QB', 'QC', 'QD', 'SF1', 'SF2', 'FA'])
const STATUS: Record<string, string> = {
  agendado: 'Agendado', atrasado: 'Atrasado', chamado: 'Chamado',
  em_andamento: 'Ao vivo', encerrado: 'Encerrado', wo: 'W.O.', cancelado: 'Cancelado',
}

interface Props {
  resumo: TorneioResumo
  onIrPara: (aba: AbaKey) => void
  onAbrirTime: (timeId: number) => void
}

function faseAtualDe(resumo: TorneioResumo): FasePublica | null {
  return resumo.fases.find(f => f.estado === 'confirmada' && !f.completa)
    ?? [...resumo.fases].reverse().find(f => f.estado === 'confirmada')
    ?? resumo.fases[0] ?? null
}

/** Snapshot público composto apenas com dados já resolvidos pelo backend. */
export default function VisaoGeral({ resumo, onIrPara, onAbrirTime }: Props) {
  const categoria = useTournamentCategory()
  const [resumoAtual, setResumoAtual] = useState(resumo)
  const [destaque, setDestaque] = useState<DestaquePublico | null>(null)
  const [jogos, setJogos] = useState<JogoPublico[]>([])
  const [standings, setStandings] = useState<StandingRowPublico[] | null>(null)
  const [historico, setHistorico] = useState<string | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => { setResumoAtual(resumo) }, [resumo])

  useEffect(() => {
    let cancelado = false
    let buscando = false
    async function atualizar() {
      if (buscando) return
      buscando = true
      try {
        const [r, d, js, cls] = await Promise.all([
          torneioPublico.resumo(categoria),
          torneioPublico.destaque(categoria, 20, 5),
          torneioPublico.jogos(categoria),
          torneioPublico.classificacao(categoria),
        ])
        const eventos = d.jogo ? await torneioPublico.eventosRecentes(d.jogo.codigo, 50, categoria) : { eventos: [] }
        if (!cancelado) {
          setResumoAtual(r)
          setDestaque({ ...d, eventos: eventos.eventos })
          setJogos(js.jogos.filter(j => j.is_bye === 0))
          setStandings(cls.classificacao)
          setErro('')
        }
      } catch (e) {
        if (!cancelado) setErro(e instanceof Error ? e.message : 'Não foi possível atualizar a visão geral.')
      } finally { buscando = false }
    }
    atualizar()
    const id = setInterval(atualizar, POLL_MS)
    return () => { cancelado = true; clearInterval(id) }
  }, [categoria])

  const fase = faseAtualDe(resumoAtual)
  const foco = destaque?.jogo ?? null
  const jogosFase = jogos.filter(j => j.fase_tipo === fase?.tipo)
  const recentes = (destaque?.ultimos_resultados ?? []).filter(j => j.codigo !== foco?.codigo).slice(0, 5).reverse()
  const proximos = useMemo(() => jogos.filter(j => j.codigo !== foco?.codigo && !ENCERRADO.has(j.status)).slice(0, 3), [jogos, foco?.codigo])

  return (
    <section className="ov-page">
      <Progress resumo={resumoAtual} fase={fase} foco={foco} />
      {erro && <div className="trp-erro">{erro}</div>}

      {foco
        ? <MatchHero jogo={foco} onAbrirTime={onAbrirTime} onHistorico={setHistorico} />
        : <div className="ov-card ov-empty">{destaque ? 'Nenhuma partida cadastrada.' : 'Carregando campeonato…'}</div>}

      {foco && <Events jogo={foco} eventos={destaque?.eventos ?? []} />}

      {(recentes.length > 0 || foco || proximos.length > 0) && (
        <GamesWindow recentes={recentes} foco={foco} proximos={proximos} onHistorico={setHistorico} />
      )}

      <PhaseSnapshot
        fase={fase} jogos={jogosFase} standings={standings} resumo={resumoAtual}
        foco={foco} onIrPara={onIrPara} onAbrirTime={onAbrirTime} onHistorico={setHistorico}
      />

      <Remaining fase={fase} jogos={jogosFase} resumo={resumoAtual} />

      {fase && !['swiss', 'round_robin', 'equalizacao'].includes(fase.tipo) && standings && (
        <details className="ov-context">
          <summary>Classificação final da Primeira Fase</summary>
          <Standings rows={standings} onAbrirTime={onAbrirTime} compact />
          <button className="trp-link-btn" onClick={() => onIrPara('primeira-fase')}>Ver classificação final →</button>
        </details>
      )}
      {historico && <PartidaHistoricoModal codigo={historico} onClose={() => setHistorico(null)} />}
    </section>
  )
}

function Progress({ resumo, fase, foco }: { resumo: TorneioResumo; fase: FasePublica | null; foco: JogoPublico | null }) {
  const etapas = ['Primeira Fase', 'Repescagem', 'Double', 'Final']
  let atual = fase?.tipo === 'repescagem' ? 1 : fase?.tipo === 'double' ? etapas.length - 2 : 0
  if (foco?.codigo === 'GF' || foco?.codigo === 'GF2' || resumo.torneio.estado === 'FINALIZADO') atual = etapas.length - 1
  const finalizado = resumo.torneio.estado === 'FINALIZADO'
  return (
    <div className="ov-progress">
      <span className="ov-kicker">Onde estamos</span>
      <div className="ov-progress-track">
        {etapas.map((nome, i) => {
          const estado = i < atual || (finalizado && i === atual) ? 'done' : i === atual ? 'current' : 'future'
          return <div key={nome} className={`ov-progress-step ov-progress-step--${estado}`}><i>{estado === 'done' ? '✓' : estado === 'current' ? '●' : '○'}</i><span>{nome}</span></div>
        })}
      </div>
    </div>
  )
}

function MatchHero({ jogo, onAbrirTime, onHistorico }: { jogo: JogoPublico; onAbrirTime: (id: number) => void; onHistorico: (codigo: string) => void }) {
  const live = jogo.status === 'em_andamento'
  const final = jogo.status === 'encerrado'
  const titulo = live ? 'Partida atual' : final ? 'Último resultado' : 'Próximo jogo'
  const hora = jogo.horario_inicio_real ?? jogo.horario_previsto ?? jogo.horario_fim_real
  return (
    <article className={`ov-hero ov-hero--${jogo.status}`}>
      <span className="ov-kicker">{titulo}</span>
      <div className="ov-hero-meta">{jogo.fase_rotulo} <span>·</span> {jogo.codigo}</div>
      <div className={`ov-live ov-live--${jogo.status}`}><i />{STATUS[jogo.status] ?? jogo.status}</div>
      <div className="ov-hero-main">
        <HeroTeam lado="a" nome={jogo.time_a_nome} logo={jogo.time_a_logo} id={jogo.time_a_id} onAbrirTime={onAbrirTime} />
        <div className="ov-hero-score">{jogo.placar_a != null ? jogo.placar_a : ''}<small>×</small>{jogo.placar_b != null ? jogo.placar_b : ''}</div>
        <HeroTeam lado="b" nome={jogo.time_b_nome} logo={jogo.time_b_logo} id={jogo.time_b_id} onAbrirTime={onAbrirTime} />
      </div>
      {hora && <div className="ov-hero-time">{live ? 'Início' : final ? 'Encerrado' : 'Previsto'} · {fmtHora(hora)}</div>}
      {final && <button className="ov-text-link" onClick={() => onHistorico(jogo.codigo)}>Ver acontecimentos →</button>}
    </article>
  )
}

function HeroTeam({ lado, nome, logo, id, onAbrirTime }: { lado: 'a' | 'b'; nome: string | null; logo: string | null; id: number | null; onAbrirTime: (id: number) => void }) {
  const content = <><TeamLogo nome={nome ?? 'A definir'} logo={logo ?? undefined} className="ov-hero-logo" /><span>{nome ?? 'A definir'}</span></>
  return id == null
    ? <div className={`ov-hero-team ov-hero-team--${lado}`}>{content}</div>
    : <button className={`ov-hero-team ov-hero-team--${lado}`} onClick={() => onAbrirTime(id)}>{content}</button>
}

function Events({ jogo, eventos }: { jogo: JogoPublico; eventos: EventoPublico[] }) {
  return (
    <OverviewSection kicker="Partida em foco" title="Acontecimentos da partida" aside={String(eventos.length)}>
      {eventos.length === 0 ? <p className="ov-muted">Nenhum acontecimento registrado.</p> : (
        <div className="ov-events">
          {[...eventos].reverse().map(e => (
            <div className="ov-event" key={e.event_id}>
              <span className="ov-event-time">{fmtHora(e.quando)}</span>
              {e.atleta ? <Avatar nome={e.atleta} foto={e.foto_path ?? undefined} className="ov-event-avatar" /> : <span className="ov-event-avatar ov-event-avatar--empty" />}
              <span className={`ov-event-icon ov-event-icon--${e.categoria}`}>{e.categoria === 'gol' ? <IconGol size={20} /> : <IconFalta size={18} />}</span>
              <span className="ov-event-copy"><b>{descreveEventoPublico(e)}</b><small>{e.time_id === jogo.time_a_id ? jogo.time_a_nome : jogo.time_b_nome}</small></span>
            </div>
          ))}
        </div>
      )}
    </OverviewSection>
  )
}

function GamesWindow({ recentes, foco, proximos, onHistorico }: { recentes: JogoPublico[]; foco: JogoPublico | null; proximos: JogoPublico[]; onHistorico: (codigo: string) => void }) {
  return (
    <OverviewSection kicker="Linha do tempo" title="Recentes e próximos">
      <div className="ov-games">
        {recentes.length > 0 && <GameGroup title="Encerrados recentemente" jogos={recentes} onHistorico={onHistorico} />}
        {foco && <GameGroup title={foco.status === 'em_andamento' ? 'Agora' : 'Em foco'} jogos={[foco]} focus onHistorico={onHistorico} />}
        {proximos.length > 0 && <GameGroup title="A seguir" jogos={proximos} onHistorico={onHistorico} />}
      </div>
    </OverviewSection>
  )
}

function GameGroup({ title, jogos, focus, onHistorico }: { title: string; jogos: JogoPublico[]; focus?: boolean; onHistorico: (codigo: string) => void }) {
  return <div className={`ov-game-group ${focus ? 'ov-game-group--focus' : ''}`}><h4>{title}</h4>{jogos.map(j => <GameRow key={j.codigo} jogo={j} onHistorico={onHistorico} />)}</div>
}

function GameRow({ jogo, onHistorico }: { jogo: JogoPublico; onHistorico: (codigo: string) => void }) {
  const hora = jogo.horario_inicio_real ?? jogo.horario_previsto ?? jogo.horario_fim_real
  const content = <><small>{hora ? `${fmtHora(hora)} · ` : ''}{jogo.fase_rotulo} · {jogo.codigo}</small><div><span>{jogo.time_a_nome ?? origemLabel(jogo.time_a_origem) ?? 'A definir'}</span><b>{jogo.placar_a != null ? `${jogo.placar_a} × ${jogo.placar_b}` : '×'}</b><span>{jogo.time_b_nome ?? origemLabel(jogo.time_b_origem) ?? 'A definir'}</span></div>{jogo.status !== 'encerrado' && <em className={`ov-game-status ov-game-status--${jogo.status}`}>{STATUS[jogo.status] ?? jogo.status}</em>}</>
  return jogo.status === 'encerrado' ? <button className="ov-game-row" onClick={() => onHistorico(jogo.codigo)}>{content}</button> : <div className="ov-game-row">{content}</div>
}

function PhaseSnapshot({ fase, jogos, standings, resumo, foco, onIrPara, onAbrirTime, onHistorico }: { fase: FasePublica | null; jogos: JogoPublico[]; standings: StandingRowPublico[] | null; resumo: TorneioResumo; foco: JogoPublico | null; onIrPara: (aba: AbaKey) => void; onAbrirTime: (id: number) => void; onHistorico: (codigo: string) => void }) {
  if (!fase) return null
  if (fase.tipo === 'swiss' || fase.tipo === 'round_robin' || fase.tipo === 'equalizacao') return (
    <OverviewSection kicker="Estado da fase" title={fase.tipo === 'equalizacao' ? 'Conclusão da Primeira Fase' : 'Classificação atual'}>
      <p className="ov-lead">{fase.tipo === 'round_robin' ? 'Cinco equipes disputam dez jogos; a classificação final define os seeds 1º a 5º.' : `Os ${resumo.torneio.classificados_diretos} primeiros avançam direto. Os demais seguem para a Repescagem.`}</p>
      {standings ? <Standings rows={standings} onAbrirTime={onAbrirTime} /> : <p className="ov-muted">Carregando classificação…</p>}
      <button className="trp-link-btn" onClick={() => onIrPara('primeira-fase')}>Ver classificação completa →</button>
    </OverviewSection>
  )
  if (fase.tipo === 'repescagem') {
    const classificados = ['REP-R4', 'REP-R5'].map(c => jogos.find(j => j.codigo === c)).map(j => j?.vencedor_time_id === j?.time_a_id ? j?.time_a_nome : j?.vencedor_time_id ? j.time_b_nome : null)
    return (
      <OverviewSection kicker="Estado da fase" title="Repescagem" aside={`${resumo.torneio.vagas_repescagem} vagas`}>
        <p className="ov-lead">Cinco confrontos definem os dois últimos classificados para a Double Elimination.</p>
        <PhaseMatches jogos={jogos} onHistorico={onHistorico} />
        <div className="ov-qualified"><h4>Classificados para a Double</h4>{Array.from({ length: resumo.torneio.vagas_repescagem }, (_, i) => <p key={i} className={classificados[i] ? 'is-known' : ''}>{classificados[i] ? `✓ ${classificados[i]}` : '○ Aguardando definição'}</p>)}</div>
        <button className="trp-link-btn" onClick={() => onIrPara('repescagem')}>Ver chave completa da Repescagem →</button>
      </OverviewSection>
    )
  }
  const final = foco?.codigo === 'GF' || foco?.codigo === 'GF2'
  const winners = jogos.filter(j => j.bracket === 'winners' || CODIGOS_WINNERS.has(j.codigo))
  const losers = jogos.filter(j => j.bracket === 'losers' || j.codigo.startsWith('B'))
  const finais = jogos.filter(j => j.codigo === 'GF' || j.codigo === 'GF2')
  const eliminados = [...new Set(losers.filter(j => j.status === 'encerrado' && j.vencedor_time_id).map(j => j.vencedor_time_id === j.time_a_id ? j.time_b_nome : j.time_a_nome).filter(Boolean))]
  return (
    <OverviewSection kicker="Estado da fase" title={final ? 'Grande Final' : 'Double Elimination'}>
      {final ? <><p className="ov-lead">A decisão do campeonato. Se o time da Losers vencer a GF, a GF2 decide o título.</p><PhaseMatches jogos={finais} onHistorico={onHistorico} /></> : <div className="ov-double"><div><h4>Winners · invictos</h4><PhaseMatches jogos={winners} onHistorico={onHistorico} /></div><div><h4>Losers · segunda chance</h4><PhaseMatches jogos={losers} onHistorico={onHistorico} /></div>{eliminados.length > 0 && <div className="ov-eliminated"><h4>Eliminados</h4><p>{eliminados.join(' · ')}</p></div>}</div>}
      <button className="trp-link-btn" onClick={() => onIrPara('double')}>Ver Double Elimination completa →</button>
    </OverviewSection>
  )
}

function PhaseMatches({ jogos, onHistorico }: { jogos: JogoPublico[]; onHistorico: (codigo: string) => void }) {
  return <div className="ov-phase-matches">{jogos.map(j => { const content = <><b>{j.codigo.replace('REP-', '')}</b><span>{j.time_a_nome ?? origemLabel(j.time_a_origem) ?? 'A definir'} <strong>{j.placar_a != null ? `${j.placar_a} × ${j.placar_b}` : '×'}</strong> {j.time_b_nome ?? origemLabel(j.time_b_origem) ?? 'A definir'}</span><i className={`is-${j.status}`}>{j.status === 'encerrado' ? '✓' : j.status === 'em_andamento' ? '●' : '○'}</i></>; return j.status === 'encerrado' ? <button key={j.codigo} onClick={() => onHistorico(j.codigo)}>{content}</button> : <div key={j.codigo}>{content}</div> })}</div>
}

function Standings({ rows, onAbrirTime, compact }: { rows: StandingRowPublico[]; onAbrirTime: (id: number) => void; compact?: boolean }) {
  return <div className={`ov-standings ${compact ? 'ov-standings--compact' : ''}`}>{rows.map(r => <button key={r.time_id} className={r.classificado_direto ? 'is-direct' : 'is-rep'} onClick={() => onAbrirTime(r.time_id)}><b>{r.posicao}º</b><span>{r.nome}</span><small>{false ? `Seed ${r.posicao}` : r.classificado_direto ? 'Direto' : 'Repescagem'}</small><strong>{r.pontos} pts</strong></button>)}</div>
}

function Remaining({ fase, jogos, resumo }: { fase: FasePublica | null; jogos: JogoPublico[]; resumo: TorneioResumo }) {
  if (!fase || resumo.torneio.estado === 'FINALIZADO') return null
  const pendentes = jogos.filter(j => !ENCERRADO.has(j.status))
  const items = pendentes.slice(0, 4).map(j => `${j.status === 'em_andamento' ? 'concluir' : 'disputar'} ${j.codigo}`)
  if (pendentes.length > 4) items.push(`disputar mais ${pendentes.length - 4} partida${pendentes.length - 4 === 1 ? '' : 's'} da fase`)
  if (fase.tipo === 'repescagem') { const n = ['REP-R4', 'REP-R5'].filter(c => jogos.find(j => j.codigo === c)?.vencedor_time_id).length; if (n < resumo.torneio.vagas_repescagem) items.push(`definir ${resumo.torneio.vagas_repescagem - n} classificado${resumo.torneio.vagas_repescagem - n === 1 ? '' : 's'} pela Repescagem`); items.push('iniciar a Double Elimination') }
  if (fase.tipo === 'round_robin') items.push('fechar a classificação e iniciar a Double Elimination')
  if (fase.tipo === 'swiss' || fase.tipo === 'equalizacao') items.push('fechar a classificação e iniciar a Repescagem')
  if (fase.tipo === 'double') items.push('definir os finalistas e disputar a Grande Final')
  return <div className="ov-remaining"><span className="ov-kicker">Ainda falta</span><ul>{[...new Set(items)].map(i => <li key={i}>{i}</li>)}</ul></div>
}

function OverviewSection({ kicker, title, aside, children }: { kicker: string; title: string; aside?: string; children: React.ReactNode }) {
  return <section className="ov-card"><header className="ov-section-head"><div><span className="ov-kicker">{kicker}</span><h3>{title}</h3></div>{aside && <span>{aside}</span>}</header>{children}</section>
}
