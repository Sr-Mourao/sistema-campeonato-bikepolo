import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const base = process.env.AWARDS_BASE_URL || 'http://127.0.0.1:5190'
const out = 'test-artifacts/awards'
await mkdir(out, { recursive: true })

const atletas = ['Ana Lima', 'Bia Costa', 'Cris Luz', 'Dani Flor', 'Eva Rocha'].map((nome, index) => ({ pessoa_id: index + 1, nome, foto: null, time: `Time ${index + 1}` }))
const metadados = {
  mvp: ['MVP', 'Melhor Atleta em Quadra. Reconhece quem mais se destacou esportivamente durante o torneio.'],
  wow: ['WOW', 'Para quem já conhecíamos, mas evoluiu demais e fez todo mundo pensar: WOW, está jogando muito!'],
  revelacao: ['Revelação', 'Um atleta novo na comunidade, prioritariamente em seu primeiro torneio, que impressionou a galera.'],
  jesse: ['Jessé', 'Para aquela pessoa queridona e colaborativa que melhora o torneio — com zero freio e histórias que só ela consegue criar.'],
}
const categorias = Object.entries(metadados).map(([codigo, [nome, descricao]]) => ({ codigo, nome, descricao, candidatos: atletas.slice(1) }))
const ranking = atletas.map((a, index) => ({ ...a, votos: Math.max(0, 4 - index), posicao: index + 1, percentual: Math.max(0, 40 - index * 10) }))
const apuracao = Object.fromEntries(Object.entries(metadados).map(([codigo, [nome, descricao]]) => [codigo, { codigo, nome, descricao, ranking, total_votos: 10, maior_quantidade: 4, vencedores: [ranking[0]], empate: false }]))
const adminData = { status: 'aberta', atletas, curadoria: { revelacao: [2, 3], jesse: [1, 2, 3, 4, 5] }, participacao: atletas.map((a, i) => ({ ...a, status: i < 2 ? 'votou' : 'nao_votou', votos: i < 2 ? { mvp: { pessoa_id: 2, nome: 'Bia Costa' }, wow: { pessoa_id: 3, nome: 'Cris Luz' }, revelacao: { pessoa_id: 4, nome: 'Dani Flor' }, jesse: { pessoa_id: 5, nome: 'Eva Rocha' } } : {} })), resumo: { aptos: 5, votaram: 2, nao_votaram: 3 }, apuracao }

const browser = await chromium.launch({ headless: true })
const admin = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await admin.route('**/api/admin/auth.php', route => route.fulfill({ json: { autenticado: true, username: 'teste' } }))
await admin.route('**/api/admin/awards.php', route => route.fulfill({ json: adminData }))
await admin.goto(`${base}/admin/awards`, { waitUntil: 'networkidle' })
const adminMetrics = await admin.evaluate(() => ({ menu: Boolean(document.querySelector('.adm-nav-item--active')), status: document.querySelector('.awd-status')?.textContent?.trim(), overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth, curadorias: document.querySelectorAll('.awd-curation').length, resultados: document.querySelectorAll('.awd-results article').length }))
await admin.screenshot({ path: `${out}/admin-1440x900.png`, fullPage: true })

const atleta = await browser.newPage({ viewport: { width: 390, height: 844 } })
await atleta.addInitScript(() => localStorage.setItem('ins_session', JSON.stringify({ token: 'teste', email: 'ana@teste.local' })))
await atleta.route('**/api/me.php', route => route.fulfill({ json: { autenticado: true, email: 'ana@teste.local', pessoa: { id: 1, nome: 'Ana Lima', email: 'ana@teste.local', genero: 'mulher', clube: 'Floripa', cidade: 'Florianópolis', nacionalidade: 'brasileire' }, config: { alojamento_aberto: false, alimentacao_aberto: false }, inscricao: { id: 1, status: 'pago', tipo_participacao: 'atleta', latino: false, acao_afirmativa: false, categorias: [{ categoria: 'misto', valor: 182 }], times: [], alimentacao: [], alojamento: [], restricao_alimentar: null, pagamentos: [], criado_em: '2026-01-01 12:00:00', valor_total: 182 } } }))
await atleta.route('**/api/awards.php', route => route.fulfill({ json: route.request().method() === 'POST'
  ? { ok: true, dados: { status: 'aberta', categorias, meus_votos: { mvp: 2, wow: 2, revelacao: 2, jesse: 2 }, completo: true } }
  : { status: 'aberta', categorias, meus_votos: {}, completo: false } }))
await atleta.goto(`${base}/minha-inscricao`, { waitUntil: 'networkidle' })
await atleta.getByRole('button', { name: 'Votar agora' }).click()
const atletaMetrics = await atleta.evaluate(() => ({ title: document.querySelector('.awv-panel h2')?.textContent, candidates: document.querySelectorAll('.awv-candidates>button').length, selfVisible: [...document.querySelectorAll('.awv-candidates strong')].some(e => e.textContent === 'Ana Lima'), overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth }))
await atleta.screenshot({ path: `${out}/atleta-mobile-390x844.png`, fullPage: true })
for (let etapa = 0; etapa < 4; etapa++) {
  const opcoes = atleta.locator('.awv-candidates>button')
  if (await opcoes.count() < 1) throw new Error(`Categoria ${etapa + 1} sem candidatos`)
  await opcoes.nth(0).click()
  await atleta.getByRole('button', { name: 'Continuar' }).click()
}
const resumo = await atleta.locator('.awv-summary>button').count()
await atleta.getByRole('button', { name: 'Confirmar votos' }).click()
const registrado = await atleta.getByRole('button', { name: 'Rever votos' }).isVisible()

console.log(JSON.stringify({ admin: adminMetrics, atleta: { ...atletaMetrics, resumo, registrado } }, null, 2))
await browser.close()
