import { useState } from 'react'
import './avatarFallback.css'

// Paleta restrita à identidade do site — nunca cor aleatória
const CORES = ['var(--pal-orange)', 'var(--pal-pink)', 'var(--pal-magenta)', 'var(--pal-purple)', 'var(--pal-plum)']

function corPara(nome: string): string {
  let hash = 0
  for (let i = 0; i < nome.length; i++) hash = (hash * 31 + nome.charCodeAt(i)) >>> 0
  return CORES[hash % CORES.length]
}

export function corDaEquipe(nome: string): string {
  return corPara(nome)
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

interface Props {
  nome: string
  foto?: string
  className?: string
}

// Preenche 100% do container do chamador — o tamanho/formato é decidido
// inteiramente pela classe CSS que envolve o Avatar (crest circular, retrato
// 3:4, etc.), nunca por uma dimensão fixa aqui dentro.
export default function Avatar({ nome, foto, className = '' }: Props) {
  const [falhou, setFalhou] = useState(false)

  if (foto && !falhou) {
    return <img src={foto} alt={nome} className={`eq-avatar ${className}`} loading="lazy" onError={() => setFalhou(true)} />
  }
  return (
    <div className={`eq-avatar eq-avatar--fallback ${className}`} style={{ background: corPara(nome) }} aria-hidden="true">
      {iniciais(nome)}
    </div>
  )
}
