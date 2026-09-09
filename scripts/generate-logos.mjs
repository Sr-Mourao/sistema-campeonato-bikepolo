import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import potrace from 'potrace'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'public', 'imgs', 'logos', 'originais')
const DEST = path.join(ROOT, 'public', 'imgs', 'logos')

const NEED = [
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

function trace(input, output) {
  return new Promise((resolve, reject) => {
    potrace.trace(
      input,
      {
        turnpolicy: 'minority',
        turdsize: 2,
        optcurve: true,
        alphamax: 1,
        opttolerance: 0.2,
      },
      (err, svg) => {
        if (err) reject(err)
        else fs.writeFile(output, svg).then(resolve, reject)
      }
    )
  })
}

const tasks = NEED.map(async name => {
  const input = path.join(SRC, name)
  const slug = name.replace(/\.(png|jpg|jpeg)$/i, '')
  const output = path.join(DEST, `${slug}.svg`)
  await trace(input, output)
  return `${slug}.svg`
})

const results = await Promise.all(tasks)
console.log('Generated SVGs:\n - ' + results.join('\n - '))
