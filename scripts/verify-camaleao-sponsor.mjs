import { chromium } from 'playwright'
import fs from 'node:fs/promises'

const out = 'test-artifacts/camaleao'
await fs.mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })

const homeContext = await browser.newContext({ viewport: { width: 1366, height: 768 } })
const home = await homeContext.newPage()
await home.goto('http://127.0.0.1:5190/', { waitUntil: 'domcontentloaded' })
const logos = home.locator('img[alt="Camaleão Drinks"]')
await logos.first().waitFor({ state: 'attached' })
if (await logos.count() !== 2) throw new Error('Camaleão deveria estar nos dois grupos do marquee infinito da home')
if (!(await logos.first().getAttribute('src'))?.includes('/imgs/logos/originais/camaleao.png')) throw new Error('Home não usa o logo original do Camaleão')
await home.locator('#apoie').scrollIntoViewIfNeeded()
await home.screenshot({ path: `${out}/home-apoiadores.png` })
await homeContext.close()

const obsContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
const intervalo = await obsContext.newPage()
await intervalo.goto('http://127.0.0.1:5190/torneio/overlay/intervalo', { waitUntil: 'domcontentloaded' })
await intervalo.waitForTimeout(17200)
const camaleao = intervalo.locator('img[data-sponsor="camaleao"]')
await camaleao.waitFor({ state: 'visible' })
if (!(await camaleao.getAttribute('src'))?.includes('/imgs/logos/originais/camaleao.png')) throw new Error('Intervalo não usa o logo original do Camaleão')
await intervalo.screenshot({ path: `${out}/intervalo-camaleao.png` })
await obsContext.close()

await browser.close()
console.log('OK: Camaleão visível na home e na rotação do intervalo.')
