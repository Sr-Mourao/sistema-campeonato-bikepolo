import { useEffect, useRef } from 'react'
import { useObsDocument } from '../../hooks/useObsDocument'
import StreamingOverlay from './StreamingOverlay'

export default function StreamingOverlayAjustado() {
  useObsDocument('OBS · Overlay Ajustado')
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function fit() {
      if (!wrapRef.current) return
      const w = window.innerWidth
      const h = window.innerHeight
      const s = Math.min(w / 1920, h / 1080)
      const x = (w - 1920 * s) / 2
      const y = (h - 1080 * s) / 2
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
