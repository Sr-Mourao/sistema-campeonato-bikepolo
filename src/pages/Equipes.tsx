import SiteNavbar from '../components/SiteNavbar'
import TeamList from '../components/equipes/TeamList'
import { useTorneioEquipes } from '../hooks/useTorneioEquipes'
import './Equipes.css'

export default function Equipes() {
  const { data, loading, error } = useTorneioEquipes('brasileiro')

  return (
    <div className="eq-page">
      <SiteNavbar currentPath="/equipes" scrollThreshold={40} />

      <main className="eq-main">
        <header className="eq-header">
          <p className="eq-header-eyebrow">Pior Campeonato de Bici Polo · Curitiba 2026</p>
          <h1 className="eq-header-title">Conheça as Equipes</h1>
          <p className="eq-header-sub">
            As equipes e atletas confirmados na disputa do 2° Pior Campeonato de Bici Polo.
          </p>
        </header>

        {loading && (
          <div className="eq-loading">
            <span className="eq-spinner" />
            <p>Carregando equipes…</p>
          </div>
        )}

        {error && !loading && (
          <div className="eq-error">
            <p>{error}</p>
            <button type="button" className="eq-back-btn" onClick={() => window.location.reload()}>Tentar de novo</button>
          </div>
        )}

        {data && !loading && !error && <TeamList equipes={data.teams} />}
      </main>
    </div>
  )
}
