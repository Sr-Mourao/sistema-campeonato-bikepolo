import { useState } from 'react'
import TeamMonogram from './TeamMonogram'

interface Props {
  nome: string
  logo?: string
  className?: string
}

/** Brasão do time — imagem local (com cache-busting já embutido pelo backend) com
 * fallback pro monograma editorial quando não há logo ou o arquivo falha ao carregar.
 * Nunca consulta o Poloperator: o `logo` recebido já vem resolvido do nosso backend. */
export default function TeamLogo({ nome, logo, className = '' }: Props) {
  const [falhou, setFalhou] = useState(false)

  if (logo && !falhou) {
    return <img src={logo} alt={nome} className={className} loading="lazy" onError={() => setFalhou(true)} />
  }
  return <TeamMonogram nome={nome} className={className} />
}
