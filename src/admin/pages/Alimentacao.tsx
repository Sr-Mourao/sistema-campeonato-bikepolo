import { useState, useEffect } from 'react'
import { adminGet } from '../adminApi'
import ExportButtons from '../components/ExportButtons'

interface Pessoa {
  id: number
  inscricao_id: number
  nome: string
  cidade: string
  nacionalidade: string
  dia: number
  pacote: string
  restricao_alimentar: { tipo?: string; descricao?: string } | null
  alimentacao_confirmada: number
}

interface Restricoes {
  vegetariano: number
  vegano: number
  lactose: number
  alergia: number
  outra: number
  total: number
}

interface DiaDados {
  dia: number
  total: number
  completo: number
  almoco: number
  restricoes: Restricoes
  pessoas: Pessoa[]
}

const RESTRICAO_LABELS: Record<keyof Omit<Restricoes, 'total'>, string> = {
  vegetariano: 'Vegetariano',
  vegano:      'Vegano',
  lactose:     'Intolerância à lactose',
  alergia:     'Alergia alimentar',
  outra:       'Outra restrição',
}

export default function Alimentacao() {
  const [dados, setDados] = useState<DiaDados[]>([])
  const [loading, setLoading] = useState(true)
  const [diaSelecionado, setDiaSelecionado] = useState<number | null>(null)

  useEffect(() => {
    adminGet<DiaDados[]>('/api/admin/alimentacao.php')
      .then(d => { if (d) setDados(d) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ color: 'var(--adm-text-2)', padding: 20 }}>Carregando…</div>

  const diasVisiveis = diaSelecionado
    ? dados.filter(d => d.dia === diaSelecionado)
    : dados

  return (
    <div>
      <div className="adm-toolbar" style={{ marginBottom: 20 }}>
        <div className="adm-filter-chips">
          <button
            className={`adm-chip ${diaSelecionado === null ? 'adm-chip--active' : ''}`}
            onClick={() => setDiaSelecionado(null)}
          >
            Todos os dias
          </button>
          {[5, 6, 7].map(dia => (
            <button
              key={dia}
              className={`adm-chip ${diaSelecionado === dia ? 'adm-chip--active' : ''}`}
              onClick={() => setDiaSelecionado(dia)}
            >
              Dia {dia}/set
            </button>
          ))}
        </div>
        <ExportButtons />
      </div>

      {diasVisiveis.map(dia => (
        <div key={dia.dia} className="adm-dia-section">
          <div className="adm-dia-header">
            <h2>Dia {dia.dia}/set</h2>
            <div className="adm-dia-stats">
              <div className="adm-dia-stat">Total: <span>{dia.total}</span></div>
              {dia.completo > 0 && <div className="adm-dia-stat">Pacote completo: <span>{dia.completo}</span></div>}
              {dia.almoco   > 0 && <div className="adm-dia-stat">Apenas almoço: <span>{dia.almoco}</span></div>}
              {dia.restricoes.total > 0 && <div className="adm-dia-stat">Restritivos: <span>{dia.restricoes.total}</span></div>}
            </div>
          </div>

          {dia.restricoes.total > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '0 0 14px' }}>
              {(Object.keys(RESTRICAO_LABELS) as (keyof typeof RESTRICAO_LABELS)[])
                .filter(t => dia.restricoes[t] > 0)
                .map(t => (
                  <span key={t} className="adm-badge adm-badge--warn">
                    {RESTRICAO_LABELS[t]}: {dia.restricoes[t]}
                  </span>
                ))}
            </div>
          )}

          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Cidade</th>
                  <th>Pacote</th>
                  <th>Restrição</th>
                  <th>Confirmado</th>
                </tr>
              </thead>
              <tbody>
                {dia.pessoas.map(p => (
                  <tr key={p.inscricao_id}>
                    <td style={{ fontWeight: 600 }}>{p.nome}</td>
                    <td style={{ color: 'var(--adm-text-2)', fontSize: '.84rem' }}>{p.cidade || '—'}</td>
                    <td>
                      {p.pacote === 'almoco'
                        ? <span className="adm-badge adm-badge--tag">Só almoço</span>
                        : <span className="adm-badge adm-badge--tag">Completo</span>
                      }
                    </td>
                    <td>
                      {p.restricao_alimentar
                        ? <span className="adm-badge adm-badge--warn">
                            {RESTRICAO_LABELS[p.restricao_alimentar.tipo as keyof typeof RESTRICAO_LABELS] ?? p.restricao_alimentar.tipo}
                            {p.restricao_alimentar.descricao ? `: ${p.restricao_alimentar.descricao}` : ''}
                          </span>
                        : <span style={{ color: 'var(--adm-text-3)' }}>—</span>
                      }
                    </td>
                    <td>
                      {p.alimentacao_confirmada
                        ? <span className="adm-badge adm-badge--ok">✓ Pago</span>
                        : <span className="adm-badge adm-badge--warn">Pendente</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {dados.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--adm-text-3)', padding: 40 }}>
          Nenhuma alimentação registrada
        </div>
      )}
    </div>
  )
}
