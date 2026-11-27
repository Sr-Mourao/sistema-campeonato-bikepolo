import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ExternalLink, Medal, ShieldCheck, Target } from 'lucide-react'
import SiteNavbar from '../components/SiteNavbar'
import TeamLogo from '../components/equipes/TeamLogo'
import Avatar from '../components/equipes/Avatar'
import { fmtHora, torneioPublico, type AwardResultadoPublico, type AwardVencedorPublico, type ColocacaoFinalPublica, type PessoaResultadoPublico, type ResultadosPublicos } from '../services/torneioPublico'
import './Resultados.css'

type Categoria = 'misto'

function categoriaInicial(): Categoria {
  return 'misto'
}

function useReveal() {
  const ref = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const node = ref.current
    if (!node || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { node.classList.add('is-visible'); observer.disconnect() }
    }, { threshold: 0.12 })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return ref
}

function Section({ kicker, title, children, className = '' }: { kicker: string; title: string; children: React.ReactNode; className?: string }) {
  const ref = useReveal()
  return <section ref={ref} className={`res-section res-reveal ${className}`}><header className="res-section-head"><span>{kicker}</span><h2>{title}</h2></header>{children}</section>
}

function ordinal(posicao: number) { return `${posicao}º` }
function saldo(valor: number) { return valor > 0 ? `+${valor}` : String(valor) }

function TeamIdentity({ team, compact = false }: { team: Pick<ColocacaoFinalPublica, 'nome' | 'logo'>; compact?: boolean }) {
  return <div className={`res-team ${compact ? 'res-team--compact' : ''}`}><TeamLogo nome={team.nome} logo={team.logo ?? undefined} className="res-team-logo" /><strong>{team.nome}</strong></div>
}

function AthleteRoster({ athletes, teamName, variant = 'podium' }: { athletes: PessoaResultadoPublico[]; teamName: string; variant?: 'podium' | 'detail' | 'fair' }) {
  if (athletes.length === 0) return null
  return <div className={`res-people res-people--${variant} res-people--count-${Math.min(athletes.length, 6)}`} aria-label={`Pessoas atletas de ${teamName}`}>
    {athletes.map((athlete, index) => <figure key={athlete.membro_id} style={{ '--portrait-index': index } as React.CSSProperties}>
      <div className="res-person-photo"><Avatar nome={athlete.nome} foto={athlete.foto_path ?? undefined} /></div>
      <figcaption>{athlete.nome}</figcaption>
    </figure>)}
  </div>
}

function PodiumTeam({ team }: { team: ColocacaoFinalPublica }) {
  const label = team.posicao === 1 ? 'Campeão' : team.posicao === 2 ? 'Vice-campeão' : '3º colocado'
  return <article className={`res-podium-team res-podium-team--${team.posicao}`}>
    <header className="res-podium-team-head">
      <div className="res-podium-place"><b>{String(team.posicao).padStart(2, '0')}</b><span>{label}</span></div>
      <TeamIdentity team={team} />
    </header>
    <AthleteRoster athletes={team.elenco} teamName={team.nome} />
    <p>{ordinal(team.posicao_primeira_fase)} na Primeira Fase · {team.campanha.total.v} vitórias · saldo {saldo(team.campanha.total.sg)}</p>
  </article>
}

function Podio({ data }: { data: ResultadosPublicos }) {
  const primeiro = data.classificacao_final.find(item => item.posicao === 1)
  const vice = data.classificacao_final.find(item => item.posicao === 2)
  const terceiro = data.classificacao_final.find(item => item.posicao === 3)
  if (!primeiro) return <div className="res-progress"><span>Resultados em andamento</span><strong>O título ainda não foi definido.</strong><p>A classificação histórica será completada automaticamente conforme a progressão oficial.</p></div>
  return <div className="res-podio" aria-label="Pódio do campeonato">
    {[primeiro, vice, terceiro].filter((team): team is ColocacaoFinalPublica => Boolean(team)).map(team => <PodiumTeam key={team.time_id} team={team} />)}
  </div>
}

