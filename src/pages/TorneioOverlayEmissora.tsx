import { useEffect, useState } from 'react'
import { useObsDocument } from '../hooks/useObsDocument'
import './TorneioEmissora.css'

/**
 * Bug de emissora: identidade permanente da transmissão. Sem backend, sem polling.
 *
 * A peça é entregue sozinha, ancorada em 0,0 e em tamanho natural — quem posiciona e
 * dimensiona é o OBS. O resto da viewport fica transparente.
 *
 * Identidade do 2º PIOR: papel bege, contorno de nanquim, sombra roxa e letreiro de
 * marcador. Alterna o nome da transmissão ("Ao vivo") com o do evento.
 */
/** Selo do campeonato e os dois textos que se alternam — troque aqui. */
const LOGO_PIOR = '/identidade/logo.svg'
const MARCA_PRINCIPAL = { titulo: 'PIOR Bici Polo', apoio: 'Ao vivo' }
const MARCA_EVENTO = { titulo: '2º PIOR Campeonato', apoio: 'Curitiba · 12–13 dez' }

/** A marca vira quando a lâmina já cobriu o miolo da placa. */
const LAMINA_MEIO_MS = 330
const LAMINA_MS = 660
const REALIZACAO_MS = 5200
const BUENA_MIN_MS = 45_000
const BUENA_MAX_MS = 90_000

type Marca = 'pior' | 'evento'

const proximaEspera = (marca: Marca) =>
  marca === 'evento' ? REALIZACAO_MS : BUENA_MIN_MS + Math.random() * (BUENA_MAX_MS - BUENA_MIN_MS)

export default function TorneioOverlayEmissora() {
  useObsDocument('OBS · Emissora')
  const [marca, setMarca] = useState<Marca>('pior')
  const [trocando, setTrocando] = useState(false)

  /* Agenda a próxima vinheta. Um timer por fase, sempre limpo: a fonte fica horas no ar. */
  useEffect(() => {
    const disparo = setTimeout(() => setTrocando(true), proximaEspera(marca))
    return () => clearTimeout(disparo)
  }, [marca])

  useEffect(() => {
    if (!trocando) return
    const troca = setTimeout(() => setMarca(atual => (atual === 'pior' ? 'evento' : 'pior')), LAMINA_MEIO_MS)
    const fim = setTimeout(() => setTrocando(false), LAMINA_MS)
    return () => { clearTimeout(troca); clearTimeout(fim) }
  }, [trocando])

  // ?canto=tr|tl|br|bl: posição do selo (sem o parâmetro, fica em 0,0 e o OBS posiciona)
  const canto = new URLSearchParams(window.location.search).get('canto')

  return (
    <main className="em-overlay" data-canto={canto ?? undefined}>
      <aside className="em-bug" data-marca={marca} data-trocando={trocando ? 'sim' : undefined}>
        <span className="em-accent" aria-hidden="true" />
        <span className="em-brilho" aria-hidden="true" />

        <div className="em-conteudo" key={marca}>
          <img src={LOGO_PIOR} alt="PIOR Bici Polo" className="em-marca em-marca--pior" />
          <div className="em-texto">
            <strong>{marca === 'pior' ? MARCA_PRINCIPAL.titulo : MARCA_EVENTO.titulo}</strong>
            {marca === 'pior'
              ? <span className="em-live"><i aria-hidden="true" />{MARCA_PRINCIPAL.apoio}</span>
              : <span className="em-papel">{MARCA_EVENTO.apoio}</span>}
          </div>
        </div>

        {trocando && <span className="em-lamina" aria-hidden="true" />}
      </aside>
    </main>
  )
}
