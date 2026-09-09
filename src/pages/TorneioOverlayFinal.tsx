import { useEffect, useMemo, useRef, useState } from 'react'
import ChampionRoster from '../components/broadcast/ChampionRoster'
import { BroadcastFrame, BroadcastTitle, Crest } from '../components/obs/TournamentGraphics'
import { estadoDaFinal, jogoTemPlacar, statusPartida, type EstadoFinal } from '../components/obs/tournamentOverlayData'
import { previewBroadcast } from '../components/obs/tournamentOverlayPreview'
import { useBroadcastIntro } from '../hooks/useBroadcastIntro'
import { useChampionRoster } from '../hooks/useChampionRoster'
import { useObsDocument } from '../hooks/useObsDocument'
import { useTournamentBroadcast } from '../hooks/useTournamentBroadcast'
import type { JogadorTimePublico, JogoPublico } from '../services/torneioPublico'
import './TorneioTournamentOverlays.css'
import { TOURNAMENT_PRESENTATION, useTournamentCategory } from '../contexts/TournamentContext'

function FinalTeam({ lado, jogo }: { lado: 'a' | 'b'; jogo: JogoPublico | null }) {
  const nome = (lado === 'a' ? jogo?.time_a_nome : jogo?.time_b_nome) ?? (lado === 'a' ? 'Vaga Winners' : 'Vaga Losers')
  const logo = lado === 'a' ? jogo?.time_a_logo : jogo?.time_b_logo
  return <section className={`tf-team tf-team--${lado}`}><Crest nome={nome} logo={logo} /><small>{lado === 'a' ? 'Winners' : 'Losers'}</small><strong>{nome}</strong></section>
}

function FinalMatch({ estado, exiting = false }: { estado: Extract<EstadoFinal, { tipo: 'aguardando' | 'partida' }>; exiting?: boolean }) {
  const categoria = useTournamentCategory()
  const identidade = TOURNAMENT_PRESENTATION[categoria]
  const jogo = estado.jogo
  const placar = jogo ? jogoTemPlacar(jogo) : false
  return (
    <div className={`tf-match ${exiting ? 'tf-match--exit' : ''}`}>
      <BroadcastTitle eyebrow="Decisão do campeonato" title="Grande Final" subtitle={jogo?.codigo === 'GF2' ? 'Jogo decisivo · GF2' : `${identidade.short} · Floripa 2026`} />
      <div className="tf-duel">
        <FinalTeam lado="a" jogo={jogo} />
        <div className="tf-score">
          <small>{jogo ? statusPartida(jogo.status) : 'Aguardando finalistas'}</small>
          {placar ? <div><b>{jogo?.placar_a}</b><i>×</i><b>{jogo?.placar_b}</b></div> : <strong>VS</strong>}
          <span>{jogo?.codigo ?? 'GF'}</span>
        </div>
        <FinalTeam lado="b" jogo={jogo} />
      </div>
      <p className="tf-await">{estado.tipo === 'aguardando' ? 'Os caminhos da Winners e da Losers convergem aqui.' : `Grande Final · ${identidade.official}`}</p>
    </div>
  )
}

function ChampionHero({ nome, logo, elenco }: { nome: string; logo: string | null; elenco: JogadorTimePublico[] }) {
  const categoria = useTournamentCategory()
  const identidade = TOURNAMENT_PRESENTATION[categoria]
  return (
    <section className="tf-champion">
      <div className="tf-champion-mass" aria-hidden="true" />
      <div className="tf-champion-lines" aria-hidden="true" />
      <div className="tf-champion-brand"><img src="/identidade/logo.svg" alt="" /><span>{identidade.official}<br />Floripa · 2026</span></div>
      <div className="tf-champion-crest"><Crest nome={nome} logo={logo} /></div>
      <div className="tf-champion-copy"><small>{categoria === 'mtnb' ? identidade.official : 'Campeão Brasileiro'}</small><strong>{categoria === 'mtnb' ? 'Floripa · 2026' : 'de Bike Polo'}</strong><b>{nome}</b></div>
      <ChampionRoster className="tf-roster" atletas={elenco} />
      <img className="tf-floripa" src="/imgs/logos/bikeplofloripabranco.png" alt="Bike Polo Floripa" />
    </section>
  )
}

export default function TorneioOverlayFinal() {
  useObsDocument('OBS · Grande Final')
  const { dados } = useTournamentBroadcast()
  const preview = useMemo(() => previewBroadcast(window.location.search), [])
  const payload = preview ?? dados
  const temPayload = Boolean(payload)
  const estado = payload ? estadoDaFinal(payload.double, payload.campeao) : null
  const [championIntro, setChampionIntro] = useState(false)
  const teveEstadoAnterior = useRef(false)
  const championId = payload?.campeao?.time_id ?? null
  const elencoPreview = useMemo<JogadorTimePublico[]>(() => ['Ana Lima', 'Bia Costa', 'Cris Luz', 'Dani Flor'].map((nome, i) => ({ membro_id: i + 1, nome, foto_path: null })), [])
  const elenco = useChampionRoster(championId, preview ? elencoPreview : undefined)

  useEffect(() => {
    if (temPayload && !championId) { teveEstadoAnterior.current = true; return }
    if (!championId || !teveEstadoAnterior.current) return
    const frame = requestAnimationFrame(() => setChampionIntro(true))
    const fim = setTimeout(() => setChampionIntro(false), 1900)
    teveEstadoAnterior.current = false
    return () => { cancelAnimationFrame(frame); clearTimeout(fim) }
  }, [championId, temPayload])

  const elencoExibido = elenco
  const pronto = Boolean(estado && (estado.tipo !== 'campeao' || elencoExibido !== null))
  const intro = useBroadcastIntro(pronto, estado?.tipo === 'campeao' ? 1900 : 1600)
  if (!payload || !estado || !pronto) return <main className="tg-overlay" />

  return (
    <BroadcastFrame className={`tc-final ${estado.tipo === 'campeao' ? 'is-champion' : ''}`} intro={intro || championIntro}>
      {estado.tipo === 'campeao'
        ? <ChampionHero nome={estado.campeao.nome} logo={estado.campeao.logo} elenco={elencoExibido ?? []} />
        : <FinalMatch estado={estado} />}
    </BroadcastFrame>
  )
}
