import { useState, useEffect, useCallback } from 'react'
import { torneioApi, type Jogo, type TorneioDetalhe } from './torneioApi'
import { ResponsiveBracket } from '../../components/torneio/BracketView'
import { porCodigo, type BracketColDef, type BracketJogo } from '../../components/torneio/bracketHelpers'
import Sumula from './Sumula'

interface Props { torneio: TorneioDetalhe; onChange: () => void }

const REP_COLS: BracketColDef[] = [
  ['Rodada 1', ['REP-R1', 'REP-R2', 'REP-R3']],
  ['Repescados', ['REP-R4', 'REP-R5']],
]
const WIN_COLS: BracketColDef[] = [
  ['Quartas', ['QA', 'QB', 'QC', 'QD']],
  ['Semifinal', ['SF1', 'SF2']],
  ['Final Winners', ['FA']],
]
const LOS_COLS: BracketColDef[] = [
  ['Losers R1', ['B1', 'B2']],
  ['Losers R2', ['B3', 'B4']],
  ['Losers R3', ['B5']],
  ['Losers R4', ['B6']],
]

export default function Chaves({ torneio, onChange }: Props) {
  const mtnb = torneio.formato === 'mtnb_round_robin_5'
  const [repescagem, setRepescagem] = useState<Jogo[]>([])
  const [double, setDouble] = useState<Jogo[]>([])
  const [jogoAberto, setJogoAberto] = useState<number | null>(null)
  const [acaoEmCurso, setAcaoEmCurso] = useState(false)

  const carregar = useCallback(async () => {
    const [r1, r2] = await Promise.all([
      torneioApi.jogos(torneio.id, { fase_tipo: 'repescagem' }),
      torneioApi.jogos(torneio.id, { fase_tipo: 'double' }),
    ])
    if (r1) setRepescagem(r1.jogos)
    if (r2) setDouble(r2.jogos)
  }, [torneio.id])

  useEffect(() => { carregar() }, [carregar])

  const temRepescagem = torneio.fases.some(f => f.tipo === 'repescagem')
  const temDouble = torneio.fases.some(f => f.tipo === 'double')
  const rep4 = porCodigo(repescagem, 'REP-R4')
  const rep5 = porCodigo(repescagem, 'REP-R5')
  const repescagemPronta = rep4?.status === 'encerrado' && rep5?.status === 'encerrado'
  const repescagemBadges = {
    'REP-R4': rep4?.status === 'encerrado' ? 'Classificado para a Double' : '',
    'REP-R5': rep5?.status === 'encerrado' ? 'Classificado para a Double' : '',
  }
  const gf2 = porCodigo(double, 'GF2')
  const finalCols: BracketColDef[] = gf2 ? [['Grande Final', ['GF', 'GF2']]] : [['Grande Final', ['GF']]]
  const winCols: BracketColDef[] = mtnb ? [['Play-in',['P1']],['Entrada do 1º',['W1','W2']],['Final Winners',['WF']]] : WIN_COLS
  const losCols: BracketColDef[] = mtnb ? [['Losers 1',['L1']],['Losers 2',['L2']],['Final Losers',['LF']]] : LOS_COLS

  function abrirSumula(jogo: BracketJogo) { if (jogo.id) setJogoAberto(jogo.id) }

  async function gerarDouble() {
    setAcaoEmCurso(true)
    await torneioApi.gerarDouble(torneio.id)
    setAcaoEmCurso(false)
    onChange(); await carregar()
  }

  async function simularProximaDouble() {
    const proxima = double.find(j => j.codigo === torneio.jogo_destaque_codigo && j.time_a_id != null && j.time_b_id != null && j.status === 'agendado')
    if (!proxima) return
    setAcaoEmCurso(true)
    await torneioApi.simularPartida(torneio.id, proxima.id)
    setAcaoEmCurso(false)
    onChange(); await carregar()
  }

  return (
    <div>
      {!mtnb && !temRepescagem && <div className="adm-card">Repescagem ainda não foi gerada — feche a classificação no painel Ao Vivo primeiro.</div>}

      {!mtnb && temRepescagem && (
        <div className="adm-card" style={{ marginBottom: 16 }}>
          <h3>Repescagem (7º–13º → 2 vagas)</h3>
          <ResponsiveBracket cols={REP_COLS} lista={repescagem} onSelect={abrirSumula} badges={repescagemBadges} />
        </div>
      )}

      {!mtnb && temRepescagem && !temDouble && (
        <button className="adm-btn-primary" disabled={!repescagemPronta || acaoEmCurso} onClick={gerarDouble}>
          {repescagemPronta ? 'GERAR DOUBLE ELIMINATION' : 'Aguardando os 2 repescados…'}
        </button>
      )}

      {temDouble && (
        <>
          {double.some(j => j.codigo === torneio.jogo_destaque_codigo && j.status === 'agendado' && j.time_a_id != null && j.time_b_id != null) && <button className="adm-btn-primary" style={{marginBottom:16}} disabled={acaoEmCurso} onClick={simularProximaDouble}>SIMULAR PRÓXIMA PARTIDA · ORDEM OPERACIONAL</button>}
          <div className="adm-card" style={{ marginBottom: 16 }}>
            <h3>Double Elimination — Chave A / Winners</h3>
            <ResponsiveBracket cols={winCols} lista={double} onSelect={abrirSumula} />
          </div>
          <div className="adm-card" style={{ marginBottom: 16 }}>
            <h3>Double Elimination — Chave B / Losers</h3>
            <p className="trn-fp-hint" style={{ marginBottom: 10 }}>Primeira derrota na Winners desce pra cá. Segunda derrota elimina.</p>
            <ResponsiveBracket cols={losCols} lista={double} onSelect={abrirSumula} />
          </div>
          <div className="adm-card">
            <h3>Grande Final</h3>
            {gf2 && <p className="trn-fp-hint" style={{ marginBottom: 10 }}>O time da chave Losers venceu a GF — GF2 decide o campeão.</p>}
            <ResponsiveBracket cols={finalCols} lista={double} onSelect={abrirSumula} />
          </div>
        </>
      )}

      {jogoAberto && (
        <Sumula torneioId={torneio.id} jogoId={jogoAberto} onClose={() => setJogoAberto(null)} onChange={() => { onChange(); carregar() }} />
      )}
    </div>
  )
}
