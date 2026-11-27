import { useState, useEffect, useCallback } from 'react'
import { torneioPublico, type TorneioResumo, type StandingRowPublico, type JogoPublico } from '../../services/torneioPublico'
import ClassificacaoTable from '../../components/torneio/ClassificacaoTable'
import PartidaHistoricoModal from '../../components/torneio/PartidaHistoricoModal'
import { CRITERIO_EXPLICACAO } from '../../components/torneio/criteriosMeta'
import { useTournamentCategory } from '../../contexts/TournamentContext'
import { formatoDe } from '../../services/formatoTorneio'

const STATUS_LABEL: Record<string, string> = {
  agendado: 'Agendado', atrasado: 'Atrasado', chamado: 'Chamado', em_andamento: 'Ao vivo',
  encerrado: 'Encerrada', wo: 'W.O.', cancelado: 'Cancelado',
}

interface Props {
  resumo: TorneioResumo
  onAbrirTime: (timeId: number) => void
}

/**
 * Primeira Fase (seções 4-9 do brief de área pública) — classificação completa e jogos
 * convivendo na mesma página (referência: página de campeonato do Brasileirão). Desktop:
 * duas colunas. Mobile: fluxo vertical. Equalização é só mais uma etapa desta mesma tela.
 */
export default function PrimeiraFase({ resumo, onAbrirTime }: Props) {
  const categoria = useTournamentCategory()
  const [rows, setRows] = useState<StandingRowPublico[] | null>(null)
  useEffect(() => { torneioPublico.classificacao(categoria).then(d => setRows(d.classificacao)) }, [categoria])

  const etapas = resumo.fases.filter(f => f.tipo === 'swiss' || f.tipo === 'round_robin' || f.tipo === 'equalizacao')
  // Todos contra todos: as rodadas nascem juntas, então abre na primeira ainda em aberto.
  const ultima = (etapas.some(f => f.tipo === 'round_robin') ? etapas.find(f => f.estado === 'confirmada' && !f.completa) : null)
    ?? [...etapas].reverse().find(f => f.estado === 'confirmada') ?? etapas[0] ?? null
  const [etapaKey, setEtapaKey] = useState<string | null>(ultima ? `${ultima.tipo}-${ultima.rodada}` : null)
  const etapaAtiva = etapas.find(f => `${f.tipo}-${f.rodada}` === etapaKey) ?? ultima
  const idxEtapa = etapaAtiva ? etapas.indexOf(etapaAtiva) : -1

  const [jogos, setJogos] = useState<JogoPublico[] | null>(null)
  const [historico, setHistorico] = useState<string | null>(null)

  const carregar = useCallback(() => {
    if (!etapaAtiva) { setJogos([]); return }
    torneioPublico.jogos(categoria, etapaAtiva.tipo === 'equalizacao' ? { fase_tipo: 'equalizacao' } : { fase_tipo: etapaAtiva.tipo, rodada: etapaAtiva.rodada ?? undefined }).then(d => setJogos(d.jogos))
  }, [etapaAtiva?.tipo, etapaAtiva?.rodada, categoria]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { carregar() }, [carregar])

  function irPara(delta: number) {
    if (idxEtapa < 0) return
    const nova = etapas[idxEtapa + delta]
    if (nova) setEtapaKey(`${nova.tipo}-${nova.rodada}`)
  }

  return (
    <section className="pf-grid">
      <div className="pf-col-classificacao">
        <h3 className="trp-section-title">Classificação</h3>
        {rows === null ? (
          <p className="trp-hint">Carregando…</p>
        ) : (
          <ClassificacaoTable
            linhas={rows} classificadosDiretos={resumo.torneio.classificados_diretos}
            criterios={resumo.criterios} onAbrirTime={onAbrirTime}
            comRepescagem={formatoDe(resumo.torneio).repescagem}
          />
        )}

        <h4 className="pf-criterios-title">Critérios de desempate</h4>
        <ol className="pf-criterios-lista">
          {resumo.criterios.map(c => (
            <li key={c.chave}>
              <b>{c.label}</b>
              {CRITERIO_EXPLICACAO[c.chave] && <span> — {CRITERIO_EXPLICACAO[c.chave]}</span>}
            </li>
          ))}
        </ol>
      </div>

      <div className="pf-col-jogos">
        <h3 className="trp-section-title">Jogos</h3>

        {etapas.length > 1 && etapaAtiva && (
          <div className="pf-rodada-nav">
            <button className="pf-rodada-seta" onClick={() => irPara(-1)} disabled={idxEtapa <= 0} aria-label="Etapa anterior">←</button>
            <select className="pf-rodada-select" value={etapaKey ?? ''} onChange={e => setEtapaKey(e.target.value)}>
              {etapas.map(f => (
                <option key={`${f.tipo}-${f.rodada}`} value={`${f.tipo}-${f.rodada}`}>
                  {f.tipo === 'equalizacao' ? 'Equalização' : `Rodada ${f.rodada} de ${etapas.filter(e => e.tipo === f.tipo).length}`}
                </option>
              ))}
            </select>
            <button className="pf-rodada-seta" onClick={() => irPara(1)} disabled={idxEtapa >= etapas.length - 1} aria-label="Próxima etapa">→</button>
          </div>
        )}

        {etapaAtiva && (
          <p className="trp-hint" style={{ marginBottom: 12 }}>
            {etapaAtiva.tipo === 'equalizacao' ? 'Equalização' : `Rodada ${etapaAtiva.rodada}`} — {etapaAtiva.completa ? 'Encerrada' : etapaAtiva.estado === 'confirmada' ? 'Em andamento' : 'Aguardando'}
          </p>
        )}

        <div className="trp-games">
          {jogos === null && <p className="trp-hint">Carregando…</p>}
          {jogos?.length === 0 && <p className="trp-hint">Nenhum jogo nesta etapa.</p>}
          {jogos?.map(j => {
            const clicavel = !j.is_bye && j.status === 'encerrado'
            const Tag = clicavel ? 'button' : 'div'
            return (
              <Tag key={j.codigo} className={`trp-game-card ${j.is_bye ? 'trp-game-card--bye' : ''} ${clicavel ? 'trp-game-card--clicavel' : ''}`}
                onClick={clicavel ? () => setHistorico(j.codigo) : undefined}>
                {j.is_bye ? (
                  <div className="trp-game-bye">BYE — {j.time_a_nome}</div>
                ) : (
                  <>
                    <div className="trp-game-row"><span>{j.time_a_nome}</span><span>{j.placar_a ?? '–'}</span></div>
                    <div className="trp-game-row"><span>{j.time_b_nome}</span><span>{j.placar_b ?? '–'}</span></div>
                  </>
                )}
                <div className="trp-game-meta">{j.codigo} · {STATUS_LABEL[j.status] ?? j.status}</div>
              </Tag>
            )
          })}
        </div>

        {historico && <PartidaHistoricoModal codigo={historico} onClose={() => setHistorico(null)} />}
      </div>
    </section>
  )
}
