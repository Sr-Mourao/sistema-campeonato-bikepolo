import { chromium } from 'playwright'

const baseUrl = process.env.OVERLAY_URL || 'http://localhost:5173/torneio/overlay/intervalo'
const browser = await chromium.launch({ headless: true })

async function inspect(width, height) {
  const page = await browser.newPage({ viewport: { width, height } })
  const apiRequests = []
  const consoleErrors = []
  page.on('request', request => {
    if (/\/api\/|torneio-publico/i.test(request.url())) apiRequests.push(request.url())
  })
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.locator('.iv-brand--entra').waitFor()
  await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0))

  const metrics = await page.evaluate(() => {
    const selectors = ['html', 'body', '#root', '.iv-overlay']
    const backgrounds = Object.fromEntries(selectors.map(selector => {
      const node = document.querySelector(selector)
      return [selector, node ? getComputedStyle(node).backgroundColor : null]
    }))
    const important = [...document.querySelectorAll('.iv-slab, .iv-titlebar, .iv-state, .iv-sponsor-plate')].map(node => {
      const rect = node.getBoundingClientRect()
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
    })
    const sponsor = document.querySelector('.iv-brand--entra')
    return {
      backgrounds,
      scrollX: document.documentElement.scrollWidth - innerWidth,
      scrollY: document.documentElement.scrollHeight - innerHeight,
      sponsorObjectFit: sponsor ? getComputedStyle(sponsor).objectFit : null,
      sponsorCount: document.querySelector('.iv-sponsor-tab b')?.textContent?.trim(),
      important,
    }
  })

  const transparentPath = `tmp/interval-overlay-${width}x${height}-alpha.png`
  await page.screenshot({ path: transparentPath, omitBackground: true })

  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      const preload = new Image()
      preload.onload = resolve
      preload.onerror = reject
      preload.src = '/imgs/apoie/DSC_3981.jpg'
    })
    const camera = document.createElement('div')
    camera.id = 'visual-camera-test'
    Object.assign(camera.style, {
      position: 'fixed', inset: '0', zIndex: '0',
      background: "linear-gradient(90deg, rgba(0,0,0,.06), rgba(0,0,0,.06)), url('/imgs/apoie/DSC_3981.jpg') center / cover no-repeat",
    })
    document.body.prepend(camera)
    const root = document.querySelector('#root')
    Object.assign(root.style, { position: 'relative', zIndex: '1' })
  })
  await page.screenshot({ path: `tmp/interval-overlay-${width}x${height}-camera.png` })
  await page.close()
  return { viewport: `${width}x${height}`, apiRequests, consoleErrors, metrics, transparentPath }
}

async function inspectLoop() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  await page.addInitScript(() => {
    const nativeSetInterval = window.setInterval.bind(window)
    window.setInterval = (handler, timeout, ...args) => nativeSetInterval(handler, timeout === 8000 ? 120 : timeout, ...args)
  })
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  const active = page.locator('.iv-brand--entra')
  await active.waitFor()
  const first = await active.getAttribute('data-sponsor')
  await page.waitForFunction(value => document.querySelector('.iv-brand--entra')?.getAttribute('data-sponsor') !== value, first)
  const second = await active.getAttribute('data-sponsor')
  await page.waitForFunction(value => document.querySelector('.iv-brand--entra')?.getAttribute('data-sponsor') === value, first, { timeout: 5000 })
  const looped = await active.getAttribute('data-sponsor')
  await page.close()
  return { first, second, looped }
}

try {
  const desktop = await inspect(1920, 1080)
  const hd = await inspect(1280, 720)
  const loop = await inspectLoop()
  console.log(JSON.stringify({ desktop, hd, loop }, null, 2))
} finally {
  await browser.close()
}
