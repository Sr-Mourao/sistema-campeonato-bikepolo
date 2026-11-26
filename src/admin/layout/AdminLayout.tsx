import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Users, Shield, DollarSign,
  LogOut, Menu, X, Settings, ShoppingBag, AlertTriangle, Copy, Check, Trophy, WalletCards, Award,
  CheckSquare, UtensilsCrossed, BedDouble
} from 'lucide-react'
import { navigate } from '../adminApi'
import { useConfigGeral } from '../useConfigGeral'
import type { ConfigGeral } from '../pages/Configuracoes'
import Dashboard from '../pages/Dashboard'
import Inscricoes from '../pages/Inscricoes'
import Times from '../pages/Times'
import Financeiro from '../pages/Financeiro'
import Checkin from '../pages/Checkin'
import Alimentacao from '../pages/Alimentacao'
import Alojamento from '../pages/Alojamento'
import Configuracoes from '../pages/Configuracoes'
import Lojinha from '../pages/lojinha'
import TorneioAdmin from '../torneio'
import CarteiraAdmin from '../pages/Carteira'
import AwardsAdmin from '../pages/Awards'

interface NavItem {
  path: string
  label: string
  icon: typeof LayoutDashboard
  modulo?: keyof ConfigGeral
}

const NAV: NavItem[] = [
  { path: '/admin',                label: 'Dashboard',     icon: LayoutDashboard },
  { path: '/admin/inscricoes',     label: 'Inscrições',    icon: Users },
  { path: '/admin/times',          label: 'Times',         icon: Shield },
  { path: '/admin/torneio',        label: 'Torneio',       icon: Trophy },
  { path: '/admin/awards',         label: 'Awards',        icon: Award },
  { path: '/admin/financeiro',     label: 'Financeiro',    icon: DollarSign },
  { path: '/admin/carteira',       label: 'Carteiras',     icon: WalletCards },
  { path: '/admin/checkin',        label: 'Check-in',      icon: CheckSquare,     modulo: 'modulo_checkin' },
  { path: '/admin/alimentacao',    label: 'Alimentação',   icon: UtensilsCrossed, modulo: 'modulo_alimentacao' },
  { path: '/admin/alojamento',     label: 'Alojamento',    icon: BedDouble,       modulo: 'modulo_alojamento' },
  { path: '/admin/lojinha',        label: 'Lojinha',       icon: ShoppingBag },
  { path: '/admin/configuracoes',  label: 'Configurações', icon: Settings },
]

interface Props {
  path: string
  onLogout: () => void
}

interface ErrorBanner {
  id: number
  message: string
  debug?: string
  url?: string
  copied: boolean
}

