#!/usr/bin/env node
/**
 * Teste de carga da sincronização do streaming: procura "database is locked".
 *
 * Parte 1 — HTTP: 3 contextos do Playwright (aparelhos independentes) fazendo, ao
 *   mesmo tempo e sem pausa, o ciclo do app: POST state, POST hello, GET state.
 *   Passa pelo Vite → PHP local. Atenção: o `php -S` atende uma requisição por vez,
 *   então aqui o que se mede é o caminho HTTP completo, não a disputa pelo banco.
 * Parte 2 — SQLite de verdade em paralelo: 3 PROCESSOS PHP separados chamando a
 *   mesma lib (public/api/streaming/lib.php) num banco temporário, cada operação com
 *   conexão nova (como uma requisição no Apache/PHP-FPM), WAL e busy_timeout de 3 s
 *   iguais aos do endpoint. Aqui sim os três disputam a trava de escrita.
 *
 * Uso: node scripts/stress-streaming-sync.mjs [segundos=30]
 * Guarda e restaura as tabelas do streaming do banco local (parte 1).
 */
import { spawn, execFileSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = 'http://localhost:5173'
const SECS = Number(process.argv[2] || 30)
const CHANNEL = process.env.PW_CHANNEL || 'msedge'
const php = (code, input) => execFileSync('php', ['-r', code], { cwd: ROOT, input }).toString()

const snapshot = () => php(`require 'public/api/db.php'; $d = getDb();
  echo json_encode(['kv' => $d->query('SELECT * FROM streaming_kv')->fetchAll(), 'pr' => $d->query('SELECT * FROM streaming_presenca')->fetchAll()]);`)
const restore = s => php(`require 'public/api/db.php'; $d = getDb(); $s = json_decode(stream_get_contents(STDIN), true);
  $d->exec('BEGIN IMMEDIATE'); $d->exec('DELETE FROM streaming_kv'); $d->exec('DELETE FROM streaming_presenca');
  $kv = $d->prepare('INSERT INTO streaming_kv (chave, rev, dados, atualizado_ms) VALUES (?, ?, ?, ?)');
  foreach ($s['kv'] as $r) $kv->execute([$r['chave'], $r['rev'], $r['dados'], $r['atualizado_ms']]);
  $pr = $d->prepare('INSERT INTO streaming_presenca (id, name, role, seen_ms) VALUES (?, ?, ?, ?)');
  foreach ($s['pr'] as $r) $pr->execute([$r['id'], $r['name'], $r['role'], $r['seen_ms']]);
  $d->exec('COMMIT');`, s)

// ── Parte 1: HTTP com 3 contextos ──
async function httpStress() {
  const browser = await chromium.launch(CHANNEL === 'chromium' ? {} : { channel: CHANNEL })
  const until = Date.now() + SECS * 1000
  const worker = async (n) => {
    const ctx = await browser.newContext()
    const stats = { total: 0, status: {}, locked: 0, outros: [] }
    let rev = 0
    while (Date.now() < until) {
      // Ciclo de um aparelho: grava (rev acima do que viu), avisa presença, lê
      const reqs = [
        ['POST', 'state', JSON.stringify({ rev: ++rev, stress: n, lastBy: {}, events: [] })],
        ['POST', 'hello', JSON.stringify({ id: `stress-${n}`, name: `Stress ${n}`, role: 'completo' })],
        ['GET', 'state', null],
      ]
      for (const [method, action, data] of reqs) {
        const r = await ctx.request.fetch(`${BASE}/api/streaming.php?action=${action}`, { method, data, headers: { 'Content-Type': 'application/json' } })
        const body = await r.text()
        stats.total++
        stats.status[r.status()] = (stats.status[r.status()] || 0) + 1
        if (/locked|busy/i.test(body)) stats.locked++
        else if (r.status() >= 500 && stats.outros.length < 3) stats.outros.push(body.slice(0, 120))
        if (r.status() === 409 && action === 'state') { try { rev = JSON.parse(body).rev } catch { /* */ } }
        if (action === 'state' && method === 'GET') { try { rev = Math.max(rev, JSON.parse(body)?.rev || 0) } catch { /* */ } }
      }
    }
    await ctx.close()
    return stats
  }
  const res = await Promise.all([1, 2, 3].map(worker))
  await browser.close()
  return res
}

// ── Parte 2: 3 processos PHP no mesmo SQLite ──
const WORKER = `
require 'public/api/db.php';
require 'public/api/streaming/lib.php';
[$dbFile, $n, $secs] = [$argv[1], (int)$argv[2], (int)$argv[3]];
$conn = function () use ($dbFile) {
  $p = new PDO('sqlite:' . $dbFile);
  $p->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $p->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
  $p->exec('PRAGMA journal_mode=WAL');
  $p->exec('PRAGMA busy_timeout = 3000');
  return $p;
};
$st = ['ops' => 0, 'ok' => 0, 'conflito' => 0, 'locked' => 0, 'outros' => [], 'max_ms' => 0];
$fim = microtime(true) + $secs;
$rev = 0;
while (microtime(true) < $fim) {
  foreach (['post', 'hello', 'get'] as $op) {
    $t = microtime(true);
    try {
      $db = $conn();
      if ($op === 'post') {
        $r = streamingSalvarState($db, json_encode(['rev' => ++$rev, 'w' => $n, 'lastBy' => new stdClass()]));
        if ($r['status'] === 200) $st['ok']++; elseif ($r['status'] === 409) { $st['conflito']++; $rev = json_decode($r['raw'])->rev; }
      } elseif ($op === 'hello') {
        streamingHello($db, ['id' => "w$n", 'name' => "W$n", 'role' => 'x']); $st['ok']++;
      } else {
        $raw = streamingLer($db, 'state'); if ($raw) $rev = max($rev, json_decode($raw)->rev); $st['ok']++;
      }
    } catch (Throwable $e) {
      if (stripos($e->getMessage(), 'locked') !== false || stripos($e->getMessage(), 'busy') !== false) $st['locked']++;
      elseif (count($st['outros']) < 3) $st['outros'][] = $e->getMessage();
    }
    $db = null;
    $st['ops']++;
    $st['max_ms'] = max($st['max_ms'], (int) round((microtime(true) - $t) * 1000));
  }
}
echo json_encode($st);
`

async function sqliteStress() {
  const dbFile = path.join(os.tmpdir(), `streaming-stress-${Date.now()}.db`)
  php(`require 'public/api/db.php'; $p = new PDO('sqlite:' . $argv[1]); $p->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION); $p->exec('PRAGMA journal_mode=WAL'); initSchema($p);`.replace('$argv[1]', JSON.stringify(dbFile).replace(/"/g, "'")))
  const run = n => new Promise((resolve, reject) => {
    const p = spawn('php', ['-r', WORKER, '--', dbFile, String(n), String(SECS)], { cwd: ROOT })
    let out = '', err = ''
    p.stdout.on('data', d => { out += d })
    p.stderr.on('data', d => { err += d })
    p.on('close', code => code === 0 ? resolve(JSON.parse(out)) : reject(new Error(err || out)))
  })
  const res = await Promise.all([1, 2, 3].map(run))
  const final = php(`$p = new PDO('sqlite:' . ${JSON.stringify(dbFile).replace(/"/g, "'")}); echo $p->query("SELECT rev FROM streaming_kv WHERE chave='state'")->fetchColumn();`)
  return { res, finalRev: Number(final), dbFile }
}

const saved = snapshot()
let failed = false
try {
  console.log(`━━ Parte 1: HTTP, 3 contextos, ${SECS} s (Vite → php -S) ━━`)
  const http = await httpStress()
  http.forEach((s, i) => {
    console.log(`  contexto ${i + 1}: ${s.total} requisições · status ${JSON.stringify(s.status)} · "database is locked": ${s.locked}${s.outros.length ? ' · outros: ' + s.outros.join(' | ') : ''}`)
    if (s.locked || s.status[500]) failed = true
  })

  console.log(`\n━━ Parte 2: SQLite, 3 processos PHP em paralelo, ${SECS} s ━━`)
  const { res, finalRev } = await sqliteStress()
  let total = 0, ok = 0
  res.forEach((s, i) => {
    total += s.ops; ok += s.ok
    console.log(`  processo ${i + 1}: ${s.ops} operações · ok ${s.ok} · 409 ${s.conflito} · locked ${s.locked} · mais lenta ${s.max_ms} ms${s.outros.length ? ' · outros: ' + s.outros.join(' | ') : ''}`)
    if (s.locked || s.outros.length) failed = true
  })
  console.log(`  total: ${total} operações (${Math.round(total / SECS)}/s) · rev final do estado: ${finalRev}`)
} finally {
  restore(saved)
  console.log('\n· tabelas do streaming do banco local restauradas')
}
console.log(failed ? '\nFALHOU: houve "database is locked" ou erro 500' : '\nPASSOU: nenhum "database is locked" nem erro 500')
process.exit(failed ? 1 : 0)
