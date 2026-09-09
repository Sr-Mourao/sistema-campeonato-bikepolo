import { useState } from 'react'
import { origemLabel, porCodigo, type BracketJogo, type BracketColDef } from './bracketHelpers'
import './bracketView.css'

// Componente compartilhado de chave (Repescagem / Double Elimination) — usado tanto
// pelo admin (com onSelect pra abrir a súmula) quanto pela página pública (somente
// leitura, sem onSelect). Mesmo dado, mesma lógica; só o layout muda com a tela
// (coluna única com abas no celular, chave completa conectada no desktop).
// Tipos e helpers puros ficam em ./bracketHelpers (import de lá, não daqui).

interface MatchCardProps {
  jogo?: BracketJogo
  onSelect?: (jogo: BracketJogo) => void
  badge?: string | null
  /** Descrição conceitual do confronto (ex.: ["4º", "5º"] ou ["Vencedor QA", "Vencedor QB"])
   * mostrada quando a partida ainda não existe no banco — transparência de chave antes dos
   * times estarem definidos (seções 10/11 do brief de área pública). Nunca usada se `jogo`
   * já existir: dado real sempre tem prioridade sobre o rótulo conceitual. */
  placeholder?: [string, string] | [string]
  /** Código do slot (ex. "REP-R1") — usado como rótulo só quando `jogo` ainda não existe,
   * pra manter a mesma referência visual (`trnb-match-code`) do card real. */
  codigo?: string
  /** Legenda discreta sob cada lado JÁ RESOLVIDO (ex. "Melhor repescado · 9º na Primeira
   * Fase") — usada pro reseeding dos repescados na Double (QC/QD), nunca pra sugerir
   * lógica de jogo nova; é só exposição de um fato já decidido pelo backend. */
  subtitulos?: [string | null, string | null]
  showcase?: boolean
}

function statusLabel(status: string): string {
  if (status === 'em_andamento') return 'Ao vivo'
  if (status === 'encerrado') return 'Encerrado'
  if (status === 'atrasado') return 'Atrasado'
  return 'A seguir'
}

export function MatchCard({ jogo, onSelect, badge, placeholder, codigo, subtitulos, showcase = false }: MatchCardProps) {
  if (!jogo) {
    if (!placeholder) return <div className="trnb-match trnb-match--empty">—</div>
    return (
      <div className="trnb-match trnb-match--placeholder">
        {codigo && <div className="trnb-match-code">{codigo}</div>}
        {placeholder.length === 2 ? (
          <>
            <div className="trnb-team trnb-team--tbd">{placeholder[0]}</div>
            <div className="trnb-team trnb-team--tbd">{placeholder[1]}</div>
          </>
        ) : (
          <div className="trnb-team trnb-team--tbd">{placeholder[0]}</div>
        )}
      </div>
    )
  }

  const pronto = jogo.time_a_nome !== null && jogo.time_b_nome !== null
  const clicavel = !!onSelect && pronto
  const encerrado = jogo.status === 'encerrado'

  return (
    <div className={`trnb-match trnb-match--${jogo.status} ${clicavel ? 'trnb-match--clicavel' : ''}`} onClick={() => clicavel && onSelect!(jogo)}>
      <div className="trnb-match-head">
        <div className="trnb-match-code">{jogo.codigo}</div>
        {showcase && <div className="trnb-match-status">{statusLabel(jogo.status)}</div>}
      </div>
      <TeamRow nome={jogo.time_a_nome} origem={jogo.time_a_origem} placar={jogo.placar_a} venceu={encerrado && jogo.vencedor_time_id != null && jogo.vencedor_time_id === jogo.time_a_id} subtitulo={subtitulos?.[0]} />
      <TeamRow nome={jogo.time_b_nome} origem={jogo.time_b_origem} placar={jogo.placar_b} venceu={encerrado && jogo.vencedor_time_id != null && jogo.vencedor_time_id === jogo.time_b_id} subtitulo={subtitulos?.[1]} />
      {badge && <div className="trnb-badge">{badge}</div>}
    </div>
  )
}

