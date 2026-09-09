// Helper para chamadas multipart ao admin API (upload de imagens) — o helper
// genérico em adminApi.ts só serializa JSON, então não dá para reaproveitá-lo aqui.

export interface MultipartError {
  message: string
  debug?: string
  meta?: unknown
  status: number
}

export async function adminPostMultipart<T = unknown>(
  url: string,
  formData: FormData,
): Promise<T | null> {
  try {
    const res = await fetch(url, { method: 'POST', credentials: 'include', body: formData })
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
        const data = (await res.json().catch(() => null)) as
          | { error?: string; debug?: string; meta?: unknown }
          | null
        if (data?.error) msg = data.error
        if (data?.debug) debug = data.debug
        if (data?.meta !== undefined) meta = data.meta
      }
      const err: MultipartError = { message: msg, status: res.status }
      if (debug) err.debug = debug
      if (meta !== undefined) err.meta = meta
      throw err
    }
    if (!isJson) throw { message: 'Resposta inválida do servidor (não é JSON)', status: res.status } as MultipartError
    return res.json() as Promise<T>
  } catch (e) {
    console.error(e)
    // Re-throw para o caller exibir a mensagem real ao usuário, em vez de null cego.
    if (e && typeof e === 'object' && 'message' in e) throw e
    throw { message: 'Erro de rede ao enviar formulário.', status: 0 } as MultipartError
  }
}
