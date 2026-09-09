import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const base = process.env.OVERLAY_BASE_URL || 'http://127.0.0.1:5173'
const cases = [
  ['classificacao', '/torneio/overlay/classificacao?preview=classificacao-revisao'],
  ['repescagem', '/torneio/overlay/repescagem?preview=1'],
  ['double', '/torneio/overlay/double?preview=1'],
  ['final', '/torneio/overlay/final?preview=final'],
  ['campeao', '/torneio/overlay/final?preview=campeao'],
]
const sizes = [[1920, 1080], [1280, 720]]
const out = 'test-artifacts/overlays'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const report = []
for (const [width, height] of sizes) {
  for (const [name, path] of cases) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
    const errors = []
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(base + path, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2300)
    const metrics = await page.evaluate(() => {
      const root = document.querySelector('.tg-overlay')
      const style = getComputedStyle(document.body)
      return {
        bodyBackground: style.backgroundColor,
        root: root ? { width: root.scrollWidth, height: root.scrollHeight, clientWidth: root.clientWidth, clientHeight: root.clientHeight } : null,
        text: document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 240),
      }
    })
    await page.screenshot({ path: `${out}/${name}-${width}x${height}.png`, omitBackground: true })
    report.push({ name, width, height, errors, ...metrics })
    await page.close()
  }
}
await browser.close()
console.log(JSON.stringify(report, null, 2))
