import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PUBLIC = path.join(ROOT, 'public')

const json = JSON.parse(
  await fs.readFile(path.join(PUBLIC, 'patrocinadores.json'), 'utf8')
)

const errors = []

for (const p of json) {
  for (const key of ['logo', 'logoOriginal']) {
    const pth = path.join(PUBLIC, p[key].replace(/^\//, ''))
    try {
      await fs.access(pth)
    } catch {
      errors.push(`[${p.slug}] ${key} não encontrado: ${p[key]}`)
    }
  }
}

console.log(`Validados ${json.length} patrocinadores.`)
if (errors.length) {
  console.error('ERROS:\n - ' + errors.join('\n - '))
  process.exit(1)
} else {
  console.log('OK: todos os caminhos existem e JSON é válido.')
}
