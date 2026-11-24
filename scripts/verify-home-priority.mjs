import { chromium } from 'playwright'
import fs from 'node:fs/promises'

const out = 'test-artifacts/home-prioridade'
await fs.mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })

for (const viewport of [{ name: 'desktop', width: 1366, height: 768 }, { name: 'mobile', width: 390, height: 844 }]) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  await page.goto('http://127.0.0.1:5190/', { waitUntil: 'domcontentloaded' })
  await page.locator('.home-links').waitFor({ state: 'visible' })

  const links = await page.evaluate(() => ({
    title: document.querySelector('.home-links-title')?.textContent,
    primary: [...document.querySelectorAll('.home-primary-grid a')].map(a => a.getAttribute('href')),
    operational: [...document.querySelectorAll('.home-operational-grid a')].map(a => a.getAttribute('href')),
    more: [...document.querySelectorAll('.home-more a')].map(a => a.getAttribute('href')),
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: innerWidth,
  }))
  if (links.title !== 'Acompanhe o 2° Pior Campeonato de Bici Polo 2026') throw new Error(`Título incorreto: ${links.title}`)
  if (JSON.stringify(links.primary) !== JSON.stringify(['/torneio/resultados', '/torneio', '/equipes'])) throw new Error(`CTAs principais incorretos: ${links.primary}`)
  if (JSON.stringify(links.operational) !== JSON.stringify(['/torneio/misto?aba=regulamento', '/minha-inscricao'])) throw new Error(`CTAs operacionais incorretos: ${links.operational}`)
  if (!links.more.includes('/carteira') || !links.more.includes('/inscricoes')) throw new Error('Acessos secundários ausentes')
  if (links.scrollWidth > links.viewportWidth) throw new Error(`Overflow horizontal em ${viewport.name}`)

  await page.locator('.home-links').scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${out}/home-acessos-${viewport.name}.png` })

  if (viewport.name === 'mobile') {
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(500)
    const toggle = page.getByRole('button', { name: 'Abrir menu' })
    await toggle.click()
    await page.screenshot({ path: `${out}/navbar-mobile.png` })
    const drawer = (await page.locator('.site-nav-drawer').innerText()).toLocaleUpperCase('pt-BR')
    if (!drawer.includes('TORNEIO') || !drawer.includes('REGULAMENTO') || !drawer.includes('CARTEIRA') || !drawer.includes('INSCRIÇÕES')) throw new Error(`Menu mobile incompleto: ${drawer}`)
  } else {
    const desktop = await page.locator('.site-nav-desktop').innerText()
    if (!desktop.startsWith('RESULTADOS\nTORNEIO\nEQUIPES\nREGULAMENTO')) throw new Error(`Ordem desktop incorreta: ${desktop}`)
    if (!desktop.includes('ÁREA DA PESSOA ATLETA')) throw new Error('CTA da pessoa atleta ausente')
  }
  await context.close()
}

await browser.close()
console.log('OK: hierarquia da home e navbar validadas em desktop e mobile.')
