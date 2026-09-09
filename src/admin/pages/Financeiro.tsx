import { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { adminGet, adminPost, fmtBRL, fmtDate } from '../adminApi'

interface Pagamento {
  id: number
  inscricao_id: number
  tipo: string
  metodo: string | null
  status: string
  valor: number
  reembolsado: number
  criado_em: string
  atleta_nome: string
  atleta_email: string
  inscricao_status: string
  valor_total: number
}

const TIPO_LABEL: Record<string, string> = {
  inscricao:        'Inscrição',
  alimentacao:      'Alimentação',
  alojamento:       'Alojamento',
  alojamento_extra: 'Alojamento extra',
  completo:         'Completo',
}

export default function Financeiro() {
  const [lista, setLista] = useState<Pagamento[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [tipo, setTipo] = useState('')
  const [busca, setBusca] = useState('')
  const [reverterAlvo, setReverterAlvo] = useState<Pagamento | null>(null)
  const [revertendo, setRevertendo] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    const p = new URLSearchParams()
    if (status) p.set('status', status)
    if (tipo)   p.set('tipo', tipo)
    if (busca)  p.set('busca', busca)
    adminGet<Pagamento[]>(`/api/admin/financeiro.php?${p}`)
      .then(d => { if (d) setLista(d) })
      .finally(() => setLoading(false))
  }, [status, tipo, busca])

  useEffect(() => {
    const t = setTimeout(load, busca ? 300 : 0)
    return () => clearTimeout(t)
  }, [load, busca])

  const totalPago       = lista.filter(p => p.status === 'pago' && !p.reembolsado && p.inscricao_status !== 'cancelado').reduce((s, p) => s + (p.valor || 0), 0)
  const totalPendente   = lista.filter(p => p.status === 'pendente').reduce((s, p) => s + (p.valor || 0), 0)
  const totalReembolsar = lista.filter(p => p.status === 'pago' && !p.reembolsado && p.inscricao_status === 'cancelado').reduce((s, p) => s + (p.valor || 0), 0)

  async function confirmarReversao() {
    if (!reverterAlvo) return
    setRevertendo(true)
    const r = await adminPost('/api/admin/financeiro.php', {
      action: 'update_status',
      id: reverterAlvo.id,
      status: 'pendente',
    })
    setRevertendo(false)
    if (r) {
      setReverterAlvo(null)
      load()
    }
  }

  return (
    <div>
      <div className="adm-toolbar">
        <input
          className="adm-search"
          placeholder="Buscar atleta…"
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
        <select className="adm-select" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="pago">Pago</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <select className="adm-select" value={tipo} onChange={e => setTipo(e.target.value)}>
          <option value="">Todos os tipos</option>
          <option value="inscricao">Inscrição</option>
          <option value="alimentacao">Alimentação</option>
          <option value="alojamento">Alojamento</option>
          <option value="alojamento_extra">Alojamento extra</option>
          <option value="completo">Completo</option>
        </select>
        <button className="adm-btn adm-btn--sm" onClick={load}><RefreshCw size={14} /></button>
        <span className="adm-count">{lista.length} registros</span>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="adm-card" style={{ flex: 1, minWidth: 140, padding: '12px 16px' }}>
          <div style={{ fontSize: '.75rem', color: 'var(--adm-text-3)', marginBottom: 2 }}>Receita efetiva</div>
          <div style={{ color: 'var(--adm-accent)', fontWeight: 700, fontSize: '1.1rem' }}>{fmtBRL(totalPago)}</div>
        </div>
        <div className="adm-card" style={{ flex: 1, minWidth: 140, padding: '12px 16px' }}>
          <div style={{ fontSize: '.75rem', color: 'var(--adm-text-3)', marginBottom: 2 }}>Pendente</div>
          <div style={{ color: 'var(--adm-yellow)', fontWeight: 700, fontSize: '1.1rem' }}>{fmtBRL(totalPendente)}</div>
        </div>
        {totalReembolsar > 0 && (
          <div className="adm-card" style={{ flex: 1, minWidth: 140, padding: '12px 16px', borderColor: 'var(--adm-red)' }}>
            <div style={{ fontSize: '.75rem', color: 'var(--adm-red)', marginBottom: 2 }}>⚠ A reembolsar</div>
            <div style={{ color: 'var(--adm-red)', fontWeight: 700, fontSize: '1.1rem' }}>{fmtBRL(totalReembolsar)}</div>
          </div>
        )}
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Atleta</th>
              <th>Tipo</th>
              <th>Método</th>
              <th>Status insc.</th>
              <th>Status pag.</th>
              <th>Valor</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--adm-text-3)', padding: 24 }}>Carregando…</td></tr>}
            {!loading && lista.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--adm-text-3)', padding: 24 }}>Nenhum resultado</td></tr>}
            {lista.map(p => (
              <tr key={p.id}>
                <td style={{ color: 'var(--adm-text-3)', fontSize: '.76rem' }}>{p.id}</td>
                <td>
                  <div style={{ fontWeight: 600 }}>{p.atleta_nome}</div>
                  <div style={{ fontSize: '.74rem', color: 'var(--adm-text-3)' }}>{p.atleta_email}</div>
                </td>
                <td style={{ fontSize: '.84rem' }}>{TIPO_LABEL[p.tipo] ?? p.tipo}</td>
                <td style={{ color: 'var(--adm-text-2)', fontSize: '.82rem' }}>{p.metodo || '—'}</td>
                <td>
                  {p.inscricao_status === 'cancelado'
                    ? <span className="adm-badge adm-badge--cancelado">Cancelada</span>
                    : <span className="adm-badge adm-badge--ok" style={{ opacity: .7 }}>Ativa</span>
                  }
                </td>
                <td>
                  {p.status === 'pago' && p.reembolsado
                    ? <span className="adm-badge adm-badge--tag">Reembolsado</span>
                    : p.status === 'pago'
                      ? (
                        <span
                          className="adm-badge adm-badge--pago"
                          style={{ cursor: 'pointer' }}
                          title="Clique para reverter para pendente"
                          onClick={() => setReverterAlvo(p)}
                        >
                          pago
                        </span>
                      )
                      : <span className={`adm-badge adm-badge--${p.status === 'cancelado' ? 'cancelado' : 'aguardando'}`}>{p.status}</span>
                  }
                  <span style={{ marginLeft: 6, fontSize: '.82rem', fontWeight: 600, color: p.status === 'pago' && !p.reembolsado && p.inscricao_status === 'cancelado' ? 'var(--adm-red)' : 'var(--adm-text-2)' }}>{fmtBRL(p.valor)}</span>
                </td>
                <td style={{ color: 'var(--adm-text-3)', fontSize: '.78rem' }}>{fmtDate(p.criado_em)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {reverterAlvo && (
        <div className="adm-confirm-overlay" onClick={() => !revertendo && setReverterAlvo(null)}>
          <div className="adm-confirm-box" onClick={e => e.stopPropagation()}>
            <h3>Reverter pagamento para pendente?</h3>
            <p>
              <strong>{reverterAlvo.atleta_nome}</strong> — {reverterAlvo.tipo} — {fmtBRL(reverterAlvo.valor)}
              <br /><br />
              Isso vai marcar este pagamento como <strong>pendente</strong> novamente
              {['inscricao', 'completo'].includes(reverterAlvo.tipo) && ' e reabrir a inscrição para pagamento'}.
              Use apenas para corrigir um pagamento marcado como pago por engano. Essa ação não pode ser desfeita automaticamente.
            </p>
            <div className="adm-confirm-actions">
              <button className="adm-btn adm-btn--sm" onClick={() => setReverterAlvo(null)} disabled={revertendo}>
                Cancelar
              </button>
              <button className="adm-btn adm-btn--sm adm-btn--danger" onClick={confirmarReversao} disabled={revertendo}>
                {revertendo ? 'Revertendo…' : 'Tenho certeza, reverter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
