import { IconLive } from './icons'
import './liveStatus.css'

const LABEL: Record<string, string> = {
  agendado: 'Agendado', atrasado: 'Atrasado', chamado: 'Chamado', em_andamento: 'Ao vivo',
  encerrado: 'Final', wo: 'W.O.', cancelado: 'Cancelado',
}

/** Pill de status — puramente apresentação do `status` que já vem pronto do backend
 * (nunca decide/deriva status aqui). Reutilizável por um futuro scorebug OBS. */
export default function LiveStatus({ status }: { status: string }) {
  const variante = status === 'em_andamento' ? 'live' : status === 'atrasado' ? 'atrasado' : status === 'encerrado' ? 'final' : 'neutro'
  return (
    <div className={`bcy-status bcy-status--${variante}`}>
      {status === 'em_andamento' && <IconLive className="bcy-status-dot" />}
      {LABEL[status] ?? status}
    </div>
  )
}
