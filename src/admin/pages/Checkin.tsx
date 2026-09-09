import { useState, useEffect, useMemo } from 'react'
import { Search, UserCheck, Bike, BedDouble, Coffee, Utensils, Cookie } from 'lucide-react'
import { adminGet, adminPost } from '../adminApi'

type Aba = 'credenciamento' | 'dia5' | 'dia6' | 'dia7' | 'alojamento'
type Parte = 'cafe' | 'almoco' | 'lanche'
type FiltroCred = 'todos' | 'falta_presenca' | 'falta_bike'

interface Refeicao { dia: number; pacote: string; retirado_cafe: number; retirado_almoco: number; retirado_lanche: number }

interface Pessoa {
  id: number
  nome: string
  email: string
  cidade: string
  status: string
  tipo_participacao: string
  categorias: string
  presente: number
  credenciado: number
  bike_check: number
  alojamento_confirmado: number
  tem_alojamento: number
  alojamento_pago: number
  refeicoes: Refeicao[]
  noites: number[]
}

// Pacote "almoco" só tem direito ao almoço — pacote "completo" tem as três refeições
function partesEsperadas(pacote: string): Parte[] {
  return pacote === 'almoco' ? ['almoco'] : ['cafe', 'almoco', 'lanche']
}

const PARTE_INFO: Record<Parte, { label: string; icon: React.ReactNode }> = {
  cafe:   { label: 'Café',   icon: <Coffee size={13} /> },
  almoco: { label: 'Almoço', icon: <Utensils size={13} /> },
  lanche: { label: 'Lanche', icon: <Cookie size={13} /> },
}

function calcStats(lista: Pessoa[]) {
  const refDia = (dia: number) => {
    let total = 0, retirados = 0
    for (const a of lista) {
      const r = a.refeicoes.find(x => x.dia === dia)
      if (!r) continue
      for (const parte of partesEsperadas(r.pacote)) {
        total++
        if (parte === 'cafe' && r.retirado_cafe) retirados++
        if (parte === 'almoco' && r.retirado_almoco) retirados++
        if (parte === 'lanche' && r.retirado_lanche) retirados++
      }
    }
    return { total, retirados }
  }
  return {
    total:        lista.length,
    presentes:    lista.filter(a => a.presente).length,
    bikes:        lista.filter(a => a.bike_check).length,
    ref5: refDia(5), ref6: refDia(6), ref7: refDia(7),
    aloj: {
      total:       lista.filter(a => a.tem_alojamento > 0).length,
      confirmados: lista.filter(a => a.tem_alojamento > 0 && a.alojamento_confirmado).length,
    },
  }
}

const ABAS: { key: Aba; label: string; icon: React.ReactNode }[] = [
  { key: 'credenciamento', label: 'Credenciamento', icon: <UserCheck size={14} /> },
  { key: 'dia5',           label: '5/set',          icon: <Utensils size={14} /> },
  { key: 'dia6',           label: '6/set',          icon: <Utensils size={14} /> },
  { key: 'dia7',           label: '7/set',          icon: <Utensils size={14} /> },
  { key: 'alojamento',     label: 'Alojamento',     icon: <BedDouble size={14} /> },
]

const FILTROS_CRED: { key: FiltroCred; label: string }[] = [
  { key: 'todos',           label: 'Todos' },
  { key: 'falta_presenca',  label: 'Faltam presença' },
  { key: 'falta_bike',      label: 'Faltam bike check' },
]

