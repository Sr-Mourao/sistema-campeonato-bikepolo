// Inicia scripts/servidor_streaming.py com o Python disponível na máquina.
// No Windows `python3` costuma ser só o atalho da Microsoft Store, então
// testamos os candidatos em ordem e usamos o primeiro que responde de verdade.
import { spawn, spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const script = join(here, 'servidor_streaming.py')

const candidates = process.platform === 'win32'
  ? [['py', ['-3']], ['python', []], ['python3', []]]
  : [['python3', []], ['python', []]]

const found = candidates.find(([cmd, pre]) => {
  const r = spawnSync(cmd, [...pre, '--version'], { encoding: 'utf8' })
  return r.status === 0 && /Python 3\./.test(`${r.stdout}${r.stderr}`)
})

if (!found) {
  console.error('Python 3 não encontrado. Instale em https://www.python.org/downloads/')
  process.exit(1)
}

const [cmd, pre] = found
// -u: sem buffer, para o banner com as URLs aparecer na hora.
const child = spawn(cmd, [...pre, '-u', script,...process.argv.slice(2)], { stdio: 'inherit' })
child.on('exit', code => process.exit(code ?? 0))