function TeamRow({ nome, origem, placar, venceu, subtitulo }: { nome: string | null; origem?: string | null; placar: number | null; venceu: boolean; subtitulo?: string | null }) {
  if (nome === null) {
    const hint = origemLabel(origem)
    return <div className="trnb-team trnb-team--tbd">{hint ?? 'a definir'}</div>
  }
  return (
    <div className="trnb-team-block">
      <div className={`trnb-team ${venceu ? 'trnb-team--winner' : ''}`}>
        <span>{nome}</span>
        <span className="trnb-team-placar">{placar ?? ''}</span>
      </div>
      {subtitulo && <div className="trnb-team-subtitulo">{subtitulo}</div>}
    </div>
  )
}

interface ResponsiveBracketProps {
  cols: BracketColDef[]
  lista: BracketJogo[]
  onSelect?: (jogo: BracketJogo) => void
  badges?: Record<string, string>
  /** Rótulos conceituais por código (ver bracketDefs.ts) — só usados pros códigos que ainda
   * não têm uma partida em `lista`. */
  placeholders?: Record<string, [string, string] | [string]>
  /** Legendas discretas por código (ver MatchCardProps.subtitulos) — só aplicadas quando a
   * partida já existe em `lista`. */
  subtitulos?: Record<string, [string | null, string | null]>
  /** Acabamento visual das chaves públicas; o admin mantém o tratamento compacto original. */
  showcase?: boolean
}

/**
 * Desktop: todas as colunas lado a lado, conectadas visualmente.
 * Mobile: uma coluna por vez, com abas + anterior/próxima — nunca uma bracket
 * gigante pra arrastar lateralmente.
 */
export function ResponsiveBracket({ cols, lista, onSelect, badges, placeholders, subtitulos, showcase = false }: ResponsiveBracketProps) {
  const [colAtiva, setColAtiva] = useState(0)

  return (
    <div className={`trnb-responsive ${showcase ? 'trnb-responsive--showcase' : ''}`}>
      <div className="trnb-desktop">
        {cols.map(([titulo, codigos]) => (
          <div className="trnb-col" key={titulo}>
            <div className="trnb-col-titulo">{titulo}</div>
            {codigos.map(c => <MatchCard key={c} jogo={porCodigo(lista, c)} onSelect={onSelect} badge={badges?.[c]} placeholder={placeholders?.[c]} codigo={c} subtitulos={subtitulos?.[c]} showcase={showcase} />)}
          </div>
        ))}
      </div>

      <div className="trnb-mobile">
        <div className="trnb-mobile-tabs">
          {cols.map(([titulo], i) => (
            <button key={titulo} className={`trnb-mobile-tab ${i === colAtiva ? 'trnb-mobile-tab--active' : ''}`} onClick={() => setColAtiva(i)}>
              {titulo}
            </button>
          ))}
        </div>
        <div className="trnb-col">
          {cols[colAtiva]?.[1].map(c => <MatchCard key={c} jogo={porCodigo(lista, c)} onSelect={onSelect} badge={badges?.[c]} placeholder={placeholders?.[c]} codigo={c} subtitulos={subtitulos?.[c]} showcase={showcase} />)}
        </div>
        <div className="trnb-mobile-nav">
          <button className="trnb-nav-btn" disabled={colAtiva === 0} onClick={() => setColAtiva(i => Math.max(0, i - 1))}>&larr; Anterior</button>
          <span className="trnb-mobile-progress">{colAtiva + 1} / {cols.length}</span>
          <button className="trnb-nav-btn" disabled={colAtiva === cols.length - 1} onClick={() => setColAtiva(i => Math.min(cols.length - 1, i + 1))}>Próxima &rarr;</button>
        </div>
      </div>
    </div>
  )
}
