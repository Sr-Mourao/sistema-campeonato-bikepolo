import { useEffect, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Minus,
  Plus,
  ShoppingBag,
  Heart,
  CheckCircle2,
  Loader2,
} from 'lucide-react'
import './Lojinha.css'
import SiteNavbar from '../components/SiteNavbar'
import Footer from '../components/Footer'
import PaymentCheckout from '../components/atleta/PaymentCheckout'
import type { Pagamento } from '../components/atleta/AthleteDashboard'

interface Produto {
  id: number
  nome: string
  descricao: string | null
  preco: number
  imagens: string[]
  tamanhos: string[]
}

interface Catalogo {
  loja_aberta: boolean
  mensagem_fechada: string
  produtos: Produto[]
}

// produtoId -> tamanho (string vazia se o produto não tem tamanhos) -> quantidade
type Selecoes = Record<number, Record<string, number>>

function fmt(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function ProdutoCarousel({ imagens, nome }: { imagens: string[]; nome: string }) {
  const [idx, setIdx] = useState(0)

  if (imagens.length === 0) {
    return <div className="loj-card-img loj-card-img--placeholder"><ShoppingBag size={32} /></div>
  }

  if (imagens.length === 1) {
    return <div className="loj-card-img"><img src={imagens[0]} alt={nome} /></div>
  }

  return (
    <div className="loj-card-img loj-carousel">
      <img src={imagens[idx]} alt={`${nome} — foto ${idx + 1}`} />
      <button
        type="button"
        className="loj-carousel-arrow loj-carousel-arrow--prev"
        onClick={() => setIdx(i => (i === 0 ? imagens.length - 1 : i - 1))}
        aria-label="Foto anterior"
      >
        <ChevronLeft size={18} />
      </button>
      <button
        type="button"
        className="loj-carousel-arrow loj-carousel-arrow--next"
        onClick={() => setIdx(i => (i === imagens.length - 1 ? 0 : i + 1))}
        aria-label="Próxima foto"
      >
        <ChevronRight size={18} />
      </button>
      <div className="loj-carousel-dots">
        {imagens.map((_, i) => (
          <button
            key={i}
            type="button"
            className={`loj-carousel-dot${i === idx ? ' loj-carousel-dot--active' : ''}`}
            onClick={() => setIdx(i)}
            aria-label={`Ir para foto ${i + 1}`}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Card compacto:
 *  - chips de tamanho, com UM stepper só para o tamanho selecionado
 *  - resumo com contagem total e subtotal no header do picker
 */
function ProdutoCard({
  produto,
  selecoesPorTamanho,
  onQuantidade,
}: {
  produto: Produto
  selecoesPorTamanho: Record<string, number>
  onQuantidade: (tamanho: string, delta: number) => void
}) {
  const [tamanhoAtivo, setTamanhoAtivo] = useState<string | null>(produto.tamanhos[0] ?? null)

  const unidadesProduto = Object.values(selecoesPorTamanho).reduce((a, b) => a + b, 0)
  const subtotal = unidadesProduto * produto.preco
  const qtdAtiva = tamanhoAtivo ? selecoesPorTamanho[tamanhoAtivo] ?? 0 : 0

  return (
    <div className="loj-card">
      <ProdutoCarousel imagens={produto.imagens} nome={produto.nome} />
      <div className="loj-card-body">
        <div className="loj-card-head">
          <h3>{produto.nome}</h3>
          <p className="loj-card-preco">{fmt(produto.preco)}</p>
        </div>

        {produto.descricao && <p className="loj-card-desc">{produto.descricao}</p>}

        {produto.tamanhos.length > 0 ? (
          <div className="loj-tamanho-picker">
            <div className="loj-tamanho-header">
              <span className="loj-tamanho-title">Tamanhos disponíveis</span>
              {unidadesProduto > 0 && (
                <span className="loj-tamanho-pill">
                  {unidadesProduto} un{unidadesProduto !== 1 ? 's' : ''} · {fmt(subtotal)}
                </span>
              )}
            </div>

            <div className="loj-tamanho-chips">
              {produto.tamanhos.map(t => {
                const qtd = selecoesPorTamanho[t] ?? 0
                const selecionado = tamanhoAtivo === t
                const badge = qtd > 0
                return (
                  <button
                    key={t}
                    type="button"
                    className={`loj-tamanho-chip${selecionado ? ' loj-tamanho-chip--active' : ''}${badge ? ' loj-tamanho-chip--hasqtd' : ''}`}
                    onClick={() => setTamanhoAtivo(t)}
                    aria-pressed={selecionado}
                  >
                    {t}
                    {badge && <span className="loj-tamanho-chip-badge">{qtd}</span>}
                  </button>
                )
              })}
            </div>

            {tamanhoAtivo && (
              <div className="loj-tamanho-stepper">
                <span className="loj-tamanho-ativo-label">
                  Selecionado: <strong>{tamanhoAtivo}</strong>
                </span>
                <div className="loj-stepper">
                  <button
                    type="button"
                    onClick={() => onQuantidade(tamanhoAtivo, -1)}
                    aria-label={`Diminuir quantidade — tamanho ${tamanhoAtivo}`}
                  >
                    <Minus size={14} />
                  </button>
                  <span>{qtdAtiva}</span>
                  <button
                    type="button"
                    onClick={() => onQuantidade(tamanhoAtivo, 1)}
                    aria-label={`Aumentar quantidade — tamanho ${tamanhoAtivo}`}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="loj-stepper">
            <button
              type="button"
              onClick={() => onQuantidade('', -1)}
              aria-label="Diminuir quantidade"
            >
              <Minus size={14} />
            </button>
            <span>{selecoesPorTamanho[''] ?? 0}</span>
            <button
              type="button"
              onClick={() => onQuantidade('', 1)}
              aria-label="Aumentar quantidade"
            >
              <Plus size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Lojinha() {
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null)
  const [loading, setLoading] = useState(true)
  const [selecoes, setSelecoes] = useState<Selecoes>({})

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [observacoes, setObservacoes] = useState('')

  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [pedido, setPedido] = useState<(Pagamento & { checkout_token: string }) | null>(null)
  const [checkoutAberto, setCheckoutAberto] = useState(false)
  const [pago, setPago] = useState(false)

  useEffect(() => {
    fetch('/api/lojinha.php')
      .then(res => res.json())
      .then(data => setCatalogo(data))
      .catch(() => setErro('Não foi possível carregar a lojinha. Tente novamente mais tarde.'))
      .finally(() => setLoading(false))
  }, [])

  function setQuantidade(produtoId: number, tamanho: string, delta: number) {
    setSelecoes(prev => {
      const porTamanho = prev[produtoId] ?? {}
      const quantidade = Math.max(0, (porTamanho[tamanho] ?? 0) + delta)
      return { ...prev, [produtoId]: { ...porTamanho, [tamanho]: quantidade } }
    })
  }

  const itensSelecionados = (catalogo?.produtos ?? []).flatMap(produto => {
    const porTamanho = selecoes[produto.id] ?? {}
    const chaves = produto.tamanhos.length > 0 ? produto.tamanhos : ['']
    return chaves
      .map(tamanho => ({ produto, tamanho, quantidade: porTamanho[tamanho] ?? 0 }))
      .filter(x => x.quantidade > 0)
  })

  const valorTotal = itensSelecionados.reduce((acc, x) => acc + x.produto.preco * x.quantidade, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    if (itensSelecionados.length === 0) {
      setErro('Selecione ao menos um produto.')
      return
    }
    if (!nome.trim()) { setErro('Nome é obrigatório.'); return }
    if (!email.trim()) { setErro('Email é obrigatório.'); return }

    setEnviando(true)
    try {
      const res = await fetch('/api/lojinha.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome, email, whatsapp, observacoes,
          itens: itensSelecionados.map(({ produto, tamanho, quantidade }) => ({
            produto_id: produto.id,
            tamanho: tamanho || undefined,
            quantidade,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error || 'Erro ao criar pedido'); return }

      setPedido(data)
      setCheckoutAberto(true)
    } catch {
      setErro('Erro de conexão. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  if (loading) {
    return (
      <div className="lojinha">
        <SiteNavbar currentPath="/lojinha" />
        <div className="loj-loading"><Loader2 className="loj-spin" size={28} /></div>
      </div>
    )
  }

  if (pago) {
    return (
      <div className="lojinha">
        <SiteNavbar currentPath="/lojinha" />
        <main className="loj-main loj-success">
          <CheckCircle2 size={48} className="loj-success-icon" />
          <h1>Compra confirmada!</h1>
          <p>
            Você vai receber um email de confirmação com o resumo da compra e o
            <strong> código de retirada</strong>. Apresente esse código à organização
            durante o evento para pegar seus produtos.
          </p>
          <a href="/" className="loj-btn loj-btn--primary">Voltar à página principal</a>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="lojinha">
      <SiteNavbar currentPath="/lojinha" />
      <main className="loj-main">
        <div className="loj-header">
          <h1>Lojinha</h1>
          <p>Garanta já sua camiseta ou boné do 10º Campeonato Brasileiro de Bike Polo — retirada no evento.</p>
        </div>

        <details className="loj-manifesto">
          <summary>
            <Heart size={16} />
            <span>Mais do que uma compra, um apoio ao campeonato</span>
            <ChevronDown size={16} className="loj-manifesto-chevron" />
          </summary>
          <div className="loj-manifesto-body">
            <p>A lojinha do campeonato existe por um motivo simples: ajudar a fazer esse evento acontecer.</p>
            <p>Quando você compra um cap ou uma camiseta, não está levando só um produto exclusivo do 10º Campeonato Brasileiro de Bike Polo. Está contribuindo diretamente para a infraestrutura do evento.</p>
            <p>Todo o lucro da lojinha é reinvestido no campeonato: quadra, estrutura, materiais, recepção e todos aqueles detalhes que fazem a diferença para quem joga, para quem acompanha e para quem constrói esse encontro.</p>
            <p>Então, se você curtiu alguma peça, saiba que ela vem com um bônus: ajudar a fortalecer o Bike Polo brasileiro.</p>
            <p className="loj-manifesto-signoff">Obrigado por vestir essa ideia. 💜</p>
          </div>
        </details>

        {!catalogo?.loja_aberta && (
          <div className="loj-closed-card">
            <p>{catalogo?.mensagem_fechada}</p>
          </div>
        )}

        {catalogo?.loja_aberta && (
          <form onSubmit={handleSubmit}>
            <div
              className={`loj-grid loj-grid--count-${catalogo.produtos.length}`}
            >
              {catalogo.produtos.map(produto => (
                <ProdutoCard
                  key={produto.id}
                  produto={produto}
                  selecoesPorTamanho={selecoes[produto.id] ?? {}}
                  onQuantidade={(t, delta) => setQuantidade(produto.id, t, delta)}
                />
              ))}
            </div>

            <div className="loj-form-section">
              <h2>Seus dados</h2>
              <div className="loj-field">
                <label>Nome</label>
                <input value={nome} onChange={e => setNome(e.target.value)} required />
              </div>
              <div className="loj-field">
                <label>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div className="loj-field">
                <label>WhatsApp</label>
                <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
              </div>
              <div className="loj-field">
                <label>Observações</label>
                <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={3} />
              </div>
            </div>

            {itensSelecionados.length > 0 && (
              <div className="loj-summary">
                {itensSelecionados.map(({ produto, tamanho, quantidade }) => (
                  <div key={`${produto.id}-${tamanho}`} className="loj-summary-row">
                    <span>{quantidade}× {produto.nome}{tamanho ? ` (${tamanho})` : ''}</span>
                    <span>{fmt(produto.preco * quantidade)}</span>
                  </div>
                ))}
                <div className="loj-summary-total">
                  <span>Total</span>
                  <span>{fmt(valorTotal)}</span>
                </div>
              </div>
            )}

            {erro && <p className="loj-erro">{erro}</p>}

            <button type="submit" className="loj-btn loj-btn--primary loj-submit" disabled={enviando}>
              {enviando ? 'Enviando…' : 'Ir para pagamento'}
            </button>
          </form>
        )}
      </main>
      <Footer />

      {checkoutAberto && pedido && (
        <PaymentCheckout
          pagamento={pedido}
          checkoutToken={pedido.checkout_token}
          mpEndpoint="/api/mp-payment-lojinha.php"
          statusEndpoint="/api/lojinha.php"
          onPaid={() => {
            setCheckoutAberto(false)
            setPago(true)
          }}
          onClose={() => setCheckoutAberto(false)}
          onPaymentCancelled={() => {
            setPedido(prev => (prev ? { ...prev, status: 'cancelado' } : prev))
          }}
        />
      )}
    </div>
  )
}
