import { useState, useEffect } from 'react'
import { adminGet, adminPost } from '../adminApi'

interface Campo {
  chave: string
  label: string
  valor: number
  min?: number
  max?: number
}

interface ConfigGeral {
  inscricoes_abertas: boolean
  alojamento_aberto: boolean
  alimentacao_aberto: boolean
}

const TOGGLES: { chave: keyof ConfigGeral; label: string; onLabel: string; offLabel: string; hint: string }[] = [
  {
    chave: 'inscricoes_abertas', label: 'Inscrições',
    onLabel: 'Inscrições abertas', offLabel: 'Inscrições encerradas',
    hint: 'Controla apenas a criação de novas inscrições em /inscricoes. Não afeta alojamento nem alimentação.',
  },
  {
    chave: 'alojamento_aberto', label: 'Alojamento',
    onLabel: 'Contratação aberta', offLabel: 'Contratação fechada',
    hint: 'Permite ou não que pessoas com inscrição contratem ou adicionem dias de alojamento.',
  },
  {
    chave: 'alimentacao_aberto', label: 'Alimentação',
    onLabel: 'Contratação aberta', offLabel: 'Contratação fechada',
    hint: 'Permite ou não que pessoas com inscrição contratem alimentação.',
  },
]

const DEFAULTS: Record<string, number> = {
  valor_misto:                182,
  valor_mtnb:                  52,
  valor_misto_com_mtnb:        90,
  desconto_primeiro_torneio:    0.5,
  valor_alimentacao_completo:  51,
  valor_alimentacao_almoco:    21,
  valor_alojamento_diaria:     26,
}

