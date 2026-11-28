import { useState, useEffect, useCallback } from 'react'
import './torneio.css'
import { torneioApi, type Torneio, type TorneioDetalhe } from './torneioApi'
import VisaoGeral from './VisaoGeral'
import TorneioDashboard from './TorneioDashboard'
import Classificacao from './Classificacao'
import Estatisticas from './Estatisticas'
import Chaves from './Chaves'
import Configuracoes from './Configuracoes'
import Auditoria from './Auditoria'

const TABS = [
  { key: 'visao-geral', label: 'Visão Geral' },
  { key: 'ao-vivo', label: 'Ao Vivo' },
  { key: 'classificacao', label: 'Classificação' },
  { key: 'chaves', label: 'Chaves' },
  { key: 'estatisticas', label: 'Estatísticas' },
  { key: 'configuracoes', label: 'Configurações' },
  { key: 'historico', label: 'Histórico' },
] as const
type TabKey = typeof TABS[number]['key']

// Esta versão (2° Pior) só tem o Misto. O MTNB continua no backend e nos testes;
// reativar depois trocando para true.
const MTNB_VISIVEL = false
const categoriaVisivel = (t: Torneio) => t.categoria === 'misto' || (MTNB_VISIVEL && t.categoria === 'mtnb') // arquivados (ex.: demo_arquivado) nunca aparecem

export default function TorneioAdmin() {
  const [torneios, setTorneios] = useState<Torneio[] | null>(null)
  const [torneioId, setTorneioId] = useState<number | null>(null)
  const [detalhe, setDetalhe] = useState<TorneioDetalhe | null>(null)
  const [tab, setTab] = useState<TabKey>('visao-geral')
  const [criando, setCriando] = useState(false)

  const carregarLista = useCallback(async () => {
    const r = await torneioApi.listar()
    if (!r) return
    const visiveis = r.torneios.filter(categoriaVisivel)
    setTorneios(visiveis)
    if (visiveis.length && torneioId === null) setTorneioId(visiveis[0].id)
  }, [torneioId])

  useEffect(() => { carregarLista() }, [carregarLista])

  const carregarDetalhe = useCallback(async () => {
    if (!torneioId) return
    const d = await torneioApi.detalhe(torneioId)
    if (d) setDetalhe(d)
  }, [torneioId])

  useEffect(() => { carregarDetalhe() }, [carregarDetalhe])

  async function criarTorneioOficial(categoria: 'misto' | 'mtnb') {
    setCriando(true)
    const r = await torneioApi.criarPreset(categoria)
    setCriando(false)
    if (r) { await carregarLista(); setTorneioId(r.id) }
  }

  if (torneios === null) return <div style={{ color: 'var(--adm-text-2)', padding: 20 }}>Carregando…</div>

  if (torneios.length === 0) {
    return (
      <div className="adm-card" style={{ maxWidth: 560 }}>
        <h3>Nenhum torneio criado ainda</h3>
        <p style={{ color: 'var(--adm-text-2)', fontSize: '.88rem', margin: '10px 0 16px' }}>
          Crie uma competição usando as equipes da categoria correspondente na base interna.
        </p>
        <div style={{display:'flex',gap:8}}><button className="adm-btn-primary" disabled={criando} onClick={() => criarTorneioOficial('misto')}>CRIAR MISTO</button>{MTNB_VISIVEL && <button className="adm-btn-primary" disabled={criando} onClick={() => criarTorneioOficial('mtnb')}>CRIAR MTNB</button>}</div>
      </div>
    )
  }

  return (
    <div className="trn-admin-shell">
      {torneios.length > 1 && (
        <div className="trn-toolbar">
          <select className="adm-select" value={torneioId ?? ''} onChange={e => setTorneioId(Number(e.target.value))}>
            {torneios.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </div>
      )}
      <div className="trn-toolbar" style={{marginBottom:12}}>
        {/* O 2° Pior (8 times) pode ser criado mesmo se um Misto antigo existir; o site mostra o mais recente. */}
        {!torneios.some(t => t.categoria === 'misto' && t.formato === 'misto_round_robin_8') && <button className="adm-btn-primary" disabled={criando} onClick={() => criarTorneioOficial('misto')}>CRIAR MISTO</button>}
        {MTNB_VISIVEL && !torneios.some(t => t.categoria === 'mtnb') && <button className="adm-btn-primary" disabled={criando} onClick={() => criarTorneioOficial('mtnb')}>CRIAR MTNB</button>}
      </div>

      <nav className="trn-nav">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`trn-nav-item ${tab === t.key ? 'trn-nav-item--active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="trn-tab-content">
        {!detalhe || !torneioId ? (
          <div style={{ color: 'var(--adm-text-2)' }}>Carregando torneio…</div>
        ) : (
          <>
            {tab === 'visao-geral' && <VisaoGeral torneio={detalhe} onIrParaAoVivo={() => setTab('ao-vivo')} />}
            {tab === 'ao-vivo' && <TorneioDashboard torneio={detalhe} onChange={carregarDetalhe} />}
            {tab === 'classificacao' && <Classificacao torneio={detalhe} />}
            {tab === 'chaves' && <Chaves torneio={detalhe} onChange={carregarDetalhe} />}
            {tab === 'estatisticas' && <Estatisticas torneio={detalhe} />}
            {tab === 'configuracoes' && <Configuracoes torneio={detalhe} onChange={carregarDetalhe} />}
            {tab === 'historico' && <Auditoria torneioId={torneioId} onChange={carregarDetalhe} />}
          </>
        )}
      </div>
    </div>
  )
}
