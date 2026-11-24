import type { ReactNode } from 'react'

export default function ProjectionFrame({ children, variant, replay, onReplay }: { children: ReactNode; variant: string; replay: number; onReplay: () => void }) {
  return <main className={`prj-frame prj-frame--${variant}`}>
    <div className="prj-atmosphere" aria-hidden="true"><i /><i /><i /><i /><i /></div>
    <div className="prj-brand"><img src="/identidade/logo.svg" alt="2° Pior Campeonato de Bici Polo" /><span>Curitiba 2026</span></div>
    <div className="prj-sequence" data-replay={replay} key={replay}>{children}</div>
    <button className="prj-replay" type="button" onClick={onReplay} title="Reiniciar animação (R)" aria-label="Reiniciar animação">↻</button>
  </main>
}
