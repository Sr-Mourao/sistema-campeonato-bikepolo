import { useState, useEffect } from 'react'
import { X, Send, KeyRound, Copy } from 'lucide-react'
import { adminGet, adminPost, fmtBRL, fmtDate } from '../adminApi'

interface Inscricao {
  id: number
  nome: string
  email: string
  telefone: string
  ddi: string
  cidade: string
  nacionalidade: string
  genero: string
  clube: string
  status: string
  latino: number
  acao_afirmativa: number
  valor_total: number
  criado_em: string
  tipo_participacao: string
  contato_emergencia_nome: string | null
  contato_emergencia_relacao: string | null
  contato_emergencia_telefone: string | null
  possui_plano_saude: number
  plano_saude: string | null
  numero_carteirinha: string | null
  aceitou_termos: number
  data_aceite_termos: string | null
  categorias: { id: number; categoria: string; valor: number }[]
  times: { id: number; nome: string; categoria: string; codigo: string }[]
  pagamentos: { id: number; tipo: string; status: string; valor: number; metodo: string; reembolsado: number; criado_em: string }[]
  alimentacao: { id: number; dia: number; valor: number }[]
  alojamento: { id: number; dia: number; valor: number; pagamento_id: number | null }[]
  observacoes: { id: number; texto: string; tipo: string; criado_em: string }[]
  checkin: { presente: number; credenciado: number } | null
}

interface Props {
  inscricaoId: number
  onClose: () => void
  onRefresh: () => void
}

const TIPO_LABEL: Record<string, string> = {
  inscricao:        'Inscrição esportiva',
  alimentacao:      'Alimentação',
  alojamento:       'Alojamento',
  alojamento_extra: 'Alojamento extra',
  completo:         'Pagamento completo',
}

