import { useEffect, useMemo, useState } from 'react'
import { Award, CheckCircle2, Clock3, Lock, Search, Trash2, Users } from 'lucide-react'
import Avatar from '../../components/equipes/Avatar'
import { adminGet, adminPost } from '../adminApi'
import './Awards.css'
import './AwardsDanger.css'

type AwardCode = 'mvp' | 'wow' | 'revelacao' | 'jesse'
interface Atleta { pessoa_id: number; nome: string; foto: string | null; time: string | null }
interface Participante extends Atleta { status: 'votou' | 'incompleto' | 'nao_votou'; votos: Partial<Record<AwardCode, { pessoa_id: number; nome: string }>> }
interface Ranking extends Atleta { votos: number; posicao: number; percentual: number }
interface Resultado { codigo: AwardCode; nome: string; descricao: string; ranking: Ranking[]; total_votos: number; maior_quantidade: number; vencedores: Ranking[]; empate: boolean }
interface Dados {
  status: 'fechada' | 'aberta' | 'encerrada'
  atletas: Atleta[]
  curadoria: { revelacao: number[]; jesse: number[] }
  participacao: Participante[]
  resumo: { aptos: number; votaram: number; nao_votaram: number }
  apuracao: Record<AwardCode, Resultado>
}

const CATEGORIAS: AwardCode[] = ['mvp', 'wow', 'revelacao', 'jesse']

