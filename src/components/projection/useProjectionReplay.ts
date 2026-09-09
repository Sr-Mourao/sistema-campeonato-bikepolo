import { useEffect, useState } from 'react'

export function useProjectionReplay() {
  const [replay, setReplay] = useState(0)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key.toLowerCase() === 'r') setReplay(value => value + 1) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return { replay, restart: () => setReplay(value => value + 1) }
}
