import { useState } from 'react'
import type { StandingRowPublico } from '../../services/torneioPublico'
import { BuchholzHeaderInfo, BuchholzValor, TiebreakTag } from './BuchholzInfo'
import './classificacaoTable.css'
import { useTournamentCategory } from '../../contexts/TournamentContext'

interface Props {
  linhas: StandingRowPublico[]
  classificadosDiretos: number
  criterios: { chave: string; label: string }[]
  onAbrirTime: (timeId: number) => void
}

/**
 * Tabela completa da Primeira Fase — classificação + Buchholz explicado + indicador de
 * desempate (genérico, qualquer critério) + corte de classificação, tudo em cima de
 * `calcularClassificacao()` (lib.php), sem recálculo no front. PONTOS é a primeira coluna
 * estatística (logo após o time) e tem hierarquia tipográfica maior — é a informação
 * principal da classificação (ajustes cirúrgicos: seções 9/10/15). Desktop: tabela cheia.
 * Mobile: linha compacta (POS/TIME/PTS) com detalhe expansível, pra evitar scroll
 * horizontal.
 */
export default function ClassificacaoTable({ linhas, classificadosDiretos, criterios, onAbrirTime }: Props) {
  const categoria = useTournamentCategory()
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set())
  const labelPorChave = new Map(criterios.map(c => [c.chave, c.label]))

  function alternar(timeId: number) {
    setExpandidos(prev => {
      const next = new Set(prev)
      if (next.has(timeId)) next.delete(timeId); else next.add(timeId)
      return next
    })
  }

  return (
    <div className="ctb-wrap">
      <div className="ctb-legenda">
        <span className="ctb-legenda-item"><i className="ctb-dot ctb-dot--direto" /> `Classificados direto (1º–${classificadosDiretos}º)`</span>
        {categoria === 'misto' && <span className="ctb-legenda-item"><i className="ctb-dot ctb-dot--rep" /> Repescagem</span>}
      </div>

      {/* Desktop */}
      <table className="ctb-table ctb-desktop">
        <thead>
          <tr>
            <th>#</th><th>Time</th><th className="ctb-pts-header">PTS</th>
            <th>J</th><th>V</th><th>E</th><th>D</th>
            <th>GP</th><th>GC</th><th>SG</th>
            <th><BuchholzHeaderInfo /></th><th>Fair Play</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((r, i) => (
            <LinhaDesktop
              key={r.time_id} row={r} abaixo={i < linhas.length - 1 ? linhas[i + 1] : null}
              labelPorChave={labelPorChave}
              onAbrirTime={onAbrirTime}
            />
          ))}
        </tbody>
      </table>

      {/* Mobile */}
      <div className="ctb-mobile">
        {linhas.map((r, i) => (
          <div key={r.time_id}>
            <div className={`ctb-card ${r.classificado_direto ? 'ctb-card--direto' : 'ctb-card--rep'}`}>
              <button className="ctb-card-linha" onClick={() => alternar(r.time_id)}>
                <span className="ctb-card-pos">{r.posicao}</span>
                <span className="ctb-card-nome" onClick={e => { e.stopPropagation(); onAbrirTime(r.time_id) }}>{r.nome}</span>
                <span className="ctb-card-pts"><b>{r.pontos}</b></span>
                <span className="ctb-card-toggle">{expandidos.has(r.time_id) ? '▾' : '▸'}</span>
              </button>
              {i < linhas.length - 1 && r.decisao && (
                <div className="ctb-card-tiebreak">
                  <TiebreakTag criterio={r.decisao} label={labelPorChave.get(r.decisao) ?? r.decisao} row={r} abaixo={linhas[i + 1]} />
                </div>
              )}
              {expandidos.has(r.time_id) && (
                <div className="ctb-card-detalhe">
                  <div><span>J</span><b>{r.j}</b></div>
                  <div><span>V</span><b>{r.v}</b></div>
                  <div><span>E</span><b>{r.e}</b></div>
                  <div><span>D</span><b>{r.d}</b></div>
                  <div><span>GP</span><b>{r.gp}</b></div>
                  <div><span>GC</span><b>{r.gc}</b></div>
                  <div><span>SG</span><b>{r.sg > 0 ? `+${r.sg}` : r.sg}</b></div>
                  <div><span>Fair Play</span><b>{r.faltas}</b></div>
                  <div className="ctb-card-buchholz"><span>Buchholz</span><BuchholzValor valor={r.buchholz} detalhe={r.buchholz_detalhe} /></div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function LinhaDesktop({ row, abaixo, labelPorChave, onAbrirTime }: {
  row: StandingRowPublico; abaixo: StandingRowPublico | null
  labelPorChave: Map<string, string>; onAbrirTime: (timeId: number) => void
}) {
  return (
    <tr className={row.classificado_direto ? 'ctb-row--direto' : 'ctb-row--rep'}>
        <td>{row.posicao}</td>
        <td className="ctb-nome-cell">
          <button className="ctb-nome-link" onClick={() => onAbrirTime(row.time_id)}>{row.nome}</button>
          {abaixo && row.decisao && (
            <TiebreakTag criterio={row.decisao} label={labelPorChave.get(row.decisao) ?? row.decisao} row={row} abaixo={abaixo} />
          )}
        </td>
        <td className="ctb-pts-cell"><b>{row.pontos}</b></td>
        <td>{row.j}</td><td>{row.v}</td><td>{row.e}</td><td>{row.d}</td>
        <td>{row.gp}</td><td>{row.gc}</td><td>{row.sg > 0 ? `+${row.sg}` : row.sg}</td>
        <td><BuchholzValor valor={row.buchholz} detalhe={row.buchholz_detalhe} /></td>
        <td>{row.faltas}</td>
    </tr>
  )
}