export default function AwardsAdmin() {
  const [dados, setDados] = useState<Dados | null>(null)
  const [buscas, setBuscas] = useState({ revelacao: '', jesse: '' })
  const [ocupado, setOcupado] = useState('')
  const [confirmandoReset, setConfirmandoReset] = useState(false)
  const [confirmacaoReset, setConfirmacaoReset] = useState('')

  useEffect(() => { adminGet<Dados>('/api/admin/awards.php').then(res => { if (res) setDados(res) }) }, [])

  async function agir(corpo: object, chave: string) {
    setOcupado(chave)
    const retorno = await adminPost<Dados>('/api/admin/awards.php', corpo)
    if (retorno) setDados(retorno)
    setOcupado('')
    return Boolean(retorno)
  }

  async function alternarCuradoria(categoria: 'revelacao' | 'jesse', pessoaId: number) {
    if (!dados) return
    const atual = dados.curadoria[categoria]
    const proximo = atual.includes(pessoaId) ? atual.filter(id => id !== pessoaId) : [...atual, pessoaId]
    await agir({ acao: 'curadoria', categoria, pessoa_ids: proximo }, `${categoria}-${pessoaId}`)
  }

  async function zerarAwards() {
    const concluiu = await agir({ acao: 'zerar_dados', confirmacao: confirmacaoReset }, 'zerar-awards')
    if (concluiu) {
      setConfirmandoReset(false)
      setConfirmacaoReset('')
    }
  }

  const filtrados = useMemo(() => {
    if (!dados) return { revelacao: [], jesse: [] } as Record<'revelacao' | 'jesse', Atleta[]>
    return Object.fromEntries((['revelacao', 'jesse'] as const).map(categoria => {
      const termo = buscas[categoria].trim().toLocaleLowerCase('pt-BR')
      return [categoria, termo ? dados.atletas.filter(a => `${a.nome} ${a.time ?? ''}`.toLocaleLowerCase('pt-BR').includes(termo)) : dados.atletas]
    })) as Record<'revelacao' | 'jesse', Atleta[]>
  }, [buscas, dados])

  if (!dados) return <div className="adm-loading">Carregando Awards…</div>
  const editavel = dados.status === 'fechada'

  return <div className="awd-admin">
    <section className="awd-admin-hero">
      <div><span>2° Pior Campeonato de Bici Polo</span><h1>Awards</h1><p>Curadoria, participação e apuração dos quatro prêmios individuais.</p></div>
      <div className={`awd-status awd-status--${dados.status}`}><i />{dados.status}</div>
      <div className="awd-state-actions">
        {dados.status === 'fechada' && <button className="adm-btn-primary" disabled={Boolean(ocupado)} onClick={() => agir({ acao: 'abrir' }, 'abrir')}>Abrir votação</button>}
        {dados.status === 'aberta' && <button className="adm-btn adm-btn--danger" disabled={Boolean(ocupado)} onClick={() => agir({ acao: 'encerrar' }, 'encerrar')}>Encerrar votação</button>}
        {dados.status === 'encerrada' && <span><Lock size={15} /> Votos congelados</span>}
      </div>
    </section>

    <div className="awd-stats">
      <div><Users size={20} /><strong>{dados.resumo.aptos}</strong><span>Aptos — atletas cadastrados</span></div>
      <div><CheckCircle2 size={20} /><strong>{dados.resumo.votaram}</strong><span>Já votaram</span></div>
      <div><Clock3 size={20} /><strong>{dados.resumo.nao_votaram}</strong><span>Ainda não votaram</span></div>
    </div>

    <section className="adm-section awd-auto"><h2>Categorias automáticas</h2><p><b>MVP</b> e <b>WOW</b> incluem automaticamente todos os {dados.atletas.length} atletas inscritos no campeonato.</p></section>

    <div className="awd-curation-grid">
      {(['revelacao', 'jesse'] as const).map(categoria => <section className="adm-section awd-curation" key={categoria}>
        <header><div><span>Curadoria</span><h2>{categoria === 'revelacao' ? 'Elegíveis para Revelação' : 'Elegíveis para Jessé'}</h2></div><strong>{dados.curadoria[categoria].length} selecionados</strong></header>
        {!editavel && <p className="awd-locked"><Lock size={14} /> Curadoria bloqueada porque a votação já foi aberta.</p>}
        {categoria === 'jesse' && editavel && <button className="adm-btn awd-add-all" disabled={Boolean(ocupado)} onClick={() => agir({ acao: 'adicionar_todos_jesse' }, 'todos-jesse')}>Adicionar todos os atletas</button>}
        <label className="awd-search"><Search size={15} /><input placeholder="Buscar atleta ou time" value={buscas[categoria]} onChange={e => setBuscas(b => ({ ...b, [categoria]: e.target.value }))} /></label>
        <div className="awd-curation-list">{filtrados[categoria].map(atleta => {
          const marcado = dados.curadoria[categoria].includes(atleta.pessoa_id)
          return <button type="button" className={marcado ? 'is-selected' : ''} disabled={!editavel || Boolean(ocupado)} onClick={() => alternarCuradoria(categoria, atleta.pessoa_id)} key={atleta.pessoa_id}>
            <span className="awd-avatar"><Avatar nome={atleta.nome} foto={atleta.foto ?? undefined} /></span><span><b>{atleta.nome}</b><small>{atleta.time ?? 'Sem time associado'}</small></span><i>{marcado ? 'Selecionado' : 'Adicionar'}</i>
          </button>
        })}</div>
      </section>)}
    </div>

    <section className="adm-section awd-participation"><header><div><span>Controle administrativo</span><h2>Participação</h2></div><p>{dados.resumo.votaram} de {dados.resumo.aptos} concluíram</p></header>
      <div className="adm-table-wrap"><table className="adm-table"><thead><tr><th>Atleta</th><th>Status</th><th>MVP</th><th>WOW</th><th>Revelação</th><th>Jessé</th></tr></thead><tbody>{dados.participacao.map(p => <tr key={p.pessoa_id}><td><b>{p.nome}</b><small>{p.time}</small></td><td><span className={`adm-badge ${p.status === 'votou' ? 'adm-badge--ok' : p.status === 'incompleto' ? 'adm-badge--warn' : 'adm-badge--tag'}`}>{p.status === 'nao_votou' ? 'Não votou' : p.status}</span></td>{CATEGORIAS.map(c => <td key={c}>{p.votos[c]?.nome ?? '—'}</td>)}</tr>)}</tbody></table></div>
    </section>

    <section className="awd-results"><header><span>Apuração administrativa</span><h2>Resultados por categoria</h2><p>Parciais visíveis somente aqui. Empates no topo produzem múltiplos vencedores.</p></header><div className="awd-results-grid">{CATEGORIAS.map(codigo => {
      const resultado = dados.apuracao[codigo]
      return <article key={codigo}><div className="awd-result-title"><Award size={18} /><div><h3>{resultado.nome}</h3><span>{resultado.total_votos} votos</span></div>{resultado.empate && <b>Empate</b>}</div>
        {resultado.vencedores.length > 0 && <div className="awd-winners"><small>{resultado.vencedores.length > 1 ? 'Vencedores' : 'Vencedor'}</small><strong>{resultado.vencedores.map(v => v.nome).join(' · ')}</strong></div>}
        <ol>{resultado.ranking.map(item => <li key={item.pessoa_id} className={item.posicao === 1 && item.votos > 0 ? 'is-winner' : ''}><span>{item.posicao}º</span><b>{item.nome}</b><em>{item.votos} <small>{item.votos === 1 ? 'voto' : 'votos'} · {item.percentual}%</small></em></li>)}</ol>
      </article>
    })}</div></section>

    <section className="awd-danger-zone">
      <div><Trash2 size={20} /><span>Zona de perigo</span><h2>Zerar dados dos Awards</h2></div>
      <p>Remove todos os votos e as curadorias de Revelação e Jessé. A votação volta para FECHADA. Atletas, inscrições, times e dados do torneio são preservados.</p>
      {!confirmandoReset ? <button className="adm-btn adm-btn--danger" disabled={Boolean(ocupado)} onClick={() => setConfirmandoReset(true)}>Zerar dados</button> : <div className="awd-reset-confirm">
        <label>Digite <strong>ZERAR AWARDS</strong> para confirmar<input autoFocus value={confirmacaoReset} onChange={e => setConfirmacaoReset(e.target.value)} /></label>
        <div><button className="adm-btn" disabled={ocupado === 'zerar-awards'} onClick={() => { setConfirmandoReset(false); setConfirmacaoReset('') }}>Cancelar</button><button className="adm-btn adm-btn--danger" disabled={ocupado === 'zerar-awards' || confirmacaoReset !== 'ZERAR AWARDS'} onClick={zerarAwards}>{ocupado === 'zerar-awards' ? 'Zerando…' : 'Confirmar e zerar'}</button></div>
      </div>}
    </section>
  </div>
}
