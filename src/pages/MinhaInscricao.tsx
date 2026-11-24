import { useState, useEffect } from 'react'
import { Mail, KeyRound } from 'lucide-react'
import './MinhaInscricao.css'
import AthleteDashboard from '../components/atleta/AthleteDashboard'
import SiteNavbar from '../components/SiteNavbar'

// ── Tipos ────────────────────────────────────────────────
interface Session { token: string; email: string }

type AuthStep = 'email' | 'code' | 'loading' | 'done' | 'no-inscricao'

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
  const [devCode, setDevCode]   = useState<string | null>(null)
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

  async function handleEnviarCodigo(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth.php', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erro ao enviar código'); return }
      setDevCode(data.code_dev ?? null)
      setStep('code')
    } catch { setError('Erro de conexão') }
    finally { setLoading(false) }
  }

  async function handleVerificarCodigo(e: React.FormEvent) {
    e.preventDefault()
    if (code.length < 6) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth.php', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, code }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Código inválido'); setLoading(false); return }
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
    setDevCode(null)
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

        {/* ── Login — email ──────────────────────────── */}
        {step === 'email' && (
          <div className="atl-auth">
            <div className="atl-auth-icon"><Mail size={44} strokeWidth={1.5} style={{ color: 'color-mix(in srgb, var(--pal-orange) 70%, transparent)' }} /></div>
            <h1 className="atl-auth-title">Minha Inscrição</h1>
            <p className="atl-auth-sub">
              Informe seu email para receber um código de acesso.
              Não precisa de senha — simples assim 💛
            </p>
            <form className="atl-auth-form" onSubmit={handleEnviarCodigo}>
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
              <button className="atl-auth-btn" type="submit" disabled={loading}>
                {loading ? <span className="atl-spinner" /> : <Mail size={15} />}
                {loading ? 'Enviando…' : 'Receber código'}
              </button>
            </form>
          </div>
        )}

        {/* ── Login — código ────────────────────────── */}
        {step === 'code' && (
          <div className="atl-auth">
            <div className="atl-auth-icon"><KeyRound size={44} strokeWidth={1.5} style={{ color: 'color-mix(in srgb, var(--pal-orange) 70%, transparent)' }} /></div>
            <h1 className="atl-auth-title">Código enviado!</h1>
            <p className="atl-auth-sub">
              Verifique sua caixa de entrada em <strong style={{ color: 'var(--pal-white)' }}>{email}</strong>
              {' '}e cole o código de 6 dígitos abaixo.
            </p>
            <form className="atl-auth-form" onSubmit={handleVerificarCodigo}>
              {error && <div className="atl-auth-error">{error}</div>}
              {devCode && (
                <div className="atl-auth-dev-code">
                  🛠 Dev mode — código: <strong>{devCode}</strong>
                </div>
              )}
              <input
                className="atl-auth-input atl-auth-input--code"
                type="text"
                inputMode="numeric"
                placeholder="000000"
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                autoFocus
                autoComplete="one-time-code"
              />
              <button className="atl-auth-btn" type="submit" disabled={loading || code.length < 6}>
                {loading ? <span className="atl-spinner" /> : <KeyRound size={15} />}
                {loading ? 'Verificando…' : 'Entrar'}
              </button>
              <button type="button" className="atl-auth-retry" onClick={() => { setStep('email'); setCode(''); setError('') }}>
                Usar outro email ou reenviar código
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
