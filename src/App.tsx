import { useState, useEffect, lazy, Suspense, type ReactNode } from 'react'
import Hero from './components/Hero'
import FAQ, { HomeQuickLinks } from './components/FAQ'
import Footer from './components/Footer'
import Apoie from './pages/Apoie'
import Inscricoes from './pages/Inscricoes'
import MinhaInscricao from './pages/MinhaInscricao'
import { TournamentProvider, type TournamentCategory } from './contexts/TournamentContext'

// Browser Source precisa nascer transparente, inclusive antes do chunk lazy do overlay.
if (/^\/torneio\/(?:mtnb\/)?overlay\//.test(window.location.pathname)) {
  document.documentElement.classList.add('obs-overlay-document')
  document.body.classList.add('obs-overlay-document')
}

const AdminApp = lazy(() => import('./admin/AdminApp'))
const Lojinha  = lazy(() => import('./pages/Lojinha'))
const Equipes  = lazy(() => import('./pages/Equipes'))
const Torneio  = lazy(() => import('./pages/Torneio'))
const TorneioSeletor = lazy(() => import('./pages/TorneioSeletor'))
const Resultados = lazy(() => import('./pages/Resultados'))
const TorneioPlacar = lazy(() => import('./pages/TorneioPlacar'))
const TorneioOverlayPlacar = lazy(() => import('./pages/TorneioOverlayPlacar'))
const TorneioOverlayEventos = lazy(() => import('./pages/TorneioOverlayEventos'))
const TorneioOverlayIntervalo = lazy(() => import('./pages/TorneioOverlayIntervalo'))
const TorneioOverlayEmissora = lazy(() => import('./pages/TorneioOverlayEmissora'))
const TorneioOverlayConfronto = lazy(() => import('./pages/TorneioOverlayConfronto'))
const TorneioOverlayClassificacao = lazy(() => import('./pages/TorneioOverlayClassificacao'))
const TorneioOverlayRepescagem = lazy(() => import('./pages/TorneioOverlayRepescagem'))
const TorneioOverlayDouble = lazy(() => import('./pages/TorneioOverlayDouble'))
const TorneioOverlayFinal = lazy(() => import('./pages/TorneioOverlayFinal'))
const OverlaysCentral = lazy(() => import('./pages/OverlaysCentral'))
const PremiacaoPodio = lazy(() => import('./pages/PremiacaoPodio'))
const PremiacaoAwards = lazy(() => import('./pages/PremiacaoAwards'))
const Carteira = lazy(() => import('./pages/Carteira'))

function usePath() {
  const [path, setPath] = useState(() => window.location.pathname)
  useEffect(() => {
    const sync = () => setPath(window.location.pathname)
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])
  return path
}

