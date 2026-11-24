import { useEffect, useRef, useState } from 'react'
import { X, CheckCircle2, AlertTriangle, Copy, Check, CreditCard } from 'lucide-react'
import type { Pagamento } from './AthleteDashboard'

const TAXA_CARTAO = 0.05

// A chave PÚBLICA do Mercado Pago vem do backend (public/api/env.php), nunca
// hardcoded aqui: cada instalação configura a sua. É pública por design — o SDK
// do MP roda no navegador com ela — mas não deve identificar a conta de OUTRO
// evento só porque alguém clonou o repositório.
let _publicKeyPromise: Promise<string> | null = null
function mpPublicKey(): Promise<string> {
  if (_publicKeyPromise) return _publicKeyPromise
  _publicKeyPromise = fetch('/api/config-publica.php')
    .then(r => r.json())
    .then((d: { mp_public_key?: string }) => d.mp_public_key ?? '')
    .catch(() => '')
  return _publicKeyPromise
}

// Singleton: garante que o script MP é carregado apenas uma vez, mesmo com StrictMode
let _sdkPromise: Promise<void> | null = null
function loadSDK(): Promise<void> {
  if (_sdkPromise) return _sdkPromise
  _sdkPromise = new Promise<void>((resolve, reject) => {
    if (window.MercadoPago) { resolve(); return }
    const existing = document.querySelector('script[src*="sdk.mercadopago.com"]')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', reject,          { once: true })
      return
    }
    const s = document.createElement('script')
    s.src = 'https://sdk.mercadopago.com/js/v2'
    s.onload  = () => resolve()
    s.onerror = () => { _sdkPromise = null; reject(new Error('Falha ao carregar MP SDK')) }
    document.head.appendChild(s)
  })
  return _sdkPromise
}

interface Props {
  pagamento: Pagamento
  token?: string
  checkoutToken?: string
  mpEndpoint?: string
  statusEndpoint?: string
  authenticated?: boolean
  onPaid: (updated: Pagamento) => void
  onClose: () => void
  onPaymentCancelled?: () => void
}

interface PixData {
  qr_code: string
  qr_code_base64: string
  ticket_url: string
}

type Estado = 'selecionando' | 'carregando' | 'brick' | 'pix' | 'aprovado' | 'rejeitado' | 'erro'
type Metodo = 'pix' | 'cartao' | null

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    MercadoPago: new (key: string, opts?: { locale: string }) => any
  }
}

