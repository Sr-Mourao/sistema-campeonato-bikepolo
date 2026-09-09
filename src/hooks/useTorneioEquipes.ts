import { useState, useEffect } from 'react'
import { fetchEquipesLocais, type Torneio, type TorneioLocalData } from '../services/equipesLocais'

interface Estado {
  data: TorneioLocalData | null
  loading: boolean
  error: string | null
}

export function useTorneioEquipes(torneio: Torneio | null): Estado {
  const [estado, setEstado] = useState<Estado>({ data: null, loading: torneio !== null, error: null })

  useEffect(() => {
    if (!torneio) { setEstado({ data: null, loading: false, error: null }); return }
    let cancelado = false
    setEstado(prev => ({ ...prev, loading: true, error: null }))
    fetchEquipesLocais(torneio)
      .then(data => { if (!cancelado) setEstado({ data, loading: false, error: null }) })
      .catch((e: Error) => { if (!cancelado) setEstado({ data: null, loading: false, error: e.message || 'Erro ao carregar equipes' }) })
    return () => { cancelado = true }
  }, [torneio])

  return estado
}
