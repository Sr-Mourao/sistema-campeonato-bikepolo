/**
 * Regras de sincronização mesa ↔ servidor ↔ overlays, separadas do hook
 * (useStreamingSync) para poderem ser testadas sem navegador.
 */

/** A mesa mantém jogadas locais que ainda não chegaram ao servidor. */
export function shouldApplyRemoteState(remoteRev: number, currentRev: number): boolean {
  return remoteRev > currentRev
}

/**
 * Fallback para o servidor Python (/api/streaming/*, modo LAN) só quando o PHP
 * não existe: erro de rede ou 404. Um 500 do PHP é um erro de verdade (ex.: o
 * banco não grava) e precisa aparecer, não ser mascarado pelo fallback.
 */
export function shouldFallbackToPython(res: Response | null): boolean {
  return res === null || res.status === 404
}

/**
 * Traduz a resposta do envio do estado em mudança de `syncError`:
 * - null      → gravou (200): limpa o aviso
 * - undefined → conflito de revisão (409): não muda o aviso
 * - string    → falhou: mensagem para o banner da mesa
 */
export async function syncErrorFromPush(res: Response | null, networkError?: unknown): Promise<string | null | undefined> {
  if (!res) {
    const why = networkError instanceof Error ? networkError.message : ''
    return `sem conexão com o servidor${why ? ` (${why})` : ''}`
  }
  if (res.ok) return null
  if (res.status === 409) return undefined
  let msg = ''
  try {
    const body = await res.clone().json()
    if (body && typeof body.error === 'string') msg = body.error
  } catch {
    // corpo não é JSON
  }
  return msg ? `${msg} (HTTP ${res.status})` : `o servidor respondeu HTTP ${res.status}`
}