function TeamDetail({ team }: { team: ColocacaoFinalPublica }) {
  const c = team.campanha
  return <div className="res-team-detail">
    <div className="res-detail-people-head"><TeamIdentity team={team} /><span>Quem construiu esta campanha</span></div>
    <AthleteRoster athletes={team.elenco} teamName={team.nome} variant="detail" />
    {team.ordenado_por_classificacao_primeira_fase && <p className="res-audit"><b>Por que esta posição?</b> {team.explicacao}</p>}
    <div className="res-journey" aria-label="Caminho no campeonato">{c.fases_disputadas.map(fase => <span key={fase}>{fase}</span>)}<strong>{ordinal(team.posicao)}</strong></div>
    <div className="res-numbers" aria-label="Números da campanha total">
      {[[c.total.j, 'jogos'], [c.total.v, 'vitórias'], [c.total.e, 'empates'], [c.total.d, 'derrotas'], [c.total.gp, 'gols pró'], [c.total.gc, 'gols contra'], [saldo(c.total.sg), 'saldo'], [c.total.faltas, 'faltas']].map(([valor, rotulo]) => <div key={rotulo}><strong>{valor}</strong><span>{rotulo}</span></div>)}
    </div>
    <div className="res-breakdown">
      {(['primeira_fase', 'repescagem', 'double'] as const).filter(chave => c[chave].j > 0).map(chave => <div key={chave}><span>{chave === 'primeira_fase' ? 'Primeira Fase' : chave === 'repescagem' ? 'Repescagem' : 'Double + finais'}</span><b>{c[chave].j}J · {c[chave].v}V · {c[chave].e}E · {c[chave].d}D · {c[chave].gp}:{c[chave].gc}</b></div>)}
    </div>
    <div className="res-games"><h4>Jogos da equipe</h4>{c.jogos.map(jogo => <article key={jogo.codigo}><span className={`res-result res-result--${jogo.resultado.toLowerCase()}`}>{jogo.resultado}</span><div><small>{jogo.fase} · {jogo.codigo}{jogo.data_hora ? ` · ${fmtHora(jogo.data_hora)}` : ''}</small><TeamLogo nome={jogo.adversario} logo={jogo.adversario_logo ?? undefined} className="res-game-logo" /><strong>{jogo.adversario}</strong></div><b>{jogo.placar}</b></article>)}</div>
  </div>
}

function FinalTable({ data }: { data: ResultadosPublicos }) {
  const [aberto, setAberto] = useState<number | null>(null)
  return <div className="res-final-list" data-testid="classificacao-final">{data.classificacao_final.map((team, index) => {
    const expanded = aberto === team.time_id
    const zona = data.metadata.zona_classificatoria
    const classificado = Boolean(zona && team.posicao <= zona.ate_posicao)
    return <article key={team.time_id} className={`res-final-row ${team.posicao <= 3 ? 'is-top' : ''} ${classificado ? 'is-g5' : ''}`} style={{ '--delay': `${Math.min(index, 12) * 45}ms` } as React.CSSProperties}>
      <button type="button" aria-expanded={expanded} onClick={() => setAberto(expanded ? null : team.time_id)}>
        <b className="res-final-pos">{ordinal(team.posicao)}</b><TeamIdentity team={team} compact /><span className="res-seed">Primeira Fase: {ordinal(team.posicao_primeira_fase)}</span><span className="res-stage">{team.etapa_final}{classificado && <small className="res-g5-tag">G5</small>}</span><span className="res-record">{team.campanha.total.j}J · {team.campanha.total.v}V · {team.campanha.total.e}E · {team.campanha.total.d}D</span><ChevronDown aria-hidden="true" className={expanded ? 'is-open' : ''} />
      </button>
      <div className={`res-expand ${expanded ? 'is-open' : ''}`}><div>{expanded && <TeamDetail team={team} />}</div></div>
    </article>
  })}</div>
}

function PrimeiraFase({ data }: { data: ResultadosPublicos }) {
  const [aberto, setAberto] = useState<number | null>(null)
  const rows = data.primeira_fase.classificacao
  return <>
    <p className="res-section-intro">Este é o ranking oficial encerrado da Primeira Fase. Ele preserva seus próprios critérios e não é a colocação final do campeonato.</p>
    <div className="res-standings-desktop"><table><thead><tr><th>Pos</th><th>Time</th><th>PTS</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GP</th><th>GC</th><th>SG</th><th>BUCH</th><th>FP</th></tr></thead><tbody>{rows.map(row => <tr key={row.time_id}><td>{ordinal(row.posicao)}</td><td><TeamLogo nome={row.nome} logo={row.logo ?? undefined} className="res-standing-logo" /><b>{row.nome}</b></td><td><strong>{row.pontos}</strong></td><td>{row.j}</td><td>{row.v}</td><td>{row.e}</td><td>{row.d}</td><td>{row.gp}</td><td>{row.gc}</td><td>{saldo(row.sg)}</td><td>{row.buchholz}</td><td>{row.faltas}</td></tr>)}</tbody></table></div>
    <div className="res-standings-mobile">{rows.map(row => <article key={row.time_id}><button type="button" aria-expanded={aberto === row.time_id} onClick={() => setAberto(aberto === row.time_id ? null : row.time_id)}><b>{ordinal(row.posicao)}</b><TeamLogo nome={row.nome} logo={row.logo ?? undefined} className="res-standing-logo" /><strong>{row.nome}</strong><span>{row.pontos} pts</span><ChevronDown /></button>{aberto === row.time_id && <div><p>{row.j}J · {row.v}V · {row.e}E · {row.d}D · {row.gp}:{row.gc} · SG {saldo(row.sg)}</p><p>Buchholz {row.buchholz} · Fair Play {row.faltas} faltas</p>{row.decisao && <p>Desempate efetivo: <b>{data.primeira_fase.criterios.find(c => c.chave === row.decisao)?.label ?? row.decisao}</b></p>}<div className="res-first-games">{row.jogos.map(j => <span key={j.codigo}>{j.codigo} · {j.adversario} · <b>{j.placar}</b></span>)}</div></div>}</article>)}</div>
    <details className="res-criteria"><summary>Critérios oficiais da Primeira Fase</summary><ol>{data.primeira_fase.criterios.map(item => <li key={item.chave}>{item.label}</li>)}</ol><p>FP representa a quantidade de faltas: menos é melhor quando esse critério é aplicado.</p></details>
  </>
}

