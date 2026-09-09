import { useState } from 'react'
import { Banknote, CreditCard, CheckCircle2, Clock } from 'lucide-react'
import type { Pagamento } from './AthleteDashboard'
import PaymentCheckout from './PaymentCheckout'

interface Categoria { categoria: string; valor: number }

interface Props {
  valorEsportivo: number
  categorias: Categoria[]
  acoesAfirmativas: boolean
  pagamento: Pagamento | null        // inscricao ou completo
  alimentacao: { dia: number; valor: number }[]
  alojamento:  { dia: number; valor: number }[]
  token: string
  onPagamentoUpdated: (p: Pagamento) => void
}

function fmt(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
}

export default function FinancialSummary({
  valorEsportivo, categorias, acoesAfirmativas,
  pagamento, alimentacao, alojamento,
  token, onPagamentoUpdated,
}: Props) {
  const [checkout, setCheckout] = useState(false)

  // Monta itens para o checkout quando não há itens_json (inscrição legada)
  function itensParaCheckout(): { descricao: string; valor: number }[] {
    if (pagamento?.itens) return pagamento.itens
    const items: { descricao: string; valor: number }[] = categorias.map(c => ({
      descricao: c.categoria === 'misto' ? 'Brasileiro Misto' : 'Brasileiro MTNB',
      valor: c.valor,
    }))
    return items
  }

  const isCompleto = pagamento?.tipo === 'completo'
  const valorAlim  = alimentacao.reduce((s, a) => s + a.valor, 0)
  const valorAloj  = alojamento.reduce((s, a)  => s + a.valor, 0)

  const titulo = isCompleto ? 'Inscrição + Serviços' : 'Inscrição Esportiva'
  const valor  = pagamento?.valor ?? valorEsportivo

  const statusCls =
    pagamento?.status === 'pago'      ? 'atl-status--pago' :
    pagamento?.status === 'cancelado' ? 'atl-status--cancelado' :
    'atl-status--aguardando'

  const statusLabel =
    pagamento?.status === 'pago'      ? 'Pago' :
    pagamento?.status === 'cancelado' ? 'Pagamento não aprovado' :
    'Aguardando pagamento'

  return (
    <>
      <div className="atl-card atl-card--financial" style={{ animationDelay: '300ms' }}>
        <div className="atl-card-header">
          <div className="atl-card-icon"><Banknote size={16} /></div>
          <div className="atl-card-title">Pagamento da Inscrição</div>
        </div>

        {/* Breakdown de valor */}
        {categorias.map(c => (
          <div key={c.categoria} className="atl-fin-row">
            <span>{c.categoria === 'misto' ? 'Brasileiro Misto' : 'Brasileiro MTNB'}</span>
            <span>{fmt(c.valor)}</span>
          </div>
        ))}
        {acoesAfirmativas && (
          <div className="atl-fin-row atl-fin-row--discount">
            <span>Política afirmativa</span>
            <span></span>
          </div>
        )}
        {isCompleto && valorAlim > 0 && (
          <div className="atl-fin-row">
            <span>Alimentação ({alimentacao.length}d)</span>
            <span>{fmt(valorAlim)}</span>
          </div>
        )}
        {isCompleto && valorAloj > 0 && (
          <div className="atl-fin-row">
            <span>Alojamento ({alojamento.length}d)</span>
            <span>{fmt(valorAloj)}</span>
          </div>
        )}

        {/* Total */}
        <div className="atl-fin-payment-row" style={{ marginTop: 8 }}>
          <div className="atl-fin-payment-info">
            <span className="atl-fin-payment-label">{titulo}</span>
            <span className="atl-fin-payment-val">{fmt(valor)}</span>
          </div>

          <div className="atl-fin-payment-actions">
            <span className={`atl-status ${statusCls}`}>
              {pagamento?.status === 'pago'
                ? <><CheckCircle2 size={10} /> Pago</>
                : <><Clock size={10} /> {statusLabel}</>
              }
            </span>

            {(pagamento?.status === 'pendente' || pagamento?.status === 'cancelado') && (
              <button className="atl-fin-pay-btn" onClick={() => setCheckout(true)}>
                <CreditCard size={13} /> {pagamento?.status === 'cancelado' ? 'Tentar pagar novamente' : 'Pagar agora'}
              </button>
            )}
          </div>
        </div>

      </div>

      {checkout && pagamento && (
        <PaymentCheckout
          pagamento={{ ...pagamento, itens: itensParaCheckout() }}
          token={token}
          onPaid={updated => { onPagamentoUpdated(updated); setCheckout(false) }}
          onClose={() => setCheckout(false)}
          onPaymentCancelled={() => {
            onPagamentoUpdated({ ...pagamento, status: 'cancelado' })
            setCheckout(false)
          }}
        />
      )}
    </>
  )
}
