import { chromium } from 'playwright'
import fs from 'node:fs/promises'

const out = 'test-artifacts/torneio-hub'
await fs.mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })

for (const viewport of [{ name: 'desktop', width: 1366, height: 768 }, { name: 'mobile', width: 390, height: 844 }]) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  await page.goto('http://127.0.0.1:5190/torneio', { waitUntil: 'domcontentloaded' })
  await page.locator('.trps-broadcast').waitFor({ state: 'visible' })
  await page.waitForTimeout(2500)

  const state = await page.evaluate(() => ({
    title: document.querySelector('.trps-header-title')?.textContent,
    intro: document.querySelector('.trps-header-sub')?.textContent,
    tournamentLinks: [...document.querySelectorAll('.trps-panel')].map(node => ({ href: node.getAttribute('href'), target: node.getAttribute('target'), text: node.textContent })),
    liveLinks: [...document.querySelectorAll('.trps-live-card')].map(node => node.getAttribute('href')),
    resultLinks: [...document.querySelectorAll('.trps-results a')].map(node => node.getAttribute('href')),
    thumbnails: [...document.querySelectorAll('.trps-live-thumb img')].map(node => ({ src: node.getAttribute('src'), width: node instanceof HTMLImageElement ? node.naturalWidth : 0 })),
    buena: document.querySelector('.trps-broadcast>header img')?.getAttribute('src'),
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: innerWidth,
  }))
  if (state.title !== 'Torneio' || !state.intro?.includes('jogos, tabelas, classificação e chaveamentos')) throw new Error('Introdução do hub incorreta')
  if (state.tournamentLinks[0]?.href !== '/torneio/misto' || state.tournamentLinks[1]?.href !== '/torneio/mtnb' || state.tournamentLinks[1]?.target) throw new Error(`Cards dos torneios incorretos: ${JSON.stringify(state.tournamentLinks)}`)
  if (state.tournamentLinks.some(link => !link.text?.toLocaleLowerCase('pt-BR').includes('acompanhar torneio'))) throw new Error('CTA de acompanhamento ausente')
  if (JSON.stringify(state.resultLinks) !== JSON.stringify(['/torneio/resultados?categoria=misto', '/torneio/resultados?categoria=mtnb'])) throw new Error(`Links de resultados inválidos: ${JSON.stringify(state.resultLinks)}`)
  if (state.liveLinks.length !== 4 || !state.liveLinks.includes('https://www.youtube.com/live/Dkh2EiHnlzI?is=7chiaSCcTv5o5b41') || state.thumbnails.some(image => image.width === 0)) throw new Error(`Lives/thumbnails inválidas: ${JSON.stringify(state)}`)
  if (!state.buena?.includes('BMSC_Negativo_Principal.png')) throw new Error('Logo Buena Mira incorreto')
  if (state.scrollWidth > state.viewportWidth) throw new Error(`Overflow horizontal em ${viewport.name}`)

  await page.screenshot({ path: `${out}/topo-${viewport.name}.png` })
  await page.locator('.trps-broadcast').scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${out}/transmissoes-${viewport.name}.png` })
  await context.close()
}

await browser.close()
console.log('OK: hub do torneio validado em desktop e mobile.')
