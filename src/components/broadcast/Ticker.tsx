import { fmtHora, type JogoPublico } from '../../services/torneioPublico'
import './ticker.css'

interface Props {
  ultimosResultados: JogoPublico[]
  proximoJogo: JogoPublico | null
}

/**
 * Faixa baixa e rolante estilo ticker de transmissão — substitui o painel grande de
 * "Últimos resultados / Próximo jogo" (era informação demais, destaque demais, pra
 * informação terciária). Mesmos dados já resolvidos pelo backend (`destaque.
 * ultimos_resultados`/`proximo_jogo`, `resolverProximoJogo()` intocado — o próximo jogo
 * nunca é o jogo em andamento), só a apresentação muda. Marquee 100% CSS (sem
 * `<marquee>`), conteúdo duplicado uma vez pra criar o loop contínuo sem salto.
 */
export default function Ticker({ ultimosResultados, proximoJogo }: Props) {
  const itens = ultimosResultados.map(r => `${r.time_a_nome} ${r.placar_a}–${r.placar_b} ${r.time_b_nome}`)
  if (proximoJogo) {
    const hora = proximoJogo.horario_previsto ? `${fmtHora(proximoJogo.horario_previsto)} · ` : ''
    itens.push(`PRÓXIMO · ${hora}${proximoJogo.time_a_nome} × ${proximoJogo.time_b_nome}`)
  }
  if (itens.length === 0) return null

  return (
    <div className="bcy-ticker">
      <span className="bcy-ticker-rotulo">Últimos</span>
      <div className="bcy-ticker-trilho">
        <div className="bcy-ticker-pista">
          <TickerConteudo itens={itens} />
          <TickerConteudo itens={itens} aria-hidden />
        </div>
      </div>
    </div>
  )
}

function TickerConteudo({ itens, ...rest }: { itens: string[] } & Record<string, unknown>) {
  return (
    <div className="bcy-ticker-conteudo" {...rest}>
      {itens.map((texto, i) => (
        <span key={i} className="bcy-ticker-item">
          <span className="bcy-ticker-bolinha" aria-hidden="true">●</span>
          {texto}
        </span>
      ))}
    </div>
  )
}
