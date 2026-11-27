/**
 * Vetoriza logos de patrocinadores (public/imgs/logos/originais → public/imgs/logos/*.svg).
 *
 * Uso:
 *   node scripts/generate-logos.mjs chandan.jpg@4 van.jpeg
 *
 * - Cada argumento é um arquivo de originais/; "@N" amplia N vezes antes do trace
 *   (suaviza as curvas de imagens pequenas).
 * - Só a parte escura vira forma; o SVG sai SEM fundo (a faixa "Apoiadores" da Home
 *   aplica brightness(0) invert(1), então qualquer fundo viraria um retângulo branco).
 * - Sem argumentos, usa a lista histórica abaixo.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Jimp from 'jimp'
import potrace from 'potrace'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'public', 'imgs', 'logos', 'originais')
const DEST = path.join(ROOT, 'public', 'imgs', 'logos')

const LISTA_PADRAO = [
  'bugio.png',
  'casabicicletas.jpeg',
  'chandan.jpg',
  'drop.jpg',
  'marino.png',
  'pedalamais.jpg',
  'toniracks.png',
  'velkro.png',
  'zeta.jpg',
]

const pedidos = (process.argv.length > 2 ? process.argv.slice(2) : LISTA_PADRAO).map(arg => {
  const [nome, escala] = arg.split('@')
  return { nome, escala: escala ? Number(escala) : 1 }
})

function trace(image, output) {
  return new Promise((resolve, reject) => {
    potrace.trace(
      image,
      {
        turnpolicy: 'minority',
        turdsize: 2,
        optcurve: true,
        alphamax: 1,
        opttolerance: 0.2,
        background: 'transparent', // nunca gerar <rect> de fundo
        color: 'black',
      },
      (err, svg) => {
        if (err) reject(err)
        else fs.writeFile(output, svg).then(resolve, reject)
      },
    )
  })
}

const results = await Promise.all(pedidos.map(async ({ nome, escala }) => {
  const image = await Jimp.read(path.join(SRC, nome))
  if (escala > 1) image.resize(image.bitmap.width * escala, image.bitmap.height * escala, Jimp.RESIZE_BICUBIC)
  const slug = nome.replace(/\.(png|jpg|jpeg)$/i, '')
  await trace(image, path.join(DEST, `${slug}.svg`))
  return `${slug}.svg${escala > 1 ? ` (ampliado ${escala}x)` : ''}`
}))
console.log('Generated SVGs:\n - ' + results.join('\n - '))
