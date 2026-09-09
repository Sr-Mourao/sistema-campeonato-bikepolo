import { useState, useEffect } from 'react'
import SiteNavbar from '../components/SiteNavbar'
import { torneioPublico, type TorneioResumo } from '../services/torneioPublico'
import TimeModal from '../components/torneio/TimeModal'
import VisaoGeral from './torneio/VisaoGeral'
import PrimeiraFase from './torneio/PrimeiraFase'
import Repescagem from './torneio/Repescagem'
import DoubleElimination from './torneio/DoubleElimination'
import Estatisticas from './torneio/Estatisticas'
import Regulamento from './torneio/Regulamento'
import './Torneio.css'
import { TOURNAMENT_PRESENTATION, useTournamentCategory } from '../contexts/TournamentContext'

const NAV_BASE = [
  { key: 'visao-geral', label: 'Visão Geral' },
  { key: 'primeira-fase', label: 'Primeira Fase' },
  { key: 'repescagem', label: 'Repescagem' },
  { key: 'double', label: 'Double Elimination' },
  { key: 'estatisticas', label: 'Estatísticas' },
  { key: 'regulamento', label: 'Regulamento' },
] as const
export type AbaKey = typeof NAV_BASE[number]['key']

function lerAba(nav: readonly { key: string }[]): AbaKey {
  const a = new URLSearchParams(window.location.search).get('aba')
  return (nav.some(n => n.key === a) ? a : 'visao-geral') as AbaKey
}

/**
 * Shell do torneio Misto (seções 2/23 do brief de área pública) — header + navegação
 * principal reduzida (6 itens, era 6 abas fragmentadas antes também, mas agora
 * Classificação+Jogos convivem em "Primeira Fase" e Repescagem/Double viram páginas
 * próprias). A aba ativa é espelhada em `?aba=` pra permitir link direto/compartilhável.
 */
export default function Torneio() {
  const categoria = useTournamentCategory()
  const NAV = categoria === 'mtnb' ? NAV_BASE.filter(n => n.key !== 'repescagem') : NAV_BASE
  const [aba, setAbaState] = useState<AbaKey>(() => lerAba(NAV))
  const [resumo, setResumo] = useState<TorneioResumo | null>(null)
  const [erro, setErro] = useState('')
  const [timeAberto, setTimeAberto] = useState<number | null>(null)

  useEffect(() => {
    torneioPublico.resumo(categoria).then(setResumo).catch(e => setErro(e.message))
  }, [categoria])

  useEffect(() => {
    const onPop = () => setAbaState(lerAba(NAV))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [categoria]) // eslint-disable-line react-hooks/exhaustive-deps

  function setAba(a: AbaKey) {
    setAbaState(a)
    const url = new URL(window.location.href)
    url.searchParams.set('aba', a)
    window.history.replaceState({}, '', url)
  }

  return (
    <div className="trp-page">
      <SiteNavbar currentPath="/torneio" scrollThreshold={40} />

      <main className="trp-main">
        <header className="trp-header">
          <p className="trp-header-eyebrow">Campeonato Brasileiro de Bike Polo · Floripa 2026</p>
          <h1 className="trp-header-title">{TOURNAMENT_PRESENTATION[categoria].title}</h1>
        </header>

        {erro && <div className="trp-erro">{erro}</div>}

        <nav className="trp-tabs">
          {NAV.map(n => (
            <button key={n.key} className={`trp-tab ${aba === n.key ? 'trp-tab--active' : ''}`} onClick={() => setAba(n.key)}>
              {n.label}
            </button>
          ))}
        </nav>

        {resumo && aba === 'visao-geral' && <VisaoGeral resumo={resumo} onIrPara={setAba} onAbrirTime={setTimeAberto} />}
        {resumo && aba === 'primeira-fase' && <PrimeiraFase resumo={resumo} onAbrirTime={setTimeAberto} />}
        {resumo && categoria === 'misto' && aba === 'repescagem' && <Repescagem resumo={resumo} />}
        {resumo && aba === 'double' && <DoubleElimination />}
        {resumo && aba === 'estatisticas' && <Estatisticas />}
        {resumo && aba === 'regulamento' && <Regulamento resumo={resumo} />}

        {timeAberto !== null && <TimeModal timeId={timeAberto} onClose={() => setTimeAberto(null)} />}
      </main>
    </div>
  )
}
