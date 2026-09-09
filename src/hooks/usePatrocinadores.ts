import { useState, useEffect } from 'react'

export interface Patrocinador {
  nome: string
  slug: string
  logo?: string
  logoOriginal?: string
  url: string
}

export function usePatrocinadores(): Patrocinador[] {
  const [lista, setLista] = useState<Patrocinador[]>([])
  useEffect(() => {
    fetch('/patrocinadores.json')
      .then(r => r.json())
      .then(setLista)
      .catch(() => {})
  }, [])
  return lista
}
