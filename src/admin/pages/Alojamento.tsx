import { useState, useEffect, useMemo } from 'react'
import { adminGet } from '../adminApi'
import ExportButtons from '../components/ExportButtons'

interface Pessoa {
  inscricao_id: number
  nome: string
  cidade: string
  nacionalidade: string
  dias: Record<string, 'pago' | 'pendente' | null>
}

interface DiaStat { total: number; pagos: number }

interface Dados {
  pessoas: Pessoa[]
  por_dia: Record<string, DiaStat>
  dias: number[]
}

const MES_LABEL: Record<number, string> = { 3: 'Qui', 4: 'Sex', 5: 'Sáb', 6: 'Dom', 7: 'Seg', 8: 'Ter', 9: 'Qua' }

export default function Alojamento() {
  const [dados, setDados] = useState<Dados | null>(null)
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    adminGet<Dados>('/api/admin/alojamento.php')
      .then(d => { if (d) setDados(d) })
      .finally(() => setLoading(false))
  }, [])

  const pessoasVisiveis = useMemo(() => {
    if (!dados) return []
    if (!busca.trim()) return dados.pessoas
    const t = busca.toLowerCase()
    return dados.pessoas.filter(p => p.nome.toLowerCase().includes(t) || p.cidade?.toLowerCase().includes(t))
  }, [dados, busca])

  if (loading) return <div style={{ color: 'var(--adm-text-2)', padding: 20 }}>Carregando…</div>
  if (!dados) return null

  return (
    <div>
      <div className="adm-toolbar" style={{ marginBottom: 20 }}>
        <input
          className="adm-search"
          placeholder="Buscar pessoa ou cidade…"
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
        <span className="adm-count">{pessoasVisiveis.length} pessoas</span>
        <ExportButtons />
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {dados.dias.map(d => (
          <div key={d} className="adm-card" style={{ padding: '10px 14px', minWidth: 88 }}>
            <div style={{ fontSize: '.72rem', color: 'var(--adm-text-3)' }}>{d}/set · {MES_LABEL[d]}</div>
            <div style={{ fontSize: '1rem', fontWeight: 700 }}>
              {dados.por_dia[String(d)]?.pagos ?? 0}
              <span style={{ fontSize: '.76rem', fontWeight: 400, color: 'var(--adm-text-3)' }}>
                {' '}/ {dados.por_dia[String(d)]?.total ?? 0}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Pessoa</th>
              <th>Cidade</th>
              {dados.dias.map(d => (
                <th key={d} style={{ textAlign: 'center' }}>{d}/set<br /><span style={{ fontWeight: 400, fontSize: '.7rem', color: 'var(--adm-text-3)' }}>{MES_LABEL[d]}</span></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pessoasVisiveis.map(p => (
              <tr key={p.inscricao_id}>
                <td style={{ fontWeight: 600 }}>{p.nome}</td>
                <td style={{ color: 'var(--adm-text-2)', fontSize: '.84rem' }}>{p.cidade || '—'}</td>
                {dados.dias.map(d => {
                  const status = p.dias[String(d)]
                  return (
                    <td key={d} style={{ textAlign: 'center' }}>
                      {status === 'pago' && <span className="adm-badge adm-badge--ok" title="Pago">✓</span>}
                      {status === 'pendente' && <span className="adm-badge adm-badge--warn" title="Pendente">·</span>}
                      {!status && <span style={{ color: 'var(--adm-text-3)' }}>—</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pessoasVisiveis.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--adm-text-3)', padding: 40 }}>
          Nenhum alojamento registrado
        </div>
      )}
    </div>
  )
}
