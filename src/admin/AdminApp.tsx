import { useState, useEffect } from 'react'
import './admin.css'
import AdminLogin from './AdminLogin'
import AdminLayout from './layout/AdminLayout'

function useAdminPath() {
  const [path, setPath] = useState(() => window.location.pathname)
  useEffect(() => {
    const sync = () => setPath(window.location.pathname)
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])
  return path
}

export default function AdminApp() {
  const [autenticado, setAutenticado] = useState<boolean | null>(null)
  const path = useAdminPath()

  useEffect(() => {
    fetch('/api/admin/auth.php', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setAutenticado(!!d.autenticado))
      .catch(() => setAutenticado(false))
  }, [])

  // Qualquer 401 emitido pelo adminFetch redireciona para login
  useEffect(() => {
    const handler = () => setAutenticado(false)
    window.addEventListener('admin-unauthorized', handler)
    return () => window.removeEventListener('admin-unauthorized', handler)
  }, [])

  if (autenticado === null) {
    return <div className="adm-loading">Carregando…</div>
  }

  if (!autenticado) {
    return <AdminLogin onLogin={() => setAutenticado(true)} />
  }

  return <AdminLayout path={path} onLogout={() => setAutenticado(false)} />
}
