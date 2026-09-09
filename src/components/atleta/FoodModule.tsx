import { useState } from 'react'
import { UtensilsCrossed, CreditCard, CheckCircle2, Clock, LockKeyhole } from 'lucide-react'
import { CONFIG } from '../../inscricoes.config'
import type { Pagamento } from './AthleteDashboard'
import PaymentCheckout from './PaymentCheckout'
import RestricoesAlimentaresField from '../shared/RestricoesAlimentaresField'

interface DiaAlim { dia: number; valor: number; pacote?: string }

interface Props {
  inscricaoId: number
  inicial: DiaAlim[]
  restricaoTipoInicial: string | null
  restricaoDescricaoInicial: string
  prazoCerrado: boolean
  prazoLabel: string
  token: string
  pagamento: Pagamento | null
  pagoViaCompleto: boolean
  aberto: boolean
  onUpdate: (nova: DiaAlim[]) => void
  onPagamentoAdded: (p: Pagamento) => void
  onPagamentoUpdated: (p: Pagamento) => void
}

const RESTRICAO_LABELS: Record<string, string> = {
  vegetariano: 'Vegetariano',
  vegano:      'Vegano',
  lactose:     'Intolerância à lactose',
  outra:       'Outra restrição',
  alergia:     'Alergia alimentar severa',
}

const DIAS = [
  { key: 5, label: '5', mes: 'SET', nome: 'Sábado'  },
  { key: 6, label: '6', mes: 'SET', nome: 'Domingo' },
  { key: 7, label: '7', mes: 'SET', nome: 'Segunda' },
]

function fmt(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
}

type PacoteAlim = 'completo' | 'almoco'

const PACOTES_ATL: { key: PacoteAlim; label: string; desc: string; valor: number }[] = [
  { key: 'completo', label: 'Pacote completo', desc: 'café, almoço e lanche 🌱', valor: CONFIG.VALOR_ALIMENTACAO_COMPLETO },
  { key: 'almoco',   label: 'Apenas almoço',   desc: 'só o almoço',              valor: CONFIG.VALOR_ALIMENTACAO_ALMOCO },
]

const PACOTE_LABEL: Record<string, string> = {
  completo: 'Pacote completo',
  almoco:   'Apenas almoço',
}

