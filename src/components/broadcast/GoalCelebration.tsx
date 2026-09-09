import { useEffect, useState } from 'react'
import type { EventoPublico, JogoPublico } from '../../services/torneioPublico'
import Avatar from '../equipes/Avatar'
import TeamLogo from '../equipes/TeamLogo'
import { IconGol } from './icons'
import './goalCelebration.css'

export type JogoParaCelebracao = Pick<JogoPublico, 'time_a_id' | 'time_b_id' | 'time_a_nome' | 'time_b_nome' | 'time_a_logo' | 'time_b_logo'>

interface Props {
  evento: EventoPublico
  jogo: JogoParaCelebracao
  onDone: () => void
}

const DURACAO_MS = 3600
const SAIDA_ANTES_MS = 650

/**
 * Intervenção visual FORTE e temporária quando um GOL novo chega — protagonismo pra
 * quem marcou. Componente independente/desacoplado (não mora dentro de
 * TeamIdentity/TeamActivityList, a página só o empilha por cima) — pensado pra também
 * poder um dia ser renderizado sozinho, sobre fundo transparente, num futuro
 * `/torneio/overlay/evento` no OBS.
 *
 * NUNCA usa o brasão como fundo gigante translúcido (já tentamos, ficou ruim) — o fundo
 * aqui é só grafismo abstrato da identidade visual (faixas diagonais + glow); o brasão
 * aparece pequeno e nítido, junto do nome do time, como um elemento normal de composição.
 *
 * FALTA não usa este componente — continua no `TeamReactionChip`, pequeno e integrado
 * (ver MatchScoreboard/TeamIdentity). Só GOL merece este destaque.
 */
export default function GoalCelebration({ evento, jogo, onDone }: Props) {
  const [fase, setFase] = useState<'entrando' | 'em-tela' | 'saindo'>('entrando')

  useEffect(() => {
    const raf = requestAnimationFrame(() => setFase('em-tela'))
    const t1 = setTimeout(() => setFase('saindo'), DURACAO_MS - SAIDA_ANTES_MS)
    const t2 = setTimeout(onDone, DURACAO_MS)
    return () => { cancelAnimationFrame(raf); clearTimeout(t1); clearTimeout(t2) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uma instância = um evento (a page troca a `key` a cada novo evento)
  }, [])

  const lado: 'a' | 'b' = evento.time_id === jogo.time_a_id ? 'a' : 'b'
  const nomeTime = (lado === 'a' ? jogo.time_a_nome : jogo.time_b_nome) ?? ''
  const logoTime = lado === 'a' ? jogo.time_a_logo : jogo.time_b_logo

  let titulo = 'GOL'
  if (evento.tipo === 'sem_autoria') titulo = 'GOL OUTORGADO'
  if (evento.tipo === 'gol_contra') titulo = 'GOL CONTRA'

  // Nunca inventa atleta: outorgado/contra nunca têm um (garantido pelo backend em
  // registrarGol() — membro_id sempre null nesses dois casos).
  const mostrarAtleta = evento.tipo === 'normal' && !!evento.atleta

  return (
    <div className={`bcy-celebra bcy-celebra--${lado} bcy-celebra--${fase}`} role="status" aria-live="polite">
      <div className="bcy-celebra-fundo" aria-hidden="true">
        <span className="bcy-celebra-faixa bcy-celebra-faixa--1" />
        <span className="bcy-celebra-faixa bcy-celebra-faixa--2" />
        <span className="bcy-celebra-glow" />
      </div>

      <div className="bcy-celebra-conteudo">
        <div className="bcy-celebra-titulo">
          <IconGol size={38} className="bcy-celebra-icon" />
          <span>{titulo}</span>
        </div>

        {mostrarAtleta ? (
          <>
            <div className="bcy-celebra-foto-wrap">
              <Avatar nome={evento.atleta!} foto={evento.foto_path ?? undefined} className="bcy-celebra-foto" />
            </div>
            <div className="bcy-celebra-atleta">{evento.atleta}</div>
          </>
        ) : evento.tipo === 'gol_contra' ? (
          <div className="bcy-celebra-atleta">Ponto para {nomeTime}</div>
        ) : null}

        <div className="bcy-celebra-time">
          <span className="bcy-celebra-time-logo-frame">
            <TeamLogo nome={nomeTime} logo={logoTime ?? undefined} className="bcy-celebra-time-logo" />
          </span>
          <span className="bcy-celebra-time-nome">{nomeTime}</span>
        </div>
      </div>
    </div>
  )
}
