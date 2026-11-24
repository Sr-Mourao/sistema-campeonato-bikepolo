import { useState, useEffect } from 'react'
import SiteNavbar from '../components/SiteNavbar'
import TournamentPicker from '../components/equipes/TournamentPicker'
import TeamList from '../components/equipes/TeamList'
import { useTorneioEquipes } from '../hooks/useTorneioEquipes'
import type { Torneio } from '../services/poloperator'
import './Equipes.css'

function lerTorneio(): Torneio | null {
  const t = new URLSearchParams(window.location.search).get('torneio')
  return t === 'brasileiro' ? t : null
}

function escreveTorneio(torneio: Torneio | null) {
  const url = '/equipes' + (torneio ? `?torneio=${torneio}` : '')
  window.history.pushState({}, '', url)
}

const TORNEIO_LABEL: Record<Torneio, string> = {
  brasileiro: '2° Pior Campeonato de Bici Polo',
}

export default function Equipes() {
  const [torneio, setTorneio] = useState<Torneio | null>(lerTorneio)

  useEffect(() => {
    const onPop = () => setTorneio(lerTorneio())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const { data, loading, error } = useTorneioEquipes(torneio)

  function escolherTorneio(t: Torneio) {
    escreveTorneio(t)
    setTorneio(t)
  }
  function voltarParaPicker() {
    escreveTorneio(null)
    setTorneio(null)
  }

  return (
    <div className="eq-page">
      <SiteNavbar currentPath="/equipes" scrollThreshold={40} />

      <main className="eq-main">
        <header className="eq-header">
          <p className="eq-header-eyebrow">Pior Campeonato de Bici Polo · Curitiba 2026</p>
          <h1 className="eq-header-title">Conheça as Equipes</h1>
          <p className="eq-header-sub">
            As equipes e atletas confirmados na disputa do Brasileiro.
          </p>
        </header>

        {!torneio && <TournamentPicker onEscolher={escolherTorneio} />}

        {torneio && (
          <>
            <div className="eq-toolbar">
              <button type="button" className="eq-back-btn" onClick={voltarParaPicker}>← Trocar campeonato</button>
              <p className="eq-toolbar-title">{TORNEIO_LABEL[torneio]}</p>
            </div>

            {loading && (
              <div className="eq-loading">
                <span className="eq-spinner" />
                <p>Carregando equipes…</p>
              </div>
            )}

            {error && !loading && (
              <div className="eq-error">
                <p>{error}</p>
                <button type="button" className="eq-back-btn" onClick={() => escolherTorneio(torneio)}>Tentar de novo</button>
              </div>
            )}

            {data && !loading && !error && <TeamList equipes={data.teams} />}
          </>
        )}
      </main>
    </div>
  )
}