function fmt(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function PaymentCheckout({
  pagamento, token, checkoutToken,
  mpEndpoint = '/api/mp-payment.php',
  statusEndpoint = '/api/pagamentos.php',
  authenticated = false,
  onPaid, onClose, onPaymentCancelled,
}: Props) {
  const [estado, setEstado] = useState<Estado>('selecionando')
  const [metodo, setMetodo] = useState<Metodo>(null)
  const [pixData, setPixData]   = useState<PixData | null>(null)
  const [erroMsg, setErroMsg]   = useState('')
  const [copiado, setCopiado]   = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controllerRef = useRef<any>(null)
  const containerRef  = useRef<HTMLDivElement>(null)

  const itens     = pagamento.itens ?? []
  const valorBase = pagamento.valor
  const taxaValor    = Math.round(valorBase * TAXA_CARTAO * 100) / 100
  const valorComTaxa = Math.round(valorBase * (1 + TAXA_CARTAO) * 100) / 100
  const valorFinal   = metodo === 'cartao' ? valorComTaxa : valorBase

  function selecionarMetodo(m: 'pix' | 'cartao') {
    setMetodo(m)
    setEstado('carregando')
  }

  function voltarParaSelecao() {
    controllerRef.current?.unmount?.()
    controllerRef.current = null
    setMetodo(null)
    setEstado('selecionando')
    setErroMsg('')
  }

  useEffect(() => {
    if (!metodo) return
    let cancelled = false

    async function init() {
      try {
        const [, publicKey] = await Promise.all([loadSDK(), mpPublicKey()])
        if (cancelled) return
        if (!publicKey) throw new Error('MP_PUBLIC_KEY não configurada em public/api/env.php')

        const mp      = new window.MercadoPago(publicKey, { locale: 'pt-BR' })
        const builder = mp.bricks()

        const container = document.getElementById('mp-brick-container')
        if (container) container.innerHTML = ''
        if (cancelled) return

        const paymentMethods = metodo === 'pix'
          ? { bankTransfer: 'all' }
          : { creditCard: 'all', debitCard: 'all', maxInstallments: 3 }

        const controller = await builder.create('payment', 'mp-brick-container', {
          initialization: { amount: valorFinal },
          customization: {
            visual: { style: { theme: 'dark' } },
            paymentMethods,
          },
          callbacks: {
            onReady: () => { if (!cancelled) setEstado('brick') },
            onError: (err: unknown) => {
              if (cancelled) return
              console.error('MP Brick error:', err)
              setEstado('erro')
              setErroMsg('Erro no formulário de pagamento')
            },
            onSubmit: async ({ formData }: { formData: unknown }) => {
              const headers: Record<string, string> = { 'Content-Type': 'application/json' }
              if (token) headers['X-Session-Token'] = token

              const body: Record<string, unknown> = {
                form_data:    formData,
                pagamento_id: pagamento.id,
                metodo,
              }
              if (checkoutToken) body.checkout_token = checkoutToken

              const res  = await fetch(mpEndpoint, { method: 'POST', headers, credentials: authenticated ? 'include' : 'same-origin', body: JSON.stringify(body) })
              const data = await res.json()

              if (!res.ok) {
                if (res.status === 404) {
                  setEstado('erro')
                  setErroMsg('Pagamento não encontrado ou expirado. Feche e tente gerar um novo pagamento.')
                  onPaymentCancelled?.()
                  return
                }
                throw new Error(data.error || 'Erro no pagamento')
              }

              if (data.status === 'approved') {
                setEstado('aprovado')
                setTimeout(() => onPaid({
                  ...pagamento,
                  status: 'pago',
                  metodo: data.payment_method_id ?? pagamento.metodo,
                  valor: Number(data.transaction_amount ?? valorFinal),
                }), 1800)
              } else if (data.pix?.qr_code) {
                setPixData(data.pix)
                setEstado('pix')
              } else if (data.status === 'rejected' || data.status === 'cancelled') {
                setErroMsg(data.status_detail || 'O pagamento não foi aprovado. Tente novamente com outro cartão ou método.')
                setEstado('rejeitado')
              } else {
                setEstado('erro')
                setErroMsg(
                  data.status
                    ? `O pagamento ficou com status "${data.status}". Confira novamente na área da pessoa atleta antes de tentar pagar de novo.`
                    : 'Não foi possível confirmar o pagamento.'
                )
              }
            },
          },
        })

        if (cancelled) {
          controller?.unmount?.()
        } else {
          controllerRef.current = controller
        }
      } catch (err) {
        if (!cancelled) {
          setEstado('erro')
          setErroMsg('Falha ao inicializar Mercado Pago')
          console.error(err)
        }
      }
    }

    init()

    return () => {
      cancelled = true
      controllerRef.current?.unmount?.()
      controllerRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metodo])

  // Polling automático enquanto aguarda confirmação do PIX via webhook
  useEffect(() => {
    if (estado !== 'pix') return

    const poll = setInterval(async () => {
      try {
        const headers: Record<string, string> = {}
        if (token) headers['X-Session-Token'] = token

        const url = token || authenticated
          ? statusEndpoint
          : `${statusEndpoint}?checkout_token=${checkoutToken}&pagamento_id=${pagamento.id}`

        const res  = await fetch(url, { headers, credentials: authenticated ? 'include' : 'same-origin' })
        const data = await res.json()
        const pgs: Pagamento[] = Array.isArray(data) ? data : [data]
        const pg = pgs.find(p => p.id === pagamento.id)

        if (pg?.status === 'pago') {
          clearInterval(poll)
          setEstado('aprovado')
          setTimeout(() => onPaid(pg), 1200)
        } else if (pg?.status === 'cancelado') {
          clearInterval(poll)
          setEstado('erro')
          setErroMsg('PIX expirado ou cancelado. Feche e tente gerar um novo pagamento.')
          onPaymentCancelled?.()
        }
      } catch { /* silencioso */ }
    }, 4000)

    return () => clearInterval(poll)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado])

  function copiarPix() {
    if (!pixData?.qr_code) return
    navigator.clipboard?.writeText(pixData.qr_code).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    })
  }

  const tituloHeader =
    estado === 'pix'        ? 'Pague com PIX'
    : estado === 'selecionando' ? 'Como você quer pagar?'
    : metodo === 'cartao'   ? 'Pagamento por Cartão'
    : metodo === 'pix'      ? 'Pagamento por PIX'
    : 'Checkout de Pagamento'

  return (
    <div className="chk-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="chk-modal" style={{ maxWidth: estado === 'pix' ? 440 : 580 }}>

        {/* Header */}
        <div className="chk-header">
          <div>
            <p className="chk-header-eyebrow">2° Pior Campeonato de Bici Polo · Curitiba 2026</p>
            <p className="chk-header-title">{tituloHeader}</p>
          </div>
          <button className="chk-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>

        {/* ── Aprovado ─────────────────────────────────── */}
        {estado === 'aprovado' && (
          <div className="chk-success">
            <CheckCircle2 size={48} className="chk-success-icon" />
            <p className="chk-success-title">Pagamento confirmado!</p>
            <p className="chk-success-sub">Seu pagamento foi registrado com sucesso.</p>
          </div>
        )}

        {/* ── Rejeitado ────────────────────────────────── */}
        {estado === 'rejeitado' && (
          <div className="chk-success">
            <AlertTriangle size={48} style={{ color: 'var(--pal-red-100-2)', marginBottom: 16 }} />
            <p className="chk-success-title" style={{ color: 'var(--pal-red-100-2)' }}>Pagamento não aprovado</p>
            <p className="chk-success-sub">{erroMsg || 'Tente novamente com outro cartão ou método.'}</p>
            <button
              className="chk-pay-btn"
              style={{ marginTop: 20 }}
              onClick={() => {
                onPaymentCancelled?.()
                onClose()
              }}
            >
              Fechar e tentar novamente
            </button>
          </div>
        )}

        {/* ── Erro geral ───────────────────────────────── */}
        {estado === 'erro' && (
          <div className="chk-success">
            <AlertTriangle size={48} style={{ color: 'var(--pal-red-100-2)', marginBottom: 16 }} />
            <p className="chk-success-title" style={{ color: 'var(--pal-red-100-2)' }}>Erro no checkout</p>
            <p className="chk-success-sub">{erroMsg}</p>
            <button
              className="chk-pay-btn"
              style={{ marginTop: 20, background: 'rgba(255,255,255,.08)', color: 'rgba(255,255,255,.7)' }}
              onClick={voltarParaSelecao}
            >
              ← Tentar outro método
            </button>
          </div>
        )}

        {/* ── PIX pendente ─────────────────────────────── */}
        {estado === 'pix' && pixData && (
          <div style={{ padding: '0 24px 24px', textAlign: 'center' }}>
            <p style={{ color: 'rgba(255,255,255,.55)', fontSize: 13, marginBottom: 16 }}>
              Escaneie o QR Code ou copie o código abaixo
            </p>
            {pixData.qr_code_base64 && (
              <img
                src={`data:image/png;base64,${pixData.qr_code_base64}`}
                alt="QR Code PIX"
                style={{ width: 200, height: 200, margin: '0 auto 16px', display: 'block', borderRadius: 8, background: 'var(--pal-white)', padding: 8 }}
              />
            )}
            <div style={{ background: 'rgba(255,255,255,.06)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <code style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {pixData.qr_code}
              </code>
              <button onClick={copiarPix} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.6)', flexShrink: 0 }}>
                {copiado ? <Check size={16} color="var(--pal-magenta-l70)" /> : <Copy size={16} />}
              </button>
            </div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.40)', marginBottom: 20 }}>
              Total: <strong style={{ color: 'var(--pal-white)' }}>{fmt(valorBase)}</strong> · vence em 30 minutos
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
              <span className="atl-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,.40)' }}>Aguardando confirmação do pagamento…</span>
            </div>
            <p className="chk-cancel-link" onClick={onClose}>Pagar depois</p>
          </div>
        )}

        {/* ── Resumo do pedido (selecionando, carregando, brick) ── */}
        {(estado === 'selecionando' || estado === 'carregando' || estado === 'brick') && (
          <div className="chk-items" style={{ margin: '0 24px' }}>
            {itens.length > 0
              ? itens.map((it, i) => (
                  <div key={i} className={`chk-item${it.valor < 0 ? ' chk-item--discount' : ''}`}>
                    <span>{it.descricao}</span>
                    <span>{it.valor < 0 ? `− ${fmt(Math.abs(it.valor))}` : fmt(it.valor)}</span>
                  </div>
                ))
              : <div className="chk-item">
                  <span>Pagamento #{String(pagamento.id).padStart(4, '0')}</span>
                  <span>{fmt(valorBase)}</span>
                </div>
            }
            {metodo === 'cartao' && (
              <div className="chk-item" style={{ color: 'color-mix(in srgb, var(--pal-amber-100) 85%, transparent)' }}>
                <span>Taxa de cartão de crédito (5%)</span>
                <span>{fmt(taxaValor)}</span>
              </div>
            )}
            {estado !== 'selecionando' && (
              <div className="chk-total"><span>Total</span><span>{fmt(valorFinal)}</span></div>
            )}
          </div>
        )}

        {/* ── Seleção de método ─────────────────────────── */}
        {estado === 'selecionando' && (
          <div style={{ padding: '0 24px 24px' }}>

            <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.35)', textAlign: 'center', margin: '16px 0 12px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Escolha a forma de pagamento
            </p>

            {/* PIX */}
            <button
              onClick={() => selecionarMetodo('pix')}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, width: '100%',
                padding: '14px 16px', marginBottom: 10,
                background: 'color-mix(in srgb, var(--pal-magenta-l70) 6%, transparent)', border: '1.5px solid color-mix(in srgb, var(--pal-magenta-l70) 30%, transparent)',
                borderRadius: 10, cursor: 'pointer', textAlign: 'left', color: 'var(--pal-white)',
              }}
            >
              <div style={{ width: 38, height: 38, borderRadius: 8, background: 'color-mix(in srgb, var(--pal-magenta-l70) 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 20 }}>
                ✦
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2, color: 'var(--pal-magenta-l70)' }}>PIX</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>Confirmação instantânea · sem acréscimo</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--pal-magenta-l70)' }}>{fmt(valorBase)}</div>
              </div>
            </button>

            {/* Cartão */}
            <button
              onClick={() => selecionarMetodo('cartao')}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, width: '100%',
                padding: '14px 16px',
                background: 'rgba(255,255,255,.04)', border: '1.5px solid rgba(255,255,255,.12)',
                borderRadius: 10, cursor: 'pointer', textAlign: 'left', color: 'var(--pal-white)',
              }}
            >
              <div style={{ width: 38, height: 38, borderRadius: 8, background: 'rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CreditCard size={18} style={{ color: 'rgba(255,255,255,.7)' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>Cartão de Crédito</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>
                  Em até 3× · +5% de taxa de transação + juros de parcelamento
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginBottom: 2 }}>a partir de</div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{fmt(valorComTaxa)}</div>
              </div>
            </button>

            <p style={{ fontSize: 11, color: 'rgba(255,255,255,.28)', textAlign: 'center', marginTop: 14, lineHeight: 1.6 }}>
              A taxa de 5% cobre os custos de processamento do cartão.<br />PIX não tem acréscimo.
            </p>

            <p className="chk-cancel-link" style={{ marginTop: 8 }} onClick={onClose}>Cancelar e voltar</p>
          </div>
        )}

        {/* ── Carregando ───────────────────────────────── */}
        {estado === 'carregando' && (
          <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,.45)', fontSize: 14 }}>
            <span className="atl-spinner" style={{ width: 24, height: 24, borderWidth: 3, display: 'inline-block', marginBottom: 12 }} />
            <p>Carregando formulário de pagamento…</p>
          </div>
        )}

        {/* ── Container do Payment Brick ────────────────── */}
        <div
          id="mp-brick-container"
          ref={containerRef}
          style={{
            padding: '0 24px 24px',
            display: estado === 'brick' ? 'block' : 'none',
          }}
        />

        {(estado === 'carregando' || estado === 'brick') && (
          <div style={{ textAlign: 'center', paddingBottom: 16 }}>
            <p className="chk-cancel-link" style={{ marginBottom: 0 }} onClick={voltarParaSelecao}>
              ← Trocar método de pagamento
            </p>
            <p className="chk-cancel-link" onClick={onClose}>Cancelar e voltar</p>
          </div>
        )}
      </div>
    </div>
  )
}
