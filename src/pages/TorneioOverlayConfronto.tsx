import { useEffect, useRef, useState } from 'react'
import ConfrontoTime from '../components/obs/ConfrontoTime'
import { useObsDocument } from '../hooks/useObsDocument'
import { useTournamentLive } from '../hooks/useTournamentLive'
import { fmtHora } from '../services/torneioPublico'
import './TorneioConfronto.css'
import { TOURNAMENT_PRESENTATION, useTournamentCategory } from '../contexts/TournamentContext'

const PALCO = { largura: 1920, altura: 1080 }
/** Vinheta de entrada da Browser Source; depois disso a peça fica estável. */
const INTRO_MS = 1500

const STATUS_ROTULO: Record<string, string> = {
  agendado: 'Agendado', atrasado: 'Atrasado', chamado: 'Chamado', em_andamento: 'Ao vivo',
  encerrado: 'Encerrado', wo: 'W.O.', cancelado: 'Cancelado',
}

/** Placar só entra em cena quando significa alguma coisa — 0×0 de jogo agendado, não. */
function placarRelevante(status: string, a: number | null, b: number | null): boolean {
  if (status === 'em_andamento') return true
  return status === 'encerrado' && (a !== null || b !== null)
}

/**
 * Apresentação do confronto — composição fullscreen para OBS montada AO REDOR da câmera.
 *
 * A partida vem do resolver canônico (`useTournamentLive` → `torneioPublico.destaque`),
 * o mesmo de /torneio/placar, /torneio/overlay/placar e /torneio/overlay/eventos: nenhuma
 * regra de seleção é reimplementada aqui, então um jogo marcado como atrasado sai desta
 * tela sozinho e volta assim que virar em_andamento.
 *
 * Não é EventOverlay: gol e falta nunca viram animação aqui, só atualizam placar/status.
 */
export default function TorneioOverlayConfronto() {
  const categoria = useTournamentCategory()
  useObsDocument('OBS · Confronto')
  const { destaque } = useTournamentLive()
  const overlay = useRef<HTMLElement>(null)
  const jogo = destaque?.jogo ?? null
  const pronto = Boolean(jogo)

  const [introFinalizada, setIntroFinalizada] = useState(false)
  const introAtiva = pronto && !introFinalizada

  useEffect(() => {
    const ajustar = () => {
      const escala = Math.min(window.innerWidth / PALCO.largura, window.innerHeight / PALCO.altura)
      overlay.current?.style.setProperty('--cf-escala', String(escala))
    }
    ajustar()
    window.addEventListener('resize', ajustar)
    return () => window.removeEventListener('resize', ajustar)
  }, [])

  /* A vinheta longa roda uma vez, quando o confronto real aparece. O polling devolve
     objetos novos a cada rodada, mas `pronto` é booleano — nada a reagenda. */
  useEffect(() => {
    if (!introAtiva) return
    const fim = setTimeout(() => setIntroFinalizada(true), INTRO_MS)
    return () => clearTimeout(fim)
  }, [introAtiva])

  if (!jogo) return <main className="cf-overlay" ref={overlay} />

  const aoVivo = jogo.status === 'em_andamento'
  const comPlacar = placarRelevante(jogo.status, jogo.placar_a, jogo.placar_b)
  const horario = aoVivo ? jogo.horario_inicio_real : jogo.horario_previsto

  return (
    <main className="cf-overlay" ref={overlay} data-intro={introAtiva ? 'ativa' : undefined}>
      <div className="cf-stage">
        <div className="cf-regua" aria-hidden="true" />

        <div className="cf-marca">
          <img src="/identidade/logo.svg" alt="" className="cf-marca-simbolo" aria-hidden="true" />
          <p>{TOURNAMENT_PRESENTATION[categoria].official} <i>·</i> <b>Floripa 2026</b></p>
        </div>

        <div className="cf-partida">
          <span className="cf-partida-fase">{jogo.fase_rotulo} <i>·</i> {jogo.codigo}</span>
          <span className="cf-partida-linha" aria-hidden="true" />
          {horario && <span className="cf-partida-hora">{fmtHora(horario)}</span>}
          <span className={`cf-status cf-status--${aoVivo ? 'vivo' : jogo.status}`}>
            {aoVivo && <i aria-hidden="true" />}{STATUS_ROTULO[jogo.status] ?? jogo.status}
          </span>
        </div>

        {/* Trocou a partida principal? Só este bloco remonta e reentra — a moldura fica. */}
        <div className="cf-conteudo" key={jogo.codigo}>
          <span className="cf-costura" aria-hidden="true" />

          <ConfrontoTime
            lado="a"
            timeId={jogo.time_a_id}
            nome={jogo.time_a_nome ?? 'A definir'}
            logo={jogo.time_a_logo}
            origem={jogo.time_a_id === null ? jogo.time_a_origem : null}
            eventos={destaque?.eventos ?? []}
          />

          <div className="cf-centro">
            {comPlacar ? (
              <div className="cf-placar">
                <b>{jogo.placar_a ?? 0}</b><i>×</i><b>{jogo.placar_b ?? 0}</b>
              </div>
            ) : (
              <div className="cf-versus"><span>VS</span></div>
            )}
          </div>

          <ConfrontoTime
            lado="b"
            timeId={jogo.time_b_id}
            nome={jogo.time_b_nome ?? 'A definir'}
            logo={jogo.time_b_logo}
            origem={jogo.time_b_id === null ? jogo.time_b_origem : null}
            eventos={destaque?.eventos ?? []}
          />
        </div>
      </div>
    </main>
  )
}
