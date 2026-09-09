import { useState, useEffect } from 'react'
import { adminGet, adminPost } from '../../adminApi'

interface ConfigLoja {
  loja_aberta: boolean
  mensagem_fechada: string
}

export default function Config() {
  const [config, setConfig] = useState<ConfigLoja | null>(null)
  const [mensagem, setMensagem] = useState('')
  const [loading, setLoading] = useState(true)
  const [salvandoStatus, setSalvandoStatus] = useState(false)
  const [salvandoMensagem, setSalvandoMensagem] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    adminGet<ConfigLoja>('/api/admin/lojinha-config.php')
      .then(d => { if (d) { setConfig(d); setMensagem(d.mensagem_fechada) } })
      .finally(() => setLoading(false))
  }, [])

  async function toggleLoja() {
    if (!config) return
    setSalvandoStatus(true)
    const res = await adminPost<ConfigLoja>('/api/admin/lojinha-config.php', { loja_aberta: !config.loja_aberta })
    if (res) setConfig(res)
    setSalvandoStatus(false)
  }

  async function salvarMensagem() {
    if (!mensagem.trim()) return
    setSalvandoMensagem(true)
    const res = await adminPost<ConfigLoja>('/api/admin/lojinha-config.php', { mensagem_fechada: mensagem.trim() })
    if (res) {
      setConfig(res)
      setMsg('Salvo!')
      setTimeout(() => setMsg(''), 2000)
    }
    setSalvandoMensagem(false)
  }

  if (loading) return <div style={{ color: 'var(--adm-text-2)', padding: 20 }}>Carregando…</div>
  if (!config) return null

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="adm-section" style={{ marginBottom: 28 }}>
        <div className="adm-section-title" style={{ marginBottom: 10 }}>Status da loja</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            className={`adm-toggle-btn ${config.loja_aberta ? 'adm-toggle-btn--on' : ''}`}
            onClick={toggleLoja}
            disabled={salvandoStatus}
          >
            {config.loja_aberta ? 'Vendas abertas' : 'Vendas fechadas'}
          </button>
          <span style={{ fontSize: '.84rem', color: 'var(--adm-text-2)' }}>
            {config.loja_aberta
              ? 'A lojinha está visível e aceitando pedidos.'
              : 'A lojinha exibe a mensagem de encerramento abaixo.'}
          </span>
        </div>
      </div>

      <div className="adm-section">
        <div className="adm-section-title" style={{ marginBottom: 10 }}>Mensagem quando fechada</div>
        <div className="adm-field">
          <textarea
            value={mensagem}
            onChange={e => setMensagem(e.target.value)}
            rows={3}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <button
            className="adm-btn adm-btn--sm adm-btn--success"
            onClick={salvarMensagem}
            disabled={salvandoMensagem || mensagem.trim() === config.mensagem_fechada}
          >
            {salvandoMensagem ? 'Salvando…' : 'Salvar mensagem'}
          </button>
          {msg && <span style={{ fontSize: '.8rem', color: 'var(--adm-accent)' }}>{msg}</span>}
        </div>
      </div>
    </div>
  )
}
