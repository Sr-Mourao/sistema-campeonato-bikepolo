import { useEffect } from 'react'

/** Garante alpha real no documento inteiro enquanto uma rota exclusiva do OBS está ativa. */
export function useObsDocument(title: string) {
  useEffect(() => {
    const anterior = document.title
    document.documentElement.classList.add('obs-overlay-document')
    document.body.classList.add('obs-overlay-document')
    document.title = title
    return () => {
      document.documentElement.classList.remove('obs-overlay-document')
      document.body.classList.remove('obs-overlay-document')
      document.title = anterior
    }
  }, [title])
}
