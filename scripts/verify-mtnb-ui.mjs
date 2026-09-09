import { chromium } from 'playwright'

const base = process.env.MTNB_BASE_URL || 'http://127.0.0.1:5190'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } })
const errors = []
page.on('pageerror', error => errors.push(error.message))
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })

await page.goto(`${base}/torneio/mtnb`, { waitUntil: 'networkidle' })
const publicState = await page.evaluate(() => ({
  title: document.querySelector('.trp-header-title')?.textContent?.trim(),
  tabs: [...document.querySelectorAll('.trp-tab')].map(node => node.textContent?.trim()),
  error: document.querySelector('.trp-erro')?.textContent?.trim(),
}))
if (publicState.title !== '4º Brasileiro MTNB') throw new Error(`Título MTNB incorreto: ${JSON.stringify(publicState)}`)
if (publicState.tabs.includes('Repescagem') || publicState.tabs.length !== 5) throw new Error(`Abas MTNB incorretas: ${JSON.stringify(publicState.tabs)}`)
if (publicState.error) throw new Error(`Página MTNB retornou erro: ${publicState.error}`)

await page.goto(`${base}/torneio/mtnb/overlay/classificacao`, { waitUntil: 'networkidle' })
const overlayState = await page.evaluate(() => ({
  rows: document.querySelectorAll('.tc-standing-list>li').length,
  text: document.querySelector('.tg-title')?.textContent?.replace(/\s+/g, ' ').trim(),
  repescagem: document.body.textContent?.includes('Repescagem'),
}))
if (overlayState.rows !== 5 || overlayState.repescagem || !overlayState.text?.includes('4º MTNB')) throw new Error(`Overlay MTNB incorreto: ${JSON.stringify(overlayState)}`)
if (errors.length) throw new Error(`Erros no navegador: ${errors.join(' | ')}`)

await browser.close()
console.log('OK: página e overlay MTNB validados sem Repescagem e com cinco equipes.')