export default function InscricaoDrawer({ inscricaoId, onClose, onRefresh }: Props) {
  const [inscricao, setInscricao] = useState<Inscricao | null>(null)
  const [loading, setLoading] = useState(true)
  const [novaObs, setNovaObs] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')
  const [codigoAtleta, setCodigoAtleta] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    adminGet<Inscricao>(`/api/admin/inscricoes.php?id=${inscricaoId}`)
      .then(d => { if (d) setInscricao(d) })
      .finally(() => setLoading(false))
  }, [inscricaoId])

  async function acao(action: string, extra?: Record<string, unknown>) {
    setSalvando(true)
    const res = await adminPost('/api/admin/inscricoes.php', { action, id: inscricaoId, ...extra })
    if (res) {
      setMsg('Salvo!')
      setTimeout(() => setMsg(''), 2000)
      // Recarrega dados
      const fresh = await adminGet<Inscricao>(`/api/admin/inscricoes.php?id=${inscricaoId}`)
      if (fresh) setInscricao(fresh)
      onRefresh()
    }
    setSalvando(false)
  }

  async function addObs() {
    if (!novaObs.trim()) return
    await acao('add_observacao', { texto: novaObs })
    setNovaObs('')
  }

  async function gerarCodigoAtleta() {
    setSalvando(true)
    setCodigoAtleta(null)
    setCopiado(false)
    const res = await adminPost<{ ok: true; code: string }>('/api/admin/inscricoes.php', {
      action: 'gerar_codigo_atleta', id: inscricaoId,
    })
    if (res?.code) setCodigoAtleta(res.code)
    setSalvando(false)
  }

  async function copiarCodigoAtleta() {
    if (!codigoAtleta) return
    await navigator.clipboard.writeText(codigoAtleta)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  if (loading) return (
    <div className="adm-drawer-overlay" onClick={onClose}>
      <div className="adm-drawer" onClick={e => e.stopPropagation()}>
        <div className="adm-drawer-header">
          <div style={{ flex: 1, color: 'var(--adm-text-2)' }}>Carregando…</div>
          <button className="adm-drawer-close" onClick={onClose}><X size={18} /></button>
        </div>
      </div>
    </div>
  )

  if (!inscricao) return null

  const ins = inscricao

  return (
    <div className="adm-drawer-overlay" onClick={onClose}>
      <div className="adm-drawer" onClick={e => e.stopPropagation()}>
        <div className="adm-drawer-header">
          <div style={{ flex: 1 }}>
            <h2>{ins.nome}</h2>
            <p>{ins.email} · {ins.cidade}</p>
          </div>
          <StatusBadge status={ins.status} />
          <button className="adm-drawer-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="adm-drawer-body">
          {/* Dados pessoais */}
          <div className="adm-section">
            <div className="adm-section-title">Dados pessoais</div>
            <div className="adm-detail-grid">
              <Detail label="Nome" value={ins.nome} />
              <Detail label="Email" value={ins.email} />
              <Detail label="Telefone" value={ins.ddi !== '55' ? `+${ins.ddi} ${ins.telefone}` : ins.telefone} />
              <Detail label="Cidade" value={ins.cidade} />
              <Detail label="Nacionalidade" value={ins.nacionalidade} />
              <Detail label="Gênero" value={ins.genero} />
              <Detail label="Clube" value={ins.clube} />
              <Detail label="Participação" value={ins.tipo_participacao === 'acompanhante' ? 'Acompanhante / Apoio' : 'Atleta'} />
              <Detail label="Inscrito em" value={fmtDate(ins.criado_em)} />
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              {ins.latino === 1 && <span className="adm-badge adm-badge--tag">Latino</span>}
              {ins.acao_afirmativa === 1 && <span className="adm-badge adm-badge--tag">Ação Afirmativa</span>}
              {ins.checkin?.presente === 1 && <span className="adm-badge adm-badge--ok">Presente</span>}
              {ins.checkin?.credenciado === 1 && <span className="adm-badge adm-badge--ok">Credenciado</span>}
            </div>
          </div>

          {/* Código de acesso da pessoa atleta */}
          <div className="adm-section">
            <div className="adm-section-title">Acesso à área do atleta</div>
            <p style={{ color: 'var(--adm-text-2)', fontSize: '.84rem', margin: '0 0 10px' }}>
              Gere um código para a pessoa entrar com este e-mail. Gerar outro código substitui o anterior e encerra as sessões abertas.
            </p>
            <button className="adm-btn adm-btn--sm" onClick={gerarCodigoAtleta} disabled={salvando}>
              <KeyRound size={14} />
              {salvando ? 'Gerando…' : 'Gerar / redefinir código'}
            </button>
            {codigoAtleta && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, padding: '10px 12px', border: '1px solid var(--adm-border)', borderRadius: 6 }}>
                <code style={{ fontSize: '1.15rem', letterSpacing: '.16em', fontWeight: 700 }}>{codigoAtleta}</code>
                <button className="adm-btn adm-btn--sm" onClick={copiarCodigoAtleta}>
                  <Copy size={13} /> {copiado ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            )}
            {codigoAtleta && <p style={{ color: 'var(--adm-text-3)', fontSize: '.76rem', margin: '8px 0 0' }}>Copie e entregue o código ao atleta. Ele não poderá ser consultado novamente; gere outro se necessário.</p>}
          </div>

          {/* Contato de emergência */}
          <div className="adm-section">
            <div className="adm-section-title">Contato de Emergência</div>
            <div className="adm-detail-grid">
              <Detail label="Nome" value={ins.contato_emergencia_nome} />
              <Detail label="Relação" value={ins.contato_emergencia_relacao} />
              <Detail label="Telefone" value={ins.contato_emergencia_telefone} />
            </div>
          </div>

          {/* Saúde e termos */}
          <div className="adm-section">
            <div className="adm-section-title">Saúde / Termos</div>
            <div className="adm-detail-grid">
              <Detail label="Plano de saúde" value={ins.possui_plano_saude === 1 ? 'Sim' : 'Não'} />
              {ins.possui_plano_saude === 1 && (
                <>
                  <Detail label="Nome do plano" value={ins.plano_saude} />
                  <Detail label="Carteirinha" value={ins.numero_carteirinha || '—'} />
                </>
              )}
              <Detail label="Termos aceitos" value={ins.aceitou_termos === 1 ? 'Sim' : 'Não'} />
              {ins.data_aceite_termos && (
                <Detail label="Data aceite" value={fmtDate(ins.data_aceite_termos)} />
              )}
            </div>
          </div>

          {/* Categorias */}
          <div className="adm-section">
            <div className="adm-section-title">Categorias</div>
            {ins.categorias.length === 0
              ? <span style={{ color: 'var(--adm-text-3)' }}>Nenhuma</span>
              : ins.categorias.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--adm-border)' }}>
                  <span className={`adm-badge adm-badge--${c.categoria}`}>{c.categoria.toUpperCase()}</span>
                  <span style={{ color: 'var(--adm-text-2)', fontSize: '.84rem' }}>{fmtBRL(c.valor)}</span>
                </div>
              ))
            }
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8 }}>
              <strong style={{ fontSize: '.88rem' }}>Total</strong>
              <strong style={{ color: 'var(--adm-accent)' }}>{fmtBRL(ins.valor_total)}</strong>
            </div>
          </div>

          {/* Times */}
          {ins.times.length > 0 && (
            <div className="adm-section">
              <div className="adm-section-title">Times</div>
              {ins.times.map(t => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--adm-border)' }}>
                  <span style={{ fontWeight: 600 }}>{t.nome}</span>
                  <span style={{ display: 'flex', gap: 6 }}>
                    <span className={`adm-badge adm-badge--${t.categoria}`}>{t.categoria.toUpperCase()}</span>
                    <span className="adm-badge adm-badge--tag">{t.codigo}</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Pagamentos */}
          <div className="adm-section">
            <div className="adm-section-title">Pagamentos</div>
            {ins.pagamentos.length === 0
              ? <span style={{ color: 'var(--adm-text-3)' }}>Nenhum</span>
              : ins.pagamentos.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--adm-border)', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '.88rem', fontWeight: 600 }}>{TIPO_LABEL[p.tipo] ?? p.tipo}</span>
                    {p.metodo && <span style={{ color: 'var(--adm-text-3)', marginLeft: 6, fontSize: '.78rem' }}>· {p.metodo}</span>}
                    <div style={{ color: 'var(--adm-text-3)', fontSize: '.74rem' }}>{fmtDate(p.criado_em)}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {p.status === 'pago' && p.reembolsado === 1
                        ? <span className="adm-badge adm-badge--tag">Reembolsado</span>
                        : <StatusBadge status={p.status} />
                      }
                      <span style={{ fontSize: '.82rem', fontWeight: 600 }}>{fmtBRL(p.valor)}</span>
                    </div>
                    {p.status === 'pendente' && (
                      <button
                        className="adm-btn adm-btn--sm adm-btn--success"
                        onClick={() => acao('marcar_pago_manual', { pagamento_id: p.id, tipo: p.tipo })}
                        disabled={salvando}
                      >
                        Marcar pago
                      </button>
                    )}
                    {p.status === 'pago' && p.reembolsado === 0 && ins.status === 'cancelado' && (
                      <button
                        className="adm-btn adm-btn--sm adm-btn--danger"
                        onClick={() => acao('marcar_reembolsado', { pagamento_id: p.id })}
                        disabled={salvando}
                      >
                        Marcar reembolsado
                      </button>
                    )}
                  </div>
                </div>
              ))
            }
            {/* Alerta de reembolso pendente */}
            {ins.status === 'cancelado' && (() => {
              const pendentes = ins.pagamentos.filter(p => p.status === 'pago' && p.reembolsado === 0)
              const total = pendentes.reduce((s, p) => s + p.valor, 0)
              if (total <= 0) return null
              return (
                <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--adm-red-dim)', border: '1px solid var(--adm-red)', borderRadius: 6, fontSize: '.84rem', color: 'var(--adm-red)' }}>
                  ⚠ Reembolso pendente: <strong>{fmtBRL(total)}</strong>
                </div>
              )
            })()}
          </div>

          {/* Alimentação */}
          {ins.alimentacao.length > 0 && (
            <div className="adm-section">
              <div className="adm-section-title">Alimentação</div>
              {ins.alimentacao.map(a => (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '.84rem' }}>
                  <span>Dia {a.dia}/set</span>
                  <span style={{ color: 'var(--adm-text-2)' }}>{fmtBRL(a.valor)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Alojamento */}
          {ins.alojamento.length > 0 && (
            <div className="adm-section">
              <div className="adm-section-title">Alojamento</div>
              {ins.alojamento.map(a => (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: '.84rem' }}>
                  <span>
                    Dia {a.dia}/set
                    {a.pagamento_id
                      ? <span className="adm-badge adm-badge--ok" style={{ marginLeft: 8, fontSize: '.68rem' }}>Pago</span>
                      : <span className="adm-badge adm-badge--warn" style={{ marginLeft: 8, fontSize: '.68rem' }}>Pendente</span>
                    }
                  </span>
                  <span style={{ color: 'var(--adm-text-2)' }}>{fmtBRL(a.valor)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Observações */}
          <div className="adm-section">
            <div className="adm-section-title">Observações internas</div>
            <div className="adm-obs-list">
              {ins.observacoes.map(o => (
                <div key={o.id} className="adm-obs-item">
                  <p>{o.texto}</p>
                  <div className="adm-obs-meta">
                    <span className="adm-obs-tipo">{o.tipo}</span>
                    <span>{fmtDate(o.criado_em)}</span>
                  </div>
                </div>
              ))}
              {ins.observacoes.length === 0 && (
                <span style={{ color: 'var(--adm-text-3)', fontSize: '.84rem' }}>Nenhuma observação</span>
              )}
            </div>
            <div className="adm-obs-add" style={{ marginTop: 10 }}>
              <textarea
                placeholder="Nova observação…"
                value={novaObs}
                onChange={e => setNovaObs(e.target.value)}
              />
              <button className="adm-btn" onClick={addObs} disabled={salvando || !novaObs.trim()}>
                <Send size={14} />
              </button>
            </div>
            {msg && <div style={{ color: 'var(--adm-accent)', fontSize: '.82rem', marginTop: 4 }}>{msg}</div>}
          </div>
        </div>

        {/* Ações */}
        <div className="adm-drawer-actions">
          {ins.status !== 'cancelado' && (
            <button className="adm-btn adm-btn--danger" onClick={() => { if (confirm('Cancelar inscrição?')) acao('cancelar') }} disabled={salvando}>
              Cancelar
            </button>
          )}
          {ins.status === 'cancelado' && (
            <button className="adm-btn" onClick={() => acao('reativar')} disabled={salvando}>
              Reativar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="adm-detail-item">
      <span className="adm-detail-label">{label}</span>
      <span className="adm-detail-value">{value || '—'}</span>
    </div>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pago: 'pago',
    aguardando_pagamento: 'aguardando',
    cancelado: 'cancelado',
    pendente: 'aguardando',
  }
  const cls = map[status] ?? 'tag'
  const label: Record<string, string> = {
    pago: 'Pago',
    aguardando_pagamento: 'Aguardando',
    cancelado: 'Cancelado',
    pendente: 'Pendente',
  }
  return <span className={`adm-badge adm-badge--${cls}`}>{label[status] ?? status}</span>
}
