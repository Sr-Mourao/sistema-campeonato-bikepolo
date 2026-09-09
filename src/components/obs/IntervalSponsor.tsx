import { useEffect, useMemo, useState } from 'react'
import type { Patrocinador } from '../../hooks/usePatrocinadores'
import { localSponsorAssets, SPONSOR_DURATION_MS, type SponsorAsset } from './intervalSponsorAssets'
import { medirMarca, placaDaMarca, type Polaridade } from './sponsorPolarity'

/** Duração da vinheta que troca uma marca pela outra. */
const VINHETA_MS = 900

export default function IntervalSponsor({ patrocinadores }: { patrocinadores: Patrocinador[] }) {
  const marcas = useMemo(() => localSponsorAssets(patrocinadores), [patrocinadores])
  const [indice, setIndice] = useState(0)
  const [saindo, setSaindo] = useState<SponsorAsset | null>(null)
  const [placas, setPlacas] = useState<Record<string, Polaridade>>({})

  useEffect(() => {
    if (marcas.length < 2) return
    const relogio = setInterval(() => {
      setIndice(atual => {
        setSaindo(marcas[atual % marcas.length])
        return (atual + 1) % marcas.length
      })
    }, SPONSOR_DURATION_MS)
    return () => clearInterval(relogio)
  }, [marcas])

  useEffect(() => {
    if (!saindo) return
    const fim = setTimeout(() => setSaindo(null), VINHETA_MS)
    return () => clearTimeout(fim)
  }, [saindo])

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
        {saindo && saindo.slug !== atual.slug && (
          <img key={`sai-${saindo.slug}`} src={saindo.src} alt="" aria-hidden="true" className="iv-brand iv-brand--sai" />
        )}
        <img key={`entra-${atual.slug}`} src={atual.src} alt={atual.nome} data-sponsor={atual.slug} className="iv-brand iv-brand--entra" />
        <span key={`lamina-${atual.slug}`} className="iv-lamina" aria-hidden="true" />
        <span key={`tempo-${atual.slug}`} className="iv-sponsor-tempo" aria-hidden="true" />
      </div>
    </div>
  )
}
