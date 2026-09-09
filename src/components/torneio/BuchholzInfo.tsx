import type { BuchholzAdversario, StandingRowPublico } from '../../services/torneioPublico'
import { CRITERIO_CURTO, CRITERIO_EXPLICACAO, valorCriterioFormatado } from './criteriosMeta'
import './buchholzInfo.css'

// Popovers por clique/toque (nunca hover — mobile não pode depender de hover).
// <details>/<summary> nativo cobre toque e teclado de graça.

/** ⓘ do cabeçalho da coluna Buchholz — explicação fixa do que é o critério (não confundir
 * com o indicador de desempate por linha, que tem outra função: ver TiebreakTag). */
export function BuchholzHeaderInfo() {
  return (
    <details className="bzi-pop bzi-pop--header">
      <summary>BUCHHOLZ <span className="bzi-icon">ⓘ</span></summary>
      <div className="bzi-pop-body" onClick={e => e.stopPropagation()}>
        <p>Buchholz mede a força dos adversários enfrentados.</p>
        <p>É calculado somando os pontos conquistados pelos adversários daquele time.</p>
        <p>Quanto maior, mais forte foi o caminho do time.</p>
      </div>
    </details>
  )
}

/** Valor do Buchholz — clicável pra abrir a composição real (adversário + pontos), vinda
 * direto de `buchholz_detalhe` (calcularClassificacao(), lib.php). Nunca recalculado aqui. */
export function BuchholzValor({ valor, detalhe }: { valor: number; detalhe: BuchholzAdversario[] }) {
  if (detalhe.length === 0) return <span className="bzi-valor-simples">{valor}</span>
  const soma = detalhe.map(d => d.pontos).join(' + ')
  return (
    <details className="bzi-pop bzi-pop--valor">
      <summary><b>{valor}</b></summary>
      <div className="bzi-pop-body" onClick={e => e.stopPropagation()}>
        <div className="bzi-pop-title">Adversários enfrentados</div>
        <ul className="bzi-adv-lista">
          {detalhe.map(d => (
            <li key={d.time_id}><span>{d.nome}</span><span>{d.pontos} pts</span></li>
          ))}
        </ul>
        <div className="bzi-soma">{soma} = {valor}</div>
      </div>
    </details>
  )
}

/**
 * Indicador DISCRETO de desempate (ex.: "BH", "FP", "SG", "CD") — genérico pra QUALQUER
 * critério configurado, nunca um caso especial de Buchholz. `criterio` vem pronto do
 * backend (`row.decisao`, decompoeDecisao() em lib.php): já é a chave do critério que
 * efetivamente separou `row` (que fica À FRENTE) de `abaixo` (a próxima linha) — o
 * componente só formata/explica, nunca decide se houve desempate nem qual critério foi.
 * Retorna null quando `criterio` é null (a maioria das linhas — só aparece quando um
 * empate real foi quebrado por um critério que não o primeiro da ordem configurada).
 */
export function TiebreakTag({ criterio, label, row, abaixo }: {
  criterio: string | null
  /** Rótulo completo do critério (de `resumo.criterios`, nunca hardcoded aqui). */
  label: string
  row: StandingRowPublico
  abaixo: StandingRowPublico
}) {
  if (!criterio) return null
  const curto = CRITERIO_CURTO[criterio] ?? criterio
  const explicacao = CRITERIO_EXPLICACAO[criterio]
  const valorRow = valorCriterioFormatado(criterio, row)
  const valorAbaixo = valorCriterioFormatado(criterio, abaixo)

  return (
    <details className="bzi-pop bzi-pop--tiebreak">
      <summary aria-label={`Desempate: ${label}`}>{curto}</summary>
      <div className="bzi-pop-body bzi-pop-body--tiebreak" onClick={e => e.stopPropagation()}>
        <div className="bzi-pop-title">Desempate: {label}</div>
        {valorRow !== null && valorAbaixo !== null && (
          <div className="bzi-adv-lista" style={{ marginBottom: 8 }}>
            <div className="bzi-comparativo"><span>{row.nome}</span><b>{valorRow}</b></div>
            <div className="bzi-comparativo"><span>{abaixo.nome}</span><b>{valorAbaixo}</b></div>
          </div>
        )}
        {explicacao && <p>{explicacao}</p>}
        {criterio === 'buchholz' && row.buchholz_detalhe.length > 0 && (
          <>
            <div className="bzi-pop-title" style={{ marginTop: 10 }}>Adversários enfrentados ({row.nome})</div>
            <ul className="bzi-adv-lista">
              {row.buchholz_detalhe.map(d => (
                <li key={d.time_id}><span>{d.nome}</span><span>{d.pontos} pts</span></li>
              ))}
            </ul>
            <div className="bzi-soma">{row.buchholz_detalhe.map(d => d.pontos).join(' + ')} = {row.buchholz}</div>
          </>
        )}
      </div>
    </details>
  )
}
