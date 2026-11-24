import { useState, useEffect } from 'react'
import { torneioPublico, type JogoPublico, type StandingRowPublico } from '../../services/torneioPublico'
import { ResponsiveBracket } from '../../components/torneio/BracketView'
import { porCodigo } from '../../components/torneio/bracketHelpers'
import { WIN_COLS, LOS_COLS, DOUBLE_PLACEHOLDERS, MTNB_WIN_COLS, MTNB_LOS_COLS, MTNB_DOUBLE_PLACEHOLDERS, type BracketColDef } from '../../components/torneio/bracketDefs'
import { useTournamentCategory } from '../../contexts/TournamentContext'

type Secao = 'winners' | 'losers' | 'final'

/**
 * Double Elimination (seção 11 do brief de área pública) — Winners/Losers/Grande Final
 * separados claramente, com dependências explícitas mesmo antes dos times existirem
 * (DOUBLE_PLACEHOLDERS). Mobile (seção 12): segmento [WINNERS][LOSERS][FINAL] em vez de
 * obrigar a rolar uma chave inteira espremida; desktop mostra as três seções empilhadas,
 * cada uma já com sua própria chave conectada completa (ResponsiveBracket).
 *
 * QC/QD e o reseeding dos repescados: o lado "repescado" de QC/QD (sempre o 2º slot, por
 * construção — ver seedsRepescados() em bracket.php) é anotado com a posição original na
 * Primeira Fase só como exibição de um fato já decidido pelo backend, nunca recalculado
 * aqui — a chave não implica que vencer REP-R4 valha mais que vencer REP-R5.
 */
export default function DoubleElimination() {
  const categoria = useTournamentCategory()
  const [double, setDouble] = useState<JogoPublico[] | null>(null)
  const [standings, setStandings] = useState<StandingRowPublico[] | null>(null)
  const [secao, setSecao] = useState<Secao>('winners')
  useEffect(() => { torneioPublico.chaves(categoria).then(d => setDouble(d.double)) }, [categoria])
  useEffect(() => { torneioPublico.classificacao(categoria).then(d => setStandings(d.classificacao)) }, [categoria])
  const mtnb = false
  const winCols = mtnb ? MTNB_WIN_COLS : WIN_COLS
  const losCols = mtnb ? MTNB_LOS_COLS : LOS_COLS
  const placeholders = mtnb ? MTNB_DOUBLE_PLACEHOLDERS : DOUBLE_PLACEHOLDERS

  const gf2 = double ? porCodigo(double, 'GF2') : undefined
  const finalCols: BracketColDef[] = gf2 ? [['Grande Final', ['GF', 'GF2']]] : [['Grande Final', ['GF']]]

  const posicaoPorTime = new Map((standings ?? []).map(r => [r.time_id, r.posicao]))
  const qc = !mtnb && double ? porCodigo(double, 'QC') : undefined
  const qd = !mtnb && double ? porCodigo(double, 'QD') : undefined
  const subtitulosWinners: Record<string, [string | null, string | null]> = {}
  if (qc?.time_b_id != null && posicaoPorTime.has(qc.time_b_id)) {
    subtitulosWinners['QC'] = [null, `Melhor repescado · ${posicaoPorTime.get(qc.time_b_id)}º na Primeira Fase`]
  }
  if (qd?.time_b_id != null && posicaoPorTime.has(qd.time_b_id)) {
    subtitulosWinners['QD'] = [null, `Segundo repescado · ${posicaoPorTime.get(qd.time_b_id)}º na Primeira Fase`]
  }

  return (
    <section className="bracket-page bracket-page--double">
      <header className="bracket-hero">
        <div className="bracket-hero-kicker">A corrida pelo título</div>
        <h3>Double Elimination</h3>
        <p>{mtnb ? 'Cinco times, entrada tardia do 1º colocado e duas vidas.' : 'Oito times, duas vidas e um caminho até a Grande Final.'}</p>
        <div className="bracket-hero-facts">
          <span>{mtnb ? '5 times' : '8 times'}</span>
          <span>Winners + Losers</span>
          <span>2ª derrota elimina</span>
        </div>
      </header>

      <p className="trp-explicacao bracket-double-intro">
        A primeira derrota leva o time da Winners para a Losers. Quem perder novamente está
        eliminado. Se o representante da Losers vencer a Grande Final, a GF2 decide o campeão.
      </p>

      {!mtnb && <details className="de-reseed-info">
        <summary>Como os repescados entram na chave (QC/QD)</summary>
        <p>
          Entre os dois classificados pela Repescagem, o time que terminou melhor colocado
          na Primeira Fase enfrenta o 2º colocado; o outro enfrenta o 1º colocado. Não são
          considerados os placares, saldo de gols, número de partidas ou qualquer outro
          indicador da campanha realizada dentro da Repescagem para essa definição.
        </p>
      </details>}
      {mtnb && <p className="trp-explicacao">O 5º enfrenta o 4º no play-in; o 1º aguarda esse vencedor. Em paralelo, 2º enfrenta 3º.</p>}

      <div className="de-mobile-tabs">
        <button className={`de-mobile-tab ${secao === 'winners' ? 'de-mobile-tab--active' : ''}`} onClick={() => setSecao('winners')}>WINNERS</button>
        <button className={`de-mobile-tab ${secao === 'losers' ? 'de-mobile-tab--active' : ''}`} onClick={() => setSecao('losers')}>LOSERS</button>
        <button className={`de-mobile-tab ${secao === 'final' ? 'de-mobile-tab--active' : ''}`} onClick={() => setSecao('final')}>FINAL</button>
      </div>

      {double === null ? (
        <p className="trp-hint">Carregando…</p>
      ) : (
        <>
          <div className={`de-secao de-secao-panel de-secao-panel--winners ${secao === 'winners' ? 'de-secao--ativa' : ''}`}>
            <div className="de-secao-head"><div><span>Chave A</span><h4>Winners</h4></div><p>Invictos seguem por aqui</p></div>
            <ResponsiveBracket cols={winCols} lista={double} placeholders={placeholders} subtitulos={subtitulosWinners} showcase />
          </div>
          <div className={`de-secao de-secao-panel de-secao-panel--losers ${secao === 'losers' ? 'de-secao--ativa' : ''}`}>
            <div className="de-secao-head"><div><span>Chave B</span><h4>Losers</h4></div><p>Uma derrota separa cada time da eliminação</p></div>
            <ResponsiveBracket cols={losCols} lista={double} placeholders={placeholders} showcase />
          </div>
          <div className={`de-secao de-secao-panel de-secao-panel--final ${secao === 'final' ? 'de-secao--ativa' : ''}`}>
            <div className="de-secao-head"><div><span>Decisão</span><h4>Grande Final</h4></div><p>{gf2 ? 'A GF2 decide o campeão' : 'Winners encontra Losers'}</p></div>
            <ResponsiveBracket cols={finalCols} lista={double} placeholders={placeholders} showcase />
          </div>
        </>
      )}
    </section>
  )
}
