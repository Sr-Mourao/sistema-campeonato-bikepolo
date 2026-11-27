import { useEffect, useState } from 'react'
import { OVERLAY_CATALOG, catalogoDoFormato, overlayUrl, type OverlayCatalogItem, type OverlayGroup } from '../components/overlays/overlayCatalog'
import { torneioPublico } from '../services/torneioPublico'
import { formatoDe } from '../services/formatoTorneio'
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
  // Sem resposta do backend mantém o catálogo completo (nunca esconde por falha de rede).
  const [comRepescagem, setComRepescagem] = useState(true)
  useEffect(() => {
    torneioPublico.resumo('misto').then(r => setComRepescagem(formatoDe(r.torneio).repescagem)).catch(() => {})
  }, [])
  const catalogo = catalogoDoFormato(OVERLAY_CATALOG, comRepescagem)

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

      {GRUPOS.map(grupo => (
        <section className={`ovc-group ${grupo === 'Projeção / Palco' ? 'ovc-group--stage' : ''}`} key={grupo}>
          <h2>{grupo}{grupo === 'Projeção / Palco' && <span>Projetor</span>}</h2>
          {cards(catalogo.filter(item => item.grupo === grupo))}
        </section>
      ))}
    </main>
  )
}
