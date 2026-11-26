import { useEffect, useState } from 'react'
import { adminGet } from './adminApi'
import type { ConfigGeral } from './pages/Configuracoes'

let cachedConfig: ConfigGeral | null = null
let fetchingPromise: Promise<ConfigGeral | null> | null = null

export function useConfigGeral(): { config: ConfigGeral | null; loading: boolean } {
  const [config, setConfig] = useState<ConfigGeral | null>(cachedConfig)
  const [loading, setLoading] = useState<boolean>(!cachedConfig)

  useEffect(() => {
    if (!cachedConfig) {
      if (!fetchingPromise) {
        fetchingPromise = adminGet<ConfigGeral>('/api/admin/config-geral.php').then(res => {
          if (res) cachedConfig = res
          return res
        })
      }
      fetchingPromise.then(res => {
        if (res) setConfig(res)
        setLoading(false)
      })
    }

    function onUpdated(e: Event) {
      const ce = e as CustomEvent<ConfigGeral>
      if (ce.detail) {
        cachedConfig = ce.detail
        setConfig(ce.detail)
      }
    }

    window.addEventListener('admin-config-updated', onUpdated as EventListener)
    return () => window.removeEventListener('admin-config-updated', onUpdated as EventListener)
  }, [])

  return { config, loading }
}
