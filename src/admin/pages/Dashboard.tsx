import { useState, useEffect } from 'react'
import { Users, CheckCircle, Clock, Trophy, Globe, Wallet, Receipt, Heart, AlertTriangle } from 'lucide-react'
import { adminGet, fmtBRL } from '../adminApi'
import ExportButtons from '../components/ExportButtons'

interface FinanceiroKpi {
  esperado: number
  pago: number
}

interface Stats {
  total_inscritos: number
  total_acompanhantes: number
  total_pagos: number
  aguardando: number
  cancelados: number
  total_latino: number
  total_aa: number
  total_misto: number
  total_mtnb: number
  financeiro: {
    total: FinanceiroKpi
    inscricao: FinanceiroKpi
    alojamento: FinanceiroKpi
    alimentacao: FinanceiroKpi
  }
  a_reembolsar: number
  n_reembolso_pendente: number
  alimentacao_por_dia: Record<string, number>
  alojamento_por_dia: Record<string, number>
  checkin_presentes: number
  checkin_credenciados: number
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminGet<Stats>('/api/admin/dashboard.php')
      .then(d => { if (d) setStats(d) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ color: 'var(--adm-text-2)', padding: 20 }}>Carregando…</div>
  if (!stats)  return <div className="adm-error">Erro ao carregar dados</div>

  const pctPagos = stats.total_inscritos
    ? Math.round((stats.total_pagos / stats.total_inscritos) * 100)
    : 0

  return (
    <div>
      <div className="adm-cards">
        <StatCard icon={<Users size={20} />}        label="Atletas"     value={stats.total_inscritos}     color="blue" />
        <StatCard icon={<Heart size={20} />}        label="Apoio"       value={stats.total_acompanhantes} color="purple" sub="acompanhantes" />
        <StatCard icon={<CheckCircle size={20} />}  label="Pagos"       value={stats.total_pagos}         color="green" sub={`${pctPagos}% atletas`} />
        <StatCard icon={<Clock size={20} />}         label="Aguardando"  value={stats.aguardando}      color="yellow" />
        <StatCard icon={<Trophy size={20} />}        label="Times"       value={stats.total_misto}     color="purple" />
        <StatCard icon={<Globe size={20} />}         label="Latino"      value={stats.total_latino}    color="cyan" />
        <StatCard icon={<Wallet size={20} />}         label="Total Pago"  value={0} color="blue" money
          valueStr={fmtBRL(stats.financeiro.total.pago)} sub={`de ${fmtBRL(stats.financeiro.total.esperado)}`} />
        <StatCard icon={<Receipt size={20} />}        label="Inscrições"  value={0} color="green" money
          valueStr={fmtBRL(stats.financeiro.inscricao.pago)} sub={`de ${fmtBRL(stats.financeiro.inscricao.esperado)}`} />
        {stats.a_reembolsar > 0 && (
          <StatCard icon={<AlertTriangle size={20} />} label="A Reembolsar" value={0} color="red"
            valueStr={fmtBRL(stats.a_reembolsar)} sub={`${stats.n_reembolso_pendente} inscr.`} />
        )}
      </div>

      <div className="adm-section-row">
        <div className="adm-card">
          <h3>Exportações</h3>
          <ExportButtons />
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, color, sub, valueStr, money }: {
  icon: React.ReactNode
  label: string
  value: number
  color: string
  sub?: string
  valueStr?: string
  money?: boolean
}) {
  return (
    <div className={`adm-stat-card adm-stat-card--${color}`}>
      <div className="adm-stat-icon">{icon}</div>
      <div className="adm-stat-info">
        <div className={`adm-stat-value${money ? ' adm-stat-value--money' : ''}`}>{valueStr ?? value}</div>
        <div className="adm-stat-label">{label}</div>
        {sub && <div className="adm-stat-sub">{sub}</div>}
      </div>
    </div>
  )
}
