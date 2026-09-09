import { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { adminGet } from '../adminApi'
import InscricaoDrawer, { StatusBadge } from './InscricaoDrawer'
import ExportButtons from '../components/ExportButtons'

interface Inscricao {
  id: number
  nome: string
  email: string
  cidade: string
  tipo_participacao: string
  nacionalidade: string
  clube: string
  categorias: string
  times: string
  status: string
  latino: number
  acao_afirmativa: number
  valor_total: number
  tem_alimentacao: number
  tem_alojamento: number
  criado_em: string
}

const FILTROS_STATUS = [
  { key: 'todos',                label: 'Todos (exceto cancelado)' },
  { key: 'pago',                 label: 'Pago' },
  { key: 'aguardando_pagamento', label: 'Aguardando' },
  { key: 'cancelado',            label: 'Cancelado' },
]

export default function Inscricoes() {
  const [lista, setLista] = useState<Inscricao[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [status, setStatus] = useState('todos')
  const [filtros, setFiltros] = useState<Record<string, boolean>>({})
  const [drawerIdId, setDrawerId] = useState<number | null>(null)

  const toggleFiltro = (key: string) =>
    setFiltros(prev => ({ ...prev, [key]: !prev[key] }))

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (status !== 'todos') params.set('status', status)
    if (filtros.latino)          params.set('latino', '1')
    if (filtros.aa)              params.set('acao_afirmativa', '1')
    if (filtros.alojamento)      params.set('alojamento', '1')
    if (filtros.alimentacao)     params.set('alimentacao', '1')
    if (filtros.estrangeiro)     params.set('estrangeiro', '1')
    if (filtros.misto)           params.set('categoria', 'misto')
    if (filtros.mtnb)            params.set('categoria', 'mtnb')
    if (busca)                   params.set('busca', busca)

    adminGet<Inscricao[]>(`/api/admin/inscricoes.php?${params}`)
      .then(d => { if (d) setLista(d) })
      .finally(() => setLoading(false))
  }, [status, filtros, busca])

  useEffect(() => {
    const t = setTimeout(load, busca ? 300 : 0)
    return () => clearTimeout(t)
  }, [load, busca])

  const CHIPS = [
    { key: 'misto',      label: 'Misto' },
    { key: 'mtnb',       label: 'MTNB' },
    { key: 'latino',     label: 'Latino' },
    { key: 'aa',         label: 'Ação Afirm.' },
    { key: 'estrangeiro',label: 'Estrangeire' },
    { key: 'alimentacao',label: 'Alimentação' },
    { key: 'alojamento', label: 'Alojamento' },
  ]

  return (
    <div>
      <div className="adm-toolbar">
        <input
          className="adm-search"
          placeholder="Buscar por nome, email, cidade…"
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />

        <select className="adm-select" value={status} onChange={e => setStatus(e.target.value)}>
          {FILTROS_STATUS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>

        <button className="adm-btn adm-btn--sm" onClick={load} title="Atualizar">
          <RefreshCw size={14} />
        </button>

        <span className="adm-count">{lista.length} resultado{lista.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="adm-filter-chips" style={{ marginBottom: 14 }}>
        {CHIPS.map(c => (
          <button
            key={c.key}
            className={`adm-chip ${filtros[c.key] ? 'adm-chip--active' : ''}`}
            onClick={() => toggleFiltro(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div style={{ marginBottom: 12 }}>
        <ExportButtons />
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Nome</th>
              <th>Clube / Cidade</th>
              <th>Categorias</th>
              <th>Times</th>
              <th>Status</th>
              <th>Flags</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--adm-text-3)', padding: 24 }}>Carregando…</td></tr>
            )}
            {!loading && lista.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--adm-text-3)', padding: 24 }}>Nenhum resultado</td></tr>
            )}
            {lista.map(ins => (
              <tr
                key={ins.id}
                className="adm-row-clickable"
                onClick={() => setDrawerId(ins.id)}
              >
                <td style={{ color: 'var(--adm-text-3)', fontSize: '.78rem' }}>{ins.id}</td>
                <td>
                  <div style={{ fontWeight: 600 }}>{ins.nome}</div>
                  <div style={{ fontSize: '.76rem', color: 'var(--adm-text-3)' }}>{ins.email}</div>
                </td>
                <td style={{ color: 'var(--adm-text-2)', fontSize: '.84rem' }}>
                  {ins.clube || '—'}
                  {ins.cidade && <div style={{ fontSize: '.76rem', color: 'var(--adm-text-3)' }}>{ins.cidade}</div>}
                </td>
                <td>
                  {ins.categorias
                    ? ins.categorias.split(', ').map(c => (
                        <span key={c} className={`adm-badge adm-badge--${c.toLowerCase()} `} style={{ marginRight: 4 }}>{c.toUpperCase()}</span>
                      ))
                    : <span style={{ color: 'var(--adm-text-3)' }}>—</span>
                  }
                </td>
                <td style={{ color: 'var(--adm-text-2)', fontSize: '.82rem', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ins.times || '—'}
                </td>
                <td><StatusBadge status={ins.status} /></td>
                <td>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {ins.tipo_participacao === 'acompanhante' && <span className="adm-badge adm-badge--tag">APOIO</span>}
                    {ins.latino === 1    && <span className="adm-badge adm-badge--tag">LAT</span>}
                    {ins.acao_afirmativa === 1 && <span className="adm-badge adm-badge--tag">AA</span>}
                    {ins.tem_alimentacao > 0 && <span className="adm-badge adm-badge--tag">🍽</span>}
                    {ins.tem_alojamento  > 0 && <span className="adm-badge adm-badge--tag">🛏</span>}
                    {ins.nacionalidade !== 'brasileire' && <span className="adm-badge adm-badge--tag">🌎</span>}
                  </div>
                </td>
                <td style={{ fontSize: '.84rem', fontWeight: 600 }}>
                  R$ {parseFloat(String(ins.valor_total || 0)).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {drawerIdId !== null && (
        <InscricaoDrawer
          inscricaoId={drawerIdId}
          onClose={() => setDrawerId(null)}
          onRefresh={load}
        />
      )}
    </div>
  )
}
