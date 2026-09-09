import { useEffect, useRef, useState } from 'react'
import './liveScore.css'

interface Props {
  placarA: number
  placarB: number
}

/**
 * Score central — o elemento mais forte da tela (seção 10 do brief de placar broadcast).
 * Ao mudar, aplica uma microanimação (scale 1→1.12→1, ~400ms) só no lado que mudou, sem
 * contador incremental. Reutilizável tal como está por um futuro overlay OBS de scorebug
 * (só props, sem polling/estado externo). Timer sempre limpo no cleanup — página fica
 * aberta por horas.
 */
export default function LiveScore({ placarA, placarB }: Props) {
  const anteriorA = useRef(placarA)
  const anteriorB = useRef(placarB)
  const [pulseA, setPulseA] = useState(false)
  const [pulseB, setPulseB] = useState(false)

  useEffect(() => {
    if (placarA === anteriorA.current) return
    anteriorA.current = placarA
    setPulseA(true)
    const t = setTimeout(() => setPulseA(false), 450)
    return () => clearTimeout(t)
  }, [placarA])

  useEffect(() => {
    if (placarB === anteriorB.current) return
    anteriorB.current = placarB
    setPulseB(true)
    const t = setTimeout(() => setPulseB(false), 450)
    return () => clearTimeout(t)
  }, [placarB])

  return (
    <div className="bcy-score">
      <span className={`bcy-score-num ${pulseA ? 'bcy-score-num--pulse' : ''}`}>{placarA}</span>
      <span className="bcy-score-x">×</span>
      <span className={`bcy-score-num ${pulseB ? 'bcy-score-num--pulse' : ''}`}>{placarB}</span>
    </div>
  )
}
