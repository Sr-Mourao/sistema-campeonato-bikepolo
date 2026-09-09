// Helper centralizado para chamadas ao admin API.
// Todas as requisições usam credentials: 'include' para enviar cookies de sessão PHP.

export interface AdminApiStrictError {
  message: string
  debug?: string
  meta?: unknown
  status: number
}

async function adminFetch<T = unknown>(url: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, { ...options, credentials: 'include' })
    if (res.status === 401) {
      window.dispatchEvent(new Event('admin-unauthorized'))
      return null
    }
    const ct = res.headers.get('content-type') || ''
    const isJson = ct.includes('application/json')
    if (!res.ok) {
      let msg = `HTTP ${res.status}`
      let debug: string | undefined
      let meta: unknown
      if (isJson) {
        const data = await res.json().catch(() => null) as
          | { error?: string; debug?: string; meta?: unknown }
          | null
        if (data?.error) msg = data.error
        if (data?.debug) debug = data.debug
        if (data?.meta !== undefined) meta = data.meta
      }
      throw new AdminApiError(msg, debug, res.status, meta)
    }
    if (!isJson) throw new AdminApiError('Resposta inválida do servidor', 'content-type=' + ct, res.status)
    return res.json() as Promise<T>
  } catch (e) {
    console.error(e)
    const err =
      e instanceof AdminApiError
        ? e
        : new AdminApiError(e instanceof Error ? e.message : 'Erro desconhecido', undefined, 0)
    window.dispatchEvent(
      new CustomEvent('admin-api-error', {
        detail: {
          message: err.message,
          debug: err.debug,
          url,
        },
      })
    )
    return null
  }
}

/**
 * Versão "strict" de adminFetch: nunca retorna null em caso de erro,
 * sempre dispara AdminApiStrictError (com status e meta).
 * Útil para fluxos onde o caller precisa tratar 409/400 etc ao invés de só um null.
 */
async function adminFetchStrict<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...options, credentials: 'include' })
  if (res.status === 401) {
    window.dispatchEvent(new Event('admin-unauthorized'))
    const e: AdminApiStrictError = { message: 'Não autorizado', status: 401 }
    throw e
  }
  const ct = res.headers.get('content-type') || ''
  const isJson = ct.includes('application/json')
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    let debug: string | undefined
    let meta: unknown
    if (isJson) {
      const data = (await res.json().catch(() => null)) as
        | { error?: string; debug?: string; meta?: unknown }
        | null
      if (data?.error) msg = data.error
      if (data?.debug) debug = data.debug
      if (data?.meta !== undefined) meta = data.meta
    }
    const err: AdminApiStrictError = { message: msg, status: res.status }
    if (debug) err.debug = debug
    if (meta !== undefined) err.meta = meta
    throw err
  }
  if (!isJson) {
    const err: AdminApiStrictError = {
      message: 'Resposta inválida do servidor (não é JSON)',
      status: res.status,
    }
    throw err
  }
  return (await res.json()) as Promise<T>
}

export class AdminApiError extends Error {
  debug?: string
  status?: number
  meta?: unknown
  constructor(message: string, debug?: string, status?: number, meta?: unknown) {
    super(message)
    this.name = 'AdminApiError'
    this.debug = debug
    this.status = status
    this.meta = meta
  }
}

export function adminGet<T = unknown>(url: string) {
  return adminFetch<T>(url)
}

export function adminPost<T = unknown>(url: string, body: unknown) {
  return adminFetch<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** Upload multipart (FormData) — nunca define Content-Type manualmente, o navegador
 * já inclui o boundary correto sozinho. Usado por upload de brasão/foto (admin/midia.php). */
export function adminPostForm<T = unknown>(url: string, formData: FormData) {
  return adminFetch<T>(url, { method: 'POST', body: formData })
}

export function adminPostStrict<T = unknown>(url: string, body: unknown): Promise<T> {
  return adminFetchStrict<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function fmtBRL(valor: number | string | null | undefined): string {
  const v = parseFloat(String(valor ?? 0)) || 0
  return 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(iso)
    ? iso.replace(' ', 'T') + 'Z'
    : iso
  const d = new Date(normalized)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Só HH:MM local — pra timestamps de evento na súmula (não precisa da data inteira). */
export function fmtHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(iso)
    ? iso.replace(' ', 'T') + 'Z'
    : iso
  const d = new Date(normalized)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
}

export function navigate(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}
