import { useState, useRef } from 'react'
import { torneioApi, criterioLabel, criterioDirecao, TODOS_CRITERIOS, type TorneioDetalhe } from './torneioApi'

interface Props {
  torneio: TorneioDetalhe
  onChange: () => void
}

export default function Configuracoes({ torneio, onChange }: Props) {
  return (
    <div>
      <div className="adm-card" style={{ marginBottom: 16 }}>
        <h3>Formato</h3>
        <dl className="trn-config-list">
          <div><dt>Preset</dt><dd>{torneio.preset ?? '—'}</dd></div>
          {torneio.formato === 'mtnb_round_robin_5' ? <><div><dt>Primeira Fase</dt><dd>5 rodadas · todos contra todos</dd></div><div><dt>Entrada na Double</dt><dd>5º × 4º; 1º aguarda o vencedor</dd></div></> : <><div><dt>Rodadas suíças</dt><dd>{torneio.rodadas_swiss}</dd></div><div><dt>Equalização</dt><dd>{torneio.equalizacao_habilitada ? 'Habilitada' : 'Desabilitada'}</dd></div><div><dt>Classificados direto</dt><dd>1º ao {torneio.classificados_diretos}º</dd></div><div><dt>Vagas de repescagem</dt><dd>{torneio.vagas_repescagem}</dd></div></>}
          <div><dt>Pontuação</dt><dd>Vitória {torneio.pontos_vitoria} · Empate {torneio.pontos_empate} · Derrota {torneio.pontos_derrota}</dd></div>
        </dl>
      </div>

      <CriteriosEditor torneio={torneio} onChange={onChange} />
      <ZonaDePerigo torneio={torneio} onChange={onChange} />
    </div>
  )
}

function CriteriosEditor({ torneio, onChange }: Props) {
  const [criterios, setCriterios] = useState<string[]>(torneio.criterios)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const dragIndex = useRef<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  function onDrop(index: number) {
    if (dragIndex.current === null || dragIndex.current === index) { setDragOverIndex(null); return }
    setCriterios(prev => {
      const next = [...prev]
      const [moved] = next.splice(dragIndex.current!, 1)
      next.splice(index, 0, moved)
      return next
    })
    dragIndex.current = null
    setDragOverIndex(null)
    setSalvo(false)
  }

  function adicionarCriterio(c: string) {
    if (!criterios.includes(c)) { setCriterios(prev => [...prev, c]); setSalvo(false) }
  }
  function removerCriterio(c: string) {
    setCriterios(prev => prev.filter(x => x !== c))
    setSalvo(false)
  }

  async function salvarOrdem() {
    setSalvando(true)
    const r = await torneioApi.salvarCriterios(torneio.id, criterios)
    setSalvando(false)
    if (r) { setSalvo(true); onChange() }
  }

  const disponiveis = TODOS_CRITERIOS.filter(c => !criterios.includes(c))

  return (
    <div className="adm-card" style={{ marginBottom: 16 }}>
      <h3>Critérios de classificação</h3>
      <p className="trn-fp-hint" style={{ margin: '6px 0 12px' }}>Arraste pra reordenar. O primeiro da lista decide primeiro; empates caem pro próximo.</p>

      <div className="trn-criterios-list">
        {criterios.map((c, i) => (
          <div
            key={c}
            className={`trn-criterio-item ${dragOverIndex === i ? 'trn-criterio-item--dragging' : ''}`}
            draggable
            onDragStart={() => { dragIndex.current = i }}
            onDragOver={e => { e.preventDefault(); setDragOverIndex(i) }}
            onDrop={() => onDrop(i)}
          >
            <span className="trn-criterio-ordem">{i + 1}</span>
            <span className="trn-criterio-nome">{criterioLabel(c)}</span>
            <span className="trn-criterio-direcao">{criterioDirecao(c)}</span>
            <button className="adm-btn adm-btn--sm adm-btn--danger" onClick={() => removerCriterio(c)}>remover</button>
          </div>
        ))}
      </div>

      {disponiveis.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="trn-fp-hint">Adicionar:</span>
          {disponiveis.map(c => (
            <button key={c} className="adm-btn adm-btn--sm" onClick={() => adicionarCriterio(c)}>+ {criterioLabel(c)}</button>
          ))}
        </div>
      )}

      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="adm-btn-primary" disabled={salvando} onClick={salvarOrdem}>Salvar ordem</button>
        {salvo && <span className="trn-fp-hint" style={{ color: 'var(--adm-accent)' }}>✓ Salvo</span>}
      </div>
    </div>
  )
}

function ZonaDePerigo({ torneio, onChange }: Props) {
  const [confirmando, setConfirmando] = useState(false)
  const [emCurso, setEmCurso] = useState(false)

  async function zerar() {
    setEmCurso(true)
    await torneioApi.zerarResultados(torneio.id)
    setEmCurso(false)
    setConfirmando(false)
    onChange()
  }

  return (
    <div className="adm-card adm-card--danger-zone">
      <h3 style={{ color: 'var(--adm-red)' }}>Zona de perigo</h3>
      <p style={{ color: 'var(--adm-text-2)', fontSize: '.86rem', margin: '8px 0 14px' }}>
        Isso removerá todos os resultados, gols, faltas e progresso do torneio, mas manterá
        times, jogadores, configuração, critérios e participantes.
      </p>
      {!confirmando ? (
        <button className="adm-btn adm-btn--danger" onClick={() => setConfirmando(true)}>ZERAR TORNEIO</button>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="adm-btn" onClick={() => setConfirmando(false)}>Cancelar</button>
          <button className="adm-btn adm-btn--danger" disabled={emCurso} onClick={zerar}>Confirmar — ZERAR TORNEIO</button>
        </div>
      )}
    </div>
  )
}
