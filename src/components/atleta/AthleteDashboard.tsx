import { useState } from 'react'
import { User, Trophy, Users, Globe, WalletCards } from 'lucide-react'
import FoodModule from './FoodModule'
import HousingModule from './HousingModule'
import FinancialSummary from './FinancialSummary'
import AwardsVoting from './AwardsVoting'

interface Pessoa {
  nome: string; email: string; genero: string
  clube: string; cidade: string; nacionalidade: string
}
interface Categoria { categoria: string; valor: number }
interface Time { nome: string; categoria: string; codigo: string; criou: boolean; logo_path: string | null }
interface DiaAlim { dia: number; valor: number; pacote?: string }
interface DiaAloj { dia: number; valor: number; pago: boolean }
interface ConfigServicos { alojamento_aberto: boolean; alimentacao_aberto: boolean }

export interface Pagamento {
  id: number
  tipo: 'inscricao' | 'completo' | 'alimentacao' | 'alojamento' | 'alojamento_extra' | 'lojinha' | 'recarga'
  status: 'pendente' | 'pago' | 'cancelado'
  valor: number
  metodo: string | null
  itens: { descricao: string; valor: number }[] | null
  criado_em?: string
}

interface Inscricao {
  id: number; status: string; valor_total: number
  tipo_participacao: string
  latino: boolean; acao_afirmativa: boolean
  categorias: Categoria[]; times: Time[]
  alimentacao: DiaAlim[]; alojamento: DiaAloj[]
  restricao_alimentar: { tipo: string; descricao: string | null } | null
  pagamentos: Pagamento[]
  criado_em: string
}

interface Props {
  pessoa: Pessoa
  inscricao: Inscricao
  config: ConfigServicos
  token: string
  onLogout: () => void
}

const ALIMENTACAO_PRAZO: string | null = null
const ALOJAMENTO_PRAZO:  string | null = null

function isPrazoEncerrado(prazo: string | null): boolean {
  if (!prazo) return false
  return new Date().toISOString().slice(0, 10) > prazo
}
function formatPrazo(prazo: string | null): string {
  if (!prazo) return ''
  const [y, m, d] = prazo.split('-')
  return `${d}/${m}/${y}`
}
function catLabel(cat: string) {
  return cat === 'misto' ? 'Brasileiro Misto' : 'Brasileiro MTNB'
}

