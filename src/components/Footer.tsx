import { useEffect, useState } from 'react'
import './Footer.css'
import { usePatrocinadores } from '../hooks/usePatrocinadores'
import type { Patrocinador } from '../hooks/usePatrocinadores'
import { whatsappUrl } from '../site.config'

function imgFallback(e: React.SyntheticEvent<HTMLImageElement>) {
  ;(e.currentTarget as HTMLImageElement).style.visibility = 'hidden'
}

interface SizedPatron extends Patrocinador {
  src: string
  w: number
  h: number
}

function measure(src: string): Promise<{ w: number; h: number }> {
  return new Promise(resolve => {
    const img = new Image()
    const done = () => resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 })
    img.onload = done
    img.onerror = () => resolve({ w: 1, h: 1 })
    img.src = src
  })
}

function classify(w: number, h: number): { spanCol: 2; spanRow: 2 | 1; tileClass: string } {
  if (!w || !h) return { spanCol: 2, spanRow: 1, tileClass: 'patron-tile--small' }
  const ratio = w / h
  if (ratio <= 1.2) {
    return { spanCol: 2, spanRow: 2, tileClass: 'patron-tile--large' }
  }
  return { spanCol: 2, spanRow: 1, tileClass: 'patron-tile--small' }
}

export default function Footer() {
  const patrocinadores = usePatrocinadores()
  const [sized, setSized] = useState<SizedPatron[]>([])

  useEffect(() => {
    let cancelled = false

    const work = async () => {
      const prepared = patrocinadores
        .filter(p => p.logoOriginal)
        .map(p => ({ p, src: p.logoOriginal as string }))

      const results = await Promise.all(
        prepared.map(async ({ p, src }) => {
          const { w, h } = await measure(src)
          return { ...p, src, w, h } as SizedPatron
        })
      )

      if (!cancelled) {
        // Ordenar: tiles grandes (quadradas, 2x2) PRIMEIRO.
        // No mobile isso impede que o grid-auto-flow dense "suba" tiles para
        // buracos anteriores, o que fazia as últimas marcas ficarem fora da
        // altura renderizada do footer.
        const ordered = [...results].sort((a, b) => {
          const aa = classify(a.w, a.h)
          const bb = classify(b.w, b.h)
          const sizeA = aa.spanCol * aa.spanRow
          const sizeB = bb.spanCol * bb.spanRow
          if (sizeB !== sizeA) return sizeB - sizeA
          return a.nome.localeCompare(b.nome)
        })
        setSized(ordered)
      }
    }

    void work()
    return () => {
      cancelled = true
    }
  }, [patrocinadores])

  return (
    <footer className="site-footer">

      {/* REALIZAÇÃO */}
      <div className="footer-top">
        <div className="footer-group">
          <span className="footer-label">REALIZAÇÃO</span>
          <a
            href="https://www.instagram.com/piorbicipolo/"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-club-link"
          >
            <img
              src="/identidade/logo-sem-fundo.svg"
              alt="PIOR Bici Polo"
              className="footer-logo"
              onError={imgFallback}
            />
          </a>
        </div>
      </div>

      {/* APOIADORES */}
      {sized.length > 0 && (
        <div className="footer-apoiadores">
          <span className="footer-apoiadores-label">Apoiadores</span>
          <div className="footer-patron-mosaic" role="list">
            {sized.map((p, idx) => {
              const { tileClass, spanCol, spanRow } = classify(p.w, p.h)
              const style = {
                gridColumn: `span ${spanCol}`,
                gridRow: `span ${spanRow}`,
              } as React.CSSProperties
              const inner = (
                <>
                  <div className="patron-tile-glow" aria-hidden="true" />
                  <img
                    src={p.src}
                    alt={p.nome}
                    className="patron-tile-logo"
                    onError={imgFallback}
                    loading={idx < 12 ? 'eager' : 'lazy'}
                    decoding="async"
                  />
                </>
              )
              return p.url ? (
                <a
                  key={p.slug}
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`patron-tile ${tileClass}`}
                  title={p.nome}
                  style={style}
                  role="listitem"
                >
                  {inner}
                </a>
              ) : (
                <div
                  key={p.slug}
                  className={`patron-tile ${tileClass} patron-tile--nolink`}
                  title={p.nome}
                  style={style}
                  role="listitem"
                >
                  {inner}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="footer-support">
        <span className="footer-support-label">Suporte</span>
        <p className="footer-support-text">
          Teve algum problema com a inscrição ou com a área da pessoa atleta?
          {' '}Fale com o suporte técnico no
          {' '}<a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="footer-support-link">WhatsApp</a>.
        </p>
      </div>

      <div className="footer-credit">
        <a
          href="https://lulinucs.duckdns.org/"
          target="_blank"
          rel="noopener noreferrer"
          className="footer-credit-link"
        >
          Desenvolvido por lulinucs
        </a>
      </div>

    </footer>
  )
}
