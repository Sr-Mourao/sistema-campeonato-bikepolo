import { useState, useEffect } from 'react'
import { torneioPublico, type EventoPublico, type JogadorTimePublico } from '../../services/torneioPublico'
import Avatar from '../equipes/Avatar'
import { IconGol, IconFalta } from './icons'
import './teamActivityList.css'
import { useTournamentCategory } from '../../contexts/TournamentContext'

interface Props {
  timeId: number
  /** Eventos da partida inteira (mesmo array já buscado pelo polling existente) — este
   * componente filtra por `timeId` internamente, nunca duplica a busca. */
  eventos: EventoPublico[]
  lado: 'a' | 'b'
}

interface Tally { gols: number; faltas: number }

/**
 * Elenco do time + o que cada jogador fez (gols/faltas) — elemento PRINCIPAL da metade
 * inferior do placar (não um rodapé secundário). Busca o roster (`torneioPublico.time()`,
 * já existente, fotos 100% locais) só quando o TIME muda — nunca a cada tick do polling
 * ao vivo. Altura é limitada pelo tamanho do elenco (3-4 atletas), nunca cresce com o
 * número de eventos: um jogo 7×4 ocupa a mesma altura que um 1×0.
 */
export default function TeamActivityList({ timeId, eventos, lado }: Props) {
  const categoria = useTournamentCategory()
  const [elenco, setElenco] = useState<JogadorTimePublico[] | null>(null)

  useEffect(() => {
    let cancelado = false
    setElenco(null)
    torneioPublico.time(timeId, categoria).then(d => { if (!cancelado) setElenco(d.elenco) }).catch(() => { if (!cancelado) setElenco([]) })
    return () => { cancelado = true }
  }, [timeId, categoria])

  const doTime = eventos.filter(e => e.time_id === timeId)
  const porAtleta = new Map<string, Tally>()
  for (const e of doTime) {
    if (!e.atleta) continue // gol outorgado/gol contra nunca têm atleta — tratados à parte
    const t = porAtleta.get(e.atleta) ?? { gols: 0, faltas: 0 }
    if (e.categoria === 'gol' && e.tipo === 'normal') t.gols++
    if (e.categoria === 'falta') t.faltas++
    porAtleta.set(e.atleta, t)
  }
  const golsOutorgados = doTime.filter(e => e.categoria === 'gol' && e.tipo === 'sem_autoria').length
  const golsContra = doTime.filter(e => e.categoria === 'gol' && e.tipo === 'gol_contra').length

  return (
    <div className={`bcy-atividade bcy-atividade--${lado}`}>
      {elenco === null && <p className="bcy-atividade-hint">Carregando…</p>}
      {elenco !== null && elenco.length === 0 && <p className="bcy-atividade-hint">Elenco não disponível.</p>}

      {elenco !== null && elenco.length > 0 && (
        <ul className={`bcy-atividade-lista ${elenco.length >= 5 ? 'bcy-atividade-lista--compacta' : ''}`}>
          {elenco.map(j => {
            const t = porAtleta.get(j.nome)
            return (
              <li key={j.membro_id} className="bcy-atividade-jogador">
                <Avatar nome={j.nome} foto={j.foto_path ?? undefined} className="bcy-atividade-avatar" />
                <span className="bcy-atividade-nome">{j.nome}</span>
                {t && (t.gols > 0 || t.faltas > 0) && (
                  <span className="bcy-atividade-badges">
                    {t.gols > 0 && <span className="bcy-atividade-badge"><IconGol size={22} />{t.gols > 1 && <b>×{t.gols}</b>}</span>}
                    {t.faltas > 0 && <span className="bcy-atividade-badge bcy-atividade-badge--falta"><IconFalta size={18} />{t.faltas > 1 && <b>×{t.faltas}</b>}</span>}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {(golsOutorgados > 0 || golsContra > 0) && (
        <div className="bcy-atividade-extra">
          {golsOutorgados > 0 && <span><IconGol size={16} /> Gol outorgado{golsOutorgados > 1 ? ` ×${golsOutorgados}` : ''}</span>}
          {golsContra > 0 && <span><IconGol size={16} /> Gol contra{golsContra > 1 ? ` ×${golsContra}` : ''}</span>}
        </div>
      )}
    </div>
  )
}