export default function Checkin() {
  const [lista, setLista] = useState<Pessoa[]>([])
  const [loading, setLoading] = useState(true)
  const [aba, setAba] = useState<Aba>('credenciamento')
  const [busca, setBusca] = useState('')
  const [filtroCred, setFiltroCred] = useState<FiltroCred>('todos')
  const [salvando, setSalvando] = useState<string | null>(null)

  useEffect(() => {
    adminGet<Pessoa[]>('/api/admin/checkin.php')
      .then(d => { if (d) setLista(d) })
      .finally(() => setLoading(false))
  }, [])

  const s = useMemo(() => calcStats(lista), [lista])

  const visivel = useMemo(() => {
    const dia = aba === 'dia5' ? 5 : aba === 'dia6' ? 6 : aba === 'dia7' ? 7 : null
    let base = lista
    if (dia !== null)         base = lista.filter(a => a.refeicoes.some(r => r.dia === dia))
    if (aba === 'alojamento') base = lista.filter(a => a.tem_alojamento > 0)
    if (aba === 'credenciamento') {
      if (filtroCred === 'falta_presenca') base = base.filter(a => !a.presente)
      if (filtroCred === 'falta_bike')     base = base.filter(a => !a.bike_check)
    }
    if (!busca) return base
    const t = busca.toLowerCase()
    return base.filter(a => a.nome.toLowerCase().includes(t) || a.email.toLowerCase().includes(t))
  }, [lista, aba, busca, filtroCred])

  async function toggleCampo(id: number, campo: string, cur: number) {
    const key = `${id}-${campo}`
    setSalvando(key)
    const v = cur ? 0 : 1
    await adminPost('/api/admin/checkin.php', { inscricao_id: id, campo, valor: v })
    setLista(prev => prev.map(a => a.id === id ? { ...a, [campo]: v } : a))
    setSalvando(null)
  }

  async function toggleRefeicaoParte(id: number, dia: number, parte: Parte, cur: number) {
    const key = `${id}-ref-${dia}-${parte}`
    setSalvando(key)
    const v = cur ? 0 : 1
    await adminPost('/api/admin/checkin.php', { inscricao_id: id, campo: 'refeicao', dia, parte, valor: v })
    setLista(prev => prev.map(a =>
      a.id === id
        ? { ...a, refeicoes: a.refeicoes.map(r => r.dia === dia ? { ...r, [`retirado_${parte}`]: v } : r) }
        : a
    ))
    setSalvando(null)
  }

  const dia = aba === 'dia5' ? 5 : aba === 'dia6' ? 6 : aba === 'dia7' ? 7 : null

  return (
    <div>
      {/* ── Stats ─────────────────────────────────────────────── */}
      <div className="adm-ck-stats">
        <StatCard label="Presentes"    done={s.presentes}    total={s.total}      cor="var(--adm-accent)"  />
        <StatCard label="Bike Check"   done={s.bikes}        total={s.total}      cor="var(--adm-purple)"  />
        <StatCard label="5/set"        done={s.ref5.retirados} total={s.ref5.total} cor="var(--adm-orange)" />
        <StatCard label="6/set"        done={s.ref6.retirados} total={s.ref6.total} cor="var(--adm-orange)" />
        <StatCard label="7/set"        done={s.ref7.retirados} total={s.ref7.total} cor="var(--adm-orange)" />
        <StatCard label="Alojamento"   done={s.aloj.confirmados} total={s.aloj.total} cor="var(--adm-cyan)" />
      </div>

      {/* ── Tabs ──────────────────────────────────────────────── */}
      <div className="adm-ck-tabs">
        {ABAS.map(a => (
          <button
            key={a.key}
            className={`adm-ck-tab ${aba === a.key ? 'adm-ck-tab--active' : ''}`}
            onClick={() => { setAba(a.key); setBusca('') }}
          >
            {a.icon} {a.label}
          </button>
        ))}
      </div>

      {/* ── Filtros do credenciamento ───────────────────────────── */}
      {aba === 'credenciamento' && (
        <div className="adm-filter-chips" style={{ marginBottom: 12 }}>
          {FILTROS_CRED.map(f => (
            <button
              key={f.key}
              className={`adm-chip ${filtroCred === f.key ? 'adm-chip--active' : ''}`}
              onClick={() => setFiltroCred(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Busca ─────────────────────────────────────────────── */}
      <div className="adm-ck-search">
        <Search size={15} className="adm-ck-search-icon" />
        <input
          placeholder="Buscar por nome ou email…"
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      <div className="adm-ck-count">
        {loading ? 'Carregando…' : `${visivel.length} pessoa${visivel.length !== 1 ? 's' : ''}`}
      </div>

      {/* ── Lista ─────────────────────────────────────────────── */}
      {!loading && (
        <div className="adm-ck-rows">
          {visivel.length === 0 && (
            <div className="adm-ck-empty">Nenhum resultado</div>
          )}

          {/* Credenciamento */}
          {aba === 'credenciamento' && visivel.map(a => (
            <div
              key={a.id}
              className={`adm-ck-row ${a.presente && a.bike_check ? 'adm-ck-row--done' : ''}`}
            >
              <div className="adm-ck-row-info">
                <div className="adm-ck-row-name">
                  <span className={`adm-ck-dot adm-ck-dot--${a.status === 'pago' ? 'pago' : 'aguardando'}`} />
                  {a.nome}
                  {a.tipo_participacao === 'acompanhante' && (
                    <span className="adm-badge adm-badge--tag" style={{ marginLeft: 7, fontSize: '.67rem', verticalAlign: 'middle' }}>APOIO</span>
                  )}
                </div>
                <div className="adm-ck-row-sub">
                  {a.categorias
                    ? a.categorias.split(', ').map(c => (
                        <span key={c} className={`adm-badge adm-badge--${c} adm-ck-cat`}>{c.toUpperCase()}</span>
                      ))
                    : null
                  }
                  {a.cidade && <span style={{ marginLeft: a.categorias ? 8 : 0 }}>{a.cidade}</span>}
                </div>
              </div>
              <div className="adm-ck-row-actions">
                <Btn
                  on={!!a.presente}
                  onClick={() => toggleCampo(a.id, 'presente', a.presente)}
                  disabled={salvando === `${a.id}-presente`}
                  icon={<UserCheck size={13} />}
                  label="Presente"
                />
                <Btn
                  on={!!a.bike_check}
                  onClick={() => toggleCampo(a.id, 'bike_check', a.bike_check)}
                  disabled={salvando === `${a.id}-bike_check`}
                  icon={<Bike size={13} />}
                  label="Bike"
                />
              </div>
            </div>
          ))}

          {/* Refeições por dia — 1 a 3 botões conforme o pacote contratado */}
          {dia !== null && visivel.map(a => {
            const ref = a.refeicoes.find(r => r.dia === dia)!
            const partes = partesEsperadas(ref.pacote)
            const feito = (p: Parte) => p === 'cafe' ? !!ref.retirado_cafe : p === 'almoco' ? !!ref.retirado_almoco : !!ref.retirado_lanche
            const done = partes.every(feito)
            return (
              <div key={a.id} className={`adm-ck-row ${done ? 'adm-ck-row--done' : ''}`}>
                <div className="adm-ck-row-info">
                  <div className="adm-ck-row-name">{a.nome}</div>
                  <div className="adm-ck-row-sub">
                    {a.cidade || ''}
                    <span className="adm-ck-pacote">
                      {ref.pacote === 'almoco' ? 'Apenas almoço' : 'Pacote completo'}
                    </span>
                  </div>
                </div>
                <div className="adm-ck-row-actions">
                  {partes.map(p => (
                    <Btn
                      key={p}
                      on={feito(p)}
                      onClick={() => toggleRefeicaoParte(a.id, dia, p, feito(p) ? 1 : 0)}
                      disabled={salvando === `${a.id}-ref-${dia}-${p}`}
                      icon={PARTE_INFO[p].icon}
                      label={PARTE_INFO[p].label}
                    />
                  ))}
                </div>
              </div>
            )
          })}

          {/* Alojamento */}
          {aba === 'alojamento' && visivel.map(a => (
            <div key={a.id} className={`adm-ck-row ${a.alojamento_confirmado ? 'adm-ck-row--done' : ''}`}>
              <div className="adm-ck-row-info">
                <div className="adm-ck-row-name">{a.nome}</div>
                <div className="adm-ck-row-sub">
                  {a.noites.map(n => (
                    <span key={n} className="adm-ck-noite">{n}/set</span>
                  ))}
                  {a.cidade && <span style={{ marginLeft: 6 }}>· {a.cidade}</span>}
                </div>
              </div>
              <div className="adm-ck-row-actions">
                {!a.alojamento_pago && (
                  <span style={{ fontSize: '.72rem', color: '#FFD54F', marginRight: 6 }}>Pagamento pendente</span>
                )}
                <Btn
                  on={!!a.alojamento_confirmado}
                  onClick={() => toggleCampo(a.id, 'alojamento_confirmado', a.alojamento_confirmado)}
                  disabled={!a.alojamento_pago || salvando === `${a.id}-alojamento_confirmado`}
                  icon={<BedDouble size={13} />}
                  label="Confirmado"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Sub-components ─────────────────────────────────────────── */

function StatCard({ label, done, total, cor }: { label: string; done: number; total: number; cor: string }) {
  const pct = total > 0 ? Math.round(done / total * 100) : 0
  return (
    <div className="adm-ck-stat">
      <div className="adm-ck-stat-nums">
        <span className="adm-ck-stat-done" style={{ color: cor }}>{done}</span>
        <span className="adm-ck-stat-sep">/</span>
        <span className="adm-ck-stat-total">{total}</span>
      </div>
      <div className="adm-ck-stat-label">{label}</div>
      <div className="adm-ck-stat-bar">
        <div className="adm-ck-stat-fill" style={{ width: `${pct}%`, background: cor }} />
      </div>
    </div>
  )
}

function Btn({ on, onClick, disabled, icon, label }: {
  on: boolean; onClick: () => void; disabled: boolean
  icon: React.ReactNode; label: string
}) {
  return (
    <button
      className={`adm-toggle-btn ${on ? 'adm-toggle-btn--on' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon} {label}
    </button>
  )
}
