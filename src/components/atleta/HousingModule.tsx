import { useState } from 'react'
import { Building2, CreditCard, CheckCircle2, Clock, LockKeyhole } from 'lucide-react'
import { CONFIG } from '../../inscricoes.config'
import type { Pagamento } from './AthleteDashboard'
import PaymentCheckout from './PaymentCheckout'

interface DiaAloj { dia: number; valor: number; pago: boolean }

interface Props {
  inicial: DiaAloj[]
  prazoCerrado: boolean
  prazoLabel: string
  token: string
  pagamento: Pagamento | null       // contratação normal (tipo 'alojamento')
  pagamentoExtra: Pagamento | null  // dias extras (tipo 'alojamento_extra')
  pagoViaCompleto: boolean
  aberto: boolean
  onUpdate: (nova: DiaAloj[]) => void
  onPagamentoAdded: (p: Pagamento) => void
  onPagamentoUpdated: (p: Pagamento) => void
}

function fmt(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
}

export default function HousingModule({
  inicial, prazoCerrado, prazoLabel, token,
  pagamento, pagamentoExtra, pagoViaCompleto, aberto,
  onUpdate, onPagamentoAdded, onPagamentoUpdated,
}: Props) {
  const confirmados = inicial.filter(a => a.pago)
  const pendentes    = inicial.filter(a => !a.pago)
  const temConfirmados = confirmados.length > 0
  // Exclui só os dias já CONFIRMADOS (pagos) — os pendentes/extras ainda não pagos
  // continuam selecionáveis aqui, senão não dá pra desmarcar o que ainda não foi pago.
  const diasDisponiveis = CONFIG.ALOJAMENTO_DIARIAS.filter(d => !confirmados.some(a => a.dia === d.dia))

  // Enquanto há dias confirmados (pagos), qualquer seleção pendente é "extra" — o pagamento
  // ativo relevante muda de tipo de acordo com isso (decidido no backend, espelhado aqui).
  const pgAtivo = temConfirmados ? pagamentoExtra : pagamento

  const [selecionados, setSelecionados] = useState<Set<number>>(
    () => new Set(pendentes.map(a => a.dia))
  )
  const [editando, setEditando]  = useState(false)
  const [salvando, setSalvando]  = useState(false)
  const [gerando,  setGerando]   = useState(false)
  const [erro, setErro]          = useState('')
  const [checkout, setCheckout]  = useState(false)

  const isPagoTudo   = pagoViaCompleto || (temConfirmados && pendentes.length === 0)
  const isPendente   = !pagoViaCompleto && pgAtivo?.status === 'pendente'
  const podeGerenciar = !pagoViaCompleto && !prazoCerrado
  const podeSalvar    = podeGerenciar && aberto
  const total = selecionados.size * CONFIG.VALOR_ALOJAMENTO_DIARIA

  function toggle(dia: number) {
    if (!podeSalvar) return
    setSelecionados(prev => {
      const next = new Set(prev)
      if (next.has(dia)) next.delete(dia)
      else next.add(dia)
      return next
    })
  }

  async function salvar() {
    setSalvando(true); setErro('')
    try {
      const res = await fetch('/api/servicos/alojamento.php', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-Token': token },
        body:    JSON.stringify({ dias: Array.from(selecionados) }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error || 'Erro ao salvar'); return }
      if (data.pagamento_cancelado) onPagamentoUpdated(data.pagamento_cancelado as Pagamento)
      onUpdate(data.alojamento)
      setEditando(false)
    } catch { setErro('Erro de conexão') }
    finally { setSalvando(false) }
  }

  async function remover() {
    if (!confirm(temConfirmados ? 'Cancelar a seleção de dias extras?' : 'Cancelar alojamento?')) return
    setSalvando(true)
    try {
      const res = await fetch('/api/servicos/alojamento.php', {
        method: 'DELETE', headers: { 'X-Session-Token': token },
      })
      if (res.ok) {
        // DELETE só remove a seleção pendente/solta — os dias já confirmados permanecem
        setSelecionados(new Set())
        onUpdate(confirmados)
        setEditando(false)
      }
    } catch { setErro('Erro de conexão') }
    finally { setSalvando(false) }
  }

  async function gerarPagamento() {
    setGerando(true); setErro('')
    try {
      const res = await fetch('/api/pagamentos.php', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-Token': token },
        body:    JSON.stringify({ acao: 'criar', tipo: 'alojamento' }),
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
      <div className="atl-card" style={{ animationDelay: '240ms' }}>
        {/* Header */}
        <div className="atl-card-header">
          <div className="atl-card-icon"><Building2 size={16} /></div>
          <div className="atl-card-title">Alojamento</div>
          {isPagoTudo && <span className="atl-status atl-status--pago" style={{ marginLeft: 'auto' }}><CheckCircle2 size={10} /> Pago</span>}
          {isPendente && <span className="atl-status atl-status--aguardando" style={{ marginLeft: 'auto' }}><Clock size={10} /> Aguardando</span>}
          {podeGerenciar && !editando && (aberto || pendentes.length > 0) && (
            <button
              className="atl-card-action"
              onClick={() => {
                // Resincroniza com o estado atual — sem isso, dias que já foram
                // travados por um pagamento confirmado ficavam presos no Set local
                // (inicializado só uma vez) e voltavam junto na próxima seleção.
                setSelecionados(new Set(pendentes.map(a => a.dia)))
                setEditando(true)
              }}
            >
              {temConfirmados
                ? (pendentes.length > 0 ? 'Editar dias extras' : '+ Adicionar dias extras')
                : (pendentes.length > 0 ? 'Editar' : 'Reservar')
              }
            </button>
          )}
        </div>

        {/* Indicador de travamento */}
        {pagoViaCompleto && (
          <div className="atl-locked-notice">
            <LockKeyhole size={12} /> Incluído no pagamento da inscrição
          </div>
        )}

        {/* Visualização */}
        {!editando && (
          <>
            {temConfirmados && (
              <>
                <p className="atl-service-empty" style={{ color: 'rgba(255,255,255,.45)', marginBottom: 6 }}>Seu alojamento confirmado</p>
                {confirmados.map(a => (
                  <div key={a.dia} className="atl-info-row">
                    <span className="atl-info-label">Dia {a.dia}/set</span>
                    <span className="atl-info-val" style={{ color: '#4CE0A8' }}>✓ Confirmado</span>
                  </div>
                ))}
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', margin: '6px 0 14px' }}>
                  Esses dias já foram pagos e não podem ser alterados.
                </p>
              </>
            )}

            {pendentes.length > 0 && (
              <>
                {temConfirmados && <p className="atl-service-empty" style={{ color: 'rgba(255,255,255,.45)', marginBottom: 6 }}>Dias extras selecionados</p>}
                {pendentes.map(a => (
                  <div key={a.dia} className="atl-info-row">
                    <span className="atl-info-label">Dia {a.dia}/set</span>
                    <span className="atl-info-val">R$ {a.valor}</span>
                  </div>
                ))}
              </>
            )}

            {!temConfirmados && pendentes.length === 0 && (
              <p className="atl-service-empty">Nenhuma diária reservada.</p>
            )}

            {!aberto && !temConfirmados && pendentes.length === 0 && (
              <p className="atl-service-deadline">🔒 Contratação de alojamento temporariamente fechada</p>
            )}

            {prazoLabel && (
              <p className={`atl-service-deadline${prazoCerrado ? ' atl-service-deadline--encerrado' : ''}`}>
                {prazoCerrado ? '🔒 Prazo encerrado em ' : '⏱ Editável até '}{prazoLabel}
              </p>
            )}
          </>
        )}

        {/* Edição */}
        {editando && podeGerenciar && (
          <>
            <div className="atl-info-box">
              Alojamento dentro do instituto · <strong>R$ {CONFIG.VALOR_ALOJAMENTO_DIARIA}/diária</strong>
              {temConfirmados && ' · dias extras são cobrados separadamente'}
            </div>

            {!aberto && (
              <p style={{ fontSize: 13, color: '#FFD54F', marginBottom: 10 }}>
                A contratação de novos dias está temporariamente fechada — você ainda pode cancelar a seleção abaixo.
              </p>
            )}

            <div className="atl-days-grid">
              {(temConfirmados ? diasDisponiveis : CONFIG.ALOJAMENTO_DIARIAS).map(d => (
                <label key={d.dia} className="atl-day-item">
                  <input
                    type="checkbox"
                    checked={selecionados.has(d.dia)}
                    disabled={!podeSalvar}
                    onChange={() => toggle(d.dia)}
                  />
                  <span className="atl-day-label">
                    <span className="atl-day-num">{d.dia}</span>
                    <span className="atl-day-mes">{d.mes} · {d.nome}</span>
                    <span className="atl-day-val">R$ {CONFIG.VALOR_ALOJAMENTO_DIARIA}</span>
                  </span>
                </label>
              ))}
            </div>
            {selecionados.size > 0 && (
              <p style={{ fontSize: 14, textAlign: 'right', color: 'rgba(255,255,255,.60)', marginBottom: 0 }}>
                Total: <strong style={{ color: 'var(--atl-orange)' }}>{fmt(total)}</strong>
              </p>
            )}
            {erro && <p style={{ color: '#FF8A80', fontSize: 13, marginTop: 8 }}>{erro}</p>}
            <div className="atl-service-actions">
              {podeSalvar && (
                <button className="atl-btn-save" onClick={salvar} disabled={salvando}>
                  {salvando ? <span className="atl-spinner" /> : null}
                  {salvando ? 'Salvando…' : (temConfirmados ? 'Contratar alojamento extra' : 'Salvar seleção')}
                </button>
              )}
              {pendentes.length > 0 && (
                <button className="atl-btn-remove" onClick={remover} disabled={salvando}>Cancelar</button>
              )}
              <button
                className="atl-btn-remove"
                onClick={() => { setEditando(false); setSelecionados(new Set(pendentes.map(a => a.dia))) }}
                disabled={salvando}
                style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.45)' }}
              >
                Fechar
              </button>
            </div>
          </>
        )}

        {/* Seção de pagamento */}
        {!isPagoTudo && pendentes.length > 0 && !editando && (
          <div className="atl-payment-section">
            <div className="atl-payment-section-divider" />

            {isPendente ? (
              <div className="atl-payment-pending">
                <div className="atl-payment-pending-info">
                  <span className="atl-payment-pending-label">Pagamento gerado</span>
                  <span className="atl-payment-pending-val">{fmt(pgAtivo!.valor)}</span>
                </div>
                {erro && <p style={{ color: '#FF8A80', fontSize: 13 }}>{erro}</p>}
                <button className="atl-fin-pay-btn" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setCheckout(true)}>
                  <CreditCard size={13} /> Pagar agora
                </button>
              </div>
            ) : (
              <>
                <p className="atl-payment-section-hint">
                  {temConfirmados ? 'Dias extras selecionados mas ainda não pagos.' : 'Alojamento reservado mas ainda não pago.'}
                </p>
                {erro && <p style={{ color: '#FF8A80', fontSize: 13 }}>{erro}</p>}
                <button className="atl-fin-generate-btn" onClick={gerarPagamento} disabled={gerando}>
                  {gerando ? <span className="atl-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <CreditCard size={14} />}
                  {gerando ? 'Gerando…' : `Gerar pagamento — ${fmt(pendentes.reduce((s, a) => s + a.valor, 0))}`}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {checkout && pgAtivo && (
        <PaymentCheckout
          pagamento={pgAtivo}
          token={token}
          onPaid={updated => { onPagamentoUpdated(updated); setCheckout(false) }}
          onClose={() => setCheckout(false)}
          onPaymentCancelled={() => {
            onPagamentoUpdated({ ...pgAtivo, status: 'cancelado' })
            setCheckout(false)
          }}
        />
      )}
    </>
  )
}
