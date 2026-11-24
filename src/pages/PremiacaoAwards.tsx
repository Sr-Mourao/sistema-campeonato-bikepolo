import { useEffect, useState } from 'react'
import Avatar from '../components/equipes/Avatar'
import ProjectionFrame from '../components/projection/ProjectionFrame'
import { useProjectionReplay } from '../components/projection/useProjectionReplay'
import { resultadoVisivel, type AwardCode, type AwardProjectionResult, type AwardWinner } from '../components/projection/awardProjectionData'
import '../components/projection/projection.css'
import './PremiacaoAwards.css'

interface Payload { status: string; categorias: Record<AwardCode, AwardProjectionResult> }

const SUBTITULOS: Record<AwardCode, string> = {
  mvp: 'Melhor Atleta em Quadra', wow: 'Atleta que Mais Evoluiu', revelacao: 'Atleta Revelação', jesse: 'Coração e Caos da Comunidade',
}
const CODIGOS: AwardCode[] = ['mvp', 'wow', 'revelacao', 'jesse']

function useAwardsProjection() {
  const [payload, setPayload] = useState<Payload | null>(null)
  const [erro, setErro] = useState('')
  useEffect(() => {
    let ativo = true
    const carregar = () => fetch('/api/admin/awards.php?view=projecao', { credentials: 'include' }).then(async resposta => {
      if (!resposta.ok) throw new Error(resposta.status === 401 ? 'Acesse o painel admin neste navegador para liberar a projeção.' : 'Não foi possível carregar os resultados.')
      return resposta.json() as Promise<Payload>
    }).then(dados => { if (ativo) { setPayload(dados); setErro('') } }).catch(e => { if (ativo) setErro(e instanceof Error ? e.message : 'Erro ao carregar') })
    carregar(); const timer = window.setInterval(carregar, 10000)
    return () => { ativo = false; window.clearInterval(timer) }
  }, [])
  return { payload, erro }
}

function WinnerCard({ winner, compact = false }: { winner: AwardWinner; compact?: boolean }) {
  return <div className={`pra-winner ${compact ? 'pra-winner--compact' : ''}`}><div className="pra-photo"><Avatar nome={winner.nome} foto={winner.foto ?? undefined} /></div><div className="pra-winner-copy"><strong>{winner.nome}</strong>{winner.time && <span>{winner.time}</span>}</div></div>
}

function Individual({ resultado, codigo }: { resultado?: AwardProjectionResult; codigo: AwardCode }) {
  const winners = resultadoVisivel(resultado)
  return <div className={`pra-individual pra-individual--${codigo}`}>
    <header><span>Awards · 2° Pior Campeonato de Bici Polo Misto</span><h1>{resultado?.nome ?? codigo}</h1><p>{SUBTITULOS[codigo]}</p></header>
    {winners.length === 0 ? <div className="pra-await"><span>Resultado ainda não disponível</span><strong>Aguardando votos</strong></div> : <>
      {resultado?.empate && <div className="pra-tie" style={{ top: '33vh', bottom: 'auto' }}>Empate · {resultado.maior_quantidade} {resultado.maior_quantidade === 1 ? 'voto cada' : 'votos cada'}</div>}
      <div className={`pra-winners pra-winners--${Math.min(winners.length, 4)}`}>{winners.map(w => <WinnerCard winner={w} key={w.pessoa_id} />)}</div>
      <div className="pra-verdict"><span>{winners.length > 1 ? 'Vencedores' : 'Vencedor'}</span></div>
    </>}
  </div>
}

function Geral({ payload }: { payload: Payload | null }) {
  return <div className="pra-general"><header><span>2° Pior Campeonato de Bici Polo · Misto</span><h1>Awards</h1><p>Os destaques de Curitiba 2026</p></header><div className="pra-general-grid">{CODIGOS.map(codigo => {
    const resultado = payload?.categorias[codigo]
    const winners = resultadoVisivel(resultado)
    return <article className={`is-${codigo}`} key={codigo}><div className="pra-general-title"><span>{resultado?.nome ?? codigo}</span><small>{SUBTITULOS[codigo]}</small></div>{winners.length === 0 ? <p>Aguardando resultado</p> : <div className="pra-general-winners">{winners.map(w => <WinnerCard winner={w} compact key={w.pessoa_id} />)}</div>}{resultado?.empate && <b>Empate · {resultado.maior_quantidade} votos cada</b>}</article>
  })}</div></div>
}

export default function PremiacaoAwards() {
  const { payload, erro } = useAwardsProjection()
  const { replay, restart } = useProjectionReplay()
  const segmento = window.location.pathname.split('/').filter(Boolean).at(-1) ?? 'awards'
  const codigo = CODIGOS.includes(segmento as AwardCode) ? segmento as AwardCode : null
  const variant = codigo ?? 'awards'
  return <ProjectionFrame variant={variant} replay={replay} onReplay={restart}>{erro ? <div className="prj-loading"><div><span>Projeção protegida</span><strong>{erro}</strong></div></div> : !payload ? <div className="prj-loading"><div><span>Awards · Brasileiro Misto</span><strong>Preparando premiação…</strong></div></div> : codigo ? <Individual codigo={codigo} resultado={payload.categorias[codigo]} /> : <Geral payload={payload} />}</ProjectionFrame>
}
