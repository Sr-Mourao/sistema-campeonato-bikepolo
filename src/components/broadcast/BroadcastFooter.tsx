import type { JogoPublico } from '../../services/torneioPublico'
import RecentResults from './RecentResults'
import NextMatch from './NextMatch'
import './broadcastFooter.css'

interface Props {
  ultimosResultados: JogoPublico[]
  proximoJogo: JogoPublico | null
}

/**
 * Barra de transmissão do rodapé — composição de RecentResults + NextMatch (seção 26 do
 * brief de placar broadcast). Só props, fundo transparente no root (painel próprio
 * interno pra contraste) — pensado pra futuramente virar sozinho um
 * `/torneio/overlay/rodape`, sem retrabalho.
 */
export default function BroadcastFooter({ ultimosResultados, proximoJogo }: Props) {
  return (
    <div className="bcy-footer">
      <RecentResults resultados={ultimosResultados} />
      <div className="bcy-footer-divisor" aria-hidden="true" />
      <NextMatch jogo={proximoJogo} />
    </div>
  )
}
