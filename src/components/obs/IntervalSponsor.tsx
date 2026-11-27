import { useEffect, useMemo, useState } from 'react'
import type { Patrocinador } from '../../hooks/usePatrocinadores'
import { localSponsorAssets, SPONSOR_DURATION_MS } from './intervalSponsorAssets'
import { medirMarca, placaDaMarca, type Polaridade } from './sponsorPolarity'

/** Tempo da cortina cobrindo a placa — e o mesmo tempo para revelar a próxima marca. */
const CORTINA_MS = 420

/**
 * Troca de marca por cortina: a cortina cobre a placa inteira, e só com tudo coberto
 * a logo E a cor da placa trocam juntas; depois a cortina sai revelando a próxima.
 *
 * Antes a placa mudava de cor no instante da troca, com a logo antiga ainda saindo de
 * lado: em artes com fundo próprio (JPEG branco) a "camada branca" sumia antes da logo.
 */
type Fase = 'parado' | 'cobrindo' | 'revelando'

export default function IntervalSponsor({ patrocinadores }: { patrocinadores: Patrocinador[] }) {
  const marcas = useMemo(() => localSponsorAssets(patrocinadores), [patrocinadores])
  const [indice, setIndice] = useState(0)
  const [fase, setFase] = useState<Fase>('parado')
  const [placas, setPlacas] = useState<Record<string, Polaridade>>({})

  useEffect(() => {
    if (marcas.length < 2) return
    const timers: ReturnType<typeof setTimeout>[] = []
    const relogio = setInterval(() => {
      setFase('cobrindo')
      timers.push(setTimeout(() => {
        setIndice(atual => (atual + 1) % marcas.length) // placa coberta: troca logo e cor juntas
        setFase('revelando')
      }, CORTINA_MS))
      timers.push(setTimeout(() => setFase('parado'), CORTINA_MS * 2))
    }, SPONSOR_DURATION_MS)
    return () => { clearInterval(relogio); timers.forEach(clearTimeout) }
  }, [marcas])

  /* Mede a polaridade de cada arte uma única vez — a placa se adapta à marca, não o contrário. */
  useEffect(() => {
    let ativo = true
    void (async () => {
      for (const marca of marcas) {
        const amostra = await medirMarca(marca.src)
        if (!ativo) return
        if (amostra) setPlacas(atual => ({ ...atual, [marca.slug]: placaDaMarca(amostra) }))
      }
    })()
    return () => { ativo = false }
  }, [marcas])

  if (marcas.length === 0) {
    return (
      <div className="iv-sponsor">
        <div className="iv-sponsor-tab">Apoio</div>
        <div className="iv-sponsor-plate" data-placa="clara" />
      </div>
    )
  }

  const atual = marcas[indice % marcas.length]

  return (
    <div className="iv-sponsor">
      <div className="iv-sponsor-tab">
        Apoio
        <b>{String(indice + 1).padStart(2, '0')}<i>/</i>{String(marcas.length).padStart(2, '0')}</b>
      </div>

      <div className="iv-sponsor-plate" data-placa={placas[atual.slug] ?? 'clara'}>
        <img key={atual.slug} src={atual.src} alt={atual.nome} data-sponsor={atual.slug} className="iv-brand" />
        {/* Cortina com a cabeça do lobo-guará (ARTE_2PCBP_LOBO_GOL), virada para a direita: o sentido do movimento */}
        <span className={`iv-cortina iv-cortina--${fase}`} aria-hidden="true">
          <img src="/identidade/overlay/lobo-gol.webp" alt="" className="iv-cortina-lobo" />
        </span>
        <span key={`tempo-${atual.slug}`} className="iv-sponsor-tempo" aria-hidden="true" />
      </div>
    </div>
  )
}
