import { useState, useEffect } from 'react'
import { torneioPublico, type ArtilheiroPublico, type FairPlayPublico, type FaltaIndividualPublico } from '../../services/torneioPublico'
import { useTournamentCategory } from '../../contexts/TournamentContext'

/**
 * Estatísticas (seção 13 do brief de área pública) — Artilharia e Fair Play (+ faltas
 * individuais) unificados num único menu, em vez de duas abas principais separadas.
 */
export default function Estatisticas() {
  const categoria = useTournamentCategory()
  const [artilharia, setArtilharia] = useState<ArtilheiroPublico[] | null>(null)
  const [fairPlay, setFairPlay] = useState<FairPlayPublico[] | null>(null)
  const [faltas, setFaltas] = useState<FaltaIndividualPublico[] | null>(null)

  useEffect(() => {
    torneioPublico.artilharia(categoria, 'torneio').then(d => setArtilharia(d.artilharia))
    torneioPublico.fairplay(categoria, 'torneio').then(d => setFairPlay(d.fair_play))
    torneioPublico.faltasIndividuais(categoria, 'torneio').then(d => setFaltas(d.faltas_individuais))
  }, [categoria])

  return (
    <section className="est-grid">
      <div>
        <h3 className="trp-section-title">Artilharia</h3>
        <div className="trp-table-wrap">
          <table className="trp-table">
            <thead><tr><th>#</th><th>Atleta</th><th>Time</th><th>Gols</th></tr></thead>
            <tbody>
              {artilharia === null && <tr><td colSpan={4}>Carregando…</td></tr>}
              {artilharia?.length === 0 && <tr><td colSpan={4}>Nenhum gol registrado ainda.</td></tr>}
              {artilharia?.map(a => <tr key={`${a.atleta}-${a.time_nome}`}><td>{a.posicao}</td><td>{a.atleta}</td><td>{a.time_nome}</td><td><b>{a.gols}</b></td></tr>)}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="trp-section-title">Fair Play</h3>
        <p className="trp-hint" style={{ marginBottom: 10 }}>Menos faltas = melhor posição.</p>
        <div className="trp-table-wrap">
          <table className="trp-table">
            <thead><tr><th>#</th><th>Time</th><th>Jogos</th><th>Faltas</th><th>Média</th></tr></thead>
            <tbody>
              {fairPlay === null && <tr><td colSpan={5}>Carregando…</td></tr>}
              {fairPlay?.map(f => <tr key={f.nome}><td>{f.posicao}</td><td>{f.nome}</td><td>{f.jogos}</td><td><b>{f.faltas}</b></td><td>{f.media}</td></tr>)}
            </tbody>
          </table>
        </div>

        {faltas && faltas.length > 0 && (
          <details className="est-faltas-individuais">
            <summary>Faltas individuais</summary>
            <div className="trp-table-wrap" style={{ marginTop: 10 }}>
              <table className="trp-table">
                <thead><tr><th>Atleta</th><th>Time</th><th>Faltas</th></tr></thead>
                <tbody>
                  {faltas.map(f => <tr key={f.membro_id}><td>{f.atleta}</td><td>{f.time_nome}</td><td><b>{f.faltas}</b></td></tr>)}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </div>
    </section>
  )
}
