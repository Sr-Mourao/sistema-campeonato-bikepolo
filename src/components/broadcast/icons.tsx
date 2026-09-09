// Ícones SVG simples pra substituir emoji (nunca renderiza igual entre SO/browser — ruim
// pra broadcast). Sem biblioteca gráfica: só o essencial (gol, falta, "ao vivo").
// `currentColor` por padrão pra herdar cor do contexto onde forem usados.

export function IconGol({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 6.5l3.3 2.4-1.3 3.9h-4l-1.3-3.9L12 6.5zM12 6.5V3.2M15.3 8.9l3-1.9M13.6 12.8l1.9 3.6M9 12.8l-1.9 3.6M8.7 8.9l-3-1.9"
        stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  )
}

/** Cartão de falta — substitui o quadrado genérico antigo por um cartão real, discreto. */
export function IconFalta({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="6" y="3" width="12" height="18" rx="2.2" transform="rotate(-8 12 12)" fill="currentColor" />
    </svg>
  )
}

export function IconLive({ size = 10, className }: { size?: number; className?: string }) {
  return <span className={className} style={{ width: size, height: size, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} aria-hidden="true" />
}
