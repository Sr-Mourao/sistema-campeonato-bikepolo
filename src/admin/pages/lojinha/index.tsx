import { useState } from 'react'
import Produtos from './Produtos'
import Pedidos from './Pedidos'
import Config from './Config'

const TABS = [
  { key: 'produtos', label: 'Produtos' },
  { key: 'pedidos',  label: 'Pedidos' },
  { key: 'config',   label: 'Configurações' },
] as const

type TabKey = typeof TABS[number]['key']

export default function Lojinha() {
  const [tab, setTab] = useState<TabKey>('produtos')

  return (
    <div>
      <div className="adm-filter-chips" style={{ marginBottom: 18 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            className={`adm-chip ${tab === t.key ? 'adm-chip--active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'produtos' && <Produtos />}
      {tab === 'pedidos' && <Pedidos />}
      {tab === 'config' && <Config />}
    </div>
  )
}