export default function Configuracoes() {
  const [campos, setCampos] = useState<Campo[]>([])
  const [editando, setEditando] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ chave: string; ok: boolean; texto: string } | null>(null)
  const [loading, setLoading] = useState(true)

  const [geral, setGeral] = useState<ConfigGeral | null>(null)
  const [alternando, setAlternando] = useState<string | null>(null)

  useEffect(() => {
    adminGet<Campo[]>('/api/admin/configuracoes.php')
      .then(d => { if (d) setCampos(d) })
      .finally(() => setLoading(false))
    adminGet<ConfigGeral>('/api/admin/config-geral.php')
      .then(d => { if (d) setGeral(d) })
  }, [])

  async function toggleGeral(chave: keyof ConfigGeral) {
    if (!geral) return
    setAlternando(chave)
    const res = await adminPost<ConfigGeral>('/api/admin/config-geral.php', { [chave]: !geral[chave] })
    if (res) setGeral(res)
    setAlternando(null)
  }

  function iniciarEdicao(chave: string, valorAtual: number) {
    setEditando(prev => ({ ...prev, [chave]: String(valorAtual) }))
  }

  function cancelarEdicao(chave: string) {
    setEditando(prev => { const n = { ...prev }; delete n[chave]; return n })
  }

  async function salvar(campo: Campo) {
    const valor = parseFloat(editando[campo.chave] ?? '')
    if (isNaN(valor)) { setMsg({ chave: campo.chave, ok: false, texto: 'Valor inválido' }); return }

    setSalvando(campo.chave)
    const res = await adminPost('/api/admin/configuracoes.php', { chave: campo.chave, valor })
    if (res) {
      setCampos(prev => prev.map(c => c.chave === campo.chave ? { ...c, valor } : c))
      cancelarEdicao(campo.chave)
      setMsg({ chave: campo.chave, ok: true, texto: 'Salvo!' })
      setTimeout(() => setMsg(null), 2000)
    } else {
      setMsg({ chave: campo.chave, ok: false, texto: 'Erro ao salvar' })
    }
    setSalvando(null)
  }

  async function restaurarPadrao(campo: Campo) {
    const def = DEFAULTS[campo.chave]
    if (def === undefined) return
    setEditando(prev => ({ ...prev, [campo.chave]: String(def) }))
    setSalvando(campo.chave)
    const res = await adminPost('/api/admin/configuracoes.php', { chave: campo.chave, valor: def })
    if (res) {
      setCampos(prev => prev.map(c => c.chave === campo.chave ? { ...c, valor: def } : c))
      cancelarEdicao(campo.chave)
      setMsg({ chave: campo.chave, ok: true, texto: 'Restaurado para o padrão' })
      setTimeout(() => setMsg(null), 2000)
    }
    setSalvando(null)
  }

  if (loading) return <div style={{ color: 'var(--adm-text-2)', padding: 20 }}>Carregando…</div>

  const grupos = [
    {
      titulo: 'Inscrição esportiva',
      chaves: ['valor_misto', 'valor_mtnb', 'valor_misto_com_mtnb', 'desconto_primeiro_torneio'],
    },
    {
      titulo: 'Alimentação',
      chaves: ['valor_alimentacao_completo', 'valor_alimentacao_almoco'],
    },
    {
      titulo: 'Alojamento',
      chaves: ['valor_alojamento_diaria'],
    },
  ]

  return (
    <div style={{ maxWidth: 680 }}>
      {geral && (
        <div className="adm-section" style={{ marginBottom: 24 }}>
          <div className="adm-section-title" style={{ marginBottom: 12 }}>Status geral</div>
          {TOGGLES.map(t => (
            <div key={t.chave} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--adm-border)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '.88rem', fontWeight: 600, marginBottom: 2 }}>{t.label}</div>
                <div style={{ fontSize: '.76rem', color: 'var(--adm-text-3)' }}>{t.hint}</div>
              </div>
              <button
                className={`adm-toggle-btn ${geral[t.chave] ? 'adm-toggle-btn--on' : ''}`}
                onClick={() => toggleGeral(t.chave)}
                disabled={alternando === t.chave}
              >
                {geral[t.chave] ? t.onLabel : t.offLabel}
              </button>
            </div>
          ))}
        </div>
      )}

      {grupos.map(grupo => (
        <div key={grupo.titulo} className="adm-section" style={{ marginBottom: 24 }}>
          <div className="adm-section-title" style={{ marginBottom: 12 }}>{grupo.titulo}</div>

          {grupo.chaves.map(chave => {
            const campo = campos.find(c => c.chave === chave)
            if (!campo) return null
            const emEdicao = chave in editando
            const def = DEFAULTS[chave]
            const mudado = campo.valor !== def

            return (
              <div key={chave} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--adm-border)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '.88rem', fontWeight: 600, marginBottom: 2 }}>{campo.label}</div>
                  {mudado && !emEdicao && (
                    <div style={{ fontSize: '.74rem', color: '#FFD54F' }}>Padrão: {def}</div>
                  )}
                </div>

                {emEdicao ? (
                  <>
                    <input
                      type="number"
                      step="0.01"
                      value={editando[chave]}
                      onChange={e => setEditando(prev => ({ ...prev, [chave]: e.target.value }))}
                      style={{ width: 100, padding: '5px 8px', background: 'var(--adm-input-bg, rgba(255,255,255,.07))', border: '1px solid var(--adm-border)', color: '#fff', borderRadius: 6, fontSize: '.88rem' }}
                      autoFocus
                    />
                    <button
                      className="adm-btn adm-btn--sm adm-btn--success"
                      onClick={() => salvar(campo)}
                      disabled={salvando === chave}
                    >
                      {salvando === chave ? '…' : 'Salvar'}
                    </button>
                    <button className="adm-btn adm-btn--sm" onClick={() => cancelarEdicao(chave)}>
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: '.9rem', fontWeight: 700, color: mudado ? '#FFD54F' : 'var(--adm-text-2)', minWidth: 60, textAlign: 'right' }}>
                      {campo.chave === 'desconto_primeiro_torneio'
                        ? `${(campo.valor * 100).toFixed(0)}%`
                        : `R$ ${campo.valor.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
                      }
                    </span>
                    <button className="adm-btn adm-btn--sm" onClick={() => iniciarEdicao(chave, campo.valor)}>
                      Editar
                    </button>
                    {mudado && (
                      <button className="adm-btn adm-btn--sm" onClick={() => restaurarPadrao(campo)} title="Restaurar padrão" style={{ opacity: .7 }}>
                        ↩
                      </button>
                    )}
                  </>
                )}

                {msg?.chave === chave && (
                  <span style={{ fontSize: '.78rem', color: msg.ok ? '#4CE0A8' : '#FF5252', minWidth: 80 }}>
                    {msg.texto}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      ))}

    </div>
  )
}