function percentual(valor = 0) {
  return `${valor.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

function WinnerIdentity({ winner, showPercentage }: { winner: AwardVencedorPublico; showPercentage: boolean }) {
  return <div className="res-award-winner">
    <div className="res-award-photo"><Avatar nome={winner.nome} foto={winner.foto ?? undefined} /></div>
    <strong>{winner.nome}</strong>
    {winner.time && <span className="res-winner-team"><TeamLogo nome={winner.time} logo={winner.time_logo ?? undefined} />{winner.time}</span>}
    {showPercentage && <b className="res-winner-percent">{percentual(winner.percentual)} <small>dos votos válidos</small></b>}
  </div>
}

function AwardCard({ award, index }: { award: AwardResultadoPublico; index: number }) {
  const temVotacao = award.origem === 'votacao_interna' && Boolean(award.votacao?.total_votos_validos)
  return <article style={{ '--award-index': index } as React.CSSProperties}>
    <header><span>{String(index + 1).padStart(2, '0')}</span><div><h3>{award.nome}</h3><p>{award.descricao}</p></div></header>
    {award.empate && <b className="res-tie">Premiação dividida</b>}
    <div className="res-winners">{award.vencedores.map(winner => <WinnerIdentity key={winner.pessoa_id} winner={winner} showPercentage={temVotacao} />)}</div>
    {temVotacao && award.votacao && <details className="res-vote-details">
      <summary>Ver como foi a votação <ChevronDown aria-hidden="true" /></summary>
      <div className="res-vote-panel">
        <div className="res-vote-panel-head"><span>Distribuição completa</span><strong>{award.votacao.total_votos_validos} votos válidos</strong></div>
        <ol>{award.votacao.distribuicao.map((candidate, candidateIndex) => <li key={candidate.pessoa_id} style={{ '--vote-index': candidateIndex, '--vote-share': `${candidate.percentual ?? 0}%` } as React.CSSProperties}>
          <b className="res-vote-rank">{ordinal(candidate.posicao ?? candidateIndex + 1)}</b>
          <div className="res-vote-photo"><Avatar nome={candidate.nome} foto={candidate.foto ?? undefined} /></div>
          <div className="res-vote-person"><strong>{candidate.nome}</strong>{candidate.time && <span><TeamLogo nome={candidate.time} logo={candidate.time_logo ?? undefined} />{candidate.time}</span>}<i><u /> </i></div>
          <div className="res-vote-score"><b>{percentual(candidate.percentual)}</b><span>{candidate.votos} {candidate.votos === 1 ? 'voto' : 'votos'}</span></div>
        </li>)}</ol>
      </div>
    </details>}
  </article>
}

function Awards({ data }: { data: ResultadosPublicos }) {
  const maiorGols = data.artilharia[0]?.gols ?? 0
  const artilheiros = maiorGols > 0 ? data.artilharia.filter(item => item.gols === maiorGols) : []
  const menosFaltas = data.fair_play_times[0]?.faltas
  const fairPlay = menosFaltas === undefined ? [] : data.fair_play_times.filter(item => item.faltas === menosFaltas)
  return <Section kicker={`Destaques · ${data.competicao.titulo_publico}`} title="Premiações" className="res-awards">
    <div className="res-sport-awards">
      <article><Target /><span>Artilharia</span><div className="res-winners">{artilheiros.map(winner => { const team = data.campanhas.find(item => item.time_id === winner.time_id); return <div key={winner.membro_id}><div className="res-award-photo"><Avatar nome={winner.atleta} foto={winner.foto ?? undefined} /></div><strong>{winner.atleta}</strong><span className="res-winner-team"><TeamLogo nome={winner.time_nome} logo={team?.logo ?? undefined} />{winner.time_nome}</span><b className="res-goals">{winner.gols} gols</b></div> })}</div></article>
      <article className="res-fair-play"><ShieldCheck /><span>Time Fair Play</span><div className="res-winners">{fairPlay.map(winner => { const team = data.campanhas.find(item => item.time_id === winner.time_id); return <div key={winner.time_id} className="res-fair-team"><div className="res-fair-identity"><div className="res-award-photo"><TeamLogo nome={winner.nome} logo={team?.logo ?? undefined} /></div><div><strong>{winner.nome}</strong><span>{winner.faltas} faltas em {winner.jogos} jogos</span></div></div>{team && <AthleteRoster athletes={team.elenco} teamName={winner.nome} variant="fair" />}</div> })}</div></article>
    </div>
    {data.awards.categorias.length > 0 && <><div className="res-awards-heading"><Medal /><h3>Awards {data.competicao.categoria.toUpperCase()}</h3></div><div className="res-awards-grid">{data.awards.categorias.map((award, index) => <AwardCard key={award.codigo} award={award} index={index} />)}</div></>}
    {data.competicao.categoria === 'misto' && data.awards.status !== 'encerrada' && <p className="res-awards-status">Os Awards individuais serão publicados aqui quando a votação oficial for encerrada.</p>}
  </Section>
}

export default function Resultados() {
  const [categoria] = useState<Categoria>(categoriaInicial)
  const [data, setData] = useState<ResultadosPublicos | null>(null)
  const [erro, setErro] = useState('')
  useEffect(() => {
    let ativo = true
    torneioPublico.resultados(categoria).then(payload => { if (ativo) setData(payload) }).catch(error => { if (ativo) setErro(error.message) })
    return () => { ativo = false }
  }, [categoria])
  const podiumReady = useMemo(() => data?.classificacao_final.some(team => team.posicao === 1) ?? false, [data])
  return <div className={`res-page res-page--${categoria}`}>
    <SiteNavbar currentPath="/torneio/resultados" scrollThreshold={80} />
    <main>
      <header className="res-hero">
        <div className="res-hero-lines" aria-hidden="true"><i /><i /><i /></div>
        <div className="res-hero-copy"><p>2° Pior Campeonato de Bici Polo de Bike Polo · Curitiba 2026</p><h1><span>Resultados</span><b>2° Pior Campeonato de Bici Polo Misto</b></h1></div>
        {erro && <div className="res-error">{erro}</div>}
        {!data && !erro && <div className="res-loading">Consultando o registro oficial…</div>}
        {data && <><div className={`res-status ${data.classificacao_final_completa ? 'is-complete' : ''}`}>{data.classificacao_final_completa ? 'Campeonato encerrado' : 'Resultados em andamento'}</div><Podio data={data} /></>}
        <a className="res-scroll-cue" href="#classificacao"><span>Explorar o campeonato</span><ChevronDown /></a>
      </header>
      {data && <div className="res-content">
        <Section kicker={podiumReady ? 'Registro definitivo' : 'Posições já definidas'} title="Classificação final" className="res-final-section"><div id="classificacao" className="res-anchor" /><p className="res-section-intro">Colocação esportiva e campanha são registros diferentes. Os números resumem a trajetória; não reordenam esta lista.</p>{data.metadata.zona_classificatoria && <a className="res-g5" href={data.metadata.zona_classificatoria.url} target="_blank" rel="noreferrer"><b>{data.metadata.zona_classificatoria.codigo}</b><span><strong>Zona classificatória</strong>{data.metadata.zona_classificatoria.nome}</span><ExternalLink /></a>}<FinalTable data={data} /></Section>
        <Section kicker="Entenda a ordem" title="Como a posição foi definida?"><div className="res-rule"><span>01</span><p>Primeiro, vale até onde cada equipe avançou.</p><i /><span>02</span><p>Na mesma etapa de eliminação, a melhor classificação da Primeira Fase ocupa a posição superior.</p></div></Section>
        <Section kicker={data.competicao.formato_info?.primeira_fase === 'round_robin' ? `Todos contra todos · ${data.competicao.formato_info.participantes} equipes` : 'Suíço + Equalização · 13 equipes'} title="Primeira Fase"><PrimeiraFase data={data} /></Section>
        <Awards data={data} />
        <section className="res-closing res-reveal is-visible"><img src="/identidade/logo.svg" alt="Bike Polo Brasil" /><p>Curitiba 2026</p><strong>Um campeonato vira história quando sua trajetória continua acessível.</strong><a href="/torneio/misto">Rever o torneio <ExternalLink size={15} /></a></section>
      </div>}
    </main>
  </div>
}
