import TeamLogo from '../equipes/TeamLogo'
import TeamReactionChip from './TeamReactionChip'
import type { EventoPublico } from '../../services/torneioPublico'
import './teamIdentity.css'

interface Props {
  nome: string
  logo: string | null
  lado: 'a' | 'b'
  /** Vencedor (partida encerrada) — único uso de destaque, nunca decide nada aqui. */
  destaque?: boolean
  /** Evento novo deste lado (opcional) — reação pequena e integrada, nunca um overlay
   * grande (ver TeamReactionChip). `onReacaoDone` libera o próximo item da fila. */
  reacao?: EventoPublico
  onReacaoDone?: () => void
}

/**
 * Identidade visual de UM time — brasão (marca d'água radial atrás) + nome. Puramente
 * apresentação (props), fundo transparente por padrão — funciona tanto no telão
 * (`/torneio/placar`) quanto, futuramente, num overlay OBS transparente sobre vídeo.
 */
export default function TeamIdentity({ nome, logo, lado, destaque, reacao, onReacaoDone }: Props) {
  return (
    <div className={`bcy-identity bcy-identity--${lado} ${destaque ? 'bcy-identity--destaque' : ''}`}>
      <div className="bcy-identity-logo-wrap">
        <div className="bcy-identity-glow" aria-hidden="true" />
        <TeamLogo nome={nome} logo={logo ?? undefined} className="bcy-identity-logo" />
      </div>
      <div className="bcy-identity-nome">{nome}</div>

      {reacao && onReacaoDone && <TeamReactionChip evento={reacao} onDone={onReacaoDone} />}
    </div>
  )
}
