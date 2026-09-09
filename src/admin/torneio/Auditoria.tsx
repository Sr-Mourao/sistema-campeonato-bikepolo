import { useState, useEffect, useCallback } from 'react'
import { torneioApi, type AuditRow } from './torneioApi'
import { fmtDate } from '../adminApi'

interface Props { torneioId: number; onChange: () => void }

const ACAO_LABEL: Record<string, string> = {
  criar_torneio: 'Torneio criado', zerar_resultados: 'Resultados do torneio zerados',
  salvar_criterios: 'Critérios de classificação alterados',
  confirmar_rodada: 'Rodada confirmada', confirmar_equalizacao: 'Equalização confirmada',
  fechar_classificacao: 'Classificação fechada', gerar_repescagem: 'Repescagem gerada',
  gerar_double: 'Double Elimination gerada', gerar_gf2: 'GF2 gerada',
  registrar_gol: 'Gol registrado', registrar_falta: 'Falta registrada',
  remover_gol: 'Gol removido', remover_falta: 'Falta removida',
  atualizar_partida: 'Partida atualizada',
}

export default function Auditoria({ torneioId, onChange }: Props) {
  const [log, setLog] = useState<AuditRow[] | null>(null)
  const [desfazendo, setDesfazendo] = useState<number | null>(null)

  const carregar = useCallback(async () => {
    const r = await torneioApi.auditoria(torneioId)
    if (r) setLog(r.log)
  }, [torneioId])

  useEffect(() => { carregar() }, [carregar])

  async function desfazer(id: number) {
    setDesfazendo(id)
    const r = await torneioApi.desfazer(torneioId, id)
    setDesfazendo(null)
    if (r) { onChange(); await carregar() }
  }

  function resumoEstado(row: AuditRow): string | null {
    const novo = row.estado_novo as Record<string, unknown> | null
    if (row.acao === 'atualizar_partida' && novo) {
      return `→ ${String(novo.status)}${novo.placar_a != null ? ` (${novo.placar_a}×${novo.placar_b})` : ''}`
    }
    return null
  }

  return (
    <div className="adm-card">
      <h3>Histórico / Auditoria</h3>
      {log === null && <div style={{ color: 'var(--adm-text-2)', padding: 12 }}>Carregando…</div>}
      {log?.length === 0 && <div className="trn-fp-hint">Nenhuma ação registrada ainda.</div>}
      {log?.map(row => (
        <div key={row.id} className="trn-audit-item">
          <div className="trn-audit-time">{fmtDate(row.criado_em)}</div>
          <div className="trn-audit-body">
            <span className={row.revertido ? 'trn-audit-reverted' : ''}>
              {ACAO_LABEL[row.acao] ?? row.acao} {resumoEstado(row)}
            </span>
            {row.motivo && <div className="trn-fp-hint">{row.motivo}</div>}
            <div className="trn-audit-user">{row.usuario}{row.revertido ? ' · desfeito' : ''}</div>
          </div>
          {row.pode_desfazer && (
            <button className="adm-btn adm-btn--sm adm-btn--danger" disabled={desfazendo === row.id} onClick={() => desfazer(row.id)}>
              {desfazendo === row.id ? 'Desfazendo…' : 'DESFAZER'}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
