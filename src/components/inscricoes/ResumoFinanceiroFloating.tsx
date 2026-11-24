import { calcTotal, type PacoteAlim } from '../../inscricoes.config'

interface CalcInput {
  misto: boolean
  acaoPreta: boolean; acaoParda: boolean
  acaoIndigena: boolean; acaoPrimeiroTorneio: boolean
  alimentacaoDia5: PacoteAlim; alimentacaoDia6: PacoteAlim; alimentacaoDia7: PacoteAlim
  alojamento: boolean
  diasAlojamento: number[]
  acoesAtivas?: boolean
}

interface Props { state: CalcInput }

function fmt(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export default function ResumoFinanceiroFloating({ state }: Props) {
  const {
    valorMistoBase,
    descontoValor, descontoTipo,
    temPPI, temPrimeiroTorneio,
    valorAlim, diasAlim, valorAloj, diasAloj, total,
  } = calcTotal(state)

  const nada = total === 0

  const DESCONTO_LABEL: Record<string, string> = {
    ppi:             'Isenção ações afirmativas',
    primeiroTorneio: 'Desconto primeiro torneio',
  }

  return (
    <aside className="ins-float">
      <p className="ins-float-title">Resumo financeiro</p>

      {nada ? (
        <p className="ins-float-empty">Selecione uma categoria para ver o valor</p>
      ) : (
        <>
          {state.misto && (
            <div className="ins-float-row">
              <span className="ins-float-row-label">Brasileiro Misto</span>
              <span className="ins-float-row-val">{fmt(valorMistoBase)}</span>
            </div>
          )}

          {descontoValor > 0 && descontoTipo && (
            <div className="ins-float-row ins-float-row--discount">
              <span className="ins-float-row-label">{DESCONTO_LABEL[descontoTipo]}</span>
              <span className="ins-float-row-val">− {fmt(descontoValor)}</span>
            </div>
          )}

          {valorAlim > 0 && (
            <div className="ins-float-row">
              <span className="ins-float-row-label">Alimentação ({diasAlim}d)</span>
              <span className="ins-float-row-val">{fmt(valorAlim)}</span>
            </div>
          )}

          {valorAloj > 0 && (
            <div className="ins-float-row">
              <span className="ins-float-row-label">Alojamento ({diasAloj}d)</span>
              <span className="ins-float-row-val">{fmt(valorAloj)}</span>
            </div>
          )}

          <div className="ins-float-divider" />

          <p className="ins-float-total-label">Total</p>
          <p className="ins-float-total-val">{fmt(total)}</p>

          {temPPI && (
            <p className="ins-float-discount-tag">💛 Isenção ações afirmativas</p>
          )}
          {temPrimeiroTorneio && !temPPI && (
            <p className="ins-float-discount-tag">🌟 Desconto primeiro torneio</p>
          )}
        </>
      )}
    </aside>
  )
}
