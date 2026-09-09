import { fmtHora, type JogoPublico, type EventoPublico } from '../../services/torneioPublico'
import TeamIdentity from './TeamIdentity'
import LiveScore from './LiveScore'
import LiveStatus from './LiveStatus'
import './matchScoreboard.css'

interface Props {
  jogo: JogoPublico
  /** Reação pequena e integrada (ver TeamIdentity/TeamReactionChip) — a página só passa
   * eventos de FALTA aqui; GOL tem seu próprio destaque forte e independente
   * (`GoalCelebration`, renderizado pela página por cima de tudo, não por este
   * componente). Este componente não sabe/decide qual categoria é "grande" — só roteia
   * pro lado correspondente o que receber. */
  reacao?: { evento: EventoPublico; onDone: () => void } | null
}

/**
 * Placar principal — compõe TeamIdentity(A) + score/VS + TeamIdentity(B) + status,
 * variando internamente por `jogo.status` (agendado/atrasado viram "próximo confronto"
 * sem placar — seção 37 do brief; em_andamento mostra `LiveScore`; encerrado mostra o
 * placar final com o vencedor em destaque). Só recebe `jogo` como prop — nenhuma lógica
 * de seleção/polling aqui, reutilizável por um futuro scorebug OBS transparente.
 */
export default function MatchScoreboard({ jogo, reacao }: Props) {
  const preJogo = jogo.status === 'agendado' || jogo.status === 'atrasado'
  const vencedorA = jogo.status === 'encerrado' && jogo.vencedor_time_id !== null && jogo.vencedor_time_id === jogo.time_a_id
  const vencedorB = jogo.status === 'encerrado' && jogo.vencedor_time_id !== null && jogo.vencedor_time_id === jogo.time_b_id

  const ladoReacao = reacao ? (reacao.evento.time_id === jogo.time_a_id ? 'a' : 'b') : null

  return (
    <div className="bcy-scoreboard">
      <div className="bcy-scoreboard-cabecalho">
        <div className="bcy-fase">{jogo.fase_rotulo} <span>·</span> {jogo.codigo}</div>
        <LiveStatus status={jogo.status} />
      </div>

      <div className="bcy-scoreboard-corpo">
        <TeamIdentity
          lado="a" nome={jogo.time_a_nome ?? 'A definir'} logo={jogo.time_a_logo} destaque={vencedorA}
          reacao={ladoReacao === 'a' ? reacao!.evento : undefined} onReacaoDone={ladoReacao === 'a' ? reacao!.onDone : undefined}
        />

        {preJogo ? (
          <div className="bcy-vs">VS</div>
        ) : (
          <LiveScore placarA={jogo.placar_a ?? 0} placarB={jogo.placar_b ?? 0} />
        )}

        <TeamIdentity
          lado="b" nome={jogo.time_b_nome ?? 'A definir'} logo={jogo.time_b_logo} destaque={vencedorB}
          reacao={ladoReacao === 'b' ? reacao!.evento : undefined} onReacaoDone={ladoReacao === 'b' ? reacao!.onDone : undefined}
        />
      </div>

      <div className="bcy-scoreboard-rodape">
        {jogo.status === 'em_andamento' && jogo.horario_inicio_real && <span>Início · {fmtHora(jogo.horario_inicio_real)}</span>}
        {jogo.status === 'atrasado' && jogo.horario_previsto && <span>Previsto para · {fmtHora(jogo.horario_previsto)}</span>}
        {jogo.status === 'agendado' && jogo.horario_previsto && <span>Início previsto · {fmtHora(jogo.horario_previsto)}</span>}
      </div>
    </div>
  )
}
