import { useEffect, useMemo, useState } from 'react'
import { Award, CheckCircle2, Clock3, Lock, Plus, Save, Search, Trash2, Users } from 'lucide-react'
import Avatar from '../../components/equipes/Avatar'
import { adminGet, adminPost } from '../adminApi'
import './Awards.css'
import './AwardsDanger.css'

type AwardCode = 'mvp' | 'wow' | 'revelacao' | 'jesse'
interface Atleta { pessoa_id: number; nome: string; foto: string | null; time: string | null }
interface Participante extends Atleta { status: 'votou' | 'incompleto' | 'nao_votou'; votos: Partial<Record<AwardCode, { pessoa_id: number; nome: string }>> }
interface Ranking extends Atleta { votos: number; posicao: number; percentual: number }
interface Resultado { codigo: AwardCode; nome: string; descricao: string; ranking: Ranking[]; total_votos: number; maior_quantidade: number; vencedores: Ranking[]; empate: boolean }
interface AwardMtnb { id: number; codigo: string; nome: string; descricao: string; ordem: number; publicado: boolean; vencedores: Atleta[] }
interface Dados {
  status: 'fechada' | 'aberta' | 'encerrada'
  atletas: Atleta[]
  curadoria: { revelacao: number[]; jesse: number[] }
  participacao: Participante[]
  resumo: { aptos: number; votaram: number; nao_votaram: number }
  apuracao: Record<AwardCode, Resultado>
  mtnb: { atletas: Atleta[]; categorias: AwardMtnb[] }
}

const CATEGORIAS: AwardCode[] = ['mvp', 'wow', 'revelacao', 'jesse']

function MtnbAwards({ dados, ocupado, agir }: { dados: Dados; ocupado: string; agir: (corpo: object, chave: string) => Promise<boolean> }) {
  const novaEdicao = () => ({ id: 0, nome: '', descricao: '', ordem: dados.mtnb.categorias.length + 1, publicado: false, pessoa_ids: [] as number[] })
  const [edicao, setEdicao] = useState(novaEdicao)
  const [busca, setBusca] = useState('')
  const atletas = dados.mtnb.atletas.filter(atleta => `${atleta.nome} ${atleta.time ?? ''}`.toLocaleLowerCase('pt-BR').includes(busca.toLocaleLowerCase('pt-BR')))
  function editar(award: AwardMtnb) {
    setEdicao({ id: award.id, nome: award.nome, descricao: award.descricao, ordem: award.ordem, publicado: award.publicado, pessoa_ids: award.vencedores.map(v => v.pessoa_id) })
  }
  async function salvar() {
    if (await agir({ acao: 'salvar_mtnb', ...edicao }, 'salvar-mtnb')) setEdicao(novaEdicao())
  }
  async function excluir(id: number) {
    if (window.confirm('Excluir esta premiação MTNB?')) await agir({ acao: 'excluir_mtnb', id }, `excluir-mtnb-${id}`)
  }
  return <div className="awd-mtnb-layout">
    <section className="adm-section awd-mtnb-form">
      <header><div><span>Cadastro oficial</span><h2>{edicao.id ? 'Editar premiação' : 'Nova premiação MTNB'}</h2></div>{edicao.id > 0 && <button className="adm-btn" onClick={() => setEdicao(novaEdicao())}><Plus size={15} /> Nova</button>}</header>
      <p>Cadastre os resultados definidos fora do sistema. Publicar apenas disponibiliza o resultado; não cria votação nem recalcula vencedores.</p>
      <div className="awd-mtnb-fields"><label>Nome<input value={edicao.nome} onChange={e => setEdicao(v => ({ ...v, nome: e.target.value }))} placeholder="Ex.: Destaque da categoria" /></label><label>Ordem<input type="number" min="0" value={edicao.ordem} onChange={e => setEdicao(v => ({ ...v, ordem: Number(e.target.value) }))} /></label><label className="awd-mtnb-description">Descrição<textarea value={edicao.descricao} onChange={e => setEdicao(v => ({ ...v, descricao: e.target.value }))} placeholder="Texto opcional para a página pública" /></label></div>
      <label className="awd-search"><Search size={15} /><input placeholder="Buscar atleta MTNB" value={busca} onChange={e => setBusca(e.target.value)} /></label>
      <div className="awd-curation-list awd-mtnb-athletes">{atletas.map(atleta => {
        const marcado = edicao.pessoa_ids.includes(atleta.pessoa_id)
        return <button type="button" className={marcado ? 'is-selected' : ''} onClick={() => setEdicao(v => ({ ...v, pessoa_ids: marcado ? v.pessoa_ids.filter(id => id !== atleta.pessoa_id) : [...v.pessoa_ids, atleta.pessoa_id] }))} key={atleta.pessoa_id}><span className="awd-avatar"><Avatar nome={atleta.nome} foto={atleta.foto ?? undefined} /></span><span><b>{atleta.nome}</b><small>{atleta.time ?? 'Sem time associado'}</small></span><i>{marcado ? 'Vencedor(a)' : 'Selecionar'}</i></button>
      })}</div>
      <div className="awd-mtnb-actions"><label><input type="checkbox" checked={edicao.publicado} onChange={e => setEdicao(v => ({ ...v, publicado: e.target.checked }))} /> Publicar na página de resultados</label><button className="adm-btn-primary" disabled={Boolean(ocupado) || !edicao.nome.trim()} onClick={salvar}><Save size={16} /> {ocupado === 'salvar-mtnb' ? 'Salvando…' : 'Salvar premiação'}</button></div>
    </section>
    <section className="adm-section awd-mtnb-list"><header><div><span>Premiações MTNB</span><h2>{dados.mtnb.categorias.length} cadastradas</h2></div></header>{dados.mtnb.categorias.length === 0 ? <p>Nenhuma premiação MTNB cadastrada.</p> : dados.mtnb.categorias.map(award => <article key={award.id}><div><span className={`adm-badge ${award.publicado ? 'adm-badge--ok' : 'adm-badge--tag'}`}>{award.publicado ? 'Publicado' : 'Rascunho'}</span><h3>{award.nome}</h3><p>{award.vencedores.map(v => v.nome).join(' · ') || 'Sem vencedor selecionado'}</p></div><div><button className="adm-btn" onClick={() => editar(award)}>Editar</button><button aria-label={`Excluir ${award.nome}`} className="adm-btn adm-btn--danger" disabled={Boolean(ocupado)} onClick={() => excluir(award.id)}><Trash2 size={15} /></button></div></article>)}</section>
  </div>
}

