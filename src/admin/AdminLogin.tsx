import { useState } from 'react'

interface Props {
  onLogin: () => void
}

export default function AdminLogin({ onLogin }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/auth.php', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (data.ok) {
        onLogin()
      } else {
        setError(data.error || 'Credenciais inválidas')
      }
    } catch {
      setError('Erro de conexão com o servidor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="adm-login-screen">
      <div className="adm-login-card">
        <div className="adm-login-logo">
          <img src="/identidade/logo.svg" alt="CB10" onError={e => (e.currentTarget.style.display = 'none')} />
        </div>
        <h1>Painel Admin</h1>
        <p>2° Pior Campeonato de Bici Polo de Bike Polo · Curitiba 2026</p>
        <form onSubmit={handleSubmit}>
          {error && <div className="adm-error-msg">{error}</div>}
          <div className="adm-field">
            <label>Usuário</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} autoFocus required autoComplete="username" />
          </div>
          <div className="adm-field">
            <label>Senha</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          <button type="submit" className="adm-btn-primary" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
