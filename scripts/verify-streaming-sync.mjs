#!/usr/bin/env node
/**
 * Verifica a sincronização mesa → overlay entre NAVEGADORES SEPARADOS (como o
 * OBS/Streamlabs): mesa e overlay em contextos diferentes do Playwright, sem
 * localStorage nem BroadcastChannel em comum. Só o servidor liga os dois.
 *
 * Cenários:
 *   normal                 pasta de dados e banco graváveis
 *   sem-permissao          api/data/streaming substituída por um ARQUIVO comum
 *                          (o servidor de produção, onde o PHP não grava nessa pasta)
 *   localstorage-antigo    overlay abre com localStorage de outro jogo, rev altíssimo
 *                          (Streamlabs que ficou aberto); precisa seguir o servidor
 *   banco-somente-leitura  arquivo do SQLite somente leitura: a mesa precisa mostrar
 *                          "NÃO SINCRONIZADO" e o aviso some quando volta a gravar
 *
 * Em cada um: login admin na mesa, gol "sem autoria" no time da esquerda e o overlay
 * precisa mostrar o placar esperado em até 5 s.
 *
 * Uso:  node scripts/verify-streaming-sync.mjs [cenário]
 * Requisitos: PHP no PATH, Microsoft Edge (ou PW_CHANNEL=chrome / PW_CHANNEL=chromium).
 * Usa o PHP em :8000 e o Vite em :5173 se já estiverem rodando; senão sobe os dois e
 * derruba no fim. Guarda e restaura os dados do streaming (arquivos de data/streaming
 * e as tabelas streaming_kv/streaming_presenca do banco local).
 * Sai com 0 se todos os cenários passarem.
 */