export default function AthleteDashboard({ pessoa, inscricao: initialIns, config, token, onLogout }: Props) {
  const [inscricao, setInscricao] = useState(initialIns)

  // ── Derivação dos pagamentos por bloco ──────────────────
  // Prefere o pagamento mais recente não-cancelado de cada tipo.
  // Se só existir pagamento cancelado, ele ainda precisa aparecer para
  // permitir uma nova tentativa de pagamento pela área da pessoa atleta.
  function findPg(tipo: string): Pagamento | null {
    const pagamentosDoTipo = inscricao.pagamentos
      .slice()
      .reverse()
      .filter(p => p.tipo === tipo)

    return pagamentosDoTipo.find(p => p.status !== 'cancelado')
      ?? pagamentosDoTipo[0]
      ?? null
  }
  const pgCompleto  = findPg('completo')
  const pgInscricao = findPg('inscricao')
  const pgAlim      = findPg('alimentacao')
  const pgAloj      = findPg('alojamento')
  const pgAlojExtra = findPg('alojamento_extra')

  // Quando o registro foi feito com tipo='completo', alimentação e alojamento
  // já estão cobertos pelo pagamento único da inscrição
  const pagoViaCompleto = pgCompleto?.status === 'pago'

  // ── Callbacks de estado ─────────────────────────────────
  function updateAlim(nova: DiaAlim[]) {
    setInscricao(prev => ({ ...prev, alimentacao: nova }))
  }
  function updateAloj(nova: DiaAloj[]) {
    setInscricao(prev => ({ ...prev, alojamento: nova }))
  }
  function addPagamento(novo: Pagamento) {
    setInscricao(prev => {
      const exists = prev.pagamentos.some(p => p.id === novo.id)
      return {
        ...prev,
        pagamentos: exists
          ? prev.pagamentos.map(p => p.id === novo.id ? novo : p)
          : [...prev.pagamentos, novo],
      }
    })
  }
  function updatePagamento(updated: Pagamento) {
    setInscricao(prev => ({
      ...prev,
      pagamentos: prev.pagamentos.map(p => p.id === updated.id ? updated : p),
      // Quando um pagamento de alojamento/alojamento_extra é confirmado, os dias ainda
      // soltos (pago: false) são exatamente os que esse pagamento cobriu — espelha
      // lockAlojamentoAoPagar no backend. Sem isso, a seção só atualiza com F5.
      alojamento: (updated.tipo === 'alojamento' || updated.tipo === 'alojamento_extra') && updated.status === 'pago'
        ? prev.alojamento.map(a => a.pago ? a : { ...a, pago: true })
        : prev.alojamento,
      // só atualiza status da inscrição se o pagamento for esportivo
      status: (updated.tipo === 'inscricao' || updated.tipo === 'completo') && updated.status === 'pago'
        ? 'pago'
        : prev.status,
    }))
  }

  const primeiroNome  = pessoa.nome.split(' ')[0]
  const dataInscricao = new Date(inscricao.criado_em)
    .toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div>
      {/* Saudação */}
      <div className="atl-greeting">
        <p className="atl-greeting-eyebrow">Área da pessoa atleta</p>
        <h1 className="atl-greeting-name">Olá, {primeiroNome}! 💛</h1>
        <p className="atl-greeting-sub">
          Inscrição #{String(inscricao.id).padStart(6, '0')} · {dataInscricao}
        </p>
      </div>

      <a href="/carteira" className="atl-card" style={{ animationDelay: '40ms', display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
        <div className="atl-card-icon"><WalletCards size={18} /></div>
        <div>
          <div className="atl-card-title">Minha Carteira</div>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'rgba(255,255,255,.45)' }}>Saldo, recarga, QR Code e extrato</p>
        </div>
        <span style={{ marginLeft: 'auto', color: 'var(--pal-orange)' }}>→</span>
      </a>

      {inscricao.tipo_participacao === 'atleta' && inscricao.categorias.some(c => c.categoria === 'misto') && (
        <AwardsVoting token={token} />
      )}

      {/* Dados pessoais */}
      <div className="atl-card" style={{ animationDelay: '60ms' }}>
        <div className="atl-card-header">
          <div className="atl-card-icon"><User size={16} /></div>
          <div className="atl-card-title">Dados Pessoais</div>
        </div>
        <div className="atl-info-row"><span className="atl-info-label">Nome</span><span className="atl-info-val">{pessoa.nome}</span></div>
        {pessoa.genero && <div className="atl-info-row"><span className="atl-info-label">Gênero</span><span className="atl-info-val">{pessoa.genero}</span></div>}
        {pessoa.clube  && <div className="atl-info-row"><span className="atl-info-label">Clube</span><span className="atl-info-val">{pessoa.clube}</span></div>}
        {pessoa.cidade && <div className="atl-info-row"><span className="atl-info-label">Cidade</span><span className="atl-info-val">{pessoa.cidade}</span></div>}
      </div>

      {/* Categorias (atleta) ou Participação (acompanhante) */}
      {inscricao.tipo_participacao === 'acompanhante' ? (
        <div className="atl-card" style={{ animationDelay: '100ms' }}>
          <div className="atl-card-header">
            <div className="atl-card-icon"><Trophy size={16} /></div>
            <div className="atl-card-title">Participação</div>
          </div>
          <div className="atl-info-row">
            <span className="atl-info-label">Tipo</span>
            <span className="atl-info-val">Acompanhante / Apoio</span>
          </div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', marginTop: 10, lineHeight: 1.5 }}>
            Sua inscrição foi confirmada como acompanhante do evento.
          </p>
        </div>
      ) : (
        <div className="atl-card" style={{ animationDelay: '100ms' }}>
          <div className="atl-card-header">
            <div className="atl-card-icon"><Trophy size={16} /></div>
            <div className="atl-card-title">Categorias</div>
            <span className={`atl-status atl-status--${inscricao.status === 'pago' ? 'pago' : inscricao.status === 'cancelado' ? 'cancelado' : 'aguardando'}`} style={{ marginLeft: 'auto' }}>
              {inscricao.status.replace('_', ' ')}
            </span>
          </div>
          {inscricao.categorias.map(c => (
            <div key={c.categoria} className="atl-info-row">
              <span className="atl-info-label">{catLabel(c.categoria)}</span>
              <span className="atl-info-val">R$ {c.valor}</span>
            </div>
          ))}
          {inscricao.acao_afirmativa && <p style={{ fontSize: 13, color: 'var(--pal-magenta-l70)', marginTop: 10 }}>💛 Política afirmativa aplicada</p>}
          {inscricao.latino && <p style={{ fontSize: 13, color: 'rgba(255,255,255,.55)', marginTop: 10 }}>🌎 Optou por disputar vaga para o Latinoamericano 2026</p>}
        </div>
      )}

      {/* Times */}
      {inscricao.times.length > 0 && (
        <div className="atl-card" style={{ animationDelay: '140ms' }}>
          <div className="atl-card-header">
            <div className="atl-card-icon"><Users size={16} /></div>
            <div className="atl-card-title">Times</div>
          </div>
          {inscricao.times.map((t, i) => (
            <div key={i} className="atl-team-tag">
              <div className="atl-team-name">{t.nome}</div>
              <div className="atl-team-meta">
                <span className="atl-team-cat">{catLabel(t.categoria)}</span>
                <span className="atl-team-code" title="Clique para copiar" onClick={() => navigator.clipboard?.writeText(t.codigo)}>{t.codigo}</span>
                {t.criou && <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', letterSpacing: '.08em' }}>(você criou)</span>}
              </div>
            </div>
          ))}
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,.30)', marginTop: 10 }}>Clique no código para copiar 💛</p>
        </div>
      )}

      {/* Latino */}
      {inscricao.latino && (
        <div className="atl-card" style={{ animationDelay: '160ms' }}>
          <div className="atl-card-header">
            <div className="atl-card-icon"><Globe size={16} /></div>
            <div className="atl-card-title">Latinoamericano 2026</div>
          </div>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,.65)', lineHeight: 1.55 }}>
            Você optou por disputar vaga para o <strong style={{ color: 'var(--pal-white)' }}>Latinoamericano de Bike Polo no Peru</strong>.
          </p>
        </div>
      )}

      {/* ── Bloco: Alimentação (com pagamento próprio) ───────── */}
      <FoodModule
        inscricaoId={inscricao.id}
        inicial={inscricao.alimentacao}
        restricaoTipoInicial={inscricao.restricao_alimentar?.tipo ?? null}
        restricaoDescricaoInicial={inscricao.restricao_alimentar?.descricao ?? ''}
        prazoCerrado={isPrazoEncerrado(ALIMENTACAO_PRAZO)}
        prazoLabel={formatPrazo(ALIMENTACAO_PRAZO)}
        token={token}
        pagamento={pgAlim}
        pagoViaCompleto={pagoViaCompleto}
        aberto={config.alimentacao_aberto}
        onUpdate={updateAlim}
        onPagamentoAdded={addPagamento}
        onPagamentoUpdated={updatePagamento}
      />

      {/* ── Bloco: Alojamento (com pagamento próprio) ────────── */}
      <HousingModule
        inicial={inscricao.alojamento}
        prazoCerrado={isPrazoEncerrado(ALOJAMENTO_PRAZO)}
        prazoLabel={formatPrazo(ALOJAMENTO_PRAZO)}
        token={token}
        pagamento={pgAloj}
        pagamentoExtra={pgAlojExtra}
        pagoViaCompleto={pagoViaCompleto}
        aberto={config.alojamento_aberto}
        onUpdate={updateAloj}
        onPagamentoAdded={addPagamento}
        onPagamentoUpdated={updatePagamento}
      />

      {/* ── Bloco: Inscrição Esportiva (apenas atletas) ─────── */}
      {inscricao.tipo_participacao !== 'acompanhante' && <FinancialSummary
        valorEsportivo={inscricao.valor_total}
        categorias={inscricao.categorias}
        acoesAfirmativas={inscricao.acao_afirmativa}
        pagamento={pgCompleto ?? pgInscricao}
        alimentacao={inscricao.alimentacao}
        alojamento={inscricao.alojamento}
        token={token}
        onPagamentoUpdated={updatePagamento}
      />}

      {/* Sair */}
      <div style={{ textAlign: 'center', paddingTop: 16 }}>
        <button onClick={onLogout} style={{ background: 'none', border: 'none', fontSize: 13, color: 'rgba(255,255,255,.30)', cursor: 'pointer', letterSpacing: '.08em' }}>
          Sair da conta
        </button>
      </div>
    </div>
  )
}
