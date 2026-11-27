import { useState, useEffect, useCallback, useMemo } from 'react'
import { torneioApi, type TorneioDetalhe, type Jogo, type Fase } from './torneioApi'
import Pareamento from './Pareamento'
import Sumula from './Sumula'
import { formatoDe, jogosPorRodada } from '../../services/formatoTorneio'

interface Props {
  torneio: TorneioDetalhe
  onChange: () => void
}

const STATUS_LABEL: Record<string, string> = {
  agendado: 'Agendado', atrasado: 'Atrasado', chamado: 'Chamado', em_andamento: 'Em andamento',
  encerrado: 'Encerrada', wo: 'W.O.', cancelado: 'Cancelado',
}

interface Slot {
  key: string
  label: string
  tipo: 'swiss' | 'round_robin' | 'equalizacao'
  rodada: number | null
  fase: Fase | null // null = ainda não gerada
}

export default function TorneioDashboard({ torneio, onChange }: Props) {
  const formato = formatoDe(torneio)
  // Todos contra todos (MTNB de 5 ou 2° Pior de 8): rodadas fixas, sem pareamento manual.
  const roundRobin = formato.primeira_fase === 'round_robin'
  const totalRodadasRR = formato.rodadas
  const [jogos, setJogos] = useState<Jogo[] | null>(null)
  const [jogoAberto, setJogoAberto] = useState<number | null>(null)
  const [mostrarPareamento, setMostrarPareamento] = useState(false)
  const [acaoEmCurso, setAcaoEmCurso] = useState(false)
  const [erro, setErro] = useState('')
  const [simulacaoLog, setSimulacaoLog] = useState<string[]>([])

  // Todas as rodadas suíças (geradas ou não) + equalização — navegação nunca esconde o passado.
  const slots: Slot[] = useMemo(() => {
    const s: Slot[] = []
    if (roundRobin) {
      for (let r = 1; r <= totalRodadasRR; r++) {
        const fase = torneio.fases.find(f => f.tipo === 'round_robin' && f.rodada === r) ?? null
        s.push({ key: `round-robin-${r}`, label: `R${r}`, tipo: 'round_robin', rodada: r, fase })
      }
      return s
    }
    for (let r = 1; r <= torneio.rodadas_swiss; r++) {
      const fase = torneio.fases.find(f => f.tipo === 'swiss' && f.rodada === r) ?? null
      s.push({ key: `swiss-${r}`, label: `R${r}`, tipo: 'swiss', rodada: r, fase })
    }
    if (torneio.equalizacao_habilitada) {
      const fase = torneio.fases.find(f => f.tipo === 'equalizacao') ?? null
      s.push({ key: 'equalizacao', label: 'Equalização', tipo: 'equalizacao', rodada: null, fase })
    }
    return s
  }, [torneio.fases, torneio.rodadas_swiss, torneio.equalizacao_habilitada, roundRobin, totalRodadasRR])

  const slotsGerados = slots.filter(s => s.fase)
  const ultimoGerado = (roundRobin ? slotsGerados.find(s => !s.fase?.completa) : null) ?? slotsGerados[slotsGerados.length - 1] ?? null

  const [slotViewKey, setSlotViewKey] = useState<string | null>(null)
  const slotAtual = slots.find(s => s.key === slotViewKey) ?? ultimoGerado ?? slots[0]

  // Se a rodada mais recente mudou (nova rodada gerada), passa a exibir ela por padrão.
  useEffect(() => {
    if (ultimoGerado && slotViewKey === null) setSlotViewKey(ultimoGerado.key)
  }, [ultimoGerado, slotViewKey])

  const swissConfirmadas = torneio.fases.filter(f => f.tipo === 'swiss' && f.estado === 'confirmada')
  const swissFinalizadas = torneio.fases.filter(f => f.tipo === 'swiss' && f.completa)
  // "completo" = todas as rodadas geradas E cada uma delas com todas as partidas reais
  // encerradas — nunca basta o pareamento ter sido publicado (ver seção 2 do brief de acabamento).
  const swissCompleto = swissFinalizadas.length >= torneio.rodadas_swiss
  const ultimaRodadaPublicada = torneio.fases.some(f => f.tipo === 'swiss' && f.rodada === torneio.rodadas_swiss)
  const proximaRodadaSwiss = swissConfirmadas.length + 1
  const faseEqualizacao = torneio.fases.find(f => f.tipo === 'equalizacao')
  const faseRepescagem = torneio.fases.find(f => f.tipo === 'repescagem')
  const faseDouble = torneio.fases.find(f => f.tipo === 'double')
  const roundRobinFases = torneio.fases.filter(f => f.tipo === 'round_robin')
  const roundRobinCompleto = roundRobinFases.length === totalRodadasRR && roundRobinFases.every(f => f.completa)

  const carregarJogos = useCallback(async () => {
    if (!slotAtual?.fase) { setJogos([]); return }
    const r = await torneioApi.jogos(torneio.id, { fase_tipo: slotAtual.tipo, rodada: slotAtual.rodada ?? undefined })
    if (r) setJogos(r.jogos)
  }, [torneio.id, slotAtual])

  useEffect(() => { carregarJogos() }, [carregarJogos])

  const jogosReais = (jogos ?? []).filter(j => !j.is_bye)
  const faseEncerrada = slotAtual?.fase?.completa ?? false // fonte canônica (backend), não deriva dos jogos carregados no front
  const faseVistaEhAUltima = slotAtual?.key === ultimoGerado?.key
  const rodadaEncerrada = faseEncerrada && faseVistaEhAUltima // só habilita "gerar próxima" quando a ÚLTIMA está fechada
  // A fila não é derivada da coluna visual da bracket. O mesmo resolvedor canônico
  // usado pelo placar/overlays entrega o código que está em foco operacional agora.
  const proximoJogo = faseVistaEhAUltima ? jogosReais.find(j => j.codigo === torneio.jogo_destaque_codigo) : undefined
  const temPendentes = jogosReais.some(j => j.status !== 'encerrado' && j.status !== 'cancelado' && j.time_a_id !== null && j.time_b_id !== null)

  async function acao(fn: () => Promise<unknown>) {
    setAcaoEmCurso(true); setErro('')
    try { await fn(); onChange(); await carregarJogos() }
    catch { setErro('Ação falhou.') }
    setAcaoEmCurso(false)
  }

  async function simularPendentes() {
    if (!slotAtual?.fase) return
    const jogoComFase = (jogos ?? []).find(j => !j.is_bye)
    if (!jogoComFase) return
    setAcaoEmCurso(true); setErro(''); setSimulacaoLog([])
    const r = await torneioApi.simularPartidasPendentes(torneio.id, jogoComFase.fase_id)
    setAcaoEmCurso(false)
    if (r) {
      setSimulacaoLog(r.log)
      if (roundRobin && slotAtual?.rodada && slotAtual.rodada < totalRodadasRR) setSlotViewKey(`round-robin-${slotAtual.rodada + 1}`)
      onChange(); await carregarJogos()
    }
    else setErro('Não foi possível simular as partidas pendentes desta rodada.')
  }

  return (
    <div>
      {torneio.multiplas_em_andamento && (
        <div className="trn-aviso" style={{ marginBottom: 12 }}>
          Atenção: há mais de uma partida marcada como <b>Em andamento</b> ao mesmo tempo ({torneio.jogos_em_andamento.join(', ')}).
          A página pública mostra a de início mais recente — confira se isso é intencional.
        </div>
      )}
      <div className="trn-hero">
        <div className="trn-hero-top">
          <div>
            <div className="trn-hero-fase">{torneio.estado.replace(/_/g, ' ')}</div>
            <div className="trn-hero-titulo">
              {slotAtual?.fase ? slotAtual.fase.rotulo : (slotAtual ? `${slotAtual.label} (ainda não gerada)` : torneio.nome)}
              {slotAtual?.fase && !faseVistaEhAUltima && <span className="trn-fp-hint" style={{ marginLeft: 8 }}>— visualizando rodada anterior</span>}
            </div>
          </div>
          {proximoJogo && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '.72rem', color: 'var(--adm-text-3)', textTransform: 'uppercase' }}>Próximo jogo</div>
              <div style={{ fontWeight: 800, color: 'var(--adm-text)' }}>{proximoJogo.time_a_nome} × {proximoJogo.time_b_nome}</div>
              <button className="adm-btn-primary adm-btn--sm" style={{ marginTop: 6 }} onClick={() => setJogoAberto(proximoJogo.id)}>ABRIR SÚMULA</button>
            </div>
          )}
        </div>

        {/* Navegação — todas as rodadas da fase, geradas ou não (seção 8: nunca esconder o histórico) */}
        <div className="trn-round-nav">
          {slots.map(s => (
            <button
              key={s.key}
              className={`trn-round-tab ${slotViewKey === s.key ? 'trn-round-tab--active' : ''} ${!s.fase ? 'trn-round-tab--disabled' : ''}`}
              disabled={!s.fase}
              onClick={() => setSlotViewKey(s.key)}
              title={s.fase ? s.fase.rotulo : `${s.label} — ainda não gerada`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {jogos && jogos.length > 0 && (
          <div className="trn-round-board">
            {jogos.map(j => (
              <div
                key={j.id}
                className={`trn-match-card ${j.is_bye ? 'trn-match-card--bye' : ''} ${j.status === 'em_andamento' ? 'trn-match-card--live' : ''} ${j.status === 'encerrado' ? 'trn-match-card--done' : ''}`}
                onClick={() => !j.is_bye && setJogoAberto(j.id)}
              >
                {j.is_bye ? (
                  <div className="trn-match-row"><span>BYE — {j.time_a_nome}</span></div>
                ) : (
                  <>
                    <div className="trn-match-row">
                      <span className={`trn-match-team ${j.vencedor_time_id === j.time_a_id ? 'trn-match-team--winner' : ''}`}>{j.time_a_nome ?? 'a definir'}</span>
                      <span className="trn-match-score">{j.placar_a ?? '–'}</span>
                    </div>
                    <div className="trn-match-row">
                      <span className={`trn-match-team ${j.vencedor_time_id === j.time_b_id ? 'trn-match-team--winner' : ''}`}>{j.time_b_nome ?? 'a definir'}</span>
                      <span className="trn-match-score">{j.placar_b ?? '–'}</span>
                    </div>
                  </>
                )}
                <div className="trn-match-meta">
                  <span className={`trn-dot trn-dot--${j.status}`} />
                  {j.codigo} · {STATUS_LABEL[j.status]}
                </div>
              </div>
            ))}
          </div>
        )}
        {jogos && jogos.length === 0 && slotAtual?.fase && (
          <div className="trn-fp-hint">Nenhum jogo encontrado nesta fase.</div>
        )}
      </div>

      {erro && <div className="adm-badge adm-badge--err" style={{ display: 'block', padding: 10, marginBottom: 12 }}>{erro}</div>}

      {simulacaoLog.length > 0 && (
        <div className="adm-card" style={{ marginBottom: 12, fontSize: '.82rem', color: 'var(--adm-text-2)' }}>
          {simulacaoLog.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}

      {/* Ações administrativas — sempre agem sobre a rodada VISTA (simular) ou sobre o estado real do torneio (gerar/fechar) */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {slotAtual?.fase && temPendentes && (
          <button className="adm-btn-primary" disabled={acaoEmCurso} onClick={simularPendentes}>{roundRobin ? `SIMULAR PRÓXIMA RODADA · ${jogosPorRodada(formato)} JOGOS` : 'SIMULAR PARTIDAS PENDENTES'}</button>
        )}

        {roundRobin && roundRobinFases.length === 0 && (
          <button className="adm-btn-primary" disabled={acaoEmCurso} onClick={() => acao(() => torneioApi.gerarRoundRobin(torneio.id))}>GERAR PRIMEIRA FASE · TODOS CONTRA TODOS</button>
        )}
        {roundRobin && roundRobinCompleto && torneio.estado !== 'CLASSIFICACAO_FECHADA' && !faseDouble && (
          <button className="adm-btn-primary" disabled={acaoEmCurso} onClick={() => acao(() => torneioApi.fecharClassificacao(torneio.id))}>FECHAR CLASSIFICAÇÃO E CONGELAR SEEDS</button>
        )}
        {!formato.repescagem && torneio.estado === 'CLASSIFICACAO_FECHADA' && !faseDouble && (
          <button className="adm-btn-primary" disabled={acaoEmCurso} onClick={() => acao(() => torneioApi.gerarDouble(torneio.id))}>GERAR DOUBLE ELIMINATION</button>
        )}
        {!roundRobin && !mostrarPareamento && !swissCompleto && swissConfirmadas.length === 0 && (
          <button className="adm-btn-primary" onClick={() => setMostrarPareamento(true)}>GERAR RODADA 1</button>
        )}
        {!roundRobin && !mostrarPareamento && !swissCompleto && rodadaEncerrada && (
          <button className="adm-btn-primary" onClick={() => setMostrarPareamento(true)}>GERAR PRÓXIMA RODADA</button>
        )}
        {!roundRobin && formato.equalizacao && !mostrarPareamento && swissCompleto && !faseEqualizacao && (
          <button className="adm-btn-primary" onClick={() => setMostrarPareamento(true)}>GERAR EQUALIZAÇÃO</button>
        )}
        {!roundRobin && formato.equalizacao && !mostrarPareamento && !swissCompleto && ultimaRodadaPublicada && (
          <span className="trn-fp-hint">Finalize todas as partidas da Rodada {torneio.rodadas_swiss} para gerar a Equalização.</span>
        )}
        {!roundRobin && !mostrarPareamento && faseEqualizacao?.estado === 'confirmada' && faseVistaEhAUltima && faseEncerrada && torneio.estado !== 'CLASSIFICACAO_FECHADA' && !faseRepescagem && (
          <button className="adm-btn-primary" disabled={acaoEmCurso} onClick={() => acao(() => torneioApi.fecharClassificacao(torneio.id))}>FECHAR CLASSIFICAÇÃO E CONGELAR SEEDS</button>
        )}
        {formato.repescagem && torneio.estado === 'CLASSIFICACAO_FECHADA' && !faseRepescagem && (
          <button className="adm-btn-primary" disabled={acaoEmCurso} onClick={() => acao(() => torneioApi.gerarRepescagem(torneio.id))}>GERAR REPESCAGEM</button>
        )}
      </div>

      {faseRepescagem && !faseDouble && (
        <div className="trn-fp-hint" style={{ marginTop: 8 }}>Repescagem em andamento — acompanhe na aba <b>Chaves</b>. Quando os 2 repescados estiverem definidos, gere a Double lá.</div>
      )}
      {faseDouble && (
        <div className="trn-fp-hint" style={{ marginTop: 8 }}>Double Elimination em andamento — acompanhe na aba <b>Chaves</b>.</div>
      )}

      {!roundRobin && mostrarPareamento && (
        <Pareamento
          torneio={torneio}
          tipo={swissCompleto ? 'equalizacao' : 'swiss'}
          rodada={swissCompleto ? undefined : proximaRodadaSwiss}
          onConfirmado={() => {
            // Salta direto pra chave do slot recém-confirmado — nunca via null+efeito
            // "pula pro mais recente", que corre ANTES do refetch de `torneio` terminar
            // e trava a navegação na rodada antiga (a rodada nova ainda não existe em
            // `torneio.fases` no instante em que esse efeito dispararia).
            setMostrarPareamento(false)
            setSlotViewKey(swissCompleto ? 'equalizacao' : `swiss-${proximaRodadaSwiss}`)
            onChange()
          }}
          onCancelar={() => setMostrarPareamento(false)}
        />
      )}

      {jogoAberto && (
        <Sumula torneioId={torneio.id} jogoId={jogoAberto} onClose={() => setJogoAberto(null)} onChange={() => { onChange(); carregarJogos() }} />
      )}
    </div>
  )
}
