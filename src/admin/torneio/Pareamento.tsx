import { useState, useEffect, useCallback } from 'react'
import { torneioApi, type ParPareamento, type TorneioDetalhe } from './torneioApi'

interface Props {
  torneio: TorneioDetalhe
  tipo: 'swiss' | 'equalizacao'
  rodada?: number // obrigatório se tipo === 'swiss'
  onConfirmado: () => void
  onCancelar: () => void
}

export default function Pareamento({ torneio, tipo, rodada, onConfirmado, onCancelar }: Props) {
  const [bye, setBye] = useState<{ time_id: number; nome: string | null; motivo: string } | null>(null)
  const [pares, setPares] = useState<ParPareamento[]>([])
  const [avisos, setAvisos] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmando, setConfirmando] = useState(false)
  const [erro, setErro] = useState('')

  const todosOsTimes = torneio.participantes.map(p => ({ id: p.time_id, nome: p.nome }))

  const carregar = useCallback(async (byeOverride?: number) => {
    setLoading(true); setErro('')
    if (tipo === 'swiss' && rodada) {
      const s = await torneioApi.sugerirSwiss(torneio.id, rodada, byeOverride ? { bye_time_id: byeOverride } : undefined)
      if (s) { setBye(s.bye); setPares(s.pares); setAvisos(s.avisos) }
      else setErro('Não foi possível gerar a sugestão de pareamento.')
    } else if (tipo === 'equalizacao') {
      const s = await torneioApi.sugerirEqualizacao(torneio.id)
      if (s) { setBye(null); setPares(s.pares); setAvisos(s.avisos) }
      else setErro('Não foi possível gerar a sugestão de equalização.')
    }
    setLoading(false)
  }, [torneio.id, tipo, rodada])

  useEffect(() => { carregar() }, [carregar])

  function trocarTime(index: number, lado: 'time_a_id' | 'time_b_id', novoId: number) {
    setPares(prev => prev.map((p, i) => i === index ? { ...p, [lado]: novoId } : p))
  }

  // Validação client-side em tempo real (o backend revalida de qualquer forma antes de confirmar)
  const idsUsados = pares.flatMap(p => [p.time_a_id, p.time_b_id])
  const duplicados = idsUsados.filter((id, i) => idsUsados.indexOf(id) !== i)
  const byeTambemPareado = bye ? idsUsados.includes(bye.time_id) : false
  const problemasEdicao: string[] = []
  if (duplicados.length) problemasEdicao.push('⚠ Há um time aparecendo em mais de um confronto — corrija antes de confirmar.')
  if (byeTambemPareado) problemasEdicao.push('⚠ O time do bye também está pareado em um jogo — corrija antes de confirmar.')

  async function confirmar() {
    if (problemasEdicao.length) return
    setConfirmando(true); setErro('')
    let ok = false
    if (tipo === 'swiss' && rodada && bye) {
      const r = await torneioApi.confirmarSwiss(torneio.id, rodada, bye, pares)
      ok = !!r
    } else if (tipo === 'equalizacao') {
      const r = await torneioApi.confirmarEqualizacao(torneio.id, pares)
      ok = !!r
    }
    setConfirmando(false)
    if (ok) onConfirmado()
    else setErro('Não foi possível confirmar — reveja os avisos acima.')
  }

  return (
    <div className="adm-card">
      <h3>{tipo === 'swiss' ? `Rodada ${rodada} — pareamento sugerido` : 'Equalização — pareamento sugerido'}</h3>

      {loading && <div style={{ color: 'var(--adm-text-2)', padding: 12 }}>Calculando…</div>}
      {erro && <div className="adm-badge adm-badge--err" style={{ display: 'block', padding: 10, marginBottom: 10 }}>{erro}</div>}

      {!loading && (
        <>
          {(avisos.length > 0 || problemasEdicao.length > 0) && (
            <div className="trn-avisos">
              {avisos.map((a, i) => <div key={`s${i}`} className="trn-aviso">{a}</div>)}
              {problemasEdicao.map((a, i) => <div key={`e${i}`} className="trn-aviso">{a}</div>)}
            </div>
          )}

          <div className="trn-pareamento-list">
            {pares.map((par, i) => (
              <div key={i} className={`trn-pareamento-card ${par.rematch ? 'trn-pareamento-card--warn' : ''}`}>
                <div className="trn-pareamento-teams">
                  <select className="adm-select" value={par.time_a_id} onChange={e => trocarTime(i, 'time_a_id', Number(e.target.value))}>
                    {todosOsTimes.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                  <span>×</span>
                  <select className="adm-select" value={par.time_b_id} onChange={e => trocarTime(i, 'time_b_id', Number(e.target.value))}>
                    {todosOsTimes.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                </div>
                <div className="trn-pareamento-motivos">
                  {par.motivos.map((m, j) => <span key={j}>{m}</span>)}
                </div>
              </div>
            ))}

            {bye && (
              <div className="trn-pareamento-card">
                <div className="trn-pareamento-teams">
                  <span style={{ color: 'var(--adm-text-3)', fontWeight: 700 }}>BYE</span>
                  <select className="adm-select" value={bye.time_id} onChange={e => carregar(Number(e.target.value))}>
                    {todosOsTimes.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                </div>
                <div className="trn-pareamento-motivos"><span>{bye.motivo}</span></div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className="adm-btn" onClick={() => carregar()}>REGERAR</button>
            <button className="adm-btn-primary" onClick={confirmar} disabled={confirmando || problemasEdicao.length > 0}>
              {confirmando ? 'Confirmando…' : (tipo === 'swiss' ? `CONFIRMAR RODADA ${rodada}` : 'CONFIRMAR EQUALIZAÇÃO')}
            </button>
            <button className="adm-btn" onClick={onCancelar}>Cancelar</button>
          </div>
        </>
      )}
    </div>
  )
}
