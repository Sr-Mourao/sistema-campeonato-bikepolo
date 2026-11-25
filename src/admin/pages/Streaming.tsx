import { useEffect, useMemo, useState } from 'react'
import { Copy, Check, ExternalLink, Radio, MonitorPlay, Gamepad2 } from 'lucide-react'
import './Streaming.css'

function overlayUrl(path: string): string {
  return `${window.location.origin}${path}`
}

const LINKS = [
  {
    label: 'Mesa de Controle',
    desc: 'Painel de arbitragem — controle o placar, relógio e lances da partida ao vivo.',
    path: '/streaming/mesa',
    icon: Gamepad2,
    primary: true,
  },
  {
    label: 'Overlay OBS — 1080p',
    desc: 'Browser Source transparente para o OBS. Resolução: 1920 × 1080.',
    path: '/streaming/overlay',
    icon: MonitorPlay,
  },
  {
    label: 'Overlay OBS — Ajustado',
    desc: 'Versão alternativa do overlay com posicionamento ajustado.',
    path: '/streaming/overlay/ajustado',
    icon: MonitorPlay,
  },
  {
    label: 'Central de Overlays',
    desc: 'Painel com todas as URLs de overlay do torneio (placar, fases, intervalos, etc.).',
    path: '/overlays',
    icon: Radio,
  },
]

export default function Streaming() {
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    const prev = document.title
    document.title = 'Streaming · Admin'
    return () => { document.title = prev }
  }, [])

  function copy(path: string) {
    const url = overlayUrl(path)
    navigator.clipboard?.writeText(url).catch(() => {})
    setCopied(path)
    window.setTimeout(() => setCopied(c => c === path ? null : c), 2000)
  }

  return (
    <div className="adm-streaming">
      <p className="adm-streaming-intro">
        Gerencie a transmissão ao vivo: abra a mesa de controle, copie URLs de overlay para o OBS
        e acompanhe o estado do servidor de sincronização.
      </p>

      <div className="adm-streaming-grid">
        {LINKS.map(link => {
          const Icon = link.icon
          const url = overlayUrl(link.path)
          const isCopied = copied === link.path
          return (
            <article
              key={link.path}
              className={`adm-streaming-card${link.primary ? ' adm-streaming-card--primary' : ''}`}
            >
              <div className="adm-streaming-card-head">
                <Icon size={20} />
                <h3>{link.label}</h3>
              </div>
              <p>{link.desc}</p>
              <code>{url}</code>
              <div className="adm-streaming-card-actions">
                <a href={link.path} target="_blank" rel="noreferrer" className="adm-streaming-btn">
                  <ExternalLink size={14} /> Abrir
                </a>
                <button
                  type="button"
                  className="adm-streaming-btn adm-streaming-btn--copy"
                  onClick={() => copy(link.path)}
                >
                  {isCopied ? <><Check size={14} /> Copiado!</> : <><Copy size={14} /> Copiar URL</>}
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
