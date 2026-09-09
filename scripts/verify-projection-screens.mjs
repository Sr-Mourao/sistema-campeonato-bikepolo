import { chromium } from 'playwright'
import fs from 'node:fs/promises'

const base = 'http://127.0.0.1:5190'
const out = 'test-artifacts/projecao'
await fs.mkdir(out, { recursive: true })

const award = (codigo, nome, vencedor, empate = false) => ({
  codigo, nome, descricao: nome, total_votos: empate ? 2 : 1, maior_quantidade: 1,
  vencedores: (Array.isArray(vencedor) ? vencedor : [vencedor]).map((pessoa, index) => ({ pessoa_id: index + 1, nome: pessoa, foto: null, time: index ? 'Pedal Insular' : 'Floripa Polo', votos: 1 })),
  empate,
})
const single = {
  status: 'aberta', categorias: {
    mvp: award('mvp', 'MVP', 'Ana Costa'), wow: award('wow', 'WOW', 'Bruno Ribeiro'),
    revelacao: award('revelacao', 'Revelação', 'Carlos Nascimento'), jesse: award('jesse', 'Jessé', 'Ana Costa'),
  },
}
const tie = structuredClone(single)
tie.categorias.mvp = award('mvp', 'MVP', ['Ana Costa', 'Bruno Ribeiro'], true)
const zero = structuredClone(single)
zero.categorias.mvp = { ...zero.categorias.mvp, total_votos: 0, maior_quantidade: 0, vencedores: [], empate: false }

const podio = { podio: [
  { posicao: 1, time_id: 1, nome: 'Floripa Bike Polo', logo: null },
  { posicao: 2, time_id: 2, nome: 'Pedal Insular Coletivo', logo: null },
  { posicao: 3, time_id: 3, nome: 'Capivaras do Sul', logo: null },
] }
const rosters = {
  1: ['Ana Costa', 'Bia Alves', 'Caio Lima', 'Dani Rocha'],
  2: ['Eva Silva', 'Fábio Luz', 'Gabi Melo', 'Hugo Reis'],
  3: ['Iara Paz', 'João Dias', 'Kika Melo', 'Leo Luz'],
}

const browser = await chromium.launch({ headless: true })
const report = []
for (const [width, height] of [[1920, 1080], [1366, 768]]) {
  const context = await browser.newContext({ viewport: { width, height } })
  const page = await context.newPage()
  let awardsPayload = single
  await page.route('**/api/admin/awards.php?view=projecao', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(awardsPayload) }))
  await page.route('**/api/torneio-publico.php?*', route => {
    const url = new URL(route.request().url())
    if (url.searchParams.get('action') === 'podio') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(podio) })
    if (url.searchParams.get('action') === 'time') {
      const id = Number(url.searchParams.get('time_id'))
      const elenco = (rosters[id] ?? []).map((nome, i) => ({ membro_id: id * 10 + i, nome, foto_path: null }))
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ time: { id, nome: podio.podio.find(t => t.time_id === id)?.nome, logo_path: null }, elenco }) })
    }
    return route.continue()
  })

  for (const path of ['/overlays/podio', '/overlays/awards', '/overlays/awards/mvp', '/overlays/awards/wow', '/overlays/awards/revelacao', '/overlays/awards/jesse']) {
    await page.goto(base + path, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1800)
    const metrics = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth, scrollH: document.documentElement.scrollHeight,
      viewportW: innerWidth, viewportH: innerHeight,
      frame: Boolean(document.querySelector('.prj-frame')),
      text: document.querySelector('.prj-sequence')?.textContent ?? '',
    }))
    if (!metrics.frame || metrics.scrollW > width || metrics.scrollH > height) throw new Error(`Overflow/frame inválido em ${path} ${width}x${height}: ${JSON.stringify(metrics)}`)
    const slug = path.replaceAll('/', '-').replace(/^-/, '') || 'root'
    await page.screenshot({ path: `${out}/${slug}-${width}x${height}.png` })
    report.push({ path, size: `${width}x${height}`, ...metrics })
  }

  await page.goto(base + '/overlays', { waitUntil: 'domcontentloaded' })
  await page.locator('.ovc-page').waitFor({ state: 'visible', timeout: 10000 })
  const stageLinks = await page.locator('.ovc-group--stage .ovc-card--stage').count()
  const centralMetrics = await page.evaluate(() => {
    const central = document.querySelector('.ovc-page')
    return { scrollW: document.documentElement.scrollWidth, viewportW: innerWidth, scrollH: central?.scrollHeight ?? 0, clientH: central?.clientHeight ?? 0, overflowY: central ? getComputedStyle(central).overflowY : '' }
  })
  if (stageLinks !== 6 || centralMetrics.scrollW > width || centralMetrics.scrollH <= centralMetrics.clientH || centralMetrics.overflowY !== 'auto') throw new Error(`Central inválida: ${JSON.stringify({ stageLinks, ...centralMetrics })}`)
  await page.evaluate(() => { const central = document.querySelector('.ovc-page'); if (central) central.scrollTop = central.scrollHeight })
  await page.screenshot({ path: `${out}/central-palco-${width}x${height}.png` })

  awardsPayload = tie
  await page.goto(base + '/overlays/awards/mvp', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  const tieNames = await page.locator('.pra-winner').count()
  if (tieNames !== 2) throw new Error(`Empate deveria renderizar 2 vencedores, renderizou ${tieNames}`)
  await page.screenshot({ path: `${out}/awards-mvp-empate-${width}x${height}.png` })

  awardsPayload = zero
  await page.goto(base + '/overlays/awards/mvp', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(900)
  if (!(await page.getByText('Aguardando votos', { exact: true }).isVisible())) throw new Error('Estado zero votos não apareceu')

  const before = await page.locator('.prj-sequence').getAttribute('data-replay')
  await page.keyboard.press('r')
  const after = await page.locator('.prj-sequence').getAttribute('data-replay')
  if (before === after) throw new Error('Atalho R não reiniciou a sequência')
  await context.close()
}
await browser.close()
await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2))
console.log(`OK: ${report.length} renderizações principais, central, empate, zero votos e replay validados.`)
