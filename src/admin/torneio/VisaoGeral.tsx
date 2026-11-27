import { useState, useEffect } from 'react'
import { torneioApi, type TorneioDetalhe } from './torneioApi'
import { formatoDe } from '../../services/formatoTorneio'

interface Props {
  torneio: TorneioDetalhe
  onIrParaAoVivo: () => void
}

const FASE_LABEL: Record<string, string> = {
  swiss: 'Suíço', round_robin: 'Todos contra todos', equalizacao: 'Equalização', repescagem: 'Repescagem', double: 'Double Elimination',
}

export default function VisaoGeral({ torneio, onIrParaAoVivo }: Props) {
  const formato = formatoDe(torneio)
  const ultima = torneio.fases.length ? torneio.fases[torneio.fases.length - 1] : null
  // No todos contra todos as 7 rodadas nascem juntas: a rodada "atual" é a primeira ainda aberta,
  // e o progresso conta a 1ª fase inteira (28 jogos), não só a última rodada gerada.
  const primeiraFaseRR = ultima?.tipo === 'round_robin'
  const atual = primeiraFaseRR ? (torneio.fases.find(f => f.tipo === 'round_robin' && !f.completa) ?? ultima) : ultima
  const [total, setTotal] = useState<number | null>(null)
  const [encerrados, setEncerrados] = useState<number | null>(null)

  useEffect(() => {
    if (!atual) { setTotal(null); setEncerrados(null); return }
    torneioApi.jogos(torneio.id, primeiraFaseRR ? { fase_tipo: 'round_robin' } : { fase_tipo: atual.tipo, rodada: atual.rodada ?? undefined }).then(r => {
      if (!r) return
      const reais = r.jogos.filter(j => !j.is_bye)
      setTotal(reais.length)
      setEncerrados(reais.filter(j => j.status === 'encerrado' || j.status === 'wo' || j.status === 'cancelado').length)
    })
  }, [torneio.id, atual?.tipo, atual?.rodada, primeiraFaseRR, torneio.fases]) // eslint-disable-line react-hooks/exhaustive-deps

  const faseLabel = atual ? (FASE_LABEL[atual.tipo] ?? atual.tipo) : 'Configuração'
  const pendentes = total !== null && encerrados !== null ? total - encerrados : null

  let proximoPasso = formato.primeira_fase === 'round_robin'
    ? `Gere a 1ª fase (todos contra todos · ${formato.rodadas} rodadas) no painel Ao Vivo.`
    : 'Gere a Rodada 1 do suíço no painel Ao Vivo.'
  if (atual && total !== null && encerrados !== null) {
    if (pendentes! > 0) proximoPasso = `Finalize ${pendentes} partida${pendentes === 1 ? '' : 's'} restante${pendentes === 1 ? '' : 's'}${primeiraFaseRR ? ' da 1ª fase' : ''}.`
    else if (atual.tipo === 'swiss' && (atual.rodada ?? 0) < torneio.rodadas_swiss) proximoPasso = 'Gere a próxima rodada.'
    else if (atual.tipo === 'swiss') proximoPasso = 'Gere a Equalização.'
    else if (atual.tipo === 'equalizacao') proximoPasso = 'Feche a classificação e gere a Repescagem.'
    else if (atual.tipo === 'round_robin') proximoPasso = torneio.estado === 'CLASSIFICACAO_FECHADA' ? 'Gere a Double Elimination (1º×8º, 2º×7º, 3º×6º, 4º×5º).' : 'Feche a classificação e gere a Double Elimination.'
    else if (atual.tipo === 'repescagem') proximoPasso = 'Gere a Double Elimination.'
    else proximoPasso = 'Acompanhe a Double Elimination até a Grande Final.'
  }

  return (
    <div className="adm-card" style={{ maxWidth: 640 }}>
      <div className="trn-hero-fase">{faseLabel}{atual?.rodada ? ` — Rodada ${atual.rodada} de ${formato.primeira_fase === 'round_robin' ? formato.rodadas : torneio.rodadas_swiss}` : ''}</div>

      {total !== null && encerrados !== null && total > 0 && (
        <div style={{ margin: '12px 0' }}>
          <div className="trn-progress-track">
            <div className="trn-progress-fill" style={{ width: `${(encerrados / total) * 100}%` }} />
          </div>
          <div className="trn-fp-hint" style={{ marginTop: 6 }}>{encerrados} de {total} partidas encerradas</div>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <div className="trn-fp-hint" style={{ textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Próximo passo</div>
        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--adm-text)' }}>{proximoPasso}</div>
      </div>

      {atual && (
        <button className="adm-btn-primary" style={{ marginTop: 18 }} onClick={onIrParaAoVivo}>IR PARA RODADA</button>
      )}
    </div>
  )
}