export default function FoodModule({
  inicial, restricaoTipoInicial, restricaoDescricaoInicial,
  prazoCerrado, prazoLabel, token,
  pagamento, pagoViaCompleto, aberto,
  onUpdate, onPagamentoAdded, onPagamentoUpdated,
}: Props) {
  const [selecionados, setSelecionados] = useState<Map<number, PacoteAlim>>(
    () => new Map(inicial.map(a => [a.dia, (a.pacote === 'almoco' ? 'almoco' : 'completo') as PacoteAlim]))
  )
  const [restricaoTipo, setRestricaoTipo]           = useState<string | null>(restricaoTipoInicial)
  const [restricaoDescricao, setRestricaoDescricao] = useState(restricaoDescricaoInicial)
  const [editando, setEditando]    = useState(false)
  const [salvando, setSalvando]    = useState(false)
  const [gerando,  setGerando]     = useState(false)
  const [erro, setErro]            = useState('')
  const [checkout, setCheckout]    = useState(false)

  // Estado do pagamento deste bloco
  const isPago      = pagoViaCompleto || pagamento?.status === 'pago'
  const isPendente  = !pagoViaCompleto && pagamento?.status === 'pendente'
  const podeEditar  = !isPago && !prazoCerrado
  const temDias     = inicial.length > 0
  const podeSalvar  = podeEditar && aberto
  const total       = Array.from(selecionados.values()).reduce((s, p) => s + (p === 'almoco' ? CONFIG.VALOR_ALIMENTACAO_ALMOCO : CONFIG.VALOR_ALIMENTACAO_COMPLETO), 0)

  function setPacote(dia: number, pacote: PacoteAlim | null) {
    setSelecionados(prev => {
      const next = new Map(prev)
      if (pacote === null) next.delete(dia)
      else next.set(dia, pacote)
      return next
    })
  }

  async function salvar() {
    setSalvando(true); setErro('')
    try {
      const diasPayload = Array.from(selecionados.entries()).map(([dia, pacote]) => ({ dia, pacote }))
      const res = await fetch('/api/servicos/alimentacao.php', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-Token': token },
        body:    JSON.stringify({
          dias: diasPayload,
          restricaoTipo,
          restricaoDescricao: restricaoDescricao.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error || 'Erro ao salvar'); return }
      if (data.restricao_alimentar !== undefined) {
        setRestricaoTipo(data.restricao_alimentar?.tipo ?? null)
        setRestricaoDescricao(data.restricao_alimentar?.descricao ?? '')
      }
      if (data.pagamento_cancelado) onPagamentoUpdated(data.pagamento_cancelado as Pagamento)
      onUpdate(data.alimentacao)
      setSelecionados(new Map((data.alimentacao as DiaAlim[]).map(a => [a.dia, (a.pacote === 'almoco' ? 'almoco' : 'completo') as PacoteAlim])))
      setEditando(false)
    } catch { setErro('Erro de conexão') }
    finally { setSalvando(false) }
  }

  async function remover() {
    if (!confirm('Remover toda a alimentação?')) return
    setSalvando(true)
    try {
      const res = await fetch('/api/servicos/alimentacao.php', {
        method: 'DELETE', headers: { 'X-Session-Token': token },
      })
      if (res.ok) { setSelecionados(new Map()); onUpdate([]); setEditando(false) }
    } catch { setErro('Erro de conexão') }
    finally { setSalvando(false) }
  }

  async function gerarPagamento() {
    setGerando(true); setErro('')
    try {
      const res = await fetch('/api/pagamentos.php', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-Token': token },
        body:    JSON.stringify({ acao: 'criar', tipo: 'alimentacao' }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error || 'Erro ao gerar pagamento'); return }
      onPagamentoAdded(data as Pagamento)
      setCheckout(true)
    } catch { setErro('Erro de conexão') }
    finally { setGerando(false) }
  }

  return (
    <>
      <div className="atl-card" style={{ animationDelay: '200ms' }}>
        {/* Header */}
        <div className="atl-card-header">
          <div className="atl-card-icon"><UtensilsCrossed size={16} /></div>
          <div className="atl-card-title">Alimentação</div>
          {isPago && <span className="atl-status atl-status--pago" style={{ marginLeft: 'auto' }}><CheckCircle2 size={10} /> Pago</span>}
          {isPendente && <span className="atl-status atl-status--aguardando" style={{ marginLeft: 'auto' }}><Clock size={10} /> Aguardando</span>}
          {podeEditar && !editando && (aberto || temDias) && (
            <button className="atl-card-action" onClick={() => setEditando(true)}>
              {temDias ? 'Editar' : 'Contratar'}
            </button>
          )}
        </div>

        {/* Indicador de travamento */}
        {isPago && (
          <div className="atl-locked-notice">
            <LockKeyhole size={12} />
            {pagoViaCompleto
              ? 'Incluído no pagamento da inscrição'
              : 'Alimentação paga — não é possível editar'}
          </div>
        )}

        {/* Visualização */}
        {!editando && (
          <>
            {!temDias
              ? <p className="atl-service-empty">{!aberto ? '🔒 Contratação de alimentação temporariamente fechada' : 'Nenhuma alimentação contratada.'}</p>
              : inicial.map(a => (
                  <div key={a.dia} className="atl-info-row">
                    <span className="atl-info-label">Dia {a.dia}/set</span>
                    <span className="atl-info-val">
                      {PACOTE_LABEL[a.pacote ?? 'completo'] ?? 'Pacote completo'} · R$ {a.valor}
                    </span>
                  </div>
                ))
            }
            <div className="atl-info-row">
              <span className="atl-info-label">Restrição alimentar</span>
              <span className="atl-info-val" style={{
                color: restricaoTipo ? 'rgba(255,255,255,.75)' : 'rgba(255,255,255,.22)',
              }}>
                {restricaoTipo
                  ? [RESTRICAO_LABELS[restricaoTipo] ?? restricaoTipo, restricaoDescricao].filter(Boolean).join(' · ')
                  : '—'}
              </span>
            </div>
            {prazoLabel && (
              <p className={`atl-service-deadline${prazoCerrado ? ' atl-service-deadline--encerrado' : ''}`}>
                {prazoCerrado ? '🔒 Prazo encerrado em ' : '⏱ Editável até '}{prazoLabel}
              </p>
            )}
          </>
        )}

        {/* Edição */}
        {editando && podeEditar && (
          <>
            <div className="atl-alim-days">
              {DIAS.map(d => {
                const sel = selecionados.get(d.key) ?? null
                return (
                  <div key={d.key} className="atl-alim-day">
                    <div className="atl-alim-day-header">
                      <span className="atl-alim-day-num">{d.label}</span>
                      <span className="atl-alim-day-info">{d.mes} · {d.nome}</span>
                    </div>
                    <div className="atl-alim-day-opts">
                      {PACOTES_ATL.map(p => (
                        <button
                          key={p.key}
                          type="button"
                          className={`atl-alim-opt${sel === p.key ? ' atl-alim-opt--active' : ''}`}
                          onClick={() => setPacote(d.key, sel === p.key ? null : p.key)}
                        >
                          <span className="atl-alim-opt-label">{p.label}</span>
                          <span className="atl-alim-opt-desc">{p.desc}</span>
                          <span className="atl-alim-opt-price">R$ {p.valor}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            {selecionados.size > 0 && (
              <p style={{ fontSize: 14, textAlign: 'right', color: 'rgba(255,255,255,.60)', marginBottom: 0 }}>
                Total: <strong style={{ color: 'var(--atl-orange)' }}>{fmt(total)}</strong>
              </p>
            )}

            <RestricoesAlimentaresField
              tipo={restricaoTipo}
              descricao={restricaoDescricao}
              onChange={(t, d) => { setRestricaoTipo(t); setRestricaoDescricao(d) }}
              variant="atl"
            />

            {!aberto && (
              <p style={{ fontSize: 13, color: '#FFD54F', marginBottom: 10 }}>
                A contratação de alimentação está temporariamente fechada — você ainda pode remover a seleção abaixo.
              </p>
            )}
            {erro && <p style={{ color: '#FF8A80', fontSize: 13, marginTop: 8 }}>{erro}</p>}
            <div className="atl-service-actions">
              {podeSalvar && (
                <button className="atl-btn-save" onClick={salvar} disabled={salvando}>
                  {salvando ? <span className="atl-spinner" /> : null}
                  {salvando ? 'Salvando…' : 'Salvar seleção'}
                </button>
              )}
              <button className="atl-btn-remove" onClick={remover} disabled={salvando}>Remover</button>
              <button
                className="atl-btn-remove"
                onClick={() => { setEditando(false); setSelecionados(new Map(inicial.map(a => [a.dia, (a.pacote === 'almoco' ? 'almoco' : 'completo') as PacoteAlim]))); setRestricaoTipo(restricaoTipoInicial); setRestricaoDescricao(restricaoDescricaoInicial) }}
                disabled={salvando}
                style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.45)' }}
              >
                Cancelar
              </button>
            </div>
          </>
        )}

        {/* Seção de pagamento — só aparece se não pago e tem dias selecionados */}
        {!isPago && temDias && !editando && (
          <div className="atl-payment-section">
            <div className="atl-payment-section-divider" />

            {isPendente ? (
              /* Pagamento gerado, aguardando */
              <div className="atl-payment-pending">
                <div className="atl-payment-pending-info">
                  <span className="atl-payment-pending-label">Pagamento gerado</span>
                  <span className="atl-payment-pending-val">{fmt(pagamento!.valor)}</span>
                </div>
                {erro && <p style={{ color: '#FF8A80', fontSize: 13 }}>{erro}</p>}
                <button className="atl-fin-pay-btn" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setCheckout(true)}>
                  <CreditCard size={13} /> Pagar agora
                </button>
              </div>
            ) : (
              /* Nenhum pagamento ainda */
              <>
                <p className="atl-payment-section-hint">
                  Alimentação selecionada mas ainda não paga.
                </p>
                {erro && <p style={{ color: '#FF8A80', fontSize: 13 }}>{erro}</p>}
                <button className="atl-fin-generate-btn" onClick={gerarPagamento} disabled={gerando}>
                  {gerando ? <span className="atl-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <CreditCard size={14} />}
                  {gerando ? 'Gerando…' : `Gerar pagamento — ${fmt(inicial.reduce((s, a) => s + (a.valor ?? 0), 0))}`}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {checkout && pagamento && (
        <PaymentCheckout
          pagamento={pagamento}
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
