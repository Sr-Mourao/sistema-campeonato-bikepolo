import { useState } from 'react'
import { adminGet, adminPost } from '../adminApi'

interface ExternoTime { id: string; name: string; logoPath?: string }
interface ExternoAtleta { id: string; name: string; photoPath?: string }
interface InternoTime { id: number; nome: string; logo_origem: string | null }
interface InternoAtleta { id: number; nome: string; foto_origem: string | null }

interface MatchTime { externo: ExternoTime; interno: InternoTime | null; status: 'associado' | 'ambiguo' | 'pendente'; via: string | null }
interface MatchAtleta { externo: ExternoAtleta; interno: InternoAtleta | null; status: 'associado' | 'ambiguo' | 'pendente'; via: string | null }
interface Resumo { encontrados: number; associados: number; pendentes: number; com_imagem_externa: number }

interface Relatorio {
  times: Resumo
  atletas: Resumo
  pendencias_times: MatchTime[]
  pendencias_atletas: { time_interno: InternoTime; match: MatchAtleta }[]
  atletas_por_time: Record<string, { time: InternoTime; matches: MatchAtleta[] }>
  importados?: { times: number; atletas: number }
  erros?: { times: { time_id: number; erro: string }[]; atletas: { pessoa_id: number; erro: string }[] }
}

type AcaoAtleta = 'no_time' | 'adicionar' | 'criar' | 'outro_time' | 'ambiguo'
interface PlanoTimes {
  times: {
    externo: { id: string; name: string }
    acao: 'existe' | 'criar'
    nome: string
    atletas: { externo: { id: string; name: string; photoPath?: string | null }; acao: AcaoAtleta; nome: string; outro_time: string | null }[]
  }[]
  resumo: { times_criar: number; atletas_criar: number; atletas_adicionar: number; avisos: number }
  criados?: { times: number; pessoas: number; vinculos: number }
}

const ROTULO_ACAO: Record<AcaoAtleta, string> = {
  no_time: 'ok', adicionar: 'entra no time', criar: 'nova pessoa', outro_time: 'está em outro time', ambiguo: 'nome repetido — revisar',
}

/** Times internos (id+nome+roster), pra popular os selects de associação manual —
 * o roster completo vem daqui (não da resposta do preview), porque um membro sem NENHUM
 * homônimo no Poloperator não apareceria em `atletas_por_time` de outra forma. */
interface TimeParaAssociar { id: number; nome: string; categoria: string; membros: { pessoa_id: number; nome: string }[] }

/**
 * Painel de importação Poloperator → local (seções 6/15/26 do brief de migração de
 * mídia). Preview NUNCA escreve nada — só calcula o matching. Importar reaproveita o
 * mesmo matching do backend (nunca uma segunda lógica aqui) e só baixa/grava o que está
 * 'associado' (automático ou confirmado manualmente aqui).
 */
