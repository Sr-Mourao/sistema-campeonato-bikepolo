import { useEffect, useState } from 'react'
import { torneioPublico, type TorneioResumo } from '../../services/torneioPublico'
import ArbitrationQuickGuide from './regulamento/ArbitrationQuickGuide'
import ConductTerms from './regulamento/ConductTerms'
import OperationalRules from './regulamento/OperationalRules'
import { useTournamentCategory } from '../../contexts/TournamentContext'
import { formatoDe } from '../../services/formatoTorneio'

interface Props { resumo: TorneioResumo }

const REGRAS_OFICIAIS_URL = 'https://gitlab.com/poabp/regras-ptbr/-/raw/main/pre-compilado/regulamento.pdf?ref_type=heads&inline=true'

const SECOES = [
  { id: 'competicao', numero: '01', label: 'Competição' },
  { id: 'operacao', numero: '02', label: 'Operação dos Jogos' },
  { id: 'arbitragem', numero: '03', label: 'Arbitragem' },
  { id: 'regras-oficiais', numero: '04', label: 'Regras Oficiais' },
  { id: 'conduta', numero: '05', label: 'Conduta e Participação' },
]

/** Dados de pontuação e desempate continuam vindo da API; esta página só os apresenta. */
export default function Regulamento({ resumo }: Props) {
  const categoria = useTournamentCategory()
  const [totalTimes, setTotalTimes] = useState<number | null>(null)

  useEffect(() => {
    torneioPublico.classificacao(categoria).then(d => setTotalTimes(d.classificacao.length))
  }, [categoria])

  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (!SECOES.some(secao => secao.id === id)) return
    const frame = window.requestAnimationFrame(() => {
      const alvo = document.getElementById(id)
      if (!alvo) return
      const raiz = document.documentElement
      const comportamentoAnterior = raiz.style.scrollBehavior
      raiz.style.scrollBehavior = 'auto'
      alvo.scrollIntoView()
      raiz.style.scrollBehavior = comportamentoAnterior
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  const t = resumo.torneio
  const ultimaVagaRepescagem = totalTimes
  const formato = formatoDe(t)

  // 2° Pior (8 times): todos contra todos + Double direta — sem suíço, bye, Equalização ou Repescagem.
  if (formato.double === 'direta_8') return (
    <section className="reg-page">
      <header className="reg-hero"><span>Formato oficial</span><h3>{formato.nome}</h3><p>Todos contra todos seguido de Double Elimination.</p></header>
      <section className="reg-section"><h4>Primeira Fase</h4><p>As {formato.participantes} equipes se enfrentam uma vez em {formato.rodadas} rodadas de {Math.floor(formato.participantes / 2)} jogos, totalizando {formato.jogos_primeira_fase} partidas. Não há folga nem bye.</p></section>
      <section className="reg-section"><h4>Classificação</h4>
        <p className="reg-pontuacao"><span>Vitória <strong>{t.pontos_vitoria}</strong></span><span>Empate <strong>{t.pontos_empate}</strong></span><span>Derrota <strong>{t.pontos_derrota}</strong></span></p>
        <p>Só os jogos da Primeira Fase contam. Critérios de desempate, na ordem:</p>
        <ol className="reg-criterios">{resumo.criterios.map(c => <li key={c.chave}>{c.label}</li>)}</ol>
        <p>No confronto direto, contam apenas os jogos entre os times empatados (mini-tabela do grupo). Se ainda assim tudo empatar, vale o número do time (Time 1 à frente do Time 2, e assim por diante).</p>
      </section>
      <section className="reg-section"><h4>Entrada na Double</h4><p>Os {formato.participantes} times entram pela classificação final da Primeira Fase: 1º×8º, 2º×7º, 3º×6º e 4º×5º. A primeira derrota leva para a chave Losers; a segunda elimina.</p></section>
      <section className="reg-section"><h4>Grande Final</h4><p>Se o finalista invicto vencer a GF, o título está decidido. Se o representante da Losers vencer, a GF2 decide a competição.</p></section>
      <OperationalRules /><ArbitrationQuickGuide /><ConductTerms />
    </section>
  )

  if (false) return (
    <section className="reg-page">
      <header className="reg-hero"><span>Formato oficial</span><h3>4º Brasileiro MTNB</h3><p>Todos contra todos seguido de Double Elimination.</p></header>
      <section className="reg-section"><h4>Primeira Fase</h4><p>As cinco equipes se enfrentam uma vez em cinco rodadas, totalizando dez partidas. A folga de calendário não vale vitória, pontos ou estatística.</p></section>
      <section className="reg-section"><h4>Entrada na Double</h4><p>O 5º enfrenta o 4º no play-in. O vencedor enfrenta o 1º colocado; no outro lado, 2º enfrenta 3º. A segunda derrota elimina.</p></section>
      <section className="reg-section"><h4>Grande Final</h4><p>Se o finalista invicto vencer a GF, o título está decidido. Se o representante da Losers vencer, a GF2 decide a competição.</p></section>
      <OperationalRules /><ArbitrationQuickGuide /><ConductTerms />
    </section>
  )

  return (
    <article className="reg-page">
      <header className="reg-intro">
        <p className="reg-kicker">Documento do evento</p>
        <h2>Regulamento do Campeonato</h2>
        <p>
          Consulte aqui o formato da competição, as regras operacionais específicas do
          evento, o resumo técnico de arbitragem e os termos de participação.
        </p>
      </header>

      <nav className="reg-index" aria-label="Seções do regulamento">
        {SECOES.map(secao => (
          <a key={secao.id} href={`#${secao.id}`}>
            <span aria-hidden="true">{secao.numero}</span>
            {secao.label}
          </a>
        ))}
      </nav>

      <section id="competicao" className="reg-section" aria-labelledby="competicao-title">
        <div className="reg-section-heading">
          <span aria-hidden="true">01</span>
          <div>
            <p>Formato e classificação</p>
            <h3 id="competicao-title">Competição</h3>
          </div>
        </div>

        <div className="reg-bloco">
          <h4>Primeira Fase</h4>
          <ul>
            <li>{totalTimes ?? '—'} times disputam a fase classificatória.</li>
            <li>{t.rodadas_swiss} rodadas no sistema suíço.</li>
            <li>A 1ª rodada do sistema suíço é definida por sorteio cego.</li>
            <li>1 bye por rodada — ao final, {t.rodadas_swiss} times terão recebido exatamente 1 bye.</li>
            <li>Bye não vale pontos nem conta como jogo (não soma J/V/E/D/gols/faltas).</li>
            <li>Os {t.rodadas_swiss} times que tiveram bye disputam a Equalização entre si.</li>
            <li>A Equalização vale normalmente para a classificação.</li>
            <li>Ao final, todos os times têm 4 jogos classificatórios reais.</li>
          </ul>
        </div>

        <div className="reg-bloco">
          <h4>Classificação</h4>
          <p className="reg-pontuacao">
            <span>Vitória <strong>{t.pontos_vitoria}</strong></span>
            <span>Empate <strong>{t.pontos_empate}</strong></span>
            <span>Derrota <strong>{t.pontos_derrota}</strong></span>
          </p>
          <p>Critérios de desempate atuais, na ordem configurada para o torneio:</p>
          <ol className="reg-criterios">
            {resumo.criterios.map(c => <li key={c.chave}>{c.label}</li>)}
          </ol>
          <ul>
            <li>1º ao {t.classificados_diretos}º lugar: classificados direto.</li>
            <li>{t.classificados_diretos + 1}º ao {ultimaVagaRepescagem ?? '—'}º lugar: Repescagem.</li>
          </ul>
        </div>

        <div className="reg-bloco">
          <h4>Repescagem</h4>
          <p>
            A Repescagem é disputada em formato de eliminação simples e concede duas vagas
            para a chave Double Elimination. Os times do{' '}
            {t.classificados_diretos + 1}º ao {ultimaVagaRepescagem ?? '—'}º lugar disputam
            essas {t.vagas_repescagem} vaga{t.vagas_repescagem === 1 ? '' : 's'} em confrontos
            eliminatórios que cruzam os colocados por proximidade de posição.
          </p>
          <p>
            Os vencedores finais dos dois caminhos da Repescagem conquistam essas vagas,
            mas não existe 1º ou 2º lugar da Repescagem, pois os caminhos possuem estruturas
            diferentes — alguns times disputam duas partidas, enquanto o{' '}
            {t.classificados_diretos + 1}º colocado pode conquistar sua vaga disputando apenas uma.
          </p>
        </div>

        <div className="reg-bloco">
          <h4>Semeamento dos Repescados</h4>
          <p>
            Após a definição dos dois classificados pela Repescagem, será considerada a
            classificação final da Primeira Fase para determinar seu posicionamento na chave
            Double Elimination.
          </p>
          <p>
            Entre os dois repescados, aquele que terminou melhor colocado na Primeira Fase
            será considerado o <strong>melhor seed entre os repescados</strong> e enfrentará o
            2º colocado da Primeira Fase. O outro repescado enfrentará o 1º colocado.
          </p>
          <p>
            Não são considerados os placares, saldo de gols, número de partidas ou qualquer
            outro indicador da campanha realizada dentro da Repescagem para definir esse
            posicionamento.
          </p>

          <div className="reg-reseed-visual" aria-label="Confrontos dos times repescados">
            <div className="reg-reseed-col">
              <div className="reg-reseed-label">Melhor seed entre os repescados</div>
              <div className="reg-reseed-sub">Melhor posição na Primeira Fase</div>
              <div className="reg-reseed-seta">enfrenta</div>
              <div className="reg-reseed-alvo">2º colocado</div>
            </div>
            <div className="reg-reseed-col">
              <div className="reg-reseed-label">Outro seed entre os repescados</div>
              <div className="reg-reseed-sub">Pior posição na Primeira Fase</div>
              <div className="reg-reseed-seta">enfrenta</div>
              <div className="reg-reseed-alvo">1º colocado</div>
            </div>
          </div>

          <aside className="reg-callout reg-callout--accent">
            A Repescagem define quem conquista as duas vagas. A classificação da Primeira
            Fase define o seed dos dois classificados.
          </aside>
        </div>

        <div className="reg-bloco">
          <h4>Double Elimination</h4>
          <ul>
            <li>1ª derrota na chave Winners → o time cai para a chave Losers.</li>
            <li>2ª derrota → eliminação do torneio.</li>
            <li>Se o time vindo da chave Losers vencer a Grande Final, há uma segunda partida (GF2) que decide o campeonato.</li>
          </ul>
        </div>
      </section>

      <OperationalRules />
      <ArbitrationQuickGuide />

      <section id="regras-oficiais" className="reg-section" aria-labelledby="regras-oficiais-title">
        <div className="reg-section-heading">
          <span aria-hidden="true">04</span>
          <div>
            <p>Referência normativa completa</p>
            <h3 id="regras-oficiais-title">Regras Oficiais de Bici Polo</h3>
          </div>
        </div>
        <div className="reg-bloco">
          <p>
            As partidas do 2° Pior Campeonato de Bici Polo são regidas pelo
            Regulamento Oficial de Bici Polo — Versão brasileira — 28 de agosto de 2026.
          </p>
          <div className="reg-reference-comparison">
            <div>
              <strong>Esta página</strong>
              <p>Formato e regras operacionais específicas do campeonato, além do resumo técnico para consulta.</p>
            </div>
            <div>
              <strong>Regulamento Oficial</strong>
              <p>Referência normativa completa para as partidas.</p>
            </div>
          </div>
          <p className="reg-oficial-hint">
            O Resumo Técnico facilita a consulta durante o evento, mas não substitui o
            Regulamento Oficial.
          </p>
          <a className="reg-oficial-link" href={REGRAS_OFICIAIS_URL} target="_blank" rel="noopener noreferrer">
            Consultar Regulamento Oficial de Bici Polo ↗
          </a>
        </div>
      </section>

      <ConductTerms />
    </article>
  )
}
