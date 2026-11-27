/**
 * Confere a primeira marca de public/patrocinadores.json na Home (faixa "Apoiadores")
 * e na rotação do overlay de intervalo. Precisa do site rodando:
 *   BASE=http://127.0.0.1:5190 node scripts/verify-sponsors.mjs   (padrão: 127.0.0.1:5190)
 *   PW_CHANNEL=msedge                                               (opcional)
 */
import { chromium } from 'playwright'
import fs from 'node:fs/promises'

const BASE = process.env.BASE || 'http://127.0.0.1:5190'
const lista = JSON.parse(await fs.readFile(new URL('../public/patrocinadores.json', import.meta.url), 'utf8'))
const marca = lista[0]
if (!marca) throw new Error('patrocinadores.json está vazio')

const out = 'test-artifacts/sponsors'
await fs.mkdir(out, { recursive: true })
// PW_CHANNEL=msedge usa o Edge instalado (sem baixar o Chromium do Playwright)
const browser = await chromium.launch({ headless: true, channel: process.env.PW_CHANNEL || undefined })

// Home: a faixa usa o SVG ("logo") e repete o grupo para o marquee infinito
if (marca.logo) {
  const homeContext = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  const home = await homeContext.newPage()
  await home.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  // Só a faixa "Apoiadores": o rodapé também mostra a marca, com o mesmo alt
  const logos = home.locator(`.red-zone-marquee img[alt="${marca.nome}"]`)
  await logos.first().waitFor({ state: 'attached' })
  if (await logos.count() !== 2) throw new Error(`${marca.nome} deveria estar nos dois grupos do marquee infinito da home`)
  if (!(await logos.first().getAttribute('src'))?.includes(marca.logo)) throw new Error(`Home não usa ${marca.logo}`)
  await home.locator('#apoie').scrollIntoViewIfNeeded()
  await home.screenshot({ path: `${out}/home-apoiadores.png` })
  await homeContext.close()
}

// Intervalo: só usa originais de /imgs/logos/originais/; a primeira marca entra primeiro
const obsContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
const intervalo = await obsContext.newPage()
await intervalo.goto(`${BASE}/torneio/overlay/intervalo`, { waitUntil: 'domcontentloaded' })
const img = intervalo.locator(`img[data-sponsor="${marca.slug}"]`)
await img.first().waitFor({ state: 'visible', timeout: 20000 })
if (!(await img.first().getAttribute('src'))?.includes(marca.logoOriginal)) throw new Error(`Intervalo não usa ${marca.logoOriginal}`)
await intervalo.screenshot({ path: `${out}/intervalo-${marca.slug}.png` })
await obsContext.close()

await browser.close()
console.log(`OK: ${marca.nome} visível na home e na rotação do intervalo.`)
