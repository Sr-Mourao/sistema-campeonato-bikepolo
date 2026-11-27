import { useState, useEffect } from 'react'
import { KeyRound } from 'lucide-react'
import './MinhaInscricao.css'
import AthleteDashboard from '../components/atleta/AthleteDashboard'
import SiteNavbar from '../components/SiteNavbar'

// ── Tipos ────────────────────────────────────────────────
interface Session { token: string; email: string }

type AuthStep = 'email' | 'loading' | 'done' | 'no-inscricao'

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem('ins_session')
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}
function saveSession(s: Session) {
  localStorage.setItem('ins_session', JSON.stringify(s))
}
function clearSession() {
  localStorage.removeItem('ins_session')
}

export default function MinhaInscricao() {
  // Auth + dados
  const initialAuth = (() => {
    const params = new URLSearchParams(window.location.search)
    const emailParam = params.get('email')?.toLowerCase() ?? null
    const stored = loadSession()

    if (emailParam) {
      if (stored && stored.email.toLowerCase() === emailParam) {
        return { step: 'loading' as AuthStep, session: stored, email: stored.email }
      }
      clearSession()
      return { step: 'email' as AuthStep, session: null, email: emailParam }
    }

    if (stored) {
      return { step: 'loading' as AuthStep, session: stored, email: stored.email }
    }

    return { step: 'email' as AuthStep, session: null, email: '' }
  })()

  const [step, setStep]         = useState<AuthStep>(initialAuth.step)
  const [session, setSession]   = useState<Session | null>(initialAuth.session)
  const [email, setEmail]       = useState(initialAuth.email)
  const [code, setCode]         = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [atleta, setAtleta]     = useState<any>(null)

  useEffect(() => {
    if (step !== 'loading' || !session) return
    fetch('/api/me.php', { headers: { 'X-Session-Token': session.token } })
      .then(async res => {
        if (res.status === 401) { logout(); return }
        const data = await res.json()
        setAtleta(data)
        setStep(data.inscricao ? 'done' : 'no-inscricao')
      })
      .catch(() => { setError('Erro de conexão. Tente novamente.'); setStep('email') })
  }, [session, step])

  async function handleVerificarCodigo(e: React.FormEvent) {
    e.preventDefault()
    if (code.length !== 8) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth.php', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, code }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'E-mail ou código inválido'); return }
      const s: Session = { token: data.token, email: data.email }
      saveSession(s)
      setSession(s)
      setStep('loading')
    } catch { setError('Erro de conexão') }
    finally { setLoading(false) }
  }

  function logout() {
    clearSession()
    setSession(null)
    setAtleta(null)
    setStep('email')
    setCode('')
    setError('')
  }

  const sessionNav = session ? (
    <div className="atl-nav-right">
      <span className="atl-nav-email">{session.email}</span>
      <button className="atl-nav-logout" onClick={logout}>Sair</button>
    </div>
  ) : null

  return (
    <div className="atl-page">
      <SiteNavbar
        currentPath="/minha-inscricao"
        rightSlot={sessionNav}
        drawerFooter={sessionNav}
      />

      <main className="atl-main">

        {/* ── Loading ──────────────────────────────────── */}
        {step === 'loading' && (
          <div className="atl-loading">
            <span className="atl-spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
            <p className="atl-loading-text">Carregando sua inscrição…</p>
          </div>
        )}

        {/* ── Login com e-mail e código do admin ─────── */}
        {step === 'email' && (
          <div className="atl-auth">
            <div className="atl-auth-icon"><KeyRound size={44} strokeWidth={1.5} style={{ color: 'color-mix(in srgb, var(--pal-orange) 70%, transparent)' }} /></div>
            <h1 className="atl-auth-title">Minha Inscrição</h1>
            <p className="atl-auth-sub">
              Entre com seu e-mail e o código de acesso fornecido pela organização.
            </p>
            <form className="atl-auth-form" onSubmit={handleVerificarCodigo}>
              {error && <div className="atl-auth-error">{error}</div>}
              <input
                className="atl-auth-input"
                type="email"
                placeholder="seuemail@exemplo.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus
                autoComplete="email"
                required
              />
              <input
                className="atl-auth-input atl-auth-input--code"
                type="text"
                inputMode="numeric"
                placeholder="00000000"
                maxLength={8}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                autoComplete="off"
                required
              />
              <button className="atl-auth-btn" type="submit" disabled={loading || code.length !== 8}>
                {loading ? <span className="atl-spinner" /> : <KeyRound size={15} />}
                {loading ? 'Entrando…' : 'Entrar'}
              </button>
            </form>
          </div>
        )}

        {/* ── Sem inscrição ─────────────────────────── */}
        {step === 'no-inscricao' && atleta && (
          <div className="atl-no-inscricao">
            <div className="atl-no-inscricao-icon">🚲</div>
            <h2 className="atl-no-inscricao-title">Nenhuma inscrição encontrada</h2>
            <p className="atl-no-inscricao-sub">
              O email <strong style={{ color: 'var(--pal-white)' }}>{atleta.email}</strong> ainda não tem uma inscrição
              no Pior Campeonato de Bici Polo 2026. Que tal fazer a sua?
            </p>
            <a href="/inscricoes" className="atl-no-inscricao-btn">
              Fazer inscrição
            </a>
            <div style={{ marginTop: 20 }}>
              <button
                onClick={logout}
                style={{ background: 'none', border: 'none', fontSize: 13, color: 'rgba(255,255,255,.35)', cursor: 'pointer' }}
              >
                Usar outro email
              </button>
            </div>
          </div>
        )}

        {/* ── Dashboard ────────────────────────────── */}
        {step === 'done' && atleta && session && (
          <AthleteDashboard
            pessoa={atleta.pessoa}
            inscricao={atleta.inscricao}
            config={atleta.config}
            token={session.token}
            onLogout={logout}
          />
        )}

      </main>
    </div>
  )
}
