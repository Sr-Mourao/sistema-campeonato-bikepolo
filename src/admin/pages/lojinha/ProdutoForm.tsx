import { useState } from 'react'
import { X, Trash2, Plus } from 'lucide-react'
import { adminPost } from '../../adminApi'
import { adminPostMultipart, type MultipartError } from './adminUpload'
import type { Produto } from './Produtos'

interface Props {
  produto: Produto | null
  onClose: () => void
  onSaved: () => void
}

export default function ProdutoForm({ produto, onClose, onSaved }: Props) {
  const [nome, setNome] = useState(produto?.nome ?? '')
  const [descricao, setDescricao] = useState(produto?.descricao ?? '')
  const [preco, setPreco] = useState(produto ? String(produto.preco) : '')
  const [ordem, setOrdem] = useState(produto ? String(produto.ordem) : '0')
  const [ativo, setAtivo] = useState(produto ? !!produto.ativo : true)
  const [tamanhos, setTamanhos] = useState<string[]>(produto?.tamanhos.map(t => t.tamanho) ?? [])
  const [novoTamanho, setNovoTamanho] = useState('')
  const [imagensExistentes, setImagensExistentes] = useState(produto?.imagens ?? [])
  const [novasImagens, setNovasImagens] = useState<File[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  function addTamanho() {
    const t = novoTamanho.trim()
    if (!t || tamanhos.includes(t)) return
    setTamanhos(prev => [...prev, t])
    setNovoTamanho('')
  }

  function removerTamanho(t: string) {
    setTamanhos(prev => prev.filter(x => x !== t))
  }

  async function removerImagemExistente(imagemId: number) {
    const res = await adminPost<{ ok: boolean }>('/api/admin/lojinha-produtos.php', { acao: 'remover_imagem', imagem_id: imagemId })
    if (res) setImagensExistentes(prev => prev.filter(img => img.id !== imagemId))
  }

  function handleNovasImagens(files: FileList | null) {
    if (!files) return
    setNovasImagens(prev => [...prev, ...Array.from(files)])
  }

  function removerNovaImagem(i: number) {
    setNovasImagens(prev => prev.filter((_, idx) => idx !== i))
  }

  async function salvar() {
    setErro('')
    if (!nome.trim()) { setErro('Nome é obrigatório.'); return }
    const precoNum = parseFloat(preco)
    if (isNaN(precoNum) || precoNum <= 0) { setErro('Preço deve ser maior que zero.'); return }

    setSalvando(true)
    const fd = new FormData()
    fd.append('acao', produto ? 'atualizar' : 'criar')
    if (produto) fd.append('id', String(produto.id))
    fd.append('nome', nome.trim())
    fd.append('descricao', descricao.trim())
    fd.append('preco', String(precoNum))
    fd.append('ativo', ativo ? '1' : '0')
    fd.append('ordem', ordem || '0')
    fd.append('tamanhos', JSON.stringify(tamanhos))
    novasImagens.forEach(f => fd.append('imagens[]', f))

    try {
      const res = await adminPostMultipart<{ ok?: boolean }>('/api/admin/lojinha-produtos.php', fd)
      setSalvando(false)
      if (res) onSaved()
      else setErro('Erro ao salvar produto.')
    } catch (e) {
      setSalvando(false)
      const err = e as MultipartError | undefined
      let msg = 'Erro ao salvar produto.'
      if (err?.message) msg = err.message
      if (err?.debug) {
        msg += `\n\nDetalhes do servidor:\n${err.debug}`
      }
      setErro(msg)
    }
  }

  return (
    <div className="adm-drawer-overlay" onClick={() => !salvando && onClose()}>
      <div className="adm-drawer" onClick={e => e.stopPropagation()}>
        <div className="adm-drawer-header">
          <h2>{produto ? 'Editar produto' : 'Novo produto'}</h2>
          <button className="adm-drawer-close" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        <div className="adm-drawer-body">
          <div className="adm-field">
            <label>Nome</label>
            <input value={nome} onChange={e => setNome(e.target.value)} autoFocus />
          </div>

          <div className="adm-field">
            <label>Descrição</label>
            <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={3} />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div className="adm-field" style={{ flex: 1 }}>
              <label>Preço (R$)</label>
              <input type="number" step="0.01" min="0" value={preco} onChange={e => setPreco(e.target.value)} />
            </div>
            <div className="adm-field" style={{ flex: 1 }}>
              <label>Ordem</label>
              <input type="number" value={ordem} onChange={e => setOrdem(e.target.value)} />
            </div>
          </div>

          <div className="adm-field">
            <label>Status</label>
            <button
              type="button"
              className={`adm-toggle-btn ${ativo ? 'adm-toggle-btn--on' : ''}`}
              onClick={() => setAtivo(a => !a)}
              style={{ alignSelf: 'flex-start' }}
            >
              {ativo ? 'Ativo' : 'Inativo'}
            </button>
          </div>

          <div className="adm-field">
            <label>Tamanhos</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {tamanhos.length === 0 && <span style={{ color: 'var(--adm-text-3)', fontSize: '.84rem' }}>Nenhum tamanho — produto sem variação (ex: boné único)</span>}
              {tamanhos.map(t => (
                <span key={t} className="adm-badge adm-badge--tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {t}
                  <button type="button" onClick={() => removerTamanho(t)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'flex' }} aria-label={`Remover ${t}`}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={novoTamanho}
                onChange={e => setNovoTamanho(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTamanho() } }}
                placeholder="Ex: P, M, G, Único…"
                style={{ flex: 1 }}
              />
              <button type="button" className="adm-btn adm-btn--sm" onClick={addTamanho}>
                <Plus size={14} /> Adicionar
              </button>
            </div>
          </div>

          <div className="adm-field">
            <label>Imagens</label>
            {imagensExistentes.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                {imagensExistentes.map(img => (
                  <div key={img.id} style={{ position: 'relative' }}>
                    <img src={img.caminho} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6 }} />
                    <button
                      type="button"
                      onClick={() => removerImagemExistente(img.id)}
                      aria-label="Remover imagem"
                      style={{
                        position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%',
                        background: 'var(--adm-red)', color: '#fff', border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {novasImagens.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                {novasImagens.map((f, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img src={URL.createObjectURL(f)} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, opacity: .85 }} />
                    <button
                      type="button"
                      onClick={() => removerNovaImagem(i)}
                      aria-label="Remover imagem"
                      style={{
                        position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%',
                        background: 'var(--adm-red)', color: '#fff', border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e => handleNovasImagens(e.target.files)} />
            <span style={{ fontSize: '.76rem', color: 'var(--adm-text-3)' }}>JPEG, PNG ou WebP — máx. 2MB cada. Uma imagem exibe normal, mais de uma vira carrossel.</span>
          </div>

          {erro && <p style={{ color: 'var(--adm-red)', fontSize: '.86rem' }}>{erro}</p>}
        </div>

        <div className="adm-drawer-actions">
          <button className="adm-btn adm-btn--sm" onClick={onClose} disabled={salvando}>Cancelar</button>
          <button className="adm-btn adm-btn--sm adm-btn--success" onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar produto'}
          </button>
        </div>
      </div>
    </div>
  )
}
