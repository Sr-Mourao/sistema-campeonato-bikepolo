import type { CSSProperties, ReactNode } from 'react'
import TeamLogo from '../equipes/TeamLogo'
import type { JogoPublico } from '../../services/torneioPublico'
import { jogoTemPlacar, statusPartida } from './tournamentOverlayData'

export function Crest({ nome, logo, className = '' }: { nome: string; logo?: string | null; className?: string }) {
  return <span className={`tg-crest ${className}`}><TeamLogo nome={nome} logo={logo ?? undefined} className="tg-crest-img" /></span>
}

export function BroadcastTitle({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <header className="tg-title">
      <span className="tg-title-mark"><img src="/identidade/logo.svg" alt="" /></span>
      <span className="tg-title-copy"><small>{eyebrow}</small><strong>{title}</strong>{subtitle && <i>{subtitle}</i>}</span>
    </header>
  )
}

export function BroadcastFrame({ children, className = '', intro = false }: { children: ReactNode; className?: string; intro?: boolean }) {
  return (
    <main className={`tg-overlay ${className}`} data-intro={intro ? 'ativa' : undefined}>
      <div className="tg-top-rule" aria-hidden="true" />
      <div className="tg-corner-hatch" aria-hidden="true" />
      {children}
    </main>
  )
}

export function MiniMatch({ jogo, order = 0 }: { jogo: JogoPublico; order?: number }) {
  if (jogo.is_bye) {
    const nome = jogo.time_a_nome ?? jogo.time_b_nome ?? 'A definir'
    const logo = jogo.time_a_nome ? jogo.time_a_logo : jogo.time_b_logo
    return <div className="tg-mini tg-mini--bye" style={{ '--order': order } as CSSProperties}><span>Folga</span><Crest nome={nome} logo={logo} /><b>{nome}</b></div>
  }
  const placar = jogoTemPlacar(jogo)
  return (
    <div className="tg-mini" data-status={jogo.status} style={{ '--order': order } as CSSProperties}>
      <div className="tg-mini-team"><Crest nome={jogo.time_a_nome ?? 'A definir'} logo={jogo.time_a_logo} /><b>{jogo.time_a_nome ?? 'A definir'}</b></div>
      <div className="tg-mini-score">{placar ? <><strong>{jogo.placar_a}</strong><i>×</i><strong>{jogo.placar_b}</strong></> : <i>×</i>}</div>
      <div className="tg-mini-team tg-mini-team--b"><b>{jogo.time_b_nome ?? 'A definir'}</b><Crest nome={jogo.time_b_nome ?? 'A definir'} logo={jogo.time_b_logo} /></div>
      {jogo.status === 'em_andamento' && <span className="tg-live-dot" />}
    </div>
  )
}

function origemCurta(origem: string | null, fallback: string) {
  if (!origem) return fallback
  try {
    const parsed = JSON.parse(origem) as { codigo?: string; resultado?: string }
    if (parsed.codigo) return `${parsed.resultado === 'perdedor' ? 'Perdedor' : 'Vencedor'} ${parsed.codigo.replace('REP-', '')}`
  } catch { /* backend mantém a origem; fallback visual seguro */ }
  return fallback
}

export function BracketMatch({ jogo, codigo, placeholders, compact = false }: { jogo?: JogoPublico; codigo: string; placeholders: [string, string]; compact?: boolean }) {
  const nomeA = jogo?.time_a_nome ?? origemCurta(jogo?.time_a_origem ?? null, placeholders[0])
  const nomeB = jogo?.time_b_nome ?? origemCurta(jogo?.time_b_origem ?? null, placeholders[1])
  const definido = jogo?.time_a_id != null && jogo.time_b_id != null
  const finalizado = jogo?.status === 'encerrado'
  const venceuA = finalizado && jogo?.vencedor_time_id === jogo?.time_a_id
  const venceuB = finalizado && jogo?.vencedor_time_id === jogo?.time_b_id
  const temPlacar = jogo ? jogoTemPlacar(jogo) : false
  return (
    <article className={`tg-bracket-match ${compact ? 'tg-bracket-match--compact' : ''}`} data-status={jogo?.status ?? 'indefinido'} data-defined={definido ? 'sim' : 'nao'}>
      <header><b>{codigo.replace('REP-', '')}</b><span>{jogo ? statusPartida(jogo.status) : 'A definir'}</span></header>
      <div className={venceuA ? 'is-winner' : finalizado ? 'is-loser' : ''}><Crest nome={nomeA} logo={jogo?.time_a_logo} /><strong>{nomeA}</strong><em>{temPlacar ? jogo?.placar_a : '—'}</em></div>
      <div className={venceuB ? 'is-winner' : finalizado ? 'is-loser' : ''}><Crest nome={nomeB} logo={jogo?.time_b_logo} /><strong>{nomeB}</strong><em>{temPlacar ? jogo?.placar_b : '—'}</em></div>
    </article>
  )
}
