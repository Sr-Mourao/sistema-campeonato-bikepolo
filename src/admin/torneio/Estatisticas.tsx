import { useState, useEffect, useCallback } from 'react'
import { torneioApi, type Estatisticas as EstatisticasData, type TorneioDetalhe } from './torneioApi'

interface Props { torneio: TorneioDetalhe }

export default function Estatisticas({ torneio }: Props) {
  const torneioId = torneio.id
  const [dados, setDados] = useState<EstatisticasData | null>(null)
  const [escopo, setEscopo] = useState<'classificatoria' | 'torneio'>('torneio')

  useEffect(() => setEscopo('torneio'), [torneio.id])

  const carregar = useCallback(async () => {
    const r = await torneioApi.estatisticas(torneioId, escopo)
    if (r) setDados(r)
  }, [torneioId, escopo])

  useEffect(() => { carregar() }, [carregar])

  return (
    <div>
      <div className="adm-filter-chips" style={{ marginBottom: 16 }}>
        <button className={`adm-chip ${escopo === 'classificatoria' ? 'adm-chip--active' : ''}`} onClick={() => setEscopo('classificatoria')}>{torneio.formato === 'mtnb_round_robin_5' ? 'Primeira Fase (todos contra todos)' : 'Classificatória (Suíço + Equalização)'}</button>
        <button className={`adm-chip ${escopo === 'torneio' ? 'adm-chip--active' : ''}`} onClick={() => setEscopo('torneio')}>Torneio inteiro</button>
      </div>

      {!dados ? <div style={{ color: 'var(--adm-text-2)' }}>Carregando…</div> : (
        <div className="adm-section-row">
          <div className="adm-card">
            <h3>Artilharia</h3>
            <table className="adm-table-mini">
              <thead><tr><th>#</th><th>Atleta</th><th>Time</th><th>Gols</th></tr></thead>
              <tbody>
                {dados.artilharia.length === 0 && <tr><td colSpan={4}>Nenhum gol registrado ainda.</td></tr>}
                {dados.artilharia.map(a => (
                  <tr key={a.membro_id}><td>{a.posicao}</td><td>{a.atleta}</td><td>{a.time_nome}</td><td><b>{a.gols}</b></td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="adm-card">
            <h3>Fair Play por time <span className="trn-fp-hint">(menos faltas = melhor)</span></h3>
            <table className="adm-table-mini">
              <thead><tr><th>#</th><th>Time</th><th>Jogos</th><th>Faltas</th><th>Média</th></tr></thead>
              <tbody>
                {dados.fair_play.map(f => (
                  <tr key={f.time_id}><td>{f.posicao}</td><td>{f.nome}</td><td>{f.jogos}</td><td><b>{f.faltas}</b></td><td>{f.media}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="adm-card">
            <h3>Faltas individuais</h3>
            <table className="adm-table-mini">
              <thead><tr><th>Atleta</th><th>Time</th><th>Faltas</th></tr></thead>
              <tbody>
                {dados.faltas_individuais.length === 0 && <tr><td colSpan={3}>Nenhuma falta registrada ainda.</td></tr>}
                {dados.faltas_individuais.map(f => (
                  <tr key={f.membro_id}><td>{f.atleta}</td><td>{f.time_nome}</td><td><b>{f.faltas}</b></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
