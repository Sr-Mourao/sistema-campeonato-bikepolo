// Tratamento editorial pra quando a equipe não tem escudo — um monograma
// grande e desenhado, não um placeholder de "imagem faltando".
import './avatarFallback.css'

function monograma(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[1][0]).toUpperCase()
}

// `className` extra é opcional (ex.: consumidores fora do bundle de /equipes, como o
// broadcast do torneio, que precisam de tamanho/contexto próprios sem depender de
// Equipes.css estar carregado — mesmo padrão já usado em Avatar/eq-avatar).
export default function TeamMonogram({ nome, className = '' }: { nome: string; className?: string }) {
  return (
    <div className={`eq-monogram ${className}`} aria-hidden="true">
      <span className="eq-monogram-letters">{monograma(nome)}</span>
    </div>
  )
}
