import { useState, useEffect, useRef } from 'react'
import { GripVertical, RefreshCw, ChevronDown, ChevronRight, Users, Pencil, Check, X, Image as ImageIcon } from 'lucide-react'
import { adminGet, adminPost, adminPostForm } from '../adminApi'
import ImagemUploadButton from '../components/ImagemUploadButton'
import PoloperatorImportPanel from './PoloperatorImportPanel'

interface Membro {
  pessoa_id: number
  nome: string
  nacionalidade: string
  latino: number
  status: string
  categorias: string
  inscricao_id: number
  foto_path: string | null
  foto_origem: 'manual' | 'importado' | null
}

interface Alerta {
  tipo: 'warning' | 'error'
  msg: string
}

interface Time {
  id: number
  nome: string
  categoria: string
  codigo: string
  criado_em: string
  num_membros: number
  num_estrangeiros: number
  num_latinos: number
  membros: Membro[]
  alertas: Alerta[]
  logo_path: string | null
  logo_origem: 'manual' | 'importado' | null
}

interface SemTimeMembro {
  inscricao_id: number
  nome: string
  email: string
  status: string
}

interface DragCtx {
  inscricao_id: number
  nome: string
  from_time_id: number | null
  categoria: string
}

interface ApiData {
  times: Time[]
  sem_time: { misto: SemTimeMembro[]; mtnb: SemTimeMembro[] }
}

const LIMITE: Record<string, number> = { misto: 4, mtnb: 3 }

