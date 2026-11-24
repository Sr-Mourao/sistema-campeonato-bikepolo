import { ExternalLink, Medal, Play, Video } from 'lucide-react'
import SiteNavbar from '../components/SiteNavbar'
import { TORNEIO_TRANSMISSOES } from './torneioTransmissoes'
import './TorneioSeletor.css'

function fallbackThumbnail(event: React.SyntheticEvent<HTMLImageElement>, videoId: string) {
  const image = event.currentTarget
  if (image.dataset.fallback === 'true') return
  image.dataset.fallback = 'true'
  image.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
}

export default function TorneioSeletor() {
  return (
    <div className="trps-page">
      <SiteNavbar currentPath="/torneio" scrollThreshold={40} />
      <main className="trps-main">
        <header className="trps-header">
          <p className="trps-header-eyebrow">Pior Campeonato de Bici Polo · Curitiba 2026</p>
          <h1 className="trps-header-title">Torneio</h1>
          <p className="trps-header-sub">Acompanhe jogos, tabelas, classificação e chaveamentos em tempo real.</p>
          <p className="trps-header-detail">Escolha uma categoria para ver o andamento completo do campeonato.</p>
        </header>

        <nav className="trps-results" aria-label="Resultados por categoria">
          <a href="/torneio/resultados?categoria=misto"><Medal size={19} /><span><b>Resultados</b>2° Pior Campeonato de Bici Polo Misto</span></a>
        </nav>

        <div className="trps-grid">
          <a href="/torneio/misto" className="trps-panel trps-panel--orange">
            <div className="trps-panel-photo"><span className="trps-panel-subtitulo">Categoria Misto</span></div>
            <div className="trps-panel-band">
              <img src="/identidade/10BR.svg" alt="2° Pior Campeonato de Bici Polo" className="trps-panel-svg" />
              <span className="trps-panel-cta">Acompanhar torneio <span aria-hidden="true">→</span></span>
            </div>
          </a>
        </div>

        <section className="trps-broadcast" aria-labelledby="trps-broadcast-title">
          <header>
            <div><p>Transmissão oficial</p><h2 id="trps-broadcast-title">Acompanhe ao vivo</h2><span>Assista aos jogos pelo canal do Buena Mira.</span></div>
            <img src="/imgs/logos/buena mira/BMSC_Negativo_Principal.png" alt="Buena Mira Social Club" />
          </header>
          <div className="trps-live-grid">
            {TORNEIO_TRANSMISSOES.map(live => <a className="trps-live-card" href={live.url} target="_blank" rel="noreferrer" key={live.videoId}>
              <div className="trps-live-thumb">
                <img src={`https://img.youtube.com/vi/${live.videoId}/maxresdefault.jpg`} onError={event => fallbackThumbnail(event, live.videoId)} alt={`Thumbnail da transmissão ${live.titulo}`} />
                <span><Play size={19} fill="currentColor" /> Assistir</span>
              </div>
              <div className="trps-live-copy"><span>{live.data}</span><h3>{live.titulo}</h3><p><Video size={17} /> Assistir no YouTube <ExternalLink size={13} /></p></div>
            </a>)}
          </div>
        </section>
      </main>
    </div>
  )
}
