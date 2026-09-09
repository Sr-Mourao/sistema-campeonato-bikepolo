import { Fragment, useState, useEffect, useCallback } from 'react'
import { torneioApi, criterioLabel, criterioDirecao, type StandingRow, type TorneioDetalhe } from './torneioApi'

interface Props {
  torneio: TorneioDetalhe
}

export default function Classificacao({ torneio }: Props) {
  const [classificacao, setClassificacao] = useState<StandingRow[] | null>(null)
  const [expandido, setExpandido] = useState<number | null>(null)

  const carregar = useCallback(async () => {
    const r = await torneioApi.estatisticas(torneio.id)
    if (r) setClassificacao(r.classificacao)
  }, [torneio.id])

  useEffect(() => { carregar() }, [carregar])

  const diretos = torneio.classificados_diretos

  return (
    <div>
      <div className="adm-card" style={{ marginBottom: 16 }}>
        <h3>Critérios de classificação atuais</h3>
        <ol style={{ margin: '10px 0 0', paddingLeft: 20, color: 'var(--adm-text)', fontSize: '.88rem' }}>
          {torneio.criterios.map(c => <li key={c}>{criterioLabel(c)} <span className="trn-fp-hint">{criterioDirecao(c)}</span></li>)}
        </ol>
        <p className="trn-fp-hint" style={{ marginTop: 10 }}>Pra reordenar os critérios, vá em Configurações.</p>
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Pos</th><th>Time</th><th>J</th><th>V</th><th>E</th><th>D</th>
              <th>GP</th><th>GC</th><th>SG</th><th>Faltas</th><th>Pts</th>
            </tr>
          </thead>
          <tbody>
            {classificacao === null && <tr><td colSpan={11}>Carregando…</td></tr>}
            {classificacao?.map((row, i) => {
              const corte = i === diretos // linha divisória logo após o último classificado direto
              return (
                <Fragment key={row.time_id}>
                  {corte && (
                    <tr key="corte"><td colSpan={11} style={{ background: 'var(--adm-surface-3)', textAlign: 'center', fontSize: '.72rem', color: 'var(--adm-text-2)', fontWeight: 700 }}>
                      ↑ CLASSIFICADOS DIRETO · REPESCAGEM ↓
                    </td></tr>
                  )}
                  <tr className="adm-row-clickable" onClick={() => setExpandido(expandido === row.time_id ? null : row.time_id)}>
                    <td>{row.posicao}</td>
                    <td>{row.nome}</td>
                    <td>{row.j}</td><td>{row.v}</td><td>{row.e}</td><td>{row.d}</td>
                    <td>{row.gp}</td><td>{row.gc}</td><td>{row.sg > 0 ? `+${row.sg}` : row.sg}</td>
                    <td>{row.faltas}</td><td><b>{row.pontos}</b></td>
                  </tr>
                  {expandido === row.time_id && (
                    <tr><td colSpan={11} className="trn-standings-row-expand">{row.decisao ?? 'Posição por ordem natural (líder ou empate total nos critérios).'}</td></tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
