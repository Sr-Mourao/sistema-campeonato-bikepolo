import { useState, useEffect, useCallback } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { adminGet, adminPostStrict, type AdminApiStrictError as ApiError, fmtBRL } from '../../adminApi'
import ProdutoForm from './ProdutoForm'

export interface ProdutoImagem { id: number; caminho: string; ordem: number }
export interface ProdutoTamanho { id: number; tamanho: string; ordem: number }
export interface Produto {
  id: number
  nome: string
  descricao: string | null
  preco: number
  ativo: number
  ordem: number
  imagens: ProdutoImagem[]
  tamanhos: ProdutoTamanho[]
}

export default function Produtos() {
  const [lista, setLista] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)
  const [formAberto, setFormAberto] = useState(false)
  const [editando, setEditando] = useState<Produto | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    adminGet<Produto[]>('/api/admin/lojinha-produtos.php')
      .then(d => { if (d) setLista(d) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    adminGet<Produto[]>('/api/admin/lojinha-produtos.php')
      .then(d => { if (d) setLista(d) })
      .finally(() => setLoading(false))
  }, [])

  async function toggleAtivo(produto: Produto) {
    const fd = new FormData()
    fd.append('acao', 'atualizar')
    fd.append('id', String(produto.id))
    fd.append('nome', produto.nome)
    fd.append('descricao', produto.descricao ?? '')
    fd.append('preco', String(produto.preco))
    fd.append('ativo', produto.ativo ? '0' : '1')
    fd.append('tamanhos', JSON.stringify(produto.tamanhos.map(t => t.tamanho)))
    const res = await fetch('/api/admin/lojinha-produtos.php', { method: 'POST', credentials: 'include', body: fd })
    if (res.ok) load()
  }

  async function excluir(produto: Produto) {
    if (!confirm(`Excluir "${produto.nome}"?`)) return
    try {
      await adminPostStrict('/api/admin/lojinha-produtos.php', { acao: 'excluir', id: produto.id })
      load()
    } catch (e) {
      const err = e as ApiError | undefined
      if (err && err.status === 409) {
        const itens = (err.meta as { itens_count?: number; pedidos_count?: number } | undefined)
        const itensCount = itens?.itens_count ?? 0
        const pedidosCount = itens?.pedidos_count ?? 0
        const go = confirm(
          `${err.message}\n\n` +
          `Ele está em ${itensCount} item(ns) de pedido dentro de ${pedidosCount} pedido(s).\n` +
          `Esses são pedidos teste, certo? Clique em OK para EXCLUIR FORÇADAMENTE ` +
          `o produto + os itens/pedidos vinculados. (Essa ação não pode ser desfeita.)`
        )
        if (go) {
          try {
            await adminPostStrict('/api/admin/lojinha-produtos.php', { acao: 'excluir_forcado', id: produto.id })
            alert('Produto e pedidos vinculados removidos com sucesso.')
            load()
          } catch (e2) {
            const err2 = e2 as ApiError | undefined
            alert(err2?.message ?? 'Não foi possível excluir forçadamente.')
          }
        }
      } else {
        alert(err?.message ?? 'Não foi possível excluir o produto.')
      }
    }
  }

  return (
    <div>
      <div className="adm-toolbar">
        <button className="adm-btn adm-btn--sm" onClick={() => { setEditando(null); setFormAberto(true) }}>
          <Plus size={14} /> Novo produto
        </button>
        <button className="adm-btn adm-btn--sm" onClick={load} title="Atualizar">
          <RefreshCw size={14} />
        </button>
        <span className="adm-count">{lista.length} produto{lista.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th></th>
              <th>Nome</th>
              <th>Preço</th>
              <th>Tamanhos</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--adm-text-3)', padding: 24 }}>Carregando…</td></tr>
            )}
            {!loading && lista.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--adm-text-3)', padding: 24 }}>Nenhum produto cadastrado</td></tr>
            )}
            {lista.map(p => (
              <tr key={p.id}>
                <td>
                  {p.imagens[0]
                    ? <img src={p.imagens[0].caminho} alt={p.nome} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} />
                    : <div style={{ width: 40, height: 40, borderRadius: 6, background: 'var(--adm-surface-3)' }} />
                  }
                </td>
                <td style={{ fontWeight: 600 }}>{p.nome}</td>
                <td>{fmtBRL(p.preco)}</td>
                <td style={{ color: 'var(--adm-text-2)', fontSize: '.84rem' }}>
                  {p.tamanhos.length > 0 ? p.tamanhos.map(t => t.tamanho).join(', ') : '—'}
                </td>
                <td>
                  <span className={`adm-badge adm-badge--${p.ativo ? 'ok' : 'tag'}`}>
                    {p.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button className="adm-btn adm-btn--sm" onClick={() => { setEditando(p); setFormAberto(true) }}>Editar</button>
                  <button className="adm-btn adm-btn--sm" onClick={() => toggleAtivo(p)}>
                    {p.ativo ? 'Desativar' : 'Ativar'}
                  </button>
                  <button className="adm-btn adm-btn--sm adm-btn--danger" onClick={() => excluir(p)}>Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {formAberto && (
        <ProdutoForm
          produto={editando}
          onClose={() => setFormAberto(false)}
          onSaved={() => { setFormAberto(false); load() }}
        />
      )}
    </div>
  )
}