export default function AwardsAdmin() {
  const [dados, setDados] = useState<Dados | null>(null)
  const [buscas, setBuscas] = useState({ revelacao: '', jesse: '' })
  const [ocupado, setOcupado] = useState('')
  const [confirmandoReset, setConfirmandoReset] = useState(false)
  const [confirmacaoReset, setConfirmacaoReset] = useState('')
  const [aba, setAba] = useState<'misto' | 'mtnb'>('misto')

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
      <div><span>{aba === 'mtnb' ? '4º Brasileiro · MTNB' : '10º Brasileiro · Misto'}</span><h1>Awards</h1><p>{aba === 'mtnb' ? 'Cadastro e publicação das premiações definidas externamente.' : 'Curadoria, participação e apuração dos quatro prêmios individuais.'}</p></div>
      {aba === 'misto' && <div className={`awd-status awd-status--${dados.status}`}><i />{dados.status}</div>}
      {aba === 'misto' && <div className="awd-state-actions">
        {dados.status === 'fechada' && <button className="adm-btn-primary" disabled={Boolean(ocupado)} onClick={() => agir({ acao: 'abrir' }, 'abrir')}>Abrir votação</button>}
        {dados.status === 'aberta' && <button className="adm-btn adm-btn--danger" disabled={Boolean(ocupado)} onClick={() => agir({ acao: 'encerrar' }, 'encerrar')}>Encerrar votação</button>}
        {dados.status === 'encerrada' && <span><Lock size={15} /> Votos congelados</span>}
      </div>}
    </section>

    <nav className="awd-category-tabs" aria-label="Categoria dos Awards"><button className={aba === 'misto' ? 'is-active' : ''} onClick={() => setAba('misto')}>Misto · votação</button><button className={aba === 'mtnb' ? 'is-active' : ''} onClick={() => setAba('mtnb')}>MTNB · cadastro manual</button></nav>

    {aba === 'mtnb' ? <MtnbAwards dados={dados} ocupado={ocupado} agir={agir} /> : <>

    <div className="awd-stats">
      <div><Users size={20} /><strong>{dados.resumo.aptos}</strong><span>Aptos — somente MISTO</span></div>
      <div><CheckCircle2 size={20} /><strong>{dados.resumo.votaram}</strong><span>Já votaram</span></div>
      <div><Clock3 size={20} /><strong>{dados.resumo.nao_votaram}</strong><span>Ainda não votaram</span></div>
    </div>

    <section className="adm-section awd-auto"><h2>Categorias automáticas</h2><p><b>MVP</b> e <b>WOW</b> incluem automaticamente todos os {dados.atletas.length} atletas inscritos no Brasileiro Misto. Atletas exclusivamente MTNB não entram.</p></section>

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
    </>}
  </div>
}
