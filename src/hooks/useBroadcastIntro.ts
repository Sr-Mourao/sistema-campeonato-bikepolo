import { useEffect, useState } from 'react'

/** Intro roda uma vez por montagem da Browser Source, somente após dados reais. */
export function useBroadcastIntro(pronto: boolean, duracao = 1600) {
  const [finalizada, setFinalizada] = useState(false)
  const ativa = pronto && !finalizada
  useEffect(() => {
    if (!ativa) return
    const id = setTimeout(() => setFinalizada(true), duracao)
    return () => clearTimeout(id)
  }, [ativa, duracao])
  return ativa
}
