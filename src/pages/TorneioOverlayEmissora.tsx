import { useEffect, useState } from 'react'
import { useObsDocument } from '../hooks/useObsDocument'
import './TorneioEmissora.css'

/**
 * Bug de emissora: identidade permanente da transmissão. Sem backend, sem polling.
 *
 * A peça é entregue sozinha, ancorada em 0,0 e em tamanho natural — quem posiciona e
 * dimensiona é o OBS. O resto da viewport fica transparente.
 *
 * A placa inverte de polaridade entre os estados porque as marcas exigem isso: a Buena
 * Mira é arte branca (pede fundo escuro) e a Bike Polo Floripa é arte preta (pede fundo
 * claro). Nenhuma das duas é alterada por filtro.
 */
const BUENA_MIRA = '/imgs/logos/buena%20mira/BMSC_Negativo_Alternativo.png'
const BIKE_POLO_FLORIPA = '/imgs/logos/bikeplofloripa.png'

/** A marca vira quando a lâmina já cobriu o miolo da placa. */
const LAMINA_MEIO_MS = 330
const LAMINA_MS = 660
const REALIZACAO_MS = 5200
const BUENA_MIN_MS = 45_000
const BUENA_MAX_MS = 90_000

type Marca = 'buena' | 'floripa'

const proximaEspera = (marca: Marca) =>
  marca === 'floripa' ? REALIZACAO_MS : BUENA_MIN_MS + Math.random() * (BUENA_MAX_MS - BUENA_MIN_MS)

export default function TorneioOverlayEmissora() {
  useObsDocument('OBS · Emissora')
  const [marca, setMarca] = useState<Marca>('buena')
  const [trocando, setTrocando] = useState(false)

  /* Agenda a próxima vinheta. Um timer por fase, sempre limpo: a fonte fica horas no ar. */
  useEffect(() => {
    const disparo = setTimeout(() => setTrocando(true), proximaEspera(marca))
    return () => clearTimeout(disparo)
  }, [marca])

  useEffect(() => {
    if (!trocando) return
    const troca = setTimeout(() => setMarca(atual => (atual === 'buena' ? 'floripa' : 'buena')), LAMINA_MEIO_MS)
    const fim = setTimeout(() => setTrocando(false), LAMINA_MS)
    return () => { clearTimeout(troca); clearTimeout(fim) }
  }, [trocando])

  return (
    <main className="em-overlay">
      <aside className="em-bug" data-marca={marca} data-trocando={trocando ? 'sim' : undefined}>
        <span className="em-accent" aria-hidden="true" />
        <span className="em-brilho" aria-hidden="true" />

        {marca === 'buena' ? (
          <div className="em-conteudo" key="buena">
            <img src={BUENA_MIRA} alt="Buena Mira Social Club" className="em-marca em-marca--buena" />
            <div className="em-texto">
              <strong>Buena Mira</strong>
              <span className="em-live"><i aria-hidden="true" />Ao vivo</span>
            </div>
          </div>
        ) : (
          <div className="em-conteudo" key="floripa">
            <img src={BIKE_POLO_FLORIPA} alt="Bike Polo Floripa" className="em-marca em-marca--floripa" />
            <div className="em-texto">
              <span className="em-papel">Realização</span>
            </div>
          </div>
        )}

        {trocando && <span className="em-lamina" aria-hidden="true" />}
      </aside>
    </main>
  )
}
