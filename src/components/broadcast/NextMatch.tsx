import { fmtHora, type JogoPublico } from '../../services/torneioPublico'
import TeamLogo from '../equipes/TeamLogo'
import './nextMatch.css'

/**
 * Próximo jogo — dado já resolvido pelo backend (`resolverProximoJogo()`, que já garante
 * nunca devolver a partida em andamento). Este componente só apresenta.
 */
export default function NextMatch({ jogo }: { jogo: JogoPublico | null }) {
  return (
    <div className="bcy-proximo">
      <div className="bcy-footer-title">Próximo jogo</div>
      {!jogo ? (
        <p className="bcy-footer-vazio">Nenhum próximo jogo agendado.</p>
      ) : (
        <div className="bcy-proximo-conteudo">
          <TeamLogo nome={jogo.time_a_nome ?? ''} logo={jogo.time_a_logo ?? undefined} className="bcy-proximo-logo" />
          <span className="bcy-proximo-nome">{jogo.time_a_nome}</span>
          {/* Sempre renderiza o slot central (mesmo sem horário definido ainda) — nunca
              deixa o grid de 5 colunas colapsar/desalinhar (seção 41/42 do brief: sem
              buraco de layout). */}
          <span className="bcy-proximo-hora">{jogo.horario_previsto ? fmtHora(jogo.horario_previsto) : 'A definir'}</span>
          <span className="bcy-proximo-nome">{jogo.time_b_nome}</span>
          <TeamLogo nome={jogo.time_b_nome ?? ''} logo={jogo.time_b_logo ?? undefined} className="bcy-proximo-logo" />
        </div>
      )}
    </div>
  )
}
