import { useEffect, useRef } from 'react'
import IntervalQr from '../components/obs/IntervalQr'
import IntervalSponsor from '../components/obs/IntervalSponsor'
import { useObsDocument } from '../hooks/useObsDocument'
import { usePatrocinadores } from '../hooks/usePatrocinadores'
import { useStreamingSync } from '../hooks/useStreamingSync'
import { nextScheduledMatch } from '../services/streamingState'
import './TorneioIntervalo.css'

const PALCO = { largura: 1920, altura: 1080 }

/* ─── TROQUE AQUI ──────────────────────────────────────────────────────────
   Enquanto estiverem null, a tela mostra um placeholder "TROCAR" no lugar.
   - LOGO_CAMPEONATO: arquivo em public/ (ex.: '/identidade/logo-2pior.svg')
   - QR_LINK: endereço que o QR code abre (ex.: 'https://piorbicipolo.com.br/torneio')
   Patrocinadores: lista em public/patrocinadores.json (campo "logoOriginal") e
   arquivos em public/imgs/logos/originais/. ─────────────────────────────── */
const LOGO_CAMPEONATO: string | null = '/identidade/overlay/logo-camp-horizontal.webp'
const QR_LINK: string | null = null

export default function TorneioOverlayIntervalo() {
  useObsDocument('OBS · Intervalo do torneio')
  const patrocinadores = usePatrocinadores()
  // Próxima partida: fila da mesa de streaming (aba Jogos). ?preview=1 mostra um exemplo.
  const { state, teams } = useStreamingSync()
  const preview = new URLSearchParams(window.location.search).has('preview')
  const proxima = nextScheduledMatch(state, teams) ?? (preview ? { a: 'Alento', b: 'Buena Mira', label: 'Rodada 3 · Jogo 4' } : null)
  const overlay = useRef<HTMLElement>(null)

  /* A composição é desenhada em 1920×1080 e escalada inteira — CSS não divide length por length. */
  useEffect(() => {
    const ajustar = () => {
      const escala = Math.min(window.innerWidth / PALCO.largura, window.innerHeight / PALCO.altura)
      overlay.current?.style.setProperty('--iv-escala', String(escala))
    }
    ajustar()
    window.addEventListener('resize', ajustar)
    return () => window.removeEventListener('resize', ajustar)
  }, [])

  return (
    <main className="iv-overlay" ref={overlay}>
      {/* Palco fixo de 1920×1080: a composição inteira é escalada, nunca reflowada. */}
      <div className="iv-stage">
        <div className="iv-rule iv-rule--topo" aria-hidden="true" />
        <div className="iv-rule iv-rule--base" aria-hidden="true" />
        <div className="iv-hatch" aria-hidden="true" />

        <section className="iv-slab" aria-label="2° Pior Campeonato de Bici Polo">
          <img src="/identidade/logo.svg" alt="" className="iv-symbol" aria-hidden="true" />
          <p className="iv-kicker">Curitiba 2026</p>
          <div className="iv-meta">
            <span className="iv-meta-rule" aria-hidden="true" />
            {proxima && (
              <div className="iv-proxima">
                <span className="iv-proxima-k">Próxima partida{proxima.label && <i> · {proxima.label}</i>}</span>
                <b>{proxima.a} <em>×</em> {proxima.b}</b>
              </div>
            )}
            <img src="/identidade/data.svg" alt="12 a 13 de dezembro de 2026" className="iv-meta-data" />
            <img src="/identidade/curitiba.svg" width="54" alt="Curitiba, Paraná" className="iv-meta-local" />
          </div>
        </section>

        {/* A faixa laranja é o berço original do wordmark roxo — mesma lógica de cor do site. */}
        <div className="iv-titlebar">
          {LOGO_CAMPEONATO
            ? <img src={LOGO_CAMPEONATO} alt="2° Pior Campeonato de Bici Polo" className="iv-wordmark" />
            : <div className="iv-placeholder iv-placeholder--logo"><b>Logo do campeonato</b><span>TROCAR · LOGO_CAMPEONATO em TorneioOverlayIntervalo.tsx</span></div>}
        </div>

        <div className="iv-state">
          <span className="iv-pulse" aria-hidden="true" />
          {/* Letreiro desenhado (ARTE_2PCBP_INTERVALO); o texto fica para leitores de tela */}
          <img src="/identidade/overlay/intervalo.webp" alt="Intervalo" className="iv-state-arte" />
        </div>
        <p className="iv-sub">Em instantes, mais bici polo.</p>
        <div className="iv-connector" aria-hidden="true" />

        {QR_LINK
          ? <IntervalQr value={QR_LINK} />
          : (
            <aside className="iv-qr">
              <span className="iv-qr-costura" aria-hidden="true" />
              <div className="iv-qr-tab"><strong>Acompanhe ao vivo</strong><span>Tabelas, jogos e classificação</span></div>
              <div className="iv-qr-plate"><div className="iv-placeholder iv-placeholder--qr"><b>QR code</b><span>TROCAR · QR_LINK</span></div></div>
            </aside>
          )}
        {/* Mascote descansando no intervalo */}
        <img src="/identidade/artes/lobo-encostado.webp" alt="" className="iv-lobo" aria-hidden="true" />
        <IntervalSponsor patrocinadores={patrocinadores} />
      </div>
    </main>
  )
}
