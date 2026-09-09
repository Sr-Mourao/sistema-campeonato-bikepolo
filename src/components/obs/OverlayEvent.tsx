import { useEffect, useState } from 'react'
import type { EventoPublico, JogoPublico } from '../../services/torneioPublico'
import Avatar from '../equipes/Avatar'
import TeamLogo from '../equipes/TeamLogo'
import { IconFalta, IconGol } from '../broadcast/icons'

type OverlayJogo = Pick<JogoPublico, 'time_a_id' | 'time_b_id' | 'time_a_nome' | 'time_b_nome' | 'time_a_logo' | 'time_b_logo'>

function useOverlayPhase(duracao: number, onDone: () => void) {
  const [fase, setFase] = useState<'entrando' | 'visivel' | 'saindo'>('entrando')
  useEffect(() => {
    const frame = requestAnimationFrame(() => setFase('visivel'))
    const saida = setTimeout(() => setFase('saindo'), duracao - 450)
    const fim = setTimeout(onDone, duracao)
    return () => { cancelAnimationFrame(frame); clearTimeout(saida); clearTimeout(fim) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uma montagem corresponde a um único evento da fila
  }, [])
  return fase
}

function teamFor(evento: EventoPublico, jogo: OverlayJogo) {
  const ladoA = evento.time_id === jogo.time_a_id
  return {
    nome: (ladoA ? jogo.time_a_nome : jogo.time_b_nome) ?? 'A definir',
    logo: ladoA ? jogo.time_a_logo : jogo.time_b_logo,
    lado: ladoA ? 'a' : 'b',
  } as const
}

function TeamMark({ nome, logo, grande = false }: { nome: string; logo: string | null; grande?: boolean }) {
  return (
    <div className={`obs-event-team ${grande ? 'obs-event-team--large' : ''}`}>
      <span className="obs-event-logo-frame"><TeamLogo nome={nome} logo={logo ?? undefined} className="obs-event-logo" /></span>
      <span>{nome}</span>
    </div>
  )
}

function Goal({ evento, jogo, onDone }: { evento: EventoPublico; jogo: OverlayJogo; onDone: () => void }) {
  const fase = useOverlayPhase(3900, onDone)
  const time = teamFor(evento, jogo)
  const normal = evento.tipo === 'normal' && !!evento.atleta
  const outorgado = evento.tipo === 'sem_autoria'
  const contra = evento.tipo === 'gol_contra'

  return (
    <div className={`obs-goal obs-goal--${time.lado} obs-event--${fase}`} data-event-kind={outorgado ? 'gol-outorgado' : contra ? 'gol-contra' : 'gol'}>
      <div className="obs-goal-shape obs-goal-shape--one" />
      <div className="obs-goal-shape obs-goal-shape--two" />
      <div className="obs-goal-panel">
        <div className="obs-goal-label"><IconGol size={44} /><span>{contra ? 'Gol contra' : 'Gol'}</span></div>
        {normal ? (
          <>
            <div className="obs-goal-photo-frame"><Avatar nome={evento.atleta!} foto={evento.foto_path ?? undefined} className="obs-goal-photo" /></div>
            <div className="obs-goal-athlete">{evento.atleta}</div>
            <TeamMark nome={time.nome} logo={time.logo} />
          </>
        ) : (
          <div className="obs-goal-team-only">
            <TeamMark nome={time.nome} logo={time.logo} grande />
            <strong>{outorgado ? 'Gol outorgado' : `Ponto para ${time.nome}`}</strong>
          </div>
        )}
      </div>
    </div>
  )
}

function Foul({ evento, jogo, onDone }: { evento: EventoPublico; jogo: OverlayJogo; onDone: () => void }) {
  const fase = useOverlayPhase(2200, onDone)
  const time = teamFor(evento, jogo)
  return (
    <div className={`obs-foul obs-foul--${time.lado} obs-event--${fase}`} data-event-kind="falta">
      <div className="obs-foul-card">
        <IconFalta size={35} className="obs-foul-icon" />
        {evento.atleta && <Avatar nome={evento.atleta} foto={evento.foto_path ?? undefined} className="obs-foul-avatar" />}
        <div className="obs-foul-copy"><span>Falta</span><strong>{evento.atleta ?? 'Sem identificação'}</strong><small>{time.nome}</small></div>
      </div>
    </div>
  )
}

export default function OverlayEvent({ evento, jogo, onDone }: { evento: EventoPublico; jogo: OverlayJogo; onDone: () => void }) {
  return evento.categoria === 'gol'
    ? <Goal evento={evento} jogo={jogo} onDone={onDone} />
    : <Foul evento={evento} jogo={jogo} onDone={onDone} />
}
