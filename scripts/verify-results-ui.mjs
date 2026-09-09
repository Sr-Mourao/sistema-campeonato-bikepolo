import { chromium } from 'playwright'
import fs from 'node:fs/promises'

const base = process.env.RESULTS_BASE_URL || 'http://127.0.0.1:5190'
const out = 'test-artifacts/resultados'
await fs.mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })

for (const viewport of [
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'desktop-1280', width: 1280, height: 900 },
  { name: 'desktop-1920', width: 1920, height: 1080 },
]) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  await page.goto(`${base}/torneio/resultados?categoria=misto`, { waitUntil: 'networkidle' })
  await page.locator('[data-testid="classificacao-final"] .res-final-row').first().waitFor()
  await page.waitForTimeout(900)
  const misto = await page.evaluate(() => ({
    titulo: document.querySelector('.res-hero h1')?.textContent,
    final: document.querySelectorAll('[data-testid="classificacao-final"] .res-final-row').length,
    primeira: document.querySelectorAll('.res-standings-desktop tbody tr').length,
    primeiraMobile: document.querySelectorAll('.res-standings-mobile > article').length,
    overflow: document.documentElement.scrollWidth > innerWidth,
    animations: document.getAnimations().length,
    champion: document.querySelector('.res-champion')?.textContent,
    g5: document.querySelectorAll('.res-final-row.is-g5').length,
    awards: document.querySelectorAll('.res-awards-grid > article').length,
    sportAwards: document.querySelectorAll('.res-sport-awards > article').length,
  }))
  if (!misto.titulo?.includes('10º Brasileiro Misto') || misto.final !== 13 || misto.primeira !== 13 || misto.primeiraMobile !== 13 || misto.g5 !== 5 || misto.awards < 1 || misto.sportAwards !== 2 || misto.overflow || !misto.champion) throw new Error(`Misto inválido em ${viewport.name}: ${JSON.stringify(misto)}`)
  if (misto.animations < 1) throw new Error(`Animações editoriais ausentes em ${viewport.name}`)
  await page.screenshot({ path: `${out}/${viewport.name}-hero-misto.png` })

  const firstRow = page.locator('[data-testid="classificacao-final"] .res-final-row').first()
  await firstRow.scrollIntoViewIfNeeded()
  await firstRow.locator('button').click()
  await firstRow.locator('.res-team-detail').waitFor()
  const detail = await firstRow.locator('.res-team-detail').evaluate(node => ({ text: node.textContent, width: node.scrollWidth, client: node.clientWidth }))
  if (!detail.text?.includes('Jogos da equipe') || detail.width > detail.client + 1) throw new Error(`Detalhe inválido em ${viewport.name}`)
  await page.screenshot({ path: `${out}/${viewport.name}-classificacao-aberta.png`, fullPage: viewport.width >= 1280 })

  await page.getByRole('button', { name: 'MTNB', exact: true }).click()
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="classificacao-final"] .res-final-row').length === 5)
  const mtnb = await page.evaluate(() => ({ final: document.querySelectorAll('[data-testid="classificacao-final"] .res-final-row').length, primeira: document.querySelectorAll('.res-standings-mobile > article').length, awards: document.querySelectorAll('.res-awards-grid > article').length, sportAwards: document.querySelectorAll('.res-sport-awards > article').length, g5: document.querySelectorAll('.res-final-row.is-g5').length, overflow: document.documentElement.scrollWidth > innerWidth, title: document.querySelector('.res-hero h1')?.textContent }))
  if (mtnb.final !== 5 || mtnb.primeira !== 5 || mtnb.awards < 1 || mtnb.sportAwards !== 2 || mtnb.g5 !== 0 || mtnb.overflow || !mtnb.title?.includes('4º Brasileiro MTNB')) throw new Error(`MTNB inválido em ${viewport.name}: ${JSON.stringify(mtnb)}`)
  await page.screenshot({ path: `${out}/${viewport.name}-hero-mtnb.png` })
  await context.close()
}

// Estresse visual isolado: empate oficial, foto ausente, nome longo e escudo ausente.
const stress = await browser.newContext({ viewport: { width: 390, height: 844 } })
const stressPage = await stress.newPage()
await stressPage.route('**/api/torneio-publico.php?action=resultados&categoria=misto', async route => {
  const response = await route.fetch()
  const data = await response.json()
  data.classificacao_final[4].nome = 'Associação Cultural Bike Polo da Grande Florianópolis'
  data.classificacao_final[4].logo = null
  data.awards = { status: 'encerrada', categorias: [{ codigo: 'mvp', nome: 'MVP', descricao: 'Melhor atleta em quadra.', empate: true, total_votos: 20, maior_quantidade: 10, vencedores: [{ pessoa_id: 9001, nome: 'Pessoa Sem Foto', foto: null, time: 'Clube de nome especialmente longo', votos: 10, posicao: 1, percentual: 50 }, { pessoa_id: 9002, nome: 'Outra Pessoa Premiada', foto: data.classificacao_final[0].elenco[0]?.foto_path ?? null, time: data.classificacao_final[0].nome, votos: 10, posicao: 1, percentual: 50 }] }] }
  await route.fulfill({ response, json: data })
})
await stressPage.goto(`${base}/torneio/resultados?categoria=misto`, { waitUntil: 'networkidle' })
await stressPage.locator('.res-awards').scrollIntoViewIfNeeded()
const stressMetrics = await stressPage.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, winners: document.querySelectorAll('.res-awards-grid .res-winners > div').length, tie: document.querySelector('.res-tie')?.textContent }))
if (stressMetrics.overflow || stressMetrics.winners !== 2 || !stressMetrics.tie?.includes('dividida')) throw new Error(`Stress visual inválido: ${JSON.stringify(stressMetrics)}`)
await stressPage.screenshot({ path: `${out}/mobile-390-award-empate-stress.png`, fullPage: true })
await stress.close()

const reduced = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
const reducedPage = await reduced.newPage()
await reducedPage.goto(`${base}/torneio/resultados`, { waitUntil: 'networkidle' })
const motion = await reducedPage.evaluate(() => ({ reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, duration: getComputedStyle(document.querySelector('.res-hero-copy')).animationDuration }))
if (!motion.reduced || Number.parseFloat(motion.duration) > 0.001) throw new Error(`Reduced motion não respeitado: ${JSON.stringify(motion)}`)
await reduced.close()

await browser.close()
console.log('OK: Resultados validado em 390, 1280 e 1920; Misto, MTNB, detalhes, animações, reduced motion e stress de Awards.')
