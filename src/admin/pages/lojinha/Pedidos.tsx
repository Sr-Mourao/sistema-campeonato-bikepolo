import { useState, useEffect, useCallback } from 'react'
import { X, RefreshCw } from 'lucide-react'
import { adminGet, adminPost, fmtBRL, fmtDate } from '../../adminApi'
import ExportButtons from '../../components/ExportButtons'

interface PedidoResumo {
  id: number
  nome: string
  email: string
  whatsapp: string | null
  status: string
  metodo: string | null
  valor: number
  codigo_retirada: string
  criado_em: string
  itens_resumo: string | null
}

interface PedidoItem {
  id: number
  produto_id: number
  produto_nome: string
  tamanho: string | null
  quantidade: number
  preco_unitario: number
}

interface PedidoDetalhe extends PedidoResumo {
  observacoes: string | null
  itens: PedidoItem[]
}

const STATUS_FILTROS = [
  { key: 'todos',    label: 'Todos' },
  { key: 'pendente', label: 'Pendente' },
  { key: 'pago',     label: 'Pago' },
  { key: 'retirado', label: 'Retirado' },
  { key: 'cancelado', label: 'Cancelado' },
] as const

function badgeClasse(status: string): string {
  if (status === 'pago') return 'adm-badge--ok'
  if (status === 'pendente') return 'adm-badge--warn'
  if (status === 'cancelado') return 'adm-badge--err'
  return 'adm-badge--tag'
}

