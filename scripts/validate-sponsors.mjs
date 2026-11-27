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
const avisos = []

for (const p of json) {
  // Valida só os campos presentes: "logo" e "logoOriginal" são opcionais
  for (const key of ['logo', 'logoOriginal']) {
    const valor = p[key]
    if (valor === undefined || valor === null || valor === '') {
      avisos.push(`[${p.slug}] sem ${key}`)
      continue
    }
    const pth = path.join(PUBLIC, String(valor).replace(/^\//, ''))
    try {
      await fs.access(pth)
    } catch {
      errors.push(`[${p.slug}] ${key} não encontrado: ${valor}`)
    }
  }
  // O overlay de intervalo só aceita originais dessa pasta (intervalSponsorAssets.ts)
  if (p.logoOriginal && !String(p.logoOriginal).startsWith('/imgs/logos/originais/')) {
    avisos.push(`[${p.slug}] logoOriginal fora de /imgs/logos/originais/: não aparece no intervalo`)
  }
}

console.log(`Validados ${json.length} patrocinadores.`)
if (avisos.length) console.log('Avisos:\n - ' + avisos.join('\n - '))
if (errors.length) {
  console.error('ERROS:\n - ' + errors.join('\n - '))
  process.exit(1)
} else {
  console.log('OK: todos os caminhos presentes existem e JSON é válido.')
}
