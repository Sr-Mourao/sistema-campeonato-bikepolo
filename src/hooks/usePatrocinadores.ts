import { useState, useEffect } from 'react'

export interface Patrocinador {
  nome: string
  slug: string
  logo?: string
  logoOriginal?: string
  url: string
  /** Fica no JSON mas some de todas as superfícies (Home, rodapé, Apoie, intervalo) — reativar removendo a flag. */
  oculto?: boolean
}

/** Remove os marcados como `oculto` — fonte única do filtro para todas as telas. */
export function patrocinadoresVisiveis(lista: Patrocinador[]): Patrocinador[] {
  return lista.filter(p => !p.oculto)
}

export function usePatrocinadores(): Patrocinador[] {
  const [lista, setLista] = useState<Patrocinador[]>([])
  useEffect(() => {
    fetch('/patrocinadores.json')
      .then(r => r.json())
      .then((dados: Patrocinador[]) => setLista(patrocinadoresVisiveis(dados)))
      .catch(() => {})
  }, [])
  return lista
}
