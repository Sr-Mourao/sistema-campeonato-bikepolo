import { useEffect, useState } from 'react'
import { Activity, Copy, Check, ExternalLink, Radio, MonitorPlay, Gamepad2 } from 'lucide-react'
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

/** Resposta de /api/streaming.php?action=diag */
interface StreamingDiag {
  ok: boolean
  agora_ms: number
  banco: { leitura: boolean; gravacao: boolean; erro: string | null }
  state?: { rev: number; atualizado_ms: number; idade_s: number } | null
  teams?: { rev: number; atualizado_ms: number; idade_s: number } | null
  dispositivos_vivos?: number
}

function formatIdade(s: number): string {
  if (s < 60) return `${Math.round(s)} s`
  if (s < 3600) return `${Math.round(s / 60)} min`
  return `${(s / 3600).toFixed(1)} h`
}

/** Botão "Testar sincronização": consulta o diagnóstico do servidor de streaming */
function DiagnosticoSync() {
  const [loading, setLoading] = useState(false)
  const [diag, setDiag] = useState<StreamingDiag | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function testar() {
    setLoading(true)
    setErro(null)
    try {
      const res = await fetch('/api/streaming.php?action=diag', { cache: 'no-store' })
      const body = await res.json().catch(() => null)
      if (!res.ok || !body) {
        setDiag(null)
        setErro(body?.error ? `${body.error} (HTTP ${res.status})` : `O servidor respondeu HTTP ${res.status}`)
      } else {
        setDiag(body as StreamingDiag)
      }
    } catch (e) {
      setDiag(null)
      setErro(`Sem resposta do servidor: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLoading(false)
    }
  }

  const sim = (v: boolean) => (v ? '✓ sim' : '✗ não')
  const tudoOk = diag?.ok && diag.banco.leitura && diag.banco.gravacao

  return (
    <section className="adm-streaming-diag">
      <div className="adm-streaming-card-actions">
        <button type="button" className="adm-streaming-btn" onClick={testar} disabled={loading}>
          <Activity size={14} /> {loading ? 'Testando…' : 'Testar sincronização'}
        </button>
        {diag && (
          <span className={`adm-streaming-diag-status ${tudoOk ? 'ok' : 'erro'}`}>
            {tudoOk ? 'Servidor gravando normalmente' : 'O servidor NÃO está gravando — o overlay não recebe'}
          </span>
        )}
      </div>

      {erro && <p className="adm-streaming-diag-status erro">{erro}</p>}

      {diag && (
        <dl className="adm-streaming-diag-grid">
          <dt>Banco: leitura</dt><dd>{sim(diag.banco.leitura)}</dd>
          <dt>Banco: gravação</dt><dd>{sim(diag.banco.gravacao)}</dd>
          {diag.banco.erro && (<><dt>Erro do banco</dt><dd>{diag.banco.erro}</dd></>)}
          <dt>Estado do placar</dt>
          <dd>{diag.state ? `rev ${diag.state.rev} · gravado há ${formatIdade(diag.state.idade_s)}` : 'nenhum estado gravado ainda'}</dd>
          <dt>Catálogo de times</dt>
          <dd>{diag.teams ? `gravado há ${formatIdade(diag.teams.idade_s)}` : 'não gravado (normal)'}</dd>
          <dt>Aparelhos conectados agora</dt><dd>{diag.dispositivos_vivos ?? 0}</dd>
        </dl>
      )}
    </section>
  )
}

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

      <DiagnosticoSync />

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