export default function Pedidos() {
  const [lista, setLista] = useState<PedidoResumo[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<string>('todos')
  const [busca, setBusca] = useState('')
  const [selecionadoId, setSelecionadoId] = useState<number | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (status !== 'todos') params.set('status', status)
    if (busca.trim()) params.set('busca', busca.trim())
    adminGet<PedidoResumo[]>(`/api/admin/lojinha-pedidos.php?${params.toString()}`)
      .then(d => { if (d) setLista(d) })
      .finally(() => setLoading(false))
  }, [status, busca])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  return (
    <div>
      <div className="adm-toolbar" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div className="adm-filter-chips">
          {STATUS_FILTROS.map(f => (
            <button
              key={f.key}
              className={`adm-chip ${status === f.key ? 'adm-chip--active' : ''}`}
              onClick={() => setStatus(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome, email, whatsapp ou código…"
          style={{
            flex: '1 1 240px', maxWidth: 320, padding: '7px 12px', fontSize: '.84rem',
            background: 'var(--adm-surface-2)', border: '1px solid var(--adm-border-2)',
            borderRadius: 'var(--adm-radius-sm)', color: 'var(--adm-text)',
          }}
        />
        <button className="adm-btn adm-btn--sm" onClick={load} title="Atualizar">
          <RefreshCw size={14} />
        </button>
        <ExportButtons />
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Contato</th>
              <th>Itens</th>
              <th>Valor</th>
              <th>Status</th>
              <th>Código</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--adm-text-3)', padding: 24 }}>Carregando…</td></tr>
            )}
            {!loading && lista.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--adm-text-3)', padding: 24 }}>Nenhum pedido encontrado</td></tr>
            )}
            {lista.map(p => (
              <tr key={p.id} onClick={() => setSelecionadoId(p.id)} style={{ cursor: 'pointer' }}>
                <td style={{ fontWeight: 600 }}>{p.nome}</td>
                <td style={{ color: 'var(--adm-text-2)', fontSize: '.84rem' }}>
                  {p.email}{p.whatsapp ? ` · ${p.whatsapp}` : ''}
                </td>
                <td style={{ color: 'var(--adm-text-2)', fontSize: '.84rem' }}>{p.itens_resumo ?? '—'}</td>
                <td>{fmtBRL(p.valor)}</td>
                <td><span className={`adm-badge ${badgeClasse(p.status)}`}>{p.status}</span></td>
                <td style={{ fontFamily: 'monospace', fontSize: '.84rem' }}>{p.codigo_retirada}</td>
                <td style={{ color: 'var(--adm-text-2)', fontSize: '.82rem' }}>{fmtDate(p.criado_em)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selecionadoId !== null && (
        <PedidoDrawer
          pedidoId={selecionadoId}
          onClose={() => setSelecionadoId(null)}
          onRefresh={load}
        />
      )}
    </div>
  )
}

function PedidoDrawer({ pedidoId, onClose, onRefresh }: { pedidoId: number; onClose: () => void; onRefresh: () => void }) {
  const [pedido, setPedido] = useState<PedidoDetalhe | null>(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(() => {
    adminGet<PedidoDetalhe>(`/api/admin/lojinha-pedidos.php?id=${pedidoId}`)
      .then(d => { if (d) setPedido(d) })
      .finally(() => setLoading(false))
  }, [pedidoId])

  useEffect(load, [load])

  async function acao(action: string) {
    setSalvando(true)
    const res = await adminPost('/api/admin/lojinha-pedidos.php', { action, id: pedidoId })
    if (res) {
      setMsg('Salvo!')
      setTimeout(() => setMsg(''), 2000)
      load()
      onRefresh()
    }
    setSalvando(false)
  }

  return (
    <div className="adm-drawer-overlay" onClick={onClose}>
      <div className="adm-drawer" onClick={e => e.stopPropagation()}>
        <div className="adm-drawer-header">
          <div>
            <h2>{pedido?.nome ?? 'Pedido'}</h2>
            {pedido && <p>{pedido.email}{pedido.whatsapp ? ` · ${pedido.whatsapp}` : ''}</p>}
          </div>
          <button className="adm-drawer-close" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        <div className="adm-drawer-body">
          {loading && <p style={{ color: 'var(--adm-text-2)' }}>Carregando…</p>}

          {pedido && (
            <>
              <div className="adm-section">
                <div className="adm-section-title">Status</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className={`adm-badge ${badgeClasse(pedido.status)}`}>{pedido.status}</span>
                  {pedido.metodo && <span style={{ color: 'var(--adm-text-2)', fontSize: '.84rem' }}>via {pedido.metodo}</span>}
                </div>
              </div>

              <div className="adm-section">
                <div className="adm-section-title">Itens</div>
                {pedido.itens.map(it => (
                  <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.86rem', padding: '4px 0' }}>
                    <span>{it.quantidade}× {it.produto_nome}{it.tamanho ? ` (${it.tamanho})` : ''}</span>
                    <span>{fmtBRL(it.quantidade * it.preco_unitario)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, paddingTop: 8, borderTop: '1px solid var(--adm-border)', marginTop: 4 }}>
                  <span>Total</span>
                  <span>{fmtBRL(pedido.valor)}</span>
                </div>
              </div>

              <div className="adm-section">
                <div className="adm-section-title">Código de retirada</div>
                <div style={{ fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: 700 }}>{pedido.codigo_retirada}</div>
              </div>

              {pedido.observacoes && (
                <div className="adm-section">
                  <div className="adm-section-title">Observações</div>
                  <p style={{ fontSize: '.86rem', color: 'var(--adm-text-2)' }}>{pedido.observacoes}</p>
                </div>
              )}

              <div className="adm-section">
                <div className="adm-section-title">Data do pedido</div>
                <div style={{ fontSize: '.86rem', color: 'var(--adm-text-2)' }}>{fmtDate(pedido.criado_em)}</div>
              </div>
            </>
          )}
        </div>

        {pedido && (
          <div className="adm-drawer-actions">
            {pedido.status === 'pendente' && (
              <button className="adm-btn adm-btn--sm adm-btn--success" onClick={() => acao('marcar_pago_manual')} disabled={salvando}>
                Marcar pago
              </button>
            )}
            {pedido.status === 'pago' && (
              <button className="adm-btn adm-btn--sm adm-btn--success" onClick={() => acao('marcar_retirado')} disabled={salvando}>
                Marcar retirado
              </button>
            )}
            {pedido.status !== 'cancelado' && pedido.status !== 'retirado' && (
              <button className="adm-btn adm-btn--sm adm-btn--danger" onClick={() => acao('cancelar')} disabled={salvando}>
                Cancelar pedido
              </button>
            )}
            {msg && <span style={{ fontSize: '.8rem', color: 'var(--adm-accent)', alignSelf: 'center' }}>{msg}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
