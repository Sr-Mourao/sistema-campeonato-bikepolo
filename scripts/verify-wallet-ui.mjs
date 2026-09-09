import { chromium } from 'playwright'

const wallet = {
  pessoa: { id: 1, nome: 'Pessoa de Teste', email: 'pessoa@teste.local' },
  carteira: { id: 1, qr_token: 'a'.repeat(64), saldo_centavos: 5400, status: 'ativa' },
  movimentos: [
    { id: 2, tipo: 'COMPRA', valor_centavos: -1200, observacao: 'Venda #12', criada_em: '2026-09-03 12:00:00' },
    { id: 1, tipo: 'RECARGA', valor_centavos: 6600, observacao: 'Recarga Mercado Pago', criada_em: '2026-09-03 11:00:00' },
  ],
  recargas: [{ id: 1, valor_centavos: 6600, status: 'aprovada', metodo: 'pix', criada_em: '2026-09-03 11:00:00' }],
}
const products = [{ id: 1, nome: 'Lanche', preco_centavos: 1800, estoque: 12, ativo: 1 }]
const wallets = [{ id: 1, nome: 'Pessoa de Teste', email: 'pessoa@teste.local', saldo_centavos: 5400, status: 'ativa', total_recarregado_centavos: 6600, total_consumido_centavos: 1200 }]
const summary = { recargas_aprovadas_centavos: 6600, vendas_centavos: 1200, estornado_centavos: 0, reembolsado_centavos: 0, saldo_carteiras_centavos: 5400, numero_carteiras: 1, carteiras_com_saldo: 1, estoque_atual: 12, produtos: [{ id: 1, nome: 'Lanche', estoque: 12, quantidade_vendida: 1, valor_bruto_centavos: 1800 }] }

const browser = await chromium.launch({ headless: true })
const admin = await browser.newPage({ viewport: { width: 390, height: 844 } })
const adminWalletQueries = []
await admin.route('**/api/admin/auth.php', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ autenticado: true }) }))
await admin.route('**/api/admin/carteira.php**', route => {
  const url = new URL(route.request().url())
  const action = url.searchParams.get('acao')
  if (action === 'carteiras') adminWalletQueries.push(url.searchParams.get('busca') ?? '')
  const body = action === 'produtos' ? products : action === 'carteiras' ? { carteiras: wallets, provisionadas: 0 } : action === 'vendas' ? [] : action === 'resumo' ? summary : {}
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
})
await admin.goto('http://127.0.0.1:4174/admin/carteira')
await admin.getByRole('heading', { name: 'Encontre a carteira e venda' }).waitFor()
if (!await admin.getByRole('button', { name: 'Abrir câmera' }).isVisible()) throw new Error('Câmera não está acessível na aba de atendimento')
if (await admin.getByRole('button', { name: 'Buscar' }).count()) throw new Error('A busca ainda exige botão manual')
await admin.getByPlaceholder('Nome, e-mail, clube ou cidade').fill('Pessoa')
await admin.waitForTimeout(250)
if (!adminWalletQueries.includes('Pessoa')) throw new Error('Busca automática não consultou ao digitar')
await admin.screenshot({ path: 'test-artifacts/carteira-admin-mobile-lista.png', fullPage: true })
await admin.getByRole('button', { name: 'Vender' }).click()
await admin.getByRole('button', { name: 'Adicionar uma unidade de Lanche' }).click()
if (!await admin.getByRole('button', { name: 'Confirmar venda' }).isEnabled()) throw new Error('Venda pelo mouse não foi habilitada')
const adminViewportOverflow = await admin.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
if (adminViewportOverflow) throw new Error('Overflow da página administrativa em 390px')
await admin.screenshot({ path: 'test-artifacts/carteira-admin-mobile.png', fullPage: true })
await browser.close()
console.log('Atendimento de carteiras validado em 390px: busca automática, venda e ausência de overflow.')
