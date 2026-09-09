import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ChevronDown, Menu, X } from 'lucide-react'
import './SiteNavbar.css'
import { SITE_NAV_CTA, SITE_NAV_LINKS, SITE_NAV_SECONDARY_LINKS } from './siteNav'

interface Props {
  currentPath?: string
  rightSlot?: ReactNode
  drawerFooter?: ReactNode
  scrollThreshold?: number
  hideOnScroll?: boolean
}

export default function SiteNavbar({
  currentPath,
  rightSlot,
  drawerFooter,
  scrollThreshold = 60,
  hideOnScroll = true,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [navScrolled, setNavScrolled] = useState(false)
  const [navHidden, setNavHidden] = useState(false)

  const path = useMemo(() => {
    if (currentPath) return currentPath
    if (typeof window !== 'undefined') return window.location.pathname
    return '/'
  }, [currentPath])

  useEffect(() => {
    let lastY = 0

    const onScroll = () => {
      const y = window.scrollY
      setNavScrolled(y > 24)

      if (!hideOnScroll || menuOpen) {
        setNavHidden(false)
        lastY = y
        return
      }

      if (y > lastY + 5 && y > scrollThreshold) {
        setNavHidden(true)
      } else if (y < lastY - 5) {
        setNavHidden(false)
      }
      lastY = y
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [hideOnScroll, menuOpen, scrollThreshold])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  const navClass = [
    'site-nav',
    navScrolled ? 'site-nav--scrolled' : '',
    navHidden ? 'site-nav--hidden' : '',
  ].filter(Boolean).join(' ')

  const closeMenu = () => setMenuOpen(false)

  return (
    <>
      <nav className={navClass}>
        <a href="/" className="site-nav-logo-link" aria-label="Ir para a página inicial">
          <img src="/identidade/logo.svg" alt="Bike Polo Brasil" className="site-nav-logo" />
        </a>

        <div className="site-nav-desktop">
          <div className="site-nav-links">
            {SITE_NAV_LINKS.map(link => (
              <a
                key={link.href}
                href={link.href}
                className={`site-nav-link${path === link.href ? ' site-nav-link--active' : ''}`}
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="site-nav-actions">
            <details className="site-nav-more">
              <summary>Mais <ChevronDown size={13} /></summary>
              <div>{SITE_NAV_SECONDARY_LINKS.map(link => <a href={link.href} key={link.href}>{link.label}</a>)}</div>
            </details>
            {rightSlot && <div className="site-nav-extra">{rightSlot}</div>}
            <a
              href={SITE_NAV_CTA.href}
              className={`site-nav-cta${path === SITE_NAV_CTA.href ? ' site-nav-cta--active' : ''}`}
            >
              {SITE_NAV_CTA.label}
            </a>
          </div>
        </div>

        <button
          type="button"
          className={`site-nav-toggle${menuOpen ? ' site-nav-toggle--open' : ''}`}
          onClick={() => setMenuOpen(open => !open)}
          aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menuOpen}
          aria-controls="site-nav-drawer"
        >
          {menuOpen ? <X size={20} strokeWidth={2.4} /> : <Menu size={20} strokeWidth={2.4} />}
        </button>
      </nav>

      <div
        id="site-nav-drawer"
        className={`site-nav-drawer${menuOpen ? ' site-nav-drawer--open' : ''}`}
      >
        <div className="site-nav-drawer-panel">
          <div className="site-nav-drawer-links">
            {SITE_NAV_LINKS.map(link => (
              <a
                key={link.href}
                href={link.href}
                className={`site-nav-drawer-link${path === link.href ? ' site-nav-drawer-link--active' : ''}`}
                onClick={closeMenu}
              >
                {link.label}
              </a>
            ))}
            <div className="site-nav-drawer-secondary"><span>Mais</span>{SITE_NAV_SECONDARY_LINKS.map(link => (
              <a key={link.href} href={link.href} className="site-nav-drawer-link site-nav-drawer-link--secondary" onClick={closeMenu}>{link.label}</a>
            ))}</div>
          </div>

          <a
            href={SITE_NAV_CTA.href}
            className={`site-nav-drawer-cta${path === SITE_NAV_CTA.href ? ' site-nav-drawer-cta--active' : ''}`}
            onClick={closeMenu}
          >
            {SITE_NAV_CTA.label}
          </a>

          {drawerFooter && <div className="site-nav-drawer-footer">{drawerFooter}</div>}
        </div>
      </div>
    </>
  )
}
