import { useEffect, useState, type CSSProperties } from 'react'
import { torneioPublico, type EventoPublico, type JogadorTimePublico } from '../../services/torneioPublico'
import { IconFalta, IconGol } from '../broadcast/icons'
import Avatar from '../equipes/Avatar'
import TeamLogo from '../equipes/TeamLogo'
import { medirMarca, placaDaMarca, type Polaridade } from './sponsorPolarity'
import { useTournamentCategory } from '../../contexts/TournamentContext'

/** Formato normal do torneio: até quatro atletas por equipe. */
const MAX_ATLETAS = 4

interface Marcas { gols: number; faltas: number }

/**
 * Gols e faltas por atleta, a partir dos eventos que já vêm no mesmo payload do resolver
 * — nunca uma segunda busca. Gol contra e gol outorgado não têm autoria e por isso não
 * entram na conta de ninguém (a soma pode diferir do placar, e é assim mesmo).
 */
function marcasPorAtleta(eventos: EventoPublico[], timeId: number | null): Map<string, Marcas> {
  const mapa = new Map<string, Marcas>()
  if (timeId === null) return mapa
  for (const evento of eventos) {
    if (evento.time_id !== timeId || !evento.atleta) continue
    const marcas = mapa.get(evento.atleta) ?? { gols: 0, faltas: 0 }
    if (evento.categoria === 'gol' && evento.tipo === 'normal') marcas.gols++
    if (evento.categoria === 'falta') marcas.faltas++
    mapa.set(evento.atleta, marcas)
  }
  return mapa
}

interface Props {
  lado: 'a' | 'b'
  timeId: number | null
  nome: string
  logo: string | null
  /** Texto de origem do chaveamento quando o time ainda não está definido. */
  origem: string | null
  /** Eventos da partida inteira; o componente filtra pelo próprio time. */
  eventos: EventoPublico[]
}

/**
 * Bloco de uma das equipes do confronto: brasão, nome e elenco com fotos.
 *
 * O elenco vem do mesmo endpoint que o placar de TV usa (`torneioPublico.time`, fotos
 * locais) e só é buscado quando o TIME muda — nunca a cada tick do polling ao vivo.
 */
export default function ConfrontoTime({ lado, timeId, nome, logo, origem, eventos }: Props) {
  const categoria = useTournamentCategory()
  const [elencos, setElencos] = useState<Record<number, JogadorTimePublico[]>>({})

  useEffect(() => {
    if (timeId === null) return
    let cancelado = false
    torneioPublico.time(timeId, categoria)
      .then(d => { if (!cancelado) setElencos(atual => ({ ...atual, [timeId]: d.elenco })) })
      .catch(() => { if (!cancelado) setElencos(atual => ({ ...atual, [timeId]: [] })) })
    return () => { cancelado = true }
  }, [timeId, categoria])

  /* Brasões vêm em polaridades imprevisíveis (arte escura, arte branca, fundo próprio):
     a placa se adapta à marca, mesma técnica já usada na placa do apoiador do intervalo. */
  const [placa, setPlaca] = useState<Polaridade>('escura')
  useEffect(() => {
    if (!logo) { return }
    let cancelado = false
    medirMarca(logo).then(amostra => { if (!cancelado && amostra) setPlaca(placaDaMarca(amostra)) })
    return () => { cancelado = true }
  }, [logo])

  const elenco = (timeId !== null ? elencos[timeId] : undefined) ?? []
  const escalados = elenco.slice(0, MAX_ATLETAS)
  const marcas = marcasPorAtleta(eventos, timeId)

  return (
    <section className="cf-time" data-lado={lado} aria-label={nome}>
      {/* O escudo fica FORA do header de propósito: o header tem clip-path e clip-path
          recorta os filhos — dentro dele o brasão era ceifado na altura da faixa. */}
      <span className="cf-escudo" data-placa={logo ? placa : 'escura'}>
        <TeamLogo nome={nome} logo={logo ?? undefined} className="cf-escudo-img" />
      </span>

      <header className="cf-time-topo">
        <h2 className="cf-time-nome">{nome}</h2>
        {origem && <span className="cf-time-origem">{origem}</span>}
      </header>

      {escalados.length > 0 && (
        <ul className="cf-elenco">
          {escalados.map((atleta, i) => {
            const marca = marcas.get(atleta.nome)
            return (
              <li
                key={atleta.membro_id}
                className="cf-atleta"
                data-marcou={marca && marca.gols > 0 ? 'sim' : undefined}
                style={{ '--ordem': i } as CSSProperties}
              >
                <span className="cf-atleta-foto">
                  <Avatar nome={atleta.nome} foto={atleta.foto_path ?? undefined} className="cf-atleta-img" />
                  {marca && (marca.gols > 0 || marca.faltas > 0) && (
                    <span className="cf-atleta-marcas">
                      {marca.gols > 0 && (
                        <b className="cf-marca-gol" title={`${marca.gols} gol(s)`}>
                          <IconGol size={22} />{marca.gols > 1 && <i>{marca.gols}</i>}
                        </b>
                      )}
                      {marca.faltas > 0 && (
                        <b className="cf-marca-falta" title={`${marca.faltas} falta(s)`}>
                          <IconFalta size={18} />{marca.faltas > 1 && <i>{marca.faltas}</i>}
                        </b>
                      )}
                    </span>
                  )}
                </span>
                <span className="cf-atleta-nome">{atleta.nome}</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