export default function PoloperatorImportPanel({ timesDisponiveis, onImportado }: {
  timesDisponiveis: TimeParaAssociar[]
  onImportado: () => void
}) {
  const [aberto, setAberto] = useState(false)
  const [categoria, setCategoria] = useState<'misto' | 'mtnb'>('misto')
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [importando, setImportando] = useState(false)
  const [confirmTimes, setConfirmTimes] = useState<Record<string, number>>({})
  const [confirmAtletas, setConfirmAtletas] = useState<Record<string, number>>({})
  const [planoTimes, setPlanoTimes] = useState<PlanoTimes | null>(null)
  const [sincronizando, setSincronizando] = useState(false)
  const [erroTimes, setErroTimes] = useState('')

  /** Poloperator como base: prévia do que falta criar (não grava). */
  async function consultarTimes() {
    setSincronizando(true); setErroTimes('')
    const r = await adminGet<PlanoTimes>(`/api/admin/poloperator-import.php?action=preview_times&categoria=${categoria}`)
    setSincronizando(false)
    if (r) setPlanoTimes(r); else setErroTimes('Não foi possível consultar o Poloperator.')
  }

  async function criarTimes() {
    setSincronizando(true); setErroTimes('')
    const r = await adminPost<{ criados: PlanoTimes['criados']; plano: PlanoTimes }>('/api/admin/poloperator-import.php', { action: 'criar_times', categoria })
    setSincronizando(false)
    if (r) { setPlanoTimes({ ...r.plano, criados: r.criados }); onImportado() }
    else setErroTimes('Não foi possível criar os times.')
  }

  async function preview() {
    setCarregando(true)
    setConfirmTimes({})
    setConfirmAtletas({})
    const r = await adminGet<Relatorio>(`/api/admin/poloperator-import.php?action=preview&categoria=${categoria}`)
    setCarregando(false)
    if (r) setRelatorio(r)
  }

  async function importar() {
    setImportando(true)
    const r = await adminPost<Relatorio>('/api/admin/poloperator-import.php', {
      action: 'importar', categoria,
      confirmacoes_times: confirmTimes,
      confirmacoes_atletas: confirmAtletas,
    })
    setImportando(false)
    if (r) {
      setRelatorio(r)
      onImportado()
    }
  }

  const timesParaSelect = timesDisponiveis.filter(t => t.categoria === categoria)

  return (
    <div className="adm-card" style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setAberto(v => !v)}>
        <h3 style={{ margin: 0, flex: 1 }}>Poloperator: times, atletas e fotos</h3>
        <span className="adm-badge adm-badge--tag">{aberto ? 'ocultar' : 'abrir'}</span>
      </div>

      {aberto && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
            <select className="adm-select" value={categoria} onChange={e => { setCategoria(e.target.value as 'misto' | 'mtnb'); setRelatorio(null); setPlanoTimes(null) }}>
              <option value="misto">2° Pior · Misto</option>
              <option value="mtnb">Brasileiro MTNB</option>
            </select>
          </div>

          {/* 1) Times e atletas: o Poloperator é a base. Cria só o que falta; nunca apaga nem muda ninguém de time. */}
          <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid var(--adm-border, rgba(255,255,255,.1))' }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>1. Times e atletas</div>
            <p className="trn-fp-hint" style={{ marginBottom: 10 }}>Traz do Poloperator os times e atletas que ainda não existem aqui. Rode de novo sempre que alguém criar conta ou entrar num time lá.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="adm-btn" disabled={sincronizando} onClick={consultarTimes}>{sincronizando ? 'Consultando…' : 'Consultar times (não grava nada)'}</button>
              {planoTimes && (planoTimes.resumo.times_criar + planoTimes.resumo.atletas_criar + planoTimes.resumo.atletas_adicionar) > 0 && (
                <button className="adm-btn-primary" disabled={sincronizando} onClick={criarTimes}>
                  {sincronizando ? 'Criando…' : `Criar o que falta (${planoTimes.resumo.times_criar} times · ${planoTimes.resumo.atletas_criar + planoTimes.resumo.atletas_adicionar} atletas)`}
                </button>
              )}
            </div>
            {erroTimes && <div style={{ marginTop: 8, fontSize: '.84rem', color: 'var(--adm-red)' }}>{erroTimes}</div>}
            {planoTimes?.criados && (
              <p style={{ marginTop: 8, fontSize: '.86rem', color: 'var(--adm-accent)' }}>✓ Criados agora: {planoTimes.criados.times} times, {planoTimes.criados.pessoas} pessoas, {planoTimes.criados.vinculos} vínculos com time.</p>
            )}
            {planoTimes && (
              <div style={{ marginTop: 10, display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                {planoTimes.times.map(t => (
                  <div key={t.externo.id} className="adm-card" style={{ padding: 10, margin: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, marginBottom: 6 }}>
                      <b>{t.nome}</b>
                      <span className="adm-badge adm-badge--tag" style={{ fontSize: '.62rem' }}>{t.acao === 'criar' ? 'novo time' : 'já existe'}</span>
                    </div>
                    {t.atletas.length === 0 && <div className="trn-fp-hint">Sem atletas no Poloperator.</div>}
                    {t.atletas.map(a => (
                      <div key={a.externo.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: '.82rem', padding: '2px 0' }}>
                        <span title={a.externo.name}>{a.nome}</span>
                        <span style={{ color: a.acao === 'no_time' ? 'var(--adm-text-3)' : a.acao === 'outro_time' || a.acao === 'ambiguo' ? 'var(--adm-red)' : 'var(--adm-accent)' }}>
                          {a.acao === 'outro_time' ? `está no ${a.outro_time}` : ROTULO_ACAO[a.acao]}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
            {planoTimes && planoTimes.resumo.avisos > 0 && (
              <p className="trn-fp-hint" style={{ marginTop: 8 }}>Itens em vermelho não são alterados automaticamente: ajuste o time na lista abaixo, se for o caso.</p>
            )}
          </div>

          <div style={{ fontWeight: 700, marginBottom: 6 }}>2. Brasões e fotos</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
            <button className="adm-btn" disabled={carregando} onClick={preview}>
              {carregando ? 'Consultando…' : 'Consultar fotos (preview, não grava nada)'}
            </button>
            {relatorio && (
              <button className="adm-btn-primary" disabled={importando} onClick={importar}>
                {importando ? 'Importando…' : 'Importar imagens confirmadas'}
              </button>
            )}
          </div>

          {relatorio && (
            <>
              <p style={{ fontSize: '.86rem', color: 'var(--adm-text-2)' }}>
                <b>Times</b>: {relatorio.times.encontrados} encontrados · {relatorio.times.associados} associados · {relatorio.times.pendentes} pendentes · {relatorio.times.com_imagem_externa} com brasão externo.
                {' '}<b>Atletas</b>: {relatorio.atletas.encontrados} encontrados · {relatorio.atletas.associados} associados · {relatorio.atletas.pendentes} requerem revisão · {relatorio.atletas.com_imagem_externa} com foto externa.
              </p>

              {relatorio.importados && (
                <p style={{ fontSize: '.86rem', color: 'var(--adm-accent)' }}>
                  ✓ Importados nesta rodada: {relatorio.importados.times} brasões, {relatorio.importados.atletas} fotos.
                </p>
              )}
              {relatorio.erros && (relatorio.erros.times.length > 0 || relatorio.erros.atletas.length > 0) && (
                <div style={{ fontSize: '.82rem', color: 'var(--adm-red)' }}>
                  {relatorio.erros.times.map((e, i) => <div key={`t${i}`}>Time #{e.time_id}: {e.erro}</div>)}
                  {relatorio.erros.atletas.map((e, i) => <div key={`a${i}`}>Atleta #{e.pessoa_id}: {e.erro}</div>)}
                </div>
              )}

              {relatorio.pendencias_times.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div className="trn-fp-hint" style={{ marginBottom: 6 }}>Times pendentes de associação manual</div>
                  {relatorio.pendencias_times.map(m => (
                    <div key={m.externo.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: '.86rem' }}>
                      <span style={{ flex: 1 }}>{m.externo.name} <span className="adm-badge adm-badge--tag" style={{ fontSize: '.62rem' }}>{m.status}</span></span>
                      <select
                        className="adm-select"
                        value={confirmTimes[m.externo.id] ?? ''}
                        onChange={e => setConfirmTimes(prev => ({ ...prev, [m.externo.id]: Number(e.target.value) }))}
                      >
                        <option value="">— associar a —</option>
                        {timesParaSelect.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}

              {relatorio.pendencias_atletas.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div className="trn-fp-hint" style={{ marginBottom: 6 }}>Atletas pendentes de revisão</div>
                  {relatorio.pendencias_atletas.map(({ time_interno, match }) => {
                    const roster = timesParaSelect.find(t => t.id === time_interno.id)?.membros ?? []
                    return (
                      <div key={match.externo.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: '.86rem' }}>
                        <span style={{ flex: 1 }}>{match.externo.name} <span style={{ color: 'var(--adm-text-3)' }}>({time_interno.nome})</span> <span className="adm-badge adm-badge--tag" style={{ fontSize: '.62rem' }}>{match.status}</span></span>
                        <select
                          className="adm-select"
                          value={confirmAtletas[match.externo.id] ?? ''}
                          onChange={e => setConfirmAtletas(prev => ({ ...prev, [match.externo.id]: Number(e.target.value) }))}
                        >
                          <option value="">— associar a —</option>
                          {roster.map(p => <option key={p.pessoa_id} value={p.pessoa_id}>{p.nome}</option>)}
                        </select>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