export default function AdminLayout({ path, onLogout }: Props) {
  const { config } = useConfigGeral()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [errors, setErrors] = useState<ErrorBanner[]>([])

  useEffect(() => {
    function onError(e: Event) {
      const ce = e as CustomEvent<{ message: string; debug?: string; url?: string }>
      const detail = ce.detail
      if (!detail) return
      setErrors(prev => {
        const id = Date.now() + Math.random()
        const next = [...prev, { id, message: detail.message, debug: detail.debug, url: detail.url, copied: false }]
        return next.slice(-4)
      })
    }
    window.addEventListener('admin-api-error', onError as EventListener)
    return () => window.removeEventListener('admin-api-error', onError as EventListener)
  }, [])

  function dismissError(id: number) {
    setErrors(prev => prev.filter(e => e.id !== id))
  }

  function copyError(id: number) {
    setErrors(prev => prev.map(e => {
      if (e.id !== id) return e
      const payload = [
        e.url ? `URL: ${e.url}` : null,
        `Erro: ${e.message}`,
        e.debug ? `Debug: ${e.debug}` : null,
      ].filter(Boolean).join('\n')
      navigator.clipboard?.writeText(payload).catch(() => {})
      return { ...e, copied: true }
    }))
    window.setTimeout(() => {
      setErrors(prev => prev.map(e => e.id === id ? { ...e, copied: false } : e))
    }, 2200)
  }

  async function handleLogout() {
    await fetch('/api/admin/auth.php', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    })
    onLogout()
  }

  function renderPage() {
    if (path.startsWith('/admin/inscricoes')) return <Inscricoes />
    if (path.startsWith('/admin/times'))      return <Times />
    if (path.startsWith('/admin/awards'))     return <AwardsAdmin />
    if (path.startsWith('/admin/torneio'))    return <TorneioAdmin />
    if (path.startsWith('/admin/financeiro')) return <Financeiro />
    if (path.startsWith('/admin/carteira'))   return <CarteiraAdmin />
    if (path.startsWith('/admin/checkin'))    return <Checkin />
    if (path.startsWith('/admin/alimentacao'))   return <Alimentacao />
    if (path.startsWith('/admin/alojamento'))    return <Alojamento />
    if (path.startsWith('/admin/lojinha'))       return <Lojinha />
    if (path.startsWith('/admin/configuracoes')) return <Configuracoes />
    return <Dashboard />
  }

  const visibleNav = NAV.filter(item => {
    if (!item.modulo) return true
    return Boolean(config?.[item.modulo])
  })

  const activeNav = NAV.find(n =>
    n.path === '/admin' ? path === '/admin' : path.startsWith(n.path)
  )

  return (
    <div className="adm-layout">
      {sidebarOpen && <div className="adm-overlay" onClick={() => setSidebarOpen(false)} />}

      {errors.length > 0 && (
        <div className="adm-error-banners" role="alert" aria-live="polite">
          {errors.map(e => (
            <div key={e.id} className="adm-error-banner">
              <div className="adm-error-banner-head">
                <AlertTriangle size={18} className="adm-error-icon" />
                <div className="adm-error-banner-title">
                  <strong>{e.message}</strong>
                  {e.url && <span className="adm-error-url">{e.url}</span>}
                </div>
                <button
                  className="adm-error-copy"
                  onClick={() => copyError(e.id)}
                  aria-label="Copiar detalhes do erro"
                  title={e.copied ? 'Copiado' : 'Copiar detalhes do erro'}
                >
                  {e.copied ? <Check size={15} /> : <Copy size={15} />}
                </button>
                <button
                  className="adm-error-close"
                  onClick={() => dismissError(e.id)}
                  aria-label="Fechar aviso"
                >
                  <X size={16} />
                </button>
              </div>
              {e.debug && <pre className="adm-error-debug">{e.debug}</pre>}
            </div>
          ))}
        </div>
      )}

      <aside className={`adm-sidebar ${sidebarOpen ? 'adm-sidebar--open' : ''}`}>
        <div className="adm-sidebar-header">
          <img
            src="/identidade/logo.svg"
            alt="CB10"
            className="adm-logo"
            onError={e => (e.currentTarget.style.display = 'none')}
          />
          <span>CB10 Admin</span>
          <button className="adm-close-btn" onClick={() => setSidebarOpen(false)} aria-label="Fechar menu">
            <X size={18} />
          </button>
        </div>

        <nav className="adm-nav">
          {visibleNav.map(item => {
            const Icon = item.icon
            const active = item.path === '/admin' ? path === '/admin' : path.startsWith(item.path)
            return (
              <button
                key={item.path}
                className={`adm-nav-item ${active ? 'adm-nav-item--active' : ''}`}
                onClick={() => { setSidebarOpen(false); navigate(item.path) }}
              >
                <Icon size={17} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="adm-sidebar-footer">
          <button className="adm-nav-item adm-nav-item--logout" onClick={handleLogout}>
            <LogOut size={17} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      <main className="adm-main">
        <header className="adm-topbar">
          <button className="adm-menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Menu">
            <Menu size={20} />
          </button>
          <h2 className="adm-page-title">{activeNav?.label ?? 'Dashboard'}</h2>
        </header>
        <div className="adm-content">
          {renderPage()}
        </div>
      </main>
    </div>
  )
}
