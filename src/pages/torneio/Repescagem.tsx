import { useState, useEffect } from 'react'
import { torneioPublico, type TorneioResumo, type JogoPublico, type StandingRowPublico } from '../../services/torneioPublico'
import { ResponsiveBracket } from '../../components/torneio/BracketView'
import { porCodigo, type BracketJogo } from '../../components/torneio/bracketHelpers'
import { REP_COLS, repescagemPlaceholders } from '../../components/torneio/bracketDefs'

interface Props { resumo: TorneioResumo }

/** Anota o lado (time_a/time_b) que efetivamente venceu — nunca assume um lado fixo, já
 * que REP-R4/REP-R5 recebem seus dois lados por propagação (qualquer um pode vencer). */
function subtituloDoVencedor(jogo: BracketJogo | undefined, texto: string): [string | null, string | null] | undefined {
  if (!jogo || jogo.vencedor_time_id == null) return undefined
  return jogo.vencedor_time_id === jogo.time_a_id ? [texto, null] : [null, texto]
}

/**
 * Repescagem (seção 10 do brief de área pública) — chave visual + dependências explícitas
 * mesmo antes de a fase existir no banco (placeholders conceituais calculados a partir da
 * config real: classificados diretos/vagas de repescagem). Assim que os jogos existem, os
 * dados reais (via `chaves`) sempre substituem o placeholder.
 *
 * Reseeding (brief "reseeding da Repescagem"): a Repescagem só concede as duas vagas — ela
 * NUNCA produz uma classificação própria entre os dois classificados (os caminhos R1-R5 são
 * assimétricos: o 7º pode conquistar a vaga com uma partida só). Por isso os vencedores de
 * REP-R4/REP-R5 aparecem aqui como "Classificado para a Double", nunca "Repescado A/B" com
 * ar de ranking — e a anotação de melhor/segundo seed (quando os dois já são conhecidos) só
 * reflete a posição já definida pela Primeira Fase, nunca a campanha na Repescagem em si.
 * O reseeding em si acontece no backend (gerarDouble()/seedsRepescados(), bracket.php);
 * esta tela só EXIBE o resultado, nunca decide.
 */
export default function Repescagem({ resumo }: Props) {
  const [rep, setRep] = useState<JogoPublico[] | null>(null)
  const [standings, setStandings] = useState<StandingRowPublico[] | null>(null)
  useEffect(() => { torneioPublico.chaves().then(d => setRep(d.repescagem)) }, [])
  useEffect(() => { torneioPublico.classificacao().then(d => setStandings(d.classificacao)) }, [])

  const diretos = resumo.torneio.classificados_diretos
  const vagas = resumo.torneio.vagas_repescagem
  const placeholders = repescagemPlaceholders(diretos)
  // Última posição que disputa a Repescagem = total de times, não `diretos + vagas`
  // (vagas é quantas vagas a Repescagem concede na Double, não quantos times a disputam —
  // com 13 times/6 diretos/2 vagas, são 7 times do 7º ao 13º disputando as 2 vagas).
  const ultimaPosicaoRepescagem = standings?.length ?? null

  const rep4 = rep ? porCodigo(rep, 'REP-R4') : undefined
  const rep5 = rep ? porCodigo(rep, 'REP-R5') : undefined
  const badges: Record<string, string> = {
    'REP-R4': rep4?.status === 'encerrado' ? 'Classificado para a Double' : '',
    'REP-R5': rep5?.status === 'encerrado' ? 'Classificado para a Double' : '',
  }

  // Só exibição: uma vez que os DOIS classificados existem, mostra quem é o melhor seed —
  // comparando a `posicao` já pronta da Primeira Fase, nunca recalculando critério nenhum.
  let subtitulos: Record<string, [string | null, string | null]> | undefined
  const posicaoPorTime = new Map((standings ?? []).map(r => [r.time_id, r.posicao]))
  const idA = rep4?.vencedor_time_id ?? null
  const idB = rep5?.vencedor_time_id ?? null
  if (idA != null && idB != null && posicaoPorTime.has(idA) && posicaoPorTime.has(idB)) {
    const posA = posicaoPorTime.get(idA)!
    const posB = posicaoPorTime.get(idB)!
    const aEhMelhor = posA <= posB
    const textoA = aEhMelhor ? `Melhor seed entre os repescados · ${posA}º na Primeira Fase` : `Segundo seed entre os repescados · ${posA}º na Primeira Fase`
    const textoB = aEhMelhor ? `Segundo seed entre os repescados · ${posB}º na Primeira Fase` : `Melhor seed entre os repescados · ${posB}º na Primeira Fase`
    subtitulos = {}
    const subA = subtituloDoVencedor(rep4, textoA)
    const subB = subtituloDoVencedor(rep5, textoB)
    if (subA) subtitulos['REP-R4'] = subA
    if (subB) subtitulos['REP-R5'] = subB
  }

  return (
    <section className="bracket-page bracket-page--rep">
      <header className="bracket-hero">
        <div className="bracket-hero-kicker">Última rota para a Double</div>
        <h3>Repescagem</h3>
        <p>
          Do {diretos + 1}º ao {ultimaPosicaoRepescagem ?? '—'}º lugar, cada confronto vale
          permanência no campeonato.
        </p>
        <div className="bracket-hero-facts">
          <span>Eliminação simples</span>
          <span>{vagas} vaga{vagas === 1 ? '' : 's'}</span>
          <span>{REP_COLS.reduce((total, [, jogos]) => total + jogos.length, 0)} confrontos</span>
        </div>
      </header>

      <div className="bracket-context-grid">
        <p className="trp-explicacao">
          As três partidas iniciais cruzam os colocados por proximidade. Os vencedores de R1
          e R2 se enfrentam em R4; o {diretos + 1}º colocado aguarda o vencedor de R3 em R5.
        </p>
        <div className="rep-destaque">
          A Repescagem define as vagas. A classificação da Primeira Fase define o seed dos
          dois classificados — não existe 1º ou 2º lugar entre os caminhos.
        </div>
      </div>

      {rep === null ? (
        <p className="trp-hint">Carregando…</p>
      ) : (
        <div className="bracket-stage bracket-stage--rep">
          <div className="bracket-stage-head">
            <div><span>Chave completa</span><small>O caminho até as duas vagas</small></div>
            <b>{rep.filter(j => j.status === 'encerrado').length}/{REP_COLS.reduce((total, [, jogos]) => total + jogos.length, 0)} concluídos</b>
          </div>
          <ResponsiveBracket cols={REP_COLS} lista={rep} badges={badges} placeholders={placeholders} subtitulos={subtitulos} showcase />
        </div>
      )}
    </section>
  )
}
