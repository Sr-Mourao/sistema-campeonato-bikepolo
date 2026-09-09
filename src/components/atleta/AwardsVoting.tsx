import { useEffect, useMemo, useState } from 'react'
import { Award, Check, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import Avatar from '../equipes/Avatar'
import './awardsVoting.css'

type AwardCode = 'mvp' | 'wow' | 'revelacao' | 'jesse'
interface Candidate { pessoa_id: number; nome: string; foto: string | null; time: string | null }
interface AwardCategory { codigo: AwardCode; nome: string; descricao: string; candidatos: Candidate[] }
interface AwardsData { status: 'fechada' | 'aberta' | 'encerrada'; categorias: AwardCategory[]; meus_votos: Partial<Record<AwardCode, number>>; completo: boolean }

const ORDEM: AwardCode[] = ['mvp', 'wow', 'revelacao', 'jesse']

export default function AwardsVoting({ token }: { token: string }) {
  const [dados, setDados] = useState<AwardsData | null>(null)
  const [aberto, setAberto] = useState(false)
  const [etapa, setEtapa] = useState(0)
  const [busca, setBusca] = useState('')
  const [votos, setVotos] = useState<Partial<Record<AwardCode, number>>>({})
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true
    const carregar = (inicial: boolean) => fetch('/api/awards.php', { headers: { 'X-Session-Token': token } })
      .then(async resposta => resposta.ok ? resposta.json() as Promise<AwardsData> : null)
      .then(novo => {
        if (!ativo || !novo) return
        setDados(novo)
        if (inicial) setVotos(novo.meus_votos)
      })
      .catch(() => {})
    carregar(true)
    const timer = window.setInterval(() => carregar(false), 15000)
    return () => { ativo = false; window.clearInterval(timer) }
  }, [token])

  const categoria = dados?.categorias[etapa]
  const candidatos = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR')
    if (!categoria || !termo) return categoria?.candidatos ?? []
    return categoria.candidatos.filter(c => `${c.nome} ${c.time ?? ''}`.toLocaleLowerCase('pt-BR').includes(termo))
  }, [busca, categoria])

  if (!dados || dados.status === 'fechada') return null
  if (dados.status === 'encerrada') return dados.completo ? (
    <section className="atl-card awv-call awv-call--done">
      <Award size={24} /><div><strong>Awards</strong><p>Votação encerrada. Seus votos foram registrados.</p></div><Check size={22} />
    </section>
  ) : null

  const todasEscolhidas = ORDEM.every(codigo => Boolean(votos[codigo]))

  async function salvar() {
    if (!todasEscolhidas) return
    setSalvando(true); setErro(''); setMensagem('')
    try {
      const resposta = await fetch('/api/awards.php', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Session-Token': token }, body: JSON.stringify({ votos }),
      })
      const retorno = await resposta.json()
      if (!resposta.ok) throw new Error(retorno.error || 'Não foi possível registrar os votos')
      setDados(retorno.dados)
      setVotos(retorno.dados.meus_votos)
      setMensagem('Votos registrados! Você pode editá-los enquanto a votação estiver aberta.')
      setAberto(false); setEtapa(0)
    } catch (e) { setErro(e instanceof Error ? e.message : 'Erro ao salvar') }
    finally { setSalvando(false) }
  }

  if (!aberto) return (
    <section className="atl-card awv-call">
      <div className="awv-call-icon"><Award size={24} /></div>
      <div><span>Votação aberta</span><strong>Awards</strong><p>{dados.completo ? 'Seus votos estão registrados. Você ainda pode editar.' : 'Escolha os destaques do Brasileiro Misto.'}</p></div>
      <button type="button" onClick={() => { setAberto(true); setMensagem('') }}>{dados.completo ? 'Rever votos' : 'Votar agora'}</button>
      {mensagem && <div className="awv-feedback"><Check size={15} />{mensagem}</div>}
    </section>
  )

  if (etapa >= ORDEM.length) return (
    <section className="atl-card awv-panel">
      <header><span>Resumo</span><h2>Confirme seus votos</h2><p>Confira as quatro escolhas antes de registrar.</p></header>
      <div className="awv-summary">
        {dados.categorias.map(cat => {
          const escolhido = cat.candidatos.find(c => c.pessoa_id === votos[cat.codigo])
          return <button type="button" key={cat.codigo} onClick={() => setEtapa(ORDEM.indexOf(cat.codigo))}><span>{cat.nome}</span><strong>{escolhido?.nome ?? 'Não escolhido'}</strong><small>{escolhido?.time}</small></button>
        })}
      </div>
      {erro && <p className="awv-error">{erro}</p>}
      <div className="awv-nav"><button type="button" className="awv-back" onClick={() => setEtapa(3)}><ChevronLeft size={17} />Voltar</button><button type="button" className="awv-next" disabled={!todasEscolhidas || salvando} onClick={salvar}>{salvando ? 'Registrando…' : 'Confirmar votos'}<Check size={17} /></button></div>
    </section>
  )

  return (
    <section className="atl-card awv-panel">
      <div className="awv-progress"><span style={{ width: `${((etapa + 1) / 4) * 100}%` }} /></div>
      <header><span>Categoria {etapa + 1} de 4</span><h2>{categoria?.nome}</h2><p>{categoria?.descricao}</p></header>
      <label className="awv-search"><Search size={16} /><input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar atleta ou time" /></label>
      <div className="awv-candidates">
        {candidatos.map(candidato => {
          const selecionado = votos[categoria!.codigo] === candidato.pessoa_id
          return <button type="button" className={selecionado ? 'is-selected' : ''} key={candidato.pessoa_id} onClick={() => setVotos(atual => ({ ...atual, [categoria!.codigo]: candidato.pessoa_id }))}>
            <span className="awv-avatar"><Avatar nome={candidato.nome} foto={candidato.foto ?? undefined} /></span><span><strong>{candidato.nome}</strong><small>{candidato.time ?? 'Sem time associado'}</small></span>{selecionado && <Check size={20} />}
          </button>
        })}
        {candidatos.length === 0 && <p className="awv-empty">Nenhum atleta encontrado.</p>}
      </div>
      <div className="awv-nav"><button type="button" className="awv-back" onClick={() => etapa === 0 ? setAberto(false) : setEtapa(e => e - 1)}><ChevronLeft size={17} />{etapa === 0 ? 'Sair' : 'Anterior'}</button><button type="button" className="awv-next" disabled={!votos[categoria!.codigo]} onClick={() => { setBusca(''); setEtapa(e => e + 1) }}>Continuar<ChevronRight size={17} /></button></div>
    </section>
  )
}
