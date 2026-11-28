import { useState, useEffect } from 'react'
import './Hero.css'
import { usePatrocinadores } from '../hooks/usePatrocinadores'
import SiteNavbar from './SiteNavbar'
import { hrefOculto } from './siteNav'

const HERO_IMGS = [
  '/imgs/hero/09.jpg',
  '/imgs/hero/13.jpg',
  '/imgs/hero/20.jpg',
  '/imgs/hero/25.jpg',
  '/imgs/hero/39.jpg',
  '/imgs/hero/DSC_2729.JPG',
  '/imgs/hero/DSC_2730.JPG',
  '/imgs/hero/DSC_2891.JPG',
  '/imgs/hero/DSC_2536.JPG',
  '/imgs/hero/DSC_0000_07_2737.JPG',
  '/imgs/hero/DSC_0000_05_2779.JPG',
  '/imgs/hero/DSC_0000_03_3229.JPG',
]

function pickRandom(exclude?: string) {
  const pool = exclude ? HERO_IMGS.filter(x => x !== exclude) : HERO_IMGS
  return pool[Math.floor(Math.random() * pool.length)]
}

function logoFallback(e: React.SyntheticEvent<HTMLImageElement>) {
  ;(e.currentTarget as HTMLImageElement).style.visibility = 'hidden'
}

export default function Hero() {
  const patrocinadores = usePatrocinadores()
  const comLogo = patrocinadores.filter(p => p.logo)

  const [imgs, setImgs] = useState<[string, string]>(() => {
    const a = pickRandom()
    return [a, pickRandom(a)]
  })
  const [active, setActive] = useState<0 | 1>(0)

  useEffect(() => {
    const id = setInterval(() => {
      setActive(prev => {
        const next = (prev === 0 ? 1 : 0) as 0 | 1
        setImgs(s => {
          const copy: [string, string] = [s[0], s[1]]
          copy[next] = pickRandom(s[prev])
          return copy
        })
        return next
      })
    }, 6000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="page">
      <SiteNavbar currentPath="/" scrollThreshold={40} />

      <main className="main">

        {/* ── Zona roxa ─────────────────────────────────── */}
        <div className="zone-purple">

          <div className="purple-bg" aria-hidden="true">
            <div
              className={`bg-layer${active === 0 ? ' bg-layer--active' : ''}`}
              style={{ backgroundImage: `url(${imgs[0]})` }}
            />
            <div
              className={`bg-layer${active === 1 ? ' bg-layer--active' : ''}`}
              style={{ backgroundImage: `url(${imgs[1]})` }}
            />
            <div className="bg-overlay" />
          </div>

          <div className="illustration-wrapper">
            <img
              src="/identidade/logocamps.svg"
              alt=""
              className="hero-illustration"
              aria-hidden="true"
            />
          </div>

          <div className="event-meta-bar">
            <img src="/identidade/data.svg" alt="12-13 DEZ 2026" className="meta-img" />
            <div className="meta-sep" aria-hidden="true" />
            <img src="/identidade/curitiba.svg" alt="Curitiba-PR" className="meta-img meta-img-loc" />
          </div>

        </div>

        {/* ── Faixas de título ──────────────────────────── */}
        <div className="hero-titles">
          <div className="zone zone-orange">
            <img
              src="/identidade/10BR.svg"
              alt="2° Pior Campeonato de Bici Polo"
              className="title-img"
            />
          </div>

          <div className="zone zone-red" id="apoie">
            <div className="red-zone-inner">
              <div className="red-zone-supporters">
                <span className="red-zone-label">Apoiadores</span>
                <div className="red-zone-sep" aria-hidden="true" />
                {comLogo.length > 0 && (
                  <div className="red-zone-marquee">
                    <div className="red-zone-marquee-track">
                      {[0, 1].map(group => (
                        <div
                          key={group}
                          className="red-zone-marquee-group"
                        aria-hidden={group === 1 ? 'true' : undefined}
                      >
                        {comLogo.map(p => (
                          <img
                            key={`${group}-${p.slug}`}
                            src={p.logo}
                            alt={p.nome}
                            className="red-zone-logo"
                            onError={logoFallback}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {!hrefOculto('/apoie') && <a href="/apoie" className="cta-btn">APOIE</a>}
            </div>
          </div>
        </div>

      </main>
    </div>
  )
}
