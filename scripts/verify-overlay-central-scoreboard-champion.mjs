import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const base = process.env.OVERLAY_BASE_URL || 'http://127.0.0.1:5173'
const out = 'test-artifacts/overlay-central-scoreboard'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })

const central = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await central.goto(`${base}/overlays`, { waitUntil: 'networkidle' })
const centralMetrics = await central.evaluate(() => ({
  cards: document.querySelectorAll('.ovc-card').length,
  urlsAbsolutas: [...document.querySelectorAll('.ovc-card input')].every(input => input.value.startsWith(location.origin)),
  linksNovaAba: [...document.querySelectorAll('.ovc-card a')].every(link => link.target === '_blank'),
  overflow: [document.documentElement.scrollWidth, document.documentElement.clientWidth],
}))
await central.screenshot({ path: `${out}/central-1440x900.png`, fullPage: true })
await central.close()

async function champion(width, height) {
  const page = await browser.newPage({ viewport: { width, height } })
  const errors = []
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${base}/torneio/placar?preview=campeao`, { waitUntil: 'networkidle' })
  const moments = [2, 5, 10, 15, 20, 30]
  let elapsed = 0
  for (const second of moments) {
    await page.waitForTimeout((second - elapsed) * 1000)
    await page.screenshot({ path: `${out}/campeao-${width}x${height}-${second}s.png` })
    elapsed = second
  }
  const metrics = await page.evaluate(() => {
    const root = document.querySelector('.plc-champion')
    return {
      champion: Boolean(root),
      roster: document.querySelectorAll('.pcc-roster>div').length,
      viewport: root ? [root.scrollWidth, root.scrollHeight, root.clientWidth, root.clientHeight] : null,
      bodyOverflow: [document.documentElement.scrollWidth, document.documentElement.clientWidth, document.documentElement.scrollHeight, document.documentElement.clientHeight],
    }
  })
  await page.close()
  return { width, height, errors, ...metrics }
}

const championMetrics = await Promise.all([champion(1920, 1080), champion(1280, 720)])
await browser.close()
console.log(JSON.stringify({ central: centralMetrics, champion: championMetrics }, null, 2))
