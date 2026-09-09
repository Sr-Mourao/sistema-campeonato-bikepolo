import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, LogOut, Plus, RefreshCw, WalletCards } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import SiteNavbar from '../components/SiteNavbar'
import PaymentCheckout from '../components/atleta/PaymentCheckout'
import type { Pagamento } from '../components/atleta/AthleteDashboard'
import './Carteira.css'

interface WalletData {
  pessoa: { id: number; nome: string; email: string }
  carteira: { id: number; qr_token: string; saldo_centavos: number; status: string }
  movimentos: Array<{ id: number; tipo: string; valor_centavos: number; observacao: string | null; criado_em: string }>
  recargas: Array<{ id: number; valor_centavos: number; status: string; metodo: string | null; criada_em: string }>
}

type View = 'loading' | 'login' | 'name' | 'sent' | 'wallet' | 'invalid-link' | 'public-qr'

const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dateTime = (value: string) => new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

function legacyToken(): string {
  try { return JSON.parse(localStorage.getItem('ins_session') || 'null')?.token || '' } catch { return '' }
}

export default function Carteira() {
  const qrPublic = window.location.pathname.startsWith('/carteira/q/')
  const accessToken = new URLSearchParams(window.location.search).get('token') || ''
  const [view, setView] = useState<View>(qrPublic ? 'public-qr' : 'loading')
  const [wallet, setWallet] = useState<WalletData | null>(null)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [amount, setAmount] = useState('50')
  const [payment, setPayment] = useState<Pagamento | null>(null)

  const loadWallet = useCallback(async (allowBridge = true) => {
    let response = await fetch('/api/carteira.php', { credentials: 'include' })
    if (response.ok) {
      setWallet(await response.json())
      setView('wallet')
      return true
    }
    if (response.status === 401 && allowBridge) {
      const token = legacyToken()
      if (token) {
        const bridge = await fetch('/api/carteira-auth.php', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'X-Session-Token': token },
          body: JSON.stringify({ acao: 'ponte_sessao' }),
        })
        if (bridge.ok) {
          response = await fetch('/api/carteira.php', { credentials: 'include' })
          if (response.ok) {
            setWallet(await response.json())
            setView('wallet')
            return true
          }
        }
      }
    }
    setView('login')
    return false
  }, [])

  // A carga inicial sincroniza a interface com a sessão HttpOnly mantida pelo servidor.
  useEffect(() => {
    if (qrPublic) return
    if (!accessToken) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadWallet()
      return
    }
    ;(async () => {
      try {
        const response = await fetch('/api/carteira-auth.php', {
          method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ acao: 'consumir', token: accessToken }),
        })
        // Remove o segredo do histórico e da barra de endereços antes de qualquer outra navegação.
        window.history.replaceState({}, '', '/carteira')
        if (!response.ok) { setView('invalid-link'); return }
        await loadWallet(false)
      } catch {
        window.history.replaceState({}, '', '/carteira')
        setView('invalid-link')
      }
    })()
  }, [accessToken, loadWallet, qrPublic])

  async function requestAccess(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const response = await fetch('/api/carteira-auth.php', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'solicitar', email: email.trim(), nome: name.trim() || undefined }),
      })
      const data = await response.json()
      if (response.status === 422 && data.nome_obrigatorio) { setEmail(data.email); setView('name'); return }
      if (!response.ok) throw new Error(data.error || 'Não foi possível enviar o acesso')
      setView('sent')
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro de conexão') }
    finally { setBusy(false) }
  }

  async function createTopUp() {
    const cents = Math.round(Number(amount.replace(',', '.')) * 100)
    if (!Number.isInteger(cents) || cents < 500) { setError('O valor mínimo de recarga é R$ 5,00.'); return }
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/carteira.php', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'criar_recarga', valor_centavos: cents }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Não foi possível criar a recarga')
      setPayment({ id: data.id, tipo: 'recarga', status: 'pendente', valor: data.valor_centavos / 100, metodo: null, itens: [{ descricao: 'Crédito na carteira', valor: data.valor_centavos / 100 }] })
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro de conexão') }
    finally { setBusy(false) }
  }

  async function logout() {
    await fetch('/api/carteira-auth.php', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'logout' }) })
    setWallet(null); setView('login')
  }

  const qrUrl = useMemo(() => wallet ? `${window.location.origin}/carteira/q/${wallet.carteira.qr_token}` : '', [wallet])

  if (view === 'public-qr') return (
    <main className="wal-public-qr"><WalletCards size={44} /><h1>QR de identificação da carteira</h1><p>Este código não autoriza compras nem exibe dados pessoais. Apresente-o no ponto de venda do evento.</p><a href="/carteira">Acessar minha carteira</a></main>
  )

  return <div className="wal-page">
    <SiteNavbar currentPath="/carteira" hideOnScroll={false} rightSlot={wallet && <button className="wal-nav-logout" onClick={logout}><LogOut size={15} /> Sair</button>} />
    <main className="wal-shell">
      {view === 'loading' && <div className="wal-state"><span className="wal-spinner" /><p>Carregando carteira…</p></div>}
      {(view === 'login' || view === 'name') && <section className="wal-access">
        <p className="wal-kicker">Carteira pré-paga do evento</p><h1>Acessar minha carteira</h1>
        <p>Informe seu e-mail para criar ou acessar sua carteira. Você receberá um link seguro, sem senha.</p>
        <form onSubmit={requestAccess}>
          {view === 'name' && <label>Nome<input autoFocus required value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></label>}
          <label>E-mail<input required type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" readOnly={view === 'name'} /></label>
          {error && <p className="wal-error" role="alert">{error}</p>}
          <button disabled={busy}>{busy ? 'Enviando…' : view === 'name' ? 'Criar minha carteira' : 'Enviar acesso'}</button>
        </form>
      </section>}
      {view === 'sent' && <section className="wal-access wal-access--center"><div className="wal-mail-icon">@</div><h1>Confira seu e-mail</h1><p>Enviamos um link de acesso para <strong>{email}</strong>. Ele vale por 15 minutos e pode ser usado uma vez.</p><button className="wal-text-button" onClick={() => setView('login')}>Usar outro e-mail</button></section>}
      {view === 'invalid-link' && <section className="wal-access wal-access--center"><h1>Link inválido ou expirado</h1><p>Por segurança, cada link só pode ser usado uma vez e vale por 15 minutos.</p><button onClick={() => setView('login')}>Solicitar novo acesso</button></section>}
      {view === 'wallet' && wallet && <>
        <header className="wal-header"><div><p className="wal-kicker">Olá, {wallet.pessoa.nome}</p><h1>Minha carteira</h1></div><button className="wal-refresh" onClick={() => loadWallet(false)} aria-label="Atualizar carteira"><RefreshCw size={18} /></button></header>
        <section className="wal-balance"><span>Saldo atual</span><strong>{money(Number(wallet.carteira.saldo_centavos))}</strong><button onClick={() => document.getElementById('recarga')?.scrollIntoView({ behavior: 'smooth' })}><Plus size={18} /> Adicionar saldo</button></section>
        <div className="wal-grid">
          <section className="wal-panel wal-qr"><div><p className="wal-section-label">Seu QR permanente</p><h2>Apresente no ponto de venda</h2></div><div className="wal-qr-code"><QRCodeSVG value={qrUrl} size={224} level="M" /></div><p>O QR identifica sua carteira. Somente uma pessoa operadora autenticada pode registrar uma venda.</p></section>
          <section className="wal-panel" id="recarga"><p className="wal-section-label">Recarga</p><h2>Adicionar saldo</h2><div className="wal-presets">{[20, 50, 100].map(v => <button key={v} className={amount === String(v) ? 'active' : ''} onClick={() => setAmount(String(v))}>{money(v * 100)}</button>)}</div><label className="wal-amount">Outro valor (R$)<input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} /></label>{error && <p className="wal-error" role="alert">{error}</p>}<button className="wal-primary" disabled={busy} onClick={createTopUp}>{busy ? 'Aguarde…' : 'Continuar para pagamento'}</button><small>Pix ou cartão via Mercado Pago. O saldo só entra após a confirmação do pagamento.</small>{wallet.recargas.length > 0 && <div className="wal-topups"><strong>Recargas recentes</strong>{wallet.recargas.slice(0,3).map(r=><div key={r.id}><span>{money(r.valor_centavos)}</span><b className={`status-${r.status}`}>{r.status === 'pendente' ? 'Aguardando pagamento' : r.status}</b></div>)}</div>}</section>
        </div>
        <section className="wal-panel wal-statement"><p className="wal-section-label">Movimentações</p><h2>Extrato</h2>{wallet.movimentos.length === 0 ? <p className="wal-empty">Nenhuma movimentação ainda.</p> : <ul>{wallet.movimentos.map(m => <li key={m.id}><span className={`wal-movement-icon ${m.valor_centavos >= 0 ? 'in' : 'out'}`}>{m.valor_centavos >= 0 ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}</span><span className="wal-movement-copy"><strong>{m.observacao || m.tipo.replaceAll('_', ' ')}</strong><small>{dateTime(m.criado_em)}</small></span><strong className={m.valor_centavos >= 0 ? 'wal-positive' : ''}>{m.valor_centavos >= 0 ? '+' : '−'} {money(Math.abs(m.valor_centavos))}</strong></li>)}</ul>}</section>
      </>}
    </main>
    {payment && <PaymentCheckout pagamento={payment} authenticated mpEndpoint="/api/carteira-pagamento.php" statusEndpoint="/api/carteira-recargas.php" onPaid={() => { setPayment(null); loadWallet(false) }} onPaymentCancelled={() => setPayment(null)} onClose={() => { setPayment(null); loadWallet(false) }} />}
  </div>
}
