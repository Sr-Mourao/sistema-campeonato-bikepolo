import { useEffect, useRef } from 'react'
import IntervalQr from '../components/obs/IntervalQr'
import IntervalSponsor from '../components/obs/IntervalSponsor'
import { useObsDocument } from '../hooks/useObsDocument'
import { usePatrocinadores } from '../hooks/usePatrocinadores'
import './TorneioIntervalo.css'

const PALCO = { largura: 1920, altura: 1080 }

export default function TorneioOverlayIntervalo() {
  useObsDocument('OBS · Intervalo do torneio')
  const patrocinadores = usePatrocinadores()
  const overlay = useRef<HTMLElement>(null)

  /* A composição é desenhada em 1920×1080 e escalada inteira — CSS não divide length por length. */
  useEffect(() => {
    const ajustar = () => {
      const escala = Math.min(window.innerWidth / PALCO.largura, window.innerHeight / PALCO.altura)
      overlay.current?.style.setProperty('--iv-escala', String(escala))
    }
    ajustar()
    window.addEventListener('resize', ajustar)
    return () => window.removeEventListener('resize', ajustar)
  }, [])

  return (
    <main className="iv-overlay" ref={overlay}>
      {/* Palco fixo de 1920×1080: a composição inteira é escalada, nunca reflowada. */}
      <div className="iv-stage">
        <div className="iv-rule iv-rule--topo" aria-hidden="true" />
        <div className="iv-rule iv-rule--base" aria-hidden="true" />
        <div className="iv-hatch" aria-hidden="true" />

        <section className="iv-slab" aria-label="2° Pior Campeonato de Bici Polo">
          <img src="/identidade/logo.svg" alt="" className="iv-symbol" aria-hidden="true" />
          <p className="iv-kicker">Curitiba 2026</p>
          <div className="iv-meta">
            <span className="iv-meta-rule" aria-hidden="true" />
            <img src="/identidade/data.svg" alt="12 a 13 de dezembro de 2026" className="iv-meta-data" />
            <img src="/identidade/curitiba.svg" width="54" alt="Curitiba, Paraná" className="iv-meta-local" />
          </div>
        </section>

        {/* A faixa laranja é o berço original do wordmark roxo — mesma lógica de cor do site. */}
        <div className="iv-titlebar">
          <img src="/identidade/10BR.svg" alt="2° Pior Campeonato de Bici Polo" className="iv-wordmark" />
        </div>

        <div className="iv-state">
          <span className="iv-pulse" aria-hidden="true" />
          Intervalo
        </div>
        <p className="iv-sub">Em instantes, mais bici polo.</p>
        <div className="iv-connector" aria-hidden="true" />

        <IntervalQr />
        <IntervalSponsor patrocinadores={patrocinadores} />
      </div>
    </main>
  )
}
