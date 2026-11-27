import { describe, expect, it } from 'vitest'
import { shouldApplyRemoteState, shouldFallbackToPython, syncErrorFromPush } from './streamingSyncRules'

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('shouldApplyRemoteState — overlay (espelho) x mesa', () => {
  it('overlay aplica rev MENOR vindo do servidor (localStorage antigo do Streamlabs)', () => {
    // OBS abriu com localStorage de outro jogo (rev 5000); o servidor está no rev 200
    expect(shouldApplyRemoteState(200, { mirror: true, lastServerRev: null, currentRev: 5000 })).toBe(true)
    // servidor foi zerado/recriado e voltou para um rev menor que o último aplicado
    expect(shouldApplyRemoteState(3, { mirror: true, lastServerRev: 200, currentRev: 200 })).toBe(true)
  })

  it('mesa NÃO aplica rev menor (não desfaz jogada local ainda não enviada)', () => {
    expect(shouldApplyRemoteState(200, { mirror: false, lastServerRev: null, currentRev: 5000 })).toBe(false)
    expect(shouldApplyRemoteState(3, { mirror: false, lastServerRev: 200, currentRev: 0 })).toBe(false)
  })

  it('mesa aplica rev maior que o local e que o último visto', () => {
    expect(shouldApplyRemoteState(201, { mirror: false, lastServerRev: 200, currentRev: 200 })).toBe(true)
    expect(shouldApplyRemoteState(10, { mirror: false, lastServerRev: null, currentRev: 0 })).toBe(true)
  })

  it('overlay não reaplica o mesmo rev; ninguém aplica estado sem rev', () => {
    expect(shouldApplyRemoteState(200, { mirror: true, lastServerRev: 200, currentRev: 0 })).toBe(false)
    for (const mirror of [true, false]) {
      expect(shouldApplyRemoteState(undefined, { mirror, lastServerRev: null, currentRev: 0 })).toBe(false)
      expect(shouldApplyRemoteState(0, { mirror, lastServerRev: null, currentRev: 0 })).toBe(false)
    }
  })
})

describe('syncErrorFromPush — aviso "NÃO SINCRONIZADO" da mesa', () => {
  it('aparece com 500, levando a mensagem do servidor', async () => {
    const msg = await syncErrorFromPush(json({ error: 'Pasta de dados sem permissão de escrita' }, 500))
    expect(msg).toBe('Pasta de dados sem permissão de escrita (HTTP 500)')
  })

  it('500 sem corpo JSON ainda gera aviso', async () => {
    expect(await syncErrorFromPush(new Response('<html>erro</html>', { status: 502 }))).toBe('o servidor respondeu HTTP 502')
  })

  it('some com 200', async () => {
    expect(await syncErrorFromPush(json({ ok: true }, 200))).toBeNull()
  })

  it('409 (conflito de revisão) não mexe no aviso', async () => {
    expect(await syncErrorFromPush(json({ rev: 9 }, 409))).toBeUndefined()
  })

  it('erro de rede gera aviso', async () => {
    expect(await syncErrorFromPush(null, new TypeError('Failed to fetch'))).toBe('sem conexão com o servidor (Failed to fetch)')
  })

  it('sequência 500 → 200: aparece e depois some', async () => {
    let syncError: string | null = null
    for (const res of [json({ error: 'banco travado' }, 500), json({ rev: 3 }, 409), json({ ok: true }, 200)]) {
      const next = await syncErrorFromPush(res)
      if (next !== undefined) syncError = next
      if (res.status === 500) expect(syncError).toContain('banco travado')
      if (res.status === 409) expect(syncError).toContain('banco travado')
    }
    expect(syncError).toBeNull()
  })
})

describe('shouldFallbackToPython', () => {
  it('cai no Python só em erro de rede ou 404', () => {
    expect(shouldFallbackToPython(null)).toBe(true)
    expect(shouldFallbackToPython(new Response('', { status: 404 }))).toBe(true)
  })

  it('500 do PHP é propagado, não mascarado', () => {
    expect(shouldFallbackToPython(new Response('{"error":"x"}', { status: 500 }))).toBe(false)
    expect(shouldFallbackToPython(new Response('{}', { status: 409 }))).toBe(false)
    expect(shouldFallbackToPython(new Response('{}', { status: 200 }))).toBe(false)
  })
})
