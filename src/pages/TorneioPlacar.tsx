import { useEffect, useMemo, useRef, useState } from 'react'
import MatchScoreboard from '../components/broadcast/MatchScoreboard'
import TeamActivityList from '../components/broadcast/TeamActivityList'
import MicroTimeline from '../components/broadcast/MicroTimeline'
import GoalCelebration from '../components/broadcast/GoalCelebration'
import Ticker from '../components/broadcast/Ticker'
import PlacarChampion from '../components/broadcast/PlacarChampion'
import { decidirEntradaCampeao } from '../components/broadcast/championState'
import { previewBroadcast } from '../components/obs/tournamentOverlayPreview'
import { useChampionRoster } from '../hooks/useChampionRoster'
import { useEventQueue } from '../hooks/useEventQueue'
import { useTournamentLive } from '../hooks/useTournamentLive'
import './TorneioPlacar.css'
import { TOURNAMENT_PRESENTATION, useTournamentCategory } from '../contexts/TournamentContext'

// Placar em tela cheia (TV/monitor) — polling leve, 5-10s (seção 19 do brief de
// acabamento 3). Reavalia a partida prioritária a cada tick, igual à home /torneio —
// mesma fonte única `torneioPublico.destaque()`, nunca lógica própria de seleção.
// INTOCADO nos ajustes de composição/gol — só o que é RENDERIZADO mudou.
/**
 * Container/página — busca dado (polling acima) e delega toda a apresentação pra
 * componentes de `components/broadcast/`, que só recebem props e não sabem de rede.
 */
export default function TorneioPlacar() {
  const categoria = useTournamentCategory()
  // Mesmos limites e mesmos 8 s históricos; agora compartilhados com as superfícies OBS.
  const { destaque } = useTournamentLive({ limiteEventos: 20, limiteResultados: 5 })
  const preview = useMemo(() => previewBroadcast(window.location.search), [])
  const campeao = preview ? preview.campeao : destaque?.campeao ?? null
  const elencoPreview = useMemo(() => ['Ana Lima', 'Bia Costa', 'Cris Luz', 'Dani Flor'].map((nome, i) => ({ membro_id: i + 1, nome, foto_path: `/imgs/atletas/${i + 1}/foto.webp` })), [])
  const elencoCampeao = useChampionRoster(campeao?.time_id ?? null, preview?.campeao ? elencoPreview : undefined)
  const [tela, setTela] = useState<'partida' | 'saindo' | 'campeao'>('partida')
  const [carregouSemCampeao, setCarregouSemCampeao] = useState(false)
  const viuSemCampeao = useRef(false)
  const campeaoAtivado = useRef<number | null>(null)

  useEffect(() => {
    if (!destaque && !preview) return
    if (!campeao) {
      viuSemCampeao.current = true
      const frame = requestAnimationFrame(() => setCarregouSemCampeao(true))
      return () => cancelAnimationFrame(frame)
    }

    const entrada = decidirEntradaCampeao(campeao.time_id, campeaoAtivado.current, viuSemCampeao.current, elencoCampeao !== null)
    if (entrada === 'nenhuma') return

    let fim: number | undefined
    const frame = requestAnimationFrame(() => {
      campeaoAtivado.current = campeao.time_id
      if (entrada === 'direta') setTela('campeao')
      else {
        setTela('saindo')
        fim = window.setTimeout(() => setTela('campeao'), 900)
      }
    })
    return () => { cancelAnimationFrame(frame); if (fim) clearTimeout(fim) }
  }, [campeao, destaque, elencoCampeao, preview])

  const jogo = destaque?.jogo ?? null
  const proximosResultados = (destaque?.ultimos_resultados ?? []).filter(r => r.codigo !== jogo?.codigo)

  // Fila de eventos (seções 12/21/22 do brief original) — inalterada: só anima o que for
  // genuinamente novo, só quando a partida está em andamento, nunca reproduz histórico.
  const emAndamento = jogo?.status === 'em_andamento'
  const proximoEvento = useEventQueue(destaque?.eventos ?? [], jogo?.codigo ?? null, emAndamento)

  // GOL ganha um destaque forte e independente (GoalCelebration, por cima de tudo);
  // FALTA continua pequena e integrada ao placar (roteada pra MatchScoreboard). O mesmo
  // item da fila nunca é os dois ao mesmo tempo — só sua categoria decide o tratamento.
  const celebracaoGol = proximoEvento && proximoEvento.evento.categoria === 'gol' ? proximoEvento : null
  const reacaoFalta = proximoEvento && proximoEvento.evento.categoria === 'falta' ? proximoEvento : null

  if (tela === 'campeao' && campeao && elencoCampeao) return <PlacarChampion campeao={campeao} elenco={elencoCampeao} />
  if (campeao && elencoCampeao === null && !carregouSemCampeao) return <div className="plc-page"><div className="plc-vazio">Preparando campeão…</div></div>
  if (!destaque) return <div className="plc-page"><div className="plc-vazio">Carregando…</div></div>
  if (!jogo) return <div className="plc-page"><div className="plc-vazio">Nenhuma partida cadastrada ainda.</div></div>

  const timesDefinidos = jogo.time_a_id !== null && jogo.time_b_id !== null

  return (
    <div className={`plc-page ${tela === 'saindo' ? 'plc-page--champion-exit' : ''}`} data-view={tela} data-champion={campeao?.time_id ?? undefined}>
      <div className="plc-marca">{TOURNAMENT_PRESENTATION[categoria].official}</div>

      <div className="plc-palco">
        {/* O placar recua sutilmente durante a celebração de gol — some de cena, nunca
            compete com o protagonismo momentâneo de quem marcou, e volta exatamente como
            estava (mesmo placar, roster já com a ocorrência) quando a celebração acaba. */}
        <div className={`plc-painel ${celebracaoGol ? 'plc-painel--recuado' : ''}`}>
          <MatchScoreboard jogo={jogo} reacao={reacaoFalta} />

          {timesDefinidos && (
            <div className="plc-atividade">
              <TeamActivityList timeId={jogo.time_a_id!} eventos={destaque.eventos} lado="a" />
              <TeamActivityList timeId={jogo.time_b_id!} eventos={destaque.eventos} lado="b" />
            </div>
          )}

          {emAndamento && destaque.eventos.length === 0 && (
            <p className="plc-eventos-vazio">Partida em andamento<br /><span>Aguardando acontecimentos…</span></p>
          )}

          <MicroTimeline eventos={destaque.eventos} />
        </div>

        {celebracaoGol && (
          <GoalCelebration key={celebracaoGol.evento.event_id} evento={celebracaoGol.evento} jogo={jogo} onDone={celebracaoGol.onDone} />
        )}
      </div>

      <Ticker ultimosResultados={proximosResultados} proximoJogo={destaque.proximo_jogo} />
    </div>
  )
}
