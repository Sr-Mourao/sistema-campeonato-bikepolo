/**
 * Regras de sincronização mesa ↔ servidor ↔ overlays, separadas do hook
 * (useStreamingSync) para poderem ser testadas sem navegador.
 */

/**
 * Deve aplicar o estado que veio do servidor no polling?
 *
 * - Espelho (overlays, que só exibem): aplica sempre que o rev do servidor for
 *   DIFERENTE do último aplicado — inclusive menor. Um localStorage antigo com
 *   rev alto (OBS/Streamlabs que ficou aberto num jogo anterior) nunca trava o
 *   overlay. No primeiro polling (nada aplicado ainda) o servidor sempre vence.
 * - Mesa (quem edita): só aplica rev maior que o último visto do servidor E
 *   maior que o rev local, para não desfazer uma jogada ainda não enviada.
 */
export function shouldApplyRemoteState(
  remoteRev: number | null | undefined,
  opts: { mirror: boolean; lastServerRev: number | null; currentRev: number },
): boolean {
  if (!remoteRev) return false
  if (opts.mirror) return remoteRev !== opts.lastServerRev
  return (opts.lastServerRev === null || remoteRev > opts.lastServerRev) && remoteRev > opts.currentRev
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