export default function Times() {
  const [data, setData]       = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro]   = useState<'todos' | 'misto' | 'mtnb'>('todos')
  const [abertos, setAbertos] = useState<Set<number>>(new Set())
  const [dragCtx, setDragCtx] = useState<DragCtx | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [moving, setMoving]   = useState(false)
  const dragCounterRef        = useRef<Record<string, number>>({})
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [novoNome, setNovoNome]     = useState('')
  const [salvandoNome, setSalvandoNome] = useState(false)
  const [erroNome, setErroNome]     = useState('')
  const [editandoPessoaId, setEditandoPessoaId] = useState<number | null>(null)
  const [novoNomePessoa, setNovoNomePessoa] = useState('')
  const [salvandoNomePessoa, setSalvandoNomePessoa] = useState(false)
  const [erroNomePessoa, setErroNomePessoa] = useState('')

  async function load() {
    setLoading(true)
    const d = await adminGet<ApiData>('/api/admin/times.php')
    if (d) setData(d)
    setLoading(false)
  }
  useEffect(() => {
    adminGet<ApiData>('/api/admin/times.php')
      .then(d => { if (d) setData(d) })
      .finally(() => setLoading(false))
  }, [])

  function toggleAberto(id: number) {
    setAbertos(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── DnD ────────────────────────────────────────────────────
  function onDragStart(
    inscricao_id: number, nome: string,
    from_time_id: number | null, categoria: string,
    e: React.DragEvent
  ) {
    e.dataTransfer.effectAllowed = 'move'
    setDragCtx({ inscricao_id, nome, from_time_id, categoria })
  }

  function onDragEnd() {
    setDragCtx(null)
    setDragOver(null)
    dragCounterRef.current = {}
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function onDragEnter(id: string, e: React.DragEvent) {
    e.preventDefault()
    dragCounterRef.current[id] = (dragCounterRef.current[id] ?? 0) + 1
    setDragOver(id)
  }

  function onDragLeave(id: string) {
    dragCounterRef.current[id] = Math.max(0, (dragCounterRef.current[id] ?? 0) - 1)
    if (dragCounterRef.current[id] === 0) {
      setDragOver(prev => prev === id ? null : prev)
    }
  }

  async function drop(to_time_id: number | null, to_categoria: string) {
    const ctx = dragCtx
    onDragEnd()
    if (!ctx || ctx.categoria !== to_categoria) return
    if (ctx.from_time_id === to_time_id) return
    if (to_time_id !== null && data) {
      const t = data.times.find(x => x.id === to_time_id)
      if (t && t.num_membros >= LIMITE[t.categoria]) return
    }
    setMoving(true)
    await adminPost('/api/admin/times.php', {
      action:       'mover',
      inscricao_id: ctx.inscricao_id,
      de_time_id:   ctx.from_time_id,
      para_time_id: to_time_id,
    })
    await load()
    setMoving(false)
  }

  function makeDropHandler(to_time_id: number | null, to_categoria: string) {
    return (e: React.DragEvent) => {
      e.preventDefault()
      void drop(to_time_id, to_categoria)
    }
  }

  // ── Renomear time ──────────────────────────────────────────
  function iniciarEdicao(time: Time, e: React.MouseEvent) {
    e.stopPropagation()
    setEditandoId(time.id)
    setNovoNome(time.nome)
    setErroNome('')
  }

  function cancelarEdicao(e?: React.MouseEvent) {
    e?.stopPropagation()
    setEditandoId(null)
    setErroNome('')
  }

  async function salvarNome(time_id: number, e?: React.MouseEvent | React.FormEvent) {
    e?.stopPropagation()
    e?.preventDefault()
    const nome = novoNome.trim()
    if (!nome) { setErroNome('Nome não pode ficar vazio'); return }
    setSalvandoNome(true)
    setErroNome('')
    const r = await adminPost<{ ok: true }>('/api/admin/times.php', { action: 'renomear', time_id, nome })
    setSalvandoNome(false)
    if (!r) { setErroNome('Não foi possível salvar'); return }
    setEditandoId(null)
    await load()
  }

  // ── Renomear atleta (pessoas.id; nenhum campo de mídia participa do request) ────────
  function iniciarEdicaoPessoa(membro: Membro, e: React.MouseEvent) {
    e.stopPropagation()
    setEditandoPessoaId(membro.pessoa_id)
    setNovoNomePessoa(membro.nome)
    setErroNomePessoa('')
  }

  function cancelarEdicaoPessoa() {
    setEditandoPessoaId(null)
    setErroNomePessoa('')
  }

  async function salvarNomePessoa(pessoaId: number, e: React.FormEvent) {
    e.stopPropagation()
    e.preventDefault()
    const nome = novoNomePessoa.trim()
    if (!nome) { setErroNomePessoa('Nome não pode ficar vazio'); return }
    setSalvandoNomePessoa(true)
    setErroNomePessoa('')
    const r = await adminPost<{ ok: true }>('/api/admin/times.php', {
      action: 'renomear_atleta', pessoa_id: pessoaId, nome,
    })
    setSalvandoNomePessoa(false)
    if (!r) { setErroNomePessoa('Não foi possível salvar'); return }
    setEditandoPessoaId(null)
    await load()
  }

  // ── Brasão do time / foto do atleta ────────────────────────
  async function uploadLogoTime(timeId: number, blob: Blob): Promise<boolean> {
    const form = new FormData()
    form.append('action', 'upload_logo_time')
    form.append('time_id', String(timeId))
    form.append('arquivo', blob, 'logo.webp')
    const r = await adminPostForm<{ ok: true }>('/api/admin/midia.php', form)
    if (r) await load()
    return !!r
  }

  async function removerLogoTime(timeId: number) {
    const r = await adminPost<{ ok: true }>('/api/admin/midia.php', { action: 'remover_logo_time', time_id: timeId })
    if (r) await load()
  }

  async function uploadFotoPessoa(pessoaId: number, blob: Blob): Promise<boolean> {
    const form = new FormData()
    form.append('action', 'upload_foto_pessoa')
    form.append('pessoa_id', String(pessoaId))
    form.append('arquivo', blob, 'foto.webp')
    const r = await adminPostForm<{ ok: true }>('/api/admin/midia.php', form)
    if (r) await load()
    return !!r
  }

  async function removerFotoPessoa(pessoaId: number) {
    const r = await adminPost<{ ok: true }>('/api/admin/midia.php', { action: 'remover_foto_pessoa', pessoa_id: pessoaId })
    if (r) await load()
  }

  // ── Render ──────────────────────────────────────────────────
  const times = data?.times ?? []
  const categorias: ('misto' | 'mtnb')[] = filtro === 'todos' ? ['misto', 'mtnb'] : [filtro]

  return (
    <div>
      <PoloperatorImportPanel
        timesDisponiveis={times.map(t => ({ id: t.id, nome: t.nome, categoria: t.categoria, membros: t.membros.map(m => ({ pessoa_id: m.pessoa_id, nome: m.nome })) }))}
        onImportado={load}
      />

      <div className="adm-toolbar" style={{ marginBottom: 20 }}>
        <div className="adm-filter-chips">
          {(['todos', 'misto', 'mtnb'] as const).map(f => {
            const cnt = f === 'todos' ? times.length : times.filter(t => t.categoria === f).length
            return (
              <button
                key={f}
                className={`adm-chip ${filtro === f ? 'adm-chip--active' : ''}`}
                onClick={() => setFiltro(f)}
              >
                {f === 'todos' ? `Todos (${cnt})` : `${f.toUpperCase()} (${cnt})`}
              </button>
            )
          })}
        </div>
        <button className="adm-btn adm-btn--sm" onClick={load} disabled={loading || moving}>
          <RefreshCw size={14} />
        </button>
      </div>

      {moving && (
        <div style={{ color: 'var(--adm-text-2)', fontSize: '.82rem', marginBottom: 10 }}>
          Movendo atleta…
        </div>
      )}
      {loading && !data && (
        <div style={{ color: 'var(--adm-text-2)', padding: 20 }}>Carregando…</div>
      )}

      {data && categorias.map(cat => {
        const catTimes = times.filter(t => t.categoria === cat)
        const semTime  = data.sem_time[cat] ?? []
        const semId    = `sem_${cat}`
        const semOver  = dragOver === semId && dragCtx?.categoria === cat

        return (
          <div key={cat} style={{ marginBottom: 36 }}>
            {/* Category header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              marginBottom: 14, paddingBottom: 10,
              borderBottom: '1px solid var(--adm-border)',
            }}>
              <Users size={15} style={{ color: 'var(--adm-text-2)' }} />
              <span style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '.04em' }}>
                {cat === 'misto' ? 'Brasileiro Misto' : 'Brasileiro MTNB'}
              </span>
              <span style={{ color: 'var(--adm-text-3)', fontSize: '.82rem' }}>
                {catTimes.length} time{catTimes.length !== 1 ? 's' : ''} · max {LIMITE[cat]} p/time
              </span>
            </div>

            {/* Sem time block */}
            <div
              className={`adm-dnd-sem-time${semOver ? ' adm-dnd-over' : ''}`}
              onDragOver={onDragOver}
              onDragEnter={e => onDragEnter(semId, e)}
              onDragLeave={() => onDragLeave(semId)}
              onDrop={makeDropHandler(null, cat)}
            >
              <div className="adm-dnd-sem-time-header">
                Sem time
                <span className="adm-badge adm-badge--tag">{semTime.length}</span>
                {semOver && (
                  <span style={{ color: 'var(--adm-accent)', fontWeight: 400, textTransform: 'none' }}>
                    — soltar para remover do time
                  </span>
                )}
              </div>

              {semTime.length === 0 && !semOver ? (
                <div style={{ color: 'var(--adm-text-3)', fontSize: '.82rem', fontStyle: 'italic' }}>
                  Todos os atletas estão em times
                </div>
              ) : (
                <div className="adm-dnd-member-list">
                  {semTime.map(m => (
                    <div
                      key={`${m.inscricao_id}_${cat}`}
                      className={`adm-dnd-member${dragCtx?.inscricao_id === m.inscricao_id && dragCtx.from_time_id === null ? ' adm-dnd-member--dragging' : ''}`}
                      draggable
                      onDragStart={e => onDragStart(m.inscricao_id, m.nome, null, cat, e)}
                      onDragEnd={onDragEnd}
                    >
                      <GripVertical size={13} className="adm-dnd-handle" />
                      <span style={{ flex: 1 }}>{m.nome}</span>
                      <span
                        className={`adm-badge adm-badge--${m.status === 'pago' ? 'ok' : 'aguardando'}`}
                        style={{ fontSize: '.68rem' }}
                      >
                        {m.status === 'pago' ? 'Pago' : 'Aguard.'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Time cards */}
            {catTimes.map(time => {
              const dropId   = `time_${time.id}`
              const isOver   = dragOver === dropId && dragCtx?.categoria === cat
              const isFull   = time.num_membros >= LIMITE[time.categoria]
              const showBody = abertos.has(time.id) || isOver

              return (
                <div
                  key={time.id}
                  className={`adm-time-card adm-dnd-target${isOver ? (isFull ? ' adm-dnd-over--full' : ' adm-dnd-over') : ''}`}
                  onDragOver={onDragOver}
                  onDragEnter={e => onDragEnter(dropId, e)}
                  onDragLeave={() => onDragLeave(dropId)}
                  onDrop={makeDropHandler(time.id, cat)}
                >
                  <div
                    className="adm-time-card-header"
                    onClick={() => !dragCtx && editandoId !== time.id && toggleAberto(time.id)}
                  >
                    {abertos.has(time.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    {editandoId === time.id ? (
                      <form
                        style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}
                        onClick={e => e.stopPropagation()}
                        onSubmit={e => salvarNome(time.id, e)}
                      >
                        <input
                          autoFocus
                          className="adm-select"
                          style={{ flex: 1, maxWidth: 260 }}
                          value={novoNome}
                          maxLength={80}
                          disabled={salvandoNome}
                          onChange={e => setNovoNome(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Escape') cancelarEdicao() }}
                        />
                        <button type="submit" className="adm-btn adm-btn--sm" disabled={salvandoNome} title="Salvar">
                          <Check size={14} />
                        </button>
                        <button type="button" className="adm-btn adm-btn--sm" onClick={cancelarEdicao} title="Cancelar">
                          <X size={14} />
                        </button>
                      </form>
                    ) : (
                      <>
                        <span className="adm-time-nome">{time.nome}</span>
                        <button
                          className="adm-btn adm-btn--sm"
                          onClick={e => iniciarEdicao(time, e)}
                          title="Renomear time"
                          style={{ padding: '4px 6px' }}
                        >
                          <Pencil size={13} />
                        </button>
                      </>
                    )}
                    <span className="adm-badge adm-badge--tag">{time.codigo}</span>
                    <span style={{
                      color: isFull ? 'var(--adm-accent)' : 'var(--adm-text-2)',
                      fontSize: '.82rem',
                      fontWeight: isFull ? 700 : 400,
                      minWidth: 32,
                      textAlign: 'right',
                    }}>
                      {time.num_membros}/{LIMITE[time.categoria]}
                    </span>
                    {isFull && (
                      <span className="adm-badge adm-badge--ok" style={{ fontSize: '.68rem' }}>Completo</span>
                    )}
                  </div>

                  {editandoId === time.id && erroNome && (
                    <div style={{ padding: '0 16px 8px' }}>
                      <span className="adm-badge adm-badge--err">{erroNome}</span>
                    </div>
                  )}

                  {time.alertas.length > 0 && (
                    <div className="adm-time-alerts" style={{ padding: '0 16px 8px' }}>
                      {time.alertas.map((a, i) => (
                        <span key={i} className={`adm-badge adm-badge--${a.tipo === 'error' ? 'err' : 'warn'}`}>
                          ⚠ {a.msg}
                        </span>
                      ))}
                    </div>
                  )}

                  {isOver && (
                    <div style={{
                      padding: '2px 16px 8px',
                      fontSize: '.76rem',
                      color: isFull ? 'var(--adm-red)' : 'var(--adm-accent)',
                    }}>
                      {isFull ? 'Time cheio — não é possível adicionar' : 'Soltar para adicionar ao time'}
                    </div>
                  )}

                  {showBody && (
                    <div className="adm-time-body">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }} onClick={e => e.stopPropagation()}>
                        <div className="adm-midia-thumb adm-midia-thumb--time">
                          {time.logo_path ? <img src={time.logo_path} alt="" /> : <ImageIcon size={16} />}
                        </div>
                        <ImagemUploadButton label="Alterar brasão" maxDim={800} onUpload={blob => uploadLogoTime(time.id, blob)} />
                        {time.logo_path && (
                          <button className="adm-btn adm-btn--sm" onClick={() => removerLogoTime(time.id)}>Remover</button>
                        )}
                        {time.logo_origem && (
                          <span className="adm-badge adm-badge--tag" style={{ fontSize: '.66rem' }}>{time.logo_origem}</span>
                        )}
                      </div>

                      <div className="adm-dnd-member-list" style={{ marginTop: 10 }}>
                        {time.membros.map(m => (
                          <div
                            key={m.inscricao_id}
                            className={`adm-dnd-member${dragCtx?.inscricao_id === m.inscricao_id ? ' adm-dnd-member--dragging' : ''}`}
                            draggable={editandoPessoaId !== m.pessoa_id}
                            onDragStart={e => onDragStart(m.inscricao_id, m.nome, time.id, cat, e)}
                            onDragEnd={onDragEnd}
                          >
                            <GripVertical size={13} className="adm-dnd-handle" />
                            <div className="adm-midia-thumb adm-midia-thumb--pessoa">
                              {m.foto_path ? <img src={m.foto_path} alt="" /> : <ImageIcon size={11} />}
                            </div>
                            {editandoPessoaId === m.pessoa_id ? (
                              <form className="adm-member-name-edit" onSubmit={e => salvarNomePessoa(m.pessoa_id, e)} onClick={e => e.stopPropagation()}>
                                <input
                                  autoFocus
                                  className="adm-select"
                                  value={novoNomePessoa}
                                  maxLength={120}
                                  disabled={salvandoNomePessoa}
                                  aria-label="Nome da pessoa atleta"
                                  onChange={e => setNovoNomePessoa(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Escape') cancelarEdicaoPessoa() }}
                                />
                                <button type="submit" className="adm-btn adm-btn--sm" disabled={salvandoNomePessoa} title="Salvar nome"><Check size={14} /></button>
                                <button type="button" className="adm-btn adm-btn--sm" onClick={cancelarEdicaoPessoa} title="Cancelar"><X size={14} /></button>
                                {erroNomePessoa && <span className="adm-member-name-error">{erroNomePessoa}</span>}
                              </form>
                            ) : (
                              <span className="adm-member-identity">
                                <span>{m.nome}</span>
                                <button className="adm-btn adm-btn--sm adm-member-rename" onClick={e => iniciarEdicaoPessoa(m, e)} title="Editar nome">
                                  <Pencil size={12} /> Editar nome
                                </button>
                              </span>
                            )}
                            {m.nacionalidade !== 'brasileire' && (
                              <span className="adm-badge adm-badge--tag" style={{ fontSize: '.68rem' }}>🌎</span>
                            )}
                            {m.latino === 1 && (
                              <span className="adm-badge adm-badge--tag" style={{ fontSize: '.68rem' }}>Latino</span>
                            )}
                            <span
                              className={`adm-badge adm-badge--${m.status === 'pago' ? 'ok' : 'aguardando'}`}
                              style={{ fontSize: '.68rem' }}
                            >
                              {m.status === 'pago' ? 'Pago' : 'Aguard.'}
                            </span>
                            <span className="adm-member-media-actions" onClick={e => e.stopPropagation()} draggable={false}>
                              <ImagemUploadButton label="Alterar foto" maxDim={800} onUpload={blob => uploadFotoPessoa(m.pessoa_id, blob)} />
                              {m.foto_path && (
                                <button className="adm-btn adm-btn--sm" onClick={() => removerFotoPessoa(m.pessoa_id)}>Remover</button>
                              )}
                            </span>
                          </div>
                        ))}
                        {time.membros.length === 0 && (
                          <span style={{ color: 'var(--adm-text-3)', fontSize: '.82rem', display: 'block', padding: '4px 0' }}>
                            {isOver ? '↓ Soltar aqui' : 'Sem membros'}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {catTimes.length === 0 && (
              <div style={{ color: 'var(--adm-text-3)', textAlign: 'center', padding: '20px 0', fontSize: '.88rem' }}>
                Nenhum time {cat.toUpperCase()} cadastrado
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
