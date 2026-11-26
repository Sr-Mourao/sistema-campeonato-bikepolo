import { useEffect, useRef, useState } from 'react'
import { useObsDocument } from '../../hooks/useObsDocument'
import StreamingOverlay from './StreamingOverlay'

/**
 * Overlay para o celular da live (Moblin etc.): desenha numa área virtual e
 * escala para caber na tela. Tela em pé usa a área vertical 1080×1920, com o
 * placar grande no topo; tela deitada usa a 1920×1080 de sempre.
 */
export default function StreamingOverlayAjustado() {
  useObsDocument('OBS · Overlay Ajustado')
  const wrapRef = useRef<HTMLDivElement>(null)
  const [vertical, setVertical] = useState(() => window.innerHeight > window.innerWidth)

  useEffect(() => {
    function fit() {
      if (!wrapRef.current) return
      const w = window.innerWidth
      const h = window.innerHeight
      const isVertical = h > w
      setVertical(isVertical)
      const cw = isVertical ? 1080 : 1920
      const ch = isVertical ? 1920 : 1080
      const s = Math.min(w / cw, h / ch)
      const x = (w - cw * s) / 2
      const y = (h - ch * s) / 2
      wrapRef.current.style.width = `${cw}px`
      wrapRef.current.style.height = `${ch}px`
      wrapRef.current.style.transform = `translate(${x}px, ${y}px) scale(${s})`
    }

    window.addEventListener('resize', fit)
    fit()
    return () => window.removeEventListener('resize', fit)
  }, [])

  return (
    <div
      style={{
        margin: 0,
        padding: 0,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: 'transparent',
      }}
    >
      <div
        ref={wrapRef}
        className={`str-fit ${vertical ? 'str-vertical' : ''}`}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 1920,
          height: 1080,
          transformOrigin: '0 0',
        }}
      >
        <StreamingOverlay />
      </div>
    </div>
  )
}
