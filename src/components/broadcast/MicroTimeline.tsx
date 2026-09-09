import { fmtHora, type EventoPublico } from '../../services/torneioPublico'
import { IconGol, IconFalta } from './icons'
import './microTimeline.css'

/**
 * Faixa única e discreta com os últimos acontecimentos (seções 5-8 do ajuste de
 * legibilidade). `eventos` já vem ordenado DESC por horário (mesmo array do polling
 * existente); pega os 3 mais recentes e inverte SÓ pra exibição (mais antigo → mais
 * recente, leitura da esquerda pra direita) — nunca reordena o array original nem
 * inventa segundos: minutos iguais são resolvidos pela ORDEM VISUAL (setas + destaque no
 * último), não por precisão de timestamp que não existe.
 */
export default function MicroTimeline({ eventos }: { eventos: EventoPublico[] }) {
  const recentes = eventos.slice(0, 3)
  if (recentes.length === 0) return null
  const emOrdemCronologica = [...recentes].reverse()

  return (
    <div className="bcy-micro">
      <span className="bcy-micro-titulo">Últimos</span>
      {emOrdemCronologica.map((e, i) => {
        const ultimo = i === emOrdemCronologica.length - 1
        const primeiro = i === 0
        const nome = e.atleta ?? (e.tipo === 'gol_contra' ? 'Gol contra' : 'Gol outorgado')
        return (
          <span key={e.event_id} className={`bcy-micro-grupo ${primeiro ? 'bcy-micro-grupo--antigo' : ''}`}>
            <span className={`bcy-micro-item ${ultimo ? 'bcy-micro-item--atual' : ''}`}>
              {e.categoria === 'falta' ? <IconFalta size={14} /> : <IconGol size={14} />}
              <span className="bcy-micro-nome">{nome}</span>
              <span className="bcy-micro-sep" aria-hidden="true">·</span>
              <span className="bcy-micro-hora">{fmtHora(e.quando)}</span>
              {ultimo && <span className="bcy-micro-dot" aria-hidden="true" title="Mais recente">●</span>}
            </span>
            {!ultimo && <span className="bcy-micro-seta" aria-hidden="true">→</span>}
          </span>
        )
      })}
    </div>
  )
}