import { spawn, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PHP_URL = 'http://localhost:8000'
const BASE = 'http://localhost:5173'
const DATA_DIR = path.join(ROOT, 'public', 'api', 'data', 'streaming')
const BAK_DIR = DATA_DIR + '.__verify_bak'
const TIMEOUT_MS = 5000
const CHANNEL = process.env.PW_CHANNEL || 'msedge'
const ALL = ['normal', 'sem-permissao', 'localstorage-antigo', 'banco-somente-leitura']

const spawned = []
const log = (...a) => console.log(...a)
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function up(url) {
  try { const r = await fetch(url, { signal: AbortSignal.timeout(2000) }); return r.status < 500 } catch { return false }
}

async function ensureServer(name, url, cmd, args) {
  if (await up(url)) { log(`· ${name}: já rodando (${url})`); return }
  log(`· ${name}: subindo…`)
  const child = spawn(cmd, args, { cwd: ROOT, shell: process.platform === 'win32', stdio: 'ignore' })
  spawned.push(child)
  for (let i = 0; i < 60; i++) {
    if (await up(url)) return
    await sleep(500)
  }
  throw new Error(`${name} não respondeu em ${url}`)
}

const php = (code, input) => execFileSync('php', ['-r', code], { cwd: ROOT, input }).toString()

function adminCredentials() {
  // Lido do env.php local (o mesmo arquivo que o PHP usa). Nunca é impresso.
  const [username, password] = JSON.parse(php("include 'public/api/env.php'; echo json_encode([ADMIN_USER, ADMIN_PASS]);"))
  return { username, password }
}

const DB_PATH = php("require 'public/api/db.php'; echo DB_PATH;").trim()

// ── Banco: o streaming agora vive nas tabelas streaming_kv/streaming_presenca ──
function dbSnapshot() {
  return php(`require 'public/api/db.php'; $d = getDb();
    echo json_encode(['kv' => $d->query('SELECT * FROM streaming_kv')->fetchAll(),
                      'pr' => $d->query('SELECT * FROM streaming_presenca')->fetchAll()]);`)
}
function dbRestore(snapshot) {
  php(`require 'public/api/db.php'; $d = getDb(); $s = json_decode(stream_get_contents(STDIN), true);
    $d->exec('BEGIN IMMEDIATE');
    $d->exec('DELETE FROM streaming_kv'); $d->exec('DELETE FROM streaming_presenca');
    $kv = $d->prepare('INSERT INTO streaming_kv (chave, rev, dados, atualizado_ms) VALUES (?, ?, ?, ?)');
    foreach ($s['kv'] as $r) $kv->execute([$r['chave'], $r['rev'], $r['dados'], $r['atualizado_ms']]);
    $pr = $d->prepare('INSERT INTO streaming_presenca (id, name, role, seen_ms) VALUES (?, ?, ?, ?)');
    foreach ($s['pr'] as $r) $pr->execute([$r['id'], $r['name'], $r['role'], $r['seen_ms']]);
    $d->exec('COMMIT');`, snapshot)
}

// ── Arquivos legados de data/streaming: backup em memória e restauração ──
// O PHP abre/fecha arquivos da pasta; no Windows isso trava o rename por instantes.
function renameRetry(from, to) {
  for (let i = 0; ; i++) {
    try { return fs.renameSync(from, to) } catch (e) {
      if (i >= 40 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw e
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100)
    }
  }
}
function backupFiles() {
  const files = {}
  if (fs.existsSync(DATA_DIR) && fs.statSync(DATA_DIR).isDirectory()) {
    for (const f of fs.readdirSync(DATA_DIR)) files[f] = fs.readFileSync(path.join(DATA_DIR, f))
  }
  return files
}
function restoreFiles(files) {
  if (fs.existsSync(DATA_DIR) && fs.statSync(DATA_DIR).isFile()) fs.unlinkSync(DATA_DIR) // arquivo criado pelo teste
  if (fs.existsSync(BAK_DIR)) renameRetry(BAK_DIR, DATA_DIR)
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  for (const [f, buf] of Object.entries(files)) fs.writeFileSync(path.join(DATA_DIR, f), buf)
}
function blockDataDir() {
  // No Windows não dá para tirar a permissão da pasta do próprio usuário; um ARQUIVO
  // com o nome da pasta tem o mesmo efeito: mkdir e file_put_contents falham.
  if (fs.existsSync(BAK_DIR)) throw new Error(`${BAK_DIR} já existe (execução anterior interrompida?) — restaure à mão`)
  if (fs.existsSync(DATA_DIR)) renameRetry(DATA_DIR, BAK_DIR)
  fs.writeFileSync(DATA_DIR, 'bloqueio temporário criado por scripts/verify-streaming-sync.mjs\n')
}
const setDbReadonly = ro => fs.chmodSync(DB_PATH, ro ? 0o444 : 0o666)

async function serverState() {
  try { return await (await fetch(`${PHP_URL}/api/streaming.php?action=state`)).text() } catch (e) { return `ERRO ${e.message}` }
}

// ── Um cenário ──
async function runScenario(browser, name, creds) {
  log(`\n━━ Cenário: ${name} ━━`)
  const checks = []
  const check = (ok, msg) => { checks.push(ok); log(`  ${ok ? '✓' : '✗'} ${msg}`) }

  // Mesa: contexto próprio, com login admin (cookie de sessão do PHP)
  const mesaCtx = await browser.newContext({ viewport: { width: 1366, height: 900 } })
  const login = await mesaCtx.request.post(`${BASE}/api/admin/auth.php`, { data: creds })
  if (!(await login.json().catch(() => ({}))).ok) throw new Error(`login admin falhou (HTTP ${login.status()})`)

  const posts = []
  const mesa = await mesaCtx.newPage()
  mesa.on('response', res => {
    if (res.request().method() === 'POST' && /streaming.*state/.test(res.url())) posts.push(res.status())
  })
  await mesa.goto(`${BASE}/streaming/mesa`)
  await mesa.locator('.stm-btn.g').first().waitFor({ timeout: 15000 })
  await mesa.waitForTimeout(2500) // primeiro polling: a mesa adota o rev do servidor

  // Overlay: OUTRO contexto, sem nada em comum com a mesa (= OBS/Streamlabs)
  const ovCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
  if (name === 'localstorage-antigo') {
    // localStorage de outro jogo: rev altíssimo e 7 gols a mais do time da direita
    const srv = JSON.parse((await serverState()) || 'null') || {}
    const fake = (i) => ({ id: `velho${i}`, type: 'goal', side: 'b', teamId: null, team: 'Antigo', pid: null, player: '', clock: '00:00', gt: 0, at: 0 })
    const stale = { ...srv, rev: 999999, label: 'JOGO ANTIGO', events: [...(srv.events || []), ...Array.from({ length: 7 }, (_, i) => fake(i))] }
    await ovCtx.addInitScript(s => { try { localStorage.setItem('polo.streaming.state.v2', s) } catch { /* */ } }, JSON.stringify(stale))
  }
  const overlay = await ovCtx.newPage()
  await overlay.goto(`${BASE}/streaming/overlay`)
  await overlay.locator('.str-score').first().waitFor({ timeout: 15000 })
  const score = async () => (await overlay.locator('.str-score').allInnerTexts()).map(t => Number(t.trim()))

  const waitScore = async (expected) => {
    const t0 = Date.now()
    let now = await score()
    while (Date.now() - t0 < TIMEOUT_MS && !(now[0] === expected[0] && now[1] === expected[1])) {
      await overlay.waitForTimeout(200)
      now = await score()
    }
    return { now, secs: ((Date.now() - t0) / 1000).toFixed(1), ok: now[0] === expected[0] && now[1] === expected[1] }
  }
  const mesaScore = async () => (await mesa.locator('.stm-big-score').allInnerTexts()).map(t => Number(t.trim()))
  const goal = async () => {
    await mesa.locator('.stm-btn.g').first().click()
    await mesa.locator('.stm-attr-modal button', { hasText: 'Sem autoria' }).click()
  }
  const banner = () => mesa.locator('.stm-sync-error')

  if (name === 'localstorage-antigo') {
    const shown = await score()
    await overlay.waitForTimeout(2500)
    const srvScore = await mesaScore() // a mesa já está igual ao servidor
    const r = await waitScore(srvScore)
    check(r.ok, `overlay largou o localStorage antigo (abriu ${shown.join('x')}) e seguiu o servidor: ${r.now.join('x')} (servidor ${srvScore.join('x')})`)
  } else {
    await overlay.waitForTimeout(2500)
  }

  const before = await score()

  if (name === 'localstorage-antigo') {
    const fake = { rev: 999999, events: [
      { id: 'nao-publicado', type: 'goal', side: 'b', team: 'Local', clock: '00:00', at: 0 },
    ] }
    const tab = await ovCtx.newPage()
    await tab.goto(`${BASE}/favicon.svg`)
    await tab.evaluate(state => {
      const channel = new BroadcastChannel('polo_streaming_sync')
      channel.postMessage({ type: 'SYNC_STATE', state, sender: 'outra-aba' })
      channel.close()
      localStorage.setItem('polo.streaming.state.v2', JSON.stringify(state))
    }, fake)
    await overlay.waitForTimeout(1500)
    check((await score()).join('x') === before.join('x'), 'overlay ignora placar não publicado de outra aba')
    await tab.close()
  }

  if (name === 'banco-somente-leitura') {
    setDbReadonly(true)
    try {
      await goal()
      const appeared = await banner().waitFor({ timeout: 4000 }).then(() => true).catch(() => false)
      const text = appeared ? (await banner().innerText()).replace(/\s+/g, ' ') : ''
      check(appeared && text.includes('NÃO SINCRONIZADO'), `faixa vermelha na mesa: "${text.slice(0, 110)}"`)
      check(!posts.includes(200) || posts.at(-1) !== 200, `servidor NÃO respondeu ok ao envio (POSTs: ${posts.join(', ')})`)
    } finally {
      setDbReadonly(false)
    }
    // Volta a gravar: o próximo envio leva os dois gols e o aviso some
    await goal()
    const gone = await banner().waitFor({ state: 'detached', timeout: 4000 }).then(() => true).catch(() => false)
    check(gone, 'faixa some quando o servidor volta a gravar')
    const r = await waitScore([before[0] + 2, before[1]])
    check(r.ok, `overlay recebeu os 2 gols depois da volta: ${before.join('x')} → ${r.now.join('x')} em ${r.secs} s`)
  } else {
    await goal()
    const r = await waitScore([before[0] + 1, before[1]])
    check(r.ok, `overlay recebeu o gol: ${before.join('x')} → ${r.now.join('x')} em ${r.secs} s (mesa ${(await mesaScore()).join('x')})`)
    check(posts.length > 0 && posts.every(s => s === 200 || s === 409), `POSTs do estado: ${posts.join(', ') || '(nenhum)'}`)
    check(!(await banner().count()), 'sem faixa de erro na mesa')
  }

  if (name === 'localstorage-antigo') {
    await overlay.route('**/api/streaming.php?action=state', route => route.fulfill({ json: null }))
    const r = await waitScore([0, 0])
    check(r.ok, 'overlay limpa o placar quando o servidor devolve null')
  }

  const srv = await serverState()
  let rev = null
  try { rev = JSON.parse(srv)?.rev ?? null } catch { /* */ }
  log(`  servidor: rev=${rev} state=${srv.slice(0, 50)}…`)

  await mesaCtx.close()
  await ovCtx.close()
  return checks.every(Boolean)
}

// ── Main ──
const only = process.argv[2]
const scenarios = ALL.filter(s => !only || s === only)
const results = {}
const savedFiles = backupFiles()
let savedDb = null
let browser
try {
  await ensureServer('PHP', `${PHP_URL}/api/streaming.php?action=ping`, 'php', ['-S', 'localhost:8000', '-t', 'public'])
  await ensureServer('Vite', BASE, 'npx', ['vite', '--port', '5173', '--strictPort'])
  savedDb = dbSnapshot()
  const creds = adminCredentials()
  browser = await chromium.launch(CHANNEL === 'chromium' ? {} : { channel: CHANNEL })

  for (const s of scenarios) {
    try {
      if (s === 'sem-permissao') blockDataDir()
      results[s] = await runScenario(browser, s, creds)
    } catch (e) {
      log(`  ERRO: ${e.message}`)
      results[s] = false
    } finally {
      setDbReadonly(false)
      restoreFiles(savedFiles)
    }
  }
} finally {
  await browser?.close()
  setDbReadonly(false)
  restoreFiles(savedFiles)
  if (savedDb) { dbRestore(savedDb); log('\n· dados do streaming restaurados (arquivos e banco)') }
  for (const c of spawned) { try { c.kill() } catch { /* já saiu */ } }
}

log('\n━━ Resumo ━━')
for (const [s, ok] of Object.entries(results)) log(`  ${ok ? 'PASSOU' : 'FALHOU'}  ${s}`)
process.exit(Object.values(results).every(Boolean) && Object.keys(results).length === scenarios.length ? 0 : 1)
