import { useEffect, useState } from 'react'
import { OVERLAY_CATALOG, MTNB_OVERLAY_CATALOG, STREAMING_OVERLAY_CATALOG, overlayUrl, type OverlayCatalogItem, type OverlayGroup } from '../components/overlays/overlayCatalog'
import './OverlaysCentral.css'

const GRUPOS: OverlayGroup[] = ['Ao vivo', 'Fases', 'Pausas', 'Projeção / Palco']

async function copiarUrl(url: string) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(url)
  const campo = document.createElement('textarea')
  campo.value = url
  campo.style.position = 'fixed'
  campo.style.opacity = '0'
  document.body.appendChild(campo)
  campo.select()
  document.execCommand('copy')
  campo.remove()
}

export default function OverlaysCentral() {
  const [copiado, setCopiado] = useState<string | null>(null)

  useEffect(() => {
    const tituloAnterior = document.title
    document.title = 'Central de overlays · 2° PCP'
    return () => { document.title = tituloAnterior }
  }, [])

  async function copiar(path: string) {
    await copiarUrl(overlayUrl(path))
    setCopiado(path)
    window.setTimeout(() => setCopiado(atual => atual === path ? null : atual), 1600)
  }

  function cards(itens: OverlayCatalogItem[]) {
    return <div className="ovc-grid">{itens.map(item => {
      const url = overlayUrl(item.path)
      return <article className={`ovc-card ${item.destino === 'PROJETOR' ? 'ovc-card--stage' : ''}`} key={item.path}>
        <div className="ovc-card-copy"><h3>{item.nome}{item.destino === 'PROJETOR' && <em>Palco</em>}</h3><p>{item.descricao}</p></div>
        <dl><div><dt>Resolução</dt><dd>{item.resolucao}</dd></div>{item.observacao && <div><dt>Operação</dt><dd>{item.observacao}</dd></div>}</dl>
        <label>URL completa<input value={url} readOnly onFocus={evento => evento.currentTarget.select()} /></label>
        <div className="ovc-actions"><a href={url} target="_blank" rel="noreferrer">Abrir</a><button type="button" onClick={() => copiar(item.path)}>{copiado === item.path ? 'Copiada!' : 'Copiar URL'}</button></div>
      </article>
    })}</div>
  }

  return (
    <main className="ovc-page">
      <header className="ovc-header">
        <div><span>2° PCP · Transmissão</span><h1>Central de overlays</h1></div>
        <p>URLs read-only para o OBS e para as telas de projeção da cerimônia.</p>
      </header>

      <section className="ovc-group">
        <h2>Transmissão ao Vivo (POLOStreaming)</h2>
        <p style={{ margin: '0 0 16px', color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>
          Sistema autônomo com mesa de controle manual, relógio sincronizado e placar animado.
        </p>
        {cards(STREAMING_OVERLAY_CATALOG)}
      </section>

      <div style={{ margin: '36px 0 20px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '24px' }}>
        <h2 style={{ fontSize: '18px', color: 'var(--pal-green-mint, #29e7a5)', margin: '0 0 8px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Overlays Oficiais do Torneio (Misto)
        </h2>
        <p style={{ margin: '0 0 20px', color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>
          Conectados ao banco do torneio. Dica: adicione <code>?preview=1</code> na URL para visualizar com dados simulados de teste.
        </p>
      </div>

      {GRUPOS.map(grupo => (
        <section className={`ovc-group ${grupo === 'Projeção / Palco' ? 'ovc-group--stage' : ''}`} key={grupo}>
          <h2>{grupo}{grupo === 'Projeção / Palco' && <span>Projetor</span>}</h2>
          {cards(OVERLAY_CATALOG.filter(item => item.grupo === grupo))}
        </section>
      ))}
      <section className="ovc-group"><h2>MTNB</h2>{cards(MTNB_OVERLAY_CATALOG)}</section>
    </main>
  )
}