export default function App() {
  const path = usePath()
  const scoped = (categoria: TournamentCategory, node: ReactNode) => <TournamentProvider categoria={categoria}>{node}</TournamentProvider>

  if (path.startsWith('/admin')) {
    return (
      <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0d0f14', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555e78', fontFamily: 'system-ui' }}>Carregando…</div>}>
        <AdminApp />
      </Suspense>
    )
  }

  if (path === '/apoie')            return <Apoie />
  if (path === '/faq') {
    return (
      <>
        <FAQ standalone />
        <Footer />
      </>
    )
  }
  if (path === '/inscricoes')       return <Inscricoes />
  if (path === '/minha-inscricao')  return <MinhaInscricao />
  if (path === '/carteira' || path === '/carteira/' || path === '/carteira/acesso' || path === '/carteira/acesso/' || path.startsWith('/carteira/q/')) {
    return <Suspense fallback={<div style={{ minHeight: '100vh', background: '#16083d' }} />}><Carteira /></Suspense>
  }
  if (path === '/lojinha') {
    return (
      <Suspense fallback={<div style={{ minHeight: '100vh', background: '#160840' }} />}>
        <Lojinha />
      </Suspense>
    )
  }
  if (path === '/equipes') {
    return (
      <Suspense fallback={<div style={{ minHeight: '100vh', background: '#16083d' }} />}>
        <Equipes />
      </Suspense>
    )
  }
  if (path === '/torneio/overlay/placar') {
    return scoped('misto', <Suspense fallback={<div className="obs-overlay-fallback" />}><TorneioOverlayPlacar /></Suspense>)
  }
  if (path === '/torneio/overlay/eventos') {
    return scoped('misto', <Suspense fallback={<div className="obs-overlay-fallback" />}><TorneioOverlayEventos /></Suspense>)
  }
  if (path === '/torneio/overlay/intervalo') {
    return <Suspense fallback={<div className="obs-overlay-fallback" />}><TorneioOverlayIntervalo /></Suspense>
  }
  if (path === '/torneio/overlay/emissora') {
    return <Suspense fallback={<div className="obs-overlay-fallback" />}><TorneioOverlayEmissora /></Suspense>
  }
  if (path === '/torneio/overlay/confronto') {
    return scoped('misto', <Suspense fallback={<div className="obs-overlay-fallback" />}><TorneioOverlayConfronto /></Suspense>)
  }
  if (path === '/overlays') {
    return <Suspense fallback={<div style={{ minHeight: '100vh', background: '#11072a' }} />}><OverlaysCentral /></Suspense>
  }
  if (path === '/overlays/podio') {
    return <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0d0326' }} />}><PremiacaoPodio /></Suspense>
  }
  if (path === '/overlays/awards' || /^\/overlays\/awards\/(mvp|wow|revelacao|jesse)$/.test(path)) {
    return <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0d0326' }} />}><PremiacaoAwards /></Suspense>
  }
  if (path === '/torneio/overlay/classificacao') {
    return scoped('misto', <Suspense fallback={<div className="obs-overlay-fallback" />}><TorneioOverlayClassificacao /></Suspense>)
  }
  if (path === '/torneio/overlay/repescagem') {
    return <Suspense fallback={<div className="obs-overlay-fallback" />}><TorneioOverlayRepescagem /></Suspense>
  }
  if (path === '/torneio/overlay/double') {
    return scoped('misto', <Suspense fallback={<div className="obs-overlay-fallback" />}><TorneioOverlayDouble /></Suspense>)
  }
  if (path === '/torneio/overlay/final') {
    return scoped('misto', <Suspense fallback={<div className="obs-overlay-fallback" />}><TorneioOverlayFinal /></Suspense>)
  }
  const overlayMtnb = path.match(/^\/torneio\/mtnb\/overlay\/(placar|eventos|confronto|classificacao|double|final)$/)?.[1]
  if (overlayMtnb) {
    const Component = overlayMtnb === 'placar' ? TorneioOverlayPlacar : overlayMtnb === 'eventos' ? TorneioOverlayEventos : overlayMtnb === 'confronto' ? TorneioOverlayConfronto : overlayMtnb === 'classificacao' ? TorneioOverlayClassificacao : overlayMtnb === 'double' ? TorneioOverlayDouble : TorneioOverlayFinal
    return scoped('mtnb', <Suspense fallback={<div className="obs-overlay-fallback" />}><Component /></Suspense>)
  }
  if (path === '/torneio/placar') {
    return (
      <Suspense fallback={<div style={{ minHeight: '100vh', background: '#16083d' }} />}>
        {scoped('misto', <TorneioPlacar />)}
      </Suspense>
    )
  }
  if (path === '/torneio/misto') {
    return (
      <Suspense fallback={<div style={{ minHeight: '100vh', background: '#16083d' }} />}>
        {scoped('misto', <Torneio />)}
      </Suspense>
    )
  }
  if (path === '/torneio/resultados' || path === '/torneio/resultados/') {
    return <Suspense fallback={<div style={{ minHeight: '100vh', background: '#11062e' }} />}><Resultados /></Suspense>
  }
  if (path === '/torneio/mtnb/placar') return scoped('mtnb', <Suspense fallback={<div style={{ minHeight: '100vh', background: '#16083d' }} />}><TorneioPlacar /></Suspense>)
  if (path === '/torneio/mtnb') return scoped('mtnb', <Suspense fallback={<div style={{ minHeight: '100vh', background: '#16083d' }} />}><Torneio /></Suspense>)
  if (path === '/torneio') {
    return (
      <Suspense fallback={<div style={{ minHeight: '100vh', background: '#16083d' }} />}>
        <TorneioSeletor />
      </Suspense>
    )
  }
  return (
    <>
      <Hero />
      <HomeQuickLinks />
      <Footer />
    </>
  )
}
