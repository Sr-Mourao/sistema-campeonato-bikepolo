import { useState, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import { fmtHora } from '../adminApi'
import { torneioApi, getErrorMessage, type SumulaData } from './torneioApi'

interface Props {
  torneioId: number
  jogoId: number
  onClose: () => void
  onChange: () => void
}

const STATUS_LABEL: Record<string, string> = {
  agendado: 'Agendado', atrasado: 'Atrasado', chamado: 'Chamado', em_andamento: 'Em andamento',
  encerrado: 'Encerrada', wo: 'W.O.', cancelado: 'Cancelado',
}

// Controle manual de status (seção 1 do brief) — encerrado tem fluxo próprio (exige
// placar + confirmação), os outros três são um ajuste direto de um clique.
const STATUS_PILLS = ['agendado', 'atrasado', 'em_andamento', 'encerrado'] as const

export default function Sumula({ torneioId, jogoId, onClose, onChange }: Props) {
  const [dados, setDados] = useState<SumulaData | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [confirmandoEncerrar, setConfirmandoEncerrar] = useState(false)
  const [overtime, setOvertime] = useState(false)
  const [corrigindo, setCorrigindo] = useState(false)
  const [corrA, setCorrA] = useState(0)
  const [corrB, setCorrB] = useState(0)

  const carregar = useCallback(async () => {
    const d = await torneioApi.sumula(torneioId, jogoId)
    if (d) {
      setDados(d)
      setOvertime(!!d.jogo.overtime)
    }
  }, [torneioId, jogoId])

  useEffect(() => { carregar() }, [carregar])

  if (!dados) {
    return (
      <div className="adm-drawer-overlay" onClick={onClose}>
        <div className="adm-drawer" onClick={e => e.stopPropagation()}>
          <div className="adm-drawer-header"><h2>Carregando súmula…</h2><button className="adm-drawer-close" onClick={onClose}><X size={18} /></button></div>
        </div>
      </div>
    )
  }

  const { jogo, elenco, eventos } = dados
  const elencoA = elenco.filter(m => m.time_id === jogo.time_a_id)
  const elencoB = elenco.filter(m => m.time_id === jogo.time_b_id)
  const encerrada = jogo.status === 'encerrado' || jogo.status === 'cancelado'
  const eliminatoria = jogo.fase_tipo === 'repescagem' || jogo.fase_tipo === 'double'
  const semTimes = jogo.time_a_id === null || jogo.time_b_id === null
  const placarA = jogo.placar_a ?? 0
  const placarB = jogo.placar_b ?? 0
  const golsA = eventos.filter(e => e.categoria === 'gol' && e.time_id === jogo.time_a_id).length
  const golsB = eventos.filter(e => e.categoria === 'gol' && e.time_id === jogo.time_b_id).length
  const placarDivergente = !semTimes && (placarA !== golsA || placarB !== golsB)

  async function gol(timeId: number, membroId: number | null, tipo: 'normal' | 'sem_autoria' | 'gol_contra') {
    if (encerrada) return
    setErro('')
    const r = await torneioApi.registrarGol(torneioId, jogoId, timeId, membroId, tipo)
    if (!r) { setErro('Não foi possível registrar o gol.'); return }
    await torneioApi.recalcularPlacar(torneioId, jogoId)
    await carregar()
  }

  async function falta(timeId: number, membroId: number) {
    if (encerrada) return
    setErro('')
    const r = await torneioApi.registrarFalta(torneioId, jogoId, timeId, membroId)
    if (!r) { setErro('Não foi possível registrar a falta.'); return }
    await carregar()
  }

  async function desfazerEvento(categoria: 'gol' | 'falta', eventoId: number) {
    await torneioApi.removerEvento(torneioId, categoria, eventoId)
    if (categoria === 'gol') await torneioApi.recalcularPlacar(torneioId, jogoId)
    await carregar()
  }

  async function escolherStatus(novo: string) {
    if (novo === jogo.status) return
    if (novo === 'encerrado') { setConfirmandoEncerrar(true); return }
    setSalvando(true); setErro(''); setAviso('')
    const r = await torneioApi.atualizarPartida(torneioId, jogoId, { status: novo })
    setSalvando(false)
    if (!r) { setErro('Não foi possível alterar o status.'); return }
    // Aviso não-bloqueante (ex.: já existe outra partida em_andamento) — nunca impede a ação.
    if (r.aviso) setAviso(r.aviso)
    onChange()
    await carregar()
  }

  function abrirCorrecaoPlacar() {
    setCorrA(placarA); setCorrB(placarB); setCorrigindo(true)
  }

  async function salvarCorrecaoPlacar() {
    setSalvando(true); setErro('')
    const r = await torneioApi.atualizarPartida(torneioId, jogoId, { placar_a: corrA, placar_b: corrB })
    setSalvando(false)
    if (!r) { setErro('Não foi possível corrigir o placar.'); return }
    setCorrigindo(false)
    await carregar()
  }

  async function encerrar() {
    if (eliminatoria && placarA === placarB) {
      setErro('Fase eliminatória: a partida não pode terminar empatada. Ajuste o placar (prorrogação/gol de ouro) antes de encerrar.')
      return
    }
    setSalvando(true); setErro('')
    const r = await torneioApi.atualizarPartida(torneioId, jogoId, { status: 'encerrado', placar_a: placarA, placar_b: placarB, overtime })
    setSalvando(false)
    if (!r) { setErro('Não foi possível encerrar a partida.'); return }
    setConfirmandoEncerrar(false)
    onChange()
    await carregar()
  }

  async function reabrir() {
    setSalvando(true); setErro('')
    const r = await torneioApi.atualizarPartida(torneioId, jogoId, { status: 'agendado' })
    setSalvando(false)
    if (!r) { setErro('Não foi possível reabrir a partida.'); return }
    onChange()
    await carregar()
  }

  async function simular() {
    setSalvando(true); setErro('')
    try {
      const r = await torneioApi.simularPartida(torneioId, jogoId)
      if (!r) throw new Error('Não foi possível simular esta partida.')
    } catch (e) {
      setErro(getErrorMessage(e))
    }
    setSalvando(false)
    onChange()
    await carregar()
  }

  return (
    <div className="adm-drawer-overlay" onClick={onClose}>
      <div className="adm-drawer" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="adm-drawer-header">
          <div>
            <h2>Súmula — {jogo.codigo}</h2>
            <p>{jogo.fase_rotulo}</p>
          </div>
          <button className="adm-drawer-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="adm-drawer-body">
          {erro && <div className="adm-badge adm-badge--err" style={{ display: 'block', padding: 10 }}>{erro}</div>}
          {aviso && <div className="trn-aviso">{aviso}</div>}

          <div className="trn-sumula-status-block">
            <span className={`trn-status-badge trn-status-badge--${jogo.status}`}>{STATUS_LABEL[jogo.status] ?? jogo.status}</span>
            {(jogo.status === 'agendado' || jogo.status === 'atrasado') && !semTimes && (
              <button className="adm-btn-primary adm-btn--sm" disabled={salvando} onClick={() => escolherStatus('em_andamento')}>▶ Iniciar partida</button>
            )}
          </div>
          {!encerrada && !semTimes && (
            <div className="trn-status-pills">
              {STATUS_PILLS.map(s => (
                <button key={s} className={`trn-status-pill ${jogo.status === s ? 'trn-status-pill--active' : ''}`}
                  disabled={salvando || jogo.status === s} onClick={() => escolherStatus(s)}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          )}

          <div className="trn-sumula-header">
            <div className="trn-sumula-team">{jogo.time_a_nome ?? 'a definir'}</div>
            <div className="trn-sumula-score">{placarA} × {placarB}</div>
            <div className="trn-sumula-team">{jogo.time_b_nome ?? 'a definir'}</div>
          </div>
          {placarDivergente && (
            <div className="trn-placar-aviso">Este placar não corresponde aos gols registrados na súmula.</div>
          )}

          {semTimes && <div className="trn-fp-hint" style={{ textAlign: 'center' }}>Times ainda não definidos — aguardando fase anterior.</div>}

          {!encerrada && !semTimes && (
            <div className="trn-sumula-cols">
              <TimeColuna nome={jogo.time_a_nome} elenco={elencoA} onGol={m => gol(jogo.time_a_id!, m, 'normal')} onFalta={m => falta(jogo.time_a_id!, m)}
                onSemAutoria={() => gol(jogo.time_a_id!, null, 'sem_autoria')} onGolContra={() => gol(jogo.time_a_id!, null, 'gol_contra')} />
              <TimeColuna nome={jogo.time_b_nome} elenco={elencoB} onGol={m => gol(jogo.time_b_id!, m, 'normal')} onFalta={m => falta(jogo.time_b_id!, m)}
                onSemAutoria={() => gol(jogo.time_b_id!, null, 'sem_autoria')} onGolContra={() => gol(jogo.time_b_id!, null, 'gol_contra')} />
            </div>
          )}

          <div>
            <div className="trn-sumula-col-title">Eventos</div>
            <div className="trn-events-list">
              {eventos.length === 0 && <div className="trn-fp-hint">Nenhum evento lançado ainda.</div>}
              {eventos.map(ev => (
                <div key={`${ev.categoria}-${ev.id}`} className="trn-event-item">
                  <span className="trn-event-time">{fmtHora(ev.quando)}</span>
                  <b>{descreveEvento(ev)}</b>
                  {!encerrada && (
                    <button className="trn-event-undo" onClick={() => desfazerEvento(ev.categoria, ev.id)}>desfazer</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {!encerrada && !semTimes && (
            <details className="trn-mais-acoes">
              <summary>Mais ações</summary>
              <div className="trn-mais-acoes-body">
                {!corrigindo && (
                  <button className="adm-btn adm-btn--sm" onClick={abrirCorrecaoPlacar}>Corrigir placar manualmente</button>
                )}
                {corrigindo && (
                  <div className="trn-corrigir-placar">
                    <input type="number" min={0} value={corrA} onChange={e => setCorrA(Number(e.target.value))} className="adm-select" style={{ width: 52, textAlign: 'center' }} />
                    ×
                    <input type="number" min={0} value={corrB} onChange={e => setCorrB(Number(e.target.value))} className="adm-select" style={{ width: 52, textAlign: 'center' }} />
                    <button className="adm-btn-primary adm-btn--sm" disabled={salvando} onClick={salvarCorrecaoPlacar}>Salvar correção</button>
                    <button className="adm-btn adm-btn--sm" onClick={() => setCorrigindo(false)}>Cancelar</button>
                  </div>
                )}
                <button className="adm-btn adm-btn--sm" onClick={() => torneioApi.recalcularPlacar(torneioId, jogoId).then(carregar)}>Recalcular dos gols</button>
                <button className="adm-btn adm-btn--sm" disabled={salvando} onClick={simular}>SIMULAR PARTIDA</button>
                {eliminatoria && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.78rem', color: 'var(--adm-text-2)' }}>
                    <input type="checkbox" checked={overtime} onChange={e => setOvertime(e.target.checked)} /> prorrogação/gol de ouro
                  </label>
                )}
              </div>
            </details>
          )}

          <div className="adm-drawer-actions">
            {!encerrada && !confirmandoEncerrar && (
              <button className="adm-btn-primary" onClick={() => setConfirmandoEncerrar(true)} disabled={semTimes}>ENCERRAR PARTIDA</button>
            )}
            {!encerrada && confirmandoEncerrar && (
              <div style={{ width: '100%' }}>
                <div className="trn-aviso" style={{ marginBottom: 10 }}>
                  Confirmar encerramento: <b>{jogo.time_a_nome} {placarA} × {placarB} {jogo.time_b_nome}</b>.
                  Isso recalcula automaticamente a classificação.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="adm-btn-primary" onClick={encerrar} disabled={salvando}>Confirmar encerramento</button>
                  <button className="adm-btn" onClick={() => setConfirmandoEncerrar(false)}>Cancelar</button>
                </div>
              </div>
            )}
            {encerrada && jogo.status === 'encerrado' && (
              <button className="adm-btn--danger adm-btn" onClick={reabrir} disabled={salvando}>Reabrir partida (corrigir erro)</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function descreveEvento(ev: SumulaData['eventos'][number]): string {
  if (ev.categoria === 'falta') return `${ev.atleta ?? '—'} — Falta`
  if (ev.tipo === 'gol_contra') return 'Gol contra'
  if (ev.tipo === 'sem_autoria') return 'Gol Outorgado'
  return `${ev.atleta ?? '—'} — Gol`
}

function TimeColuna({ nome, elenco, onGol, onFalta, onSemAutoria, onGolContra }: {
  nome: string | null
  elenco: SumulaData['elenco']
  onGol: (membroId: number) => void
  onFalta: (membroId: number) => void
  onSemAutoria: () => void
  onGolContra: () => void
}) {
  return (
    <div>
      <div className="trn-sumula-col-title">{nome}</div>
      {elenco.map(m => (
        <div key={m.membro_id} className="trn-player-btn">
          <span>{m.nome}</span>
          <span className="trn-player-btn-actions">
            <button className="trn-btn-gol" onClick={() => onGol(m.membro_id)}>+ GOL</button>
            <button className="trn-btn-falta" onClick={() => onFalta(m.membro_id)}>+ FALTA</button>
          </span>
        </div>
      ))}
      <div className="trn-sumula-extra-actions">
        <button className="adm-btn adm-btn--sm" onClick={onSemAutoria}>GOL OUTORGADO</button>
        <button className="adm-btn adm-btn--sm" onClick={onGolContra}>GOL CONTRA (a favor)</button>
      </div>
    </div>
  )
}
