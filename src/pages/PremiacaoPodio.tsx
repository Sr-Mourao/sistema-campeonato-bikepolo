import { useEffect, useState } from 'react'
import Avatar from '../components/equipes/Avatar'
import TeamLogo from '../components/equipes/TeamLogo'
import ProjectionFrame from '../components/projection/ProjectionFrame'
import { useProjectionReplay } from '../components/projection/useProjectionReplay'
import '../components/projection/projection.css'
import { torneioPublico, type JogadorTimePublico, type PodioTimePublico } from '../services/torneioPublico'
import './PremiacaoPodio.css'

interface PodioComElenco extends PodioTimePublico { elenco: JogadorTimePublico[] }

function usePodio() {
  const [podio, setPodio] = useState<PodioComElenco[] | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true
    const carregar = async () => {
      try {
        const resposta = await torneioPublico.podio()
        const completo = await Promise.all(resposta.podio.map(async time => {
          try {
            const detalhe = await torneioPublico.time(time.time_id)
            return { ...time, elenco: detalhe.elenco.slice(0, 4) }
          } catch {
            return { ...time, elenco: [] }
          }
        }))
        if (ativo) { setPodio(completo); setErro('') }
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : 'Não foi possível carregar o pódio')
      }
    }
    carregar()
    const timer = window.setInterval(carregar, 15000)
    return () => { ativo = false; window.clearInterval(timer) }
  }, [])

  return { podio, erro }
}

function Lugar({ time }: { time: PodioComElenco }) {
  return <article className={`prp-place prp-place--${time.posicao}`}>
    <div className="prp-rank" style={{ left: '9%' }}><span>{time.posicao}º</span><small>{time.posicao === 1 ? 'Campeão' : time.posicao === 2 ? 'Vice-campeão' : 'Terceiro lugar'}</small></div>
    <div className="prp-crest"><TeamLogo nome={time.nome} logo={time.logo ?? undefined} /></div>
    <h2>{time.nome}</h2>
    {time.elenco.length > 0 && <div className="prp-roster">{time.elenco.map(atleta => <div key={atleta.membro_id}><Avatar nome={atleta.nome} foto={atleta.foto_path ?? undefined} /><span>{atleta.nome}</span></div>)}</div>}
  </article>
}

export default function PremiacaoPodio() {
  const { podio, erro } = usePodio()
  const { replay, restart } = useProjectionReplay()
  const ordem = podio ? [podio.find(time => time.posicao === 2), podio.find(time => time.posicao === 1), podio.find(time => time.posicao === 3)].filter((time): time is PodioComElenco => Boolean(time)) : []

  return <ProjectionFrame variant="podio" replay={replay} onReplay={restart}>
    {!podio ? <div className="prj-loading"><div><span>Pódio · Brasileiro Misto</span><strong>{erro || 'Preparando premiação…'}</strong></div></div> : ordem.length < 3 ? <div className="prj-loading"><div><span>Pódio · Brasileiro Misto</span><strong>Pódio ainda não disponível</strong><p>Aguardando o encerramento oficial da fase final.</p></div></div> : <div className="prp-content">
      <header><span>2° Pior Campeonato de Bici Polo · Misto</span><h1>Pódio</h1><p>Curitiba 2026</p></header>
      <section className="prp-places">{ordem.map(time => <Lugar time={time} key={time.time_id} />)}</section>
    </div>}
  </ProjectionFrame>
}
