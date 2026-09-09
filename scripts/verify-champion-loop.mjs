import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const base = process.env.OVERLAY_BASE_URL || 'http://127.0.0.1:5173'
const checkpoints = [0, 5, 10, 15, 20, 30]
const sizes = [[1920, 1080], [1280, 720]]
const out = 'test-artifacts/champion-loop'

await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })

async function validate(width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
  const errors = []
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${base}/torneio/overlay/final?preview=campeao`, { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    window.__championIntroMutations = []
    const root = document.querySelector('.tc-final')
    new MutationObserver(() => window.__championIntroMutations.push({
      at: performance.now(),
      value: root?.getAttribute('data-intro'),
    })).observe(root, { attributes: true, attributeFilter: ['data-intro'] })
  })
  await page.waitForTimeout(2300)

  const frames = []
  let previous = 0
  for (const second of checkpoints) {
    await page.waitForTimeout((second - previous) * 1000)
    previous = second
    const metrics = await page.evaluate(() => {
      const style = selector => {
        const element = document.querySelector(selector)
        if (!element) return null
        const computed = getComputedStyle(element)
        const box = element.getBoundingClientRect()
        return {
          transform: computed.transform,
          opacity: computed.opacity,
          box: { left: box.left, top: box.top, right: box.right, bottom: box.bottom },
        }
      }
      const root = document.querySelector('.tc-final')
      return {
        intro: root?.getAttribute('data-intro'),
        viewport: { width: innerWidth, height: innerHeight },
        document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
        bodyBackground: getComputedStyle(document.body).backgroundColor,
        crest: style('.tf-champion-crest'),
        player1: style('.tf-roster > div:nth-child(1)'),
        player4: style('.tf-roster > div:nth-child(4)'),
        title: style('.tf-champion-copy strong'),
        team: style('.tf-champion-copy b'),
        background: style('.tf-champion-lines'),
      }
    })
    await page.screenshot({ path: `${out}/champion-${width}x${height}-${second}s.png`, omitBackground: true })
    frames.push({ second, ...metrics })
  }

  const introMutations = await page.evaluate(() => window.__championIntroMutations)
  await page.close()
  return { width, height, errors, introMutations, frames }
}

const report = await Promise.all(sizes.map(([width, height]) => validate(width, height)))
await browser.close()
console.log(JSON.stringify(report, null, 2))
