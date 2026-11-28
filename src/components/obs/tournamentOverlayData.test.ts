import { describe, expect, it } from 'vitest'
import type { CampeaoPublico, JogoPublico, StandingRowPublico } from '../../services/torneioPublico'
import { chaveMudouParaCampeao, classificacaoOficial, classificadosRepescagem, colunaDoDesempate, cruzamentosDaDouble, escolherEtapaClassificacao, escolherRodada, estadoDaFinal, jogoTemPlacar, partidaOperacionalEmFoco, porCodigo } from './tournamentOverlayData'

const jogo = (codigo: string, patch: Partial<JogoPublico> = {}): JogoPublico => ({
  codigo, bracket: null, ordem: 1, status: 'agendado', placar_a: null, placar_b: null,
  is_bye: 0, overtime: 0, horario_previsto: null, horario_inicio_real: null, horario_fim_real: null,
  fase_tipo: 'swiss', fase_rodada: 1, fase_rotulo: 'Rodada 1', time_a_nome: 'A', time_b_nome: 'B',
  time_a_id: 1, time_b_id: 2, vencedor_time_id: null, time_a_origem: null, time_b_origem: null,
  time_a_logo: null, time_b_logo: null, ...patch,
})

describe('dados dos overlays de fase', () => {
  it('mantém a ordem oficial da classificação', () => {
    const rows = [{ time_id: 9, posicao: 1 }, { time_id: 2, posicao: 2 }] as StandingRowPublico[]
    expect(classificacaoOficial(rows).map(r => r.time_id)).toEqual([9, 2])
  })

  it('prefere a rodada em andamento e ignora a próxima apenas criada', () => {
    const jogos = [
      jogo('R2-A', { fase_rodada: 2, status: 'encerrado', placar_a: 3, placar_b: 2 }),
      jogo('R3-A', { fase_rodada: 3, status: 'em_andamento', placar_a: 1, placar_b: 0 }),
      jogo('R4-A', { fase_rodada: 4 }),
    ]
    expect(escolherRodada(jogos)?.rodada).toBe(3)
    expect(escolherRodada([jogos[0], jogos[2]])?.rodada).toBe(2)
  })

  it('reconhece as rodadas do todos contra todos (2° Pior de 8)', () => {
    const rr = (codigo: string, rodada: number, patch: Partial<JogoPublico> = {}) => jogo(codigo, { fase_tipo: 'round_robin', fase_rodada: rodada, fase_rotulo: `Todos contra todos — Rodada ${rodada}`, ...patch })
    const jogos = [1, 2, 3, 4, 5, 6, 7].map(r => rr(`RR${r}.1`, r))
    expect(escolherEtapaClassificacao(jogos)).toMatchObject({ tipo: 'rodada', rodada: 1, rotulo: 'Rodada 1' })
    jogos[0] = rr('RR1.1', 1, { status: 'encerrado', placar_a: 2, placar_b: 1 })
    jogos[1] = rr('RR2.1', 2, { status: 'em_andamento', placar_a: 0, placar_b: 0 })
    expect(escolherRodada(jogos)?.rodada).toBe(2)
  })

  it('cruzamentos da Double de 8: projeção 1×8, 2×7, 3×6, 4×5 e, depois, os jogos oficiais', () => {
    const classif = Array.from({ length: 8 }, (_, i) => ({ time_id: 100 + i, nome: `Time ${i + 1}`, logo: null, posicao: i + 1 }))
    const proj = cruzamentosDaDouble(classif, [])
    expect(proj.map(c => `${c.codigo}:${c.a.nome}x${c.b.nome}`)).toEqual(['QD:Time 1xTime 8', 'QC:Time 2xTime 7', 'QB:Time 3xTime 6', 'QA:Time 4xTime 5'])
    expect(proj.every(c => c.jogo === undefined)).toBe(true)
    const qd = jogo('QD', { fase_tipo: 'double', fase_rodada: null, time_a_id: 900, time_a_nome: 'Oficial A', time_b_id: 901, time_b_nome: 'Oficial B', status: 'em_andamento' })
    const oficial = cruzamentosDaDouble(classif, [qd])
    expect(oficial[0]).toMatchObject({ codigo: 'QD', jogo: qd, a: { seed: 1, nome: 'Oficial A' }, b: { seed: 8, nome: 'Oficial B' } })
    expect(oficial[1].jogo).toBeUndefined()
  })

  it('antes do início mostra a primeira rodada criada', () => {
    expect(escolherRodada([jogo('R2', { fase_rodada: 2 }), jogo('R1')])?.rodada).toBe(1)
  })

  it('mantém R4 até a Equalização existir', () => {
    const r4AoVivo = jogo('R4-A', { fase_rodada: 4, status: 'em_andamento' })
    const r4Encerrada = { ...r4AoVivo, status: 'encerrado' }
    expect(escolherEtapaClassificacao([r4AoVivo])).toMatchObject({ tipo: 'rodada', rodada: 4 })
    expect(escolherEtapaClassificacao([r4Encerrada])).toMatchObject({ tipo: 'rodada', rodada: 4 })
  })

  it.each(['agendado', 'em_andamento', 'encerrado'])('Equalização %s substitui R4', status => {
    const jogos = [
      jogo('R4-A', { fase_rodada: 4, status: 'encerrado' }),
      jogo('EQ1', { fase_tipo: 'equalizacao', fase_rodada: null, fase_rotulo: 'Equalização', status }),
      jogo('EQ2', { fase_tipo: 'equalizacao', fase_rodada: null, fase_rotulo: 'Equalização', status: status === 'em_andamento' ? 'agendado' : status }),
    ]
    expect(escolherEtapaClassificacao(jogos)).toMatchObject({ tipo: 'equalizacao', rotulo: 'Equalização' })
    expect(escolherEtapaClassificacao(jogos)?.jogos.map(j => j.codigo)).toEqual(['EQ1', 'EQ2'])
  })

  it('mantém a Equalização quando ela está parcialmente encerrada', () => {
    const etapa = escolherEtapaClassificacao([
      jogo('R4-A', { fase_rodada: 4, status: 'encerrado' }),
      jogo('EQ1', { fase_tipo: 'equalizacao', fase_rodada: null, status: 'encerrado' }),
      jogo('EQ2', { fase_tipo: 'equalizacao', fase_rodada: null, status: 'em_andamento' }),
    ])
    expect(etapa).toMatchObject({ tipo: 'equalizacao', jogos: [{ codigo: 'EQ1' }, { codigo: 'EQ2' }] })
  })

  it('não transforma bye em jogo da Equalização', () => {
    const etapa = escolherEtapaClassificacao([
      jogo('EQ1', { fase_tipo: 'equalizacao', fase_rodada: null }),
      jogo('EQ-BYE', { fase_tipo: 'equalizacao', fase_rodada: null, is_bye: 1 }),
    ])
    expect(etapa?.jogos.map(j => j.codigo)).toEqual(['EQ1'])
  })

  it('interpreta a metadata oficial de desempate sem comparar ou reordenar linhas', () => {
    expect(colunaDoDesempate(null)).toBeNull()
    expect(colunaDoDesempate('vitorias')).toBe('v')
    expect(colunaDoDesempate('empates')).toBe('e')
    expect(colunaDoDesempate('saldo')).toBe('sg')
    expect(colunaDoDesempate('buchholz')).toBe('buch')
    expect(colunaDoDesempate('fair_play')).toBe('fp')
    expect(colunaDoDesempate('gols_pro')).toBe('gp')
    expect(colunaDoDesempate('confronto_direto')).toBeNull()
  })

  it('bye nunca vira placar ou vitória visual', () => {
    expect(jogoTemPlacar(jogo('BYE', { is_bye: 1, status: 'encerrado', placar_a: 0, placar_b: 0 }))).toBe(false)
  })

  it('usa somente vencedores oficiais de R4/R5, sem recalcular seed', () => {
    const rep = [jogo('REP-R4', { fase_tipo: 'repescagem', status: 'encerrado', vencedor_time_id: 2 })]
    expect(classificadosRepescagem(rep)).toEqual([{ time_id: 2, nome: 'B', logo: null, codigo: 'REP-R4' }])
  })

  it('a Double representa a partida oficial existente sem criar outra árvore', () => {
    const qa = jogo('QA', { fase_tipo: 'double', bracket: 'winners', vencedor_time_id: 1 })
    const b1 = jogo('B1', { fase_tipo: 'double', bracket: 'losers', time_a_origem: '{"tipo":"jogo","codigo":"QA","resultado":"perdedor"}' })
    expect(porCodigo([qa, b1], 'QA')).toBe(qa)
    expect(porCodigo([qa, b1], 'B1')?.time_a_origem).toContain('perdedor')
  })

  it('destaca a ordem operacional recebida sem confundir time definido com proximo jogo', () => {
    const b1 = jogo('B1', { fase_tipo: 'double', ordem: 5 })
    const b2 = jogo('B2', { fase_tipo: 'double', ordem: 6 })
    const sf1 = jogo('SF1', { fase_tipo: 'double', ordem: 7 })
    expect(partidaOperacionalEmFoco([b1, b2, sf1])?.codigo).toBe('B1')
    expect(partidaOperacionalEmFoco([{ ...b1, status: 'encerrado' }, b2, sf1])?.codigo).toBe('B2')
    expect(partidaOperacionalEmFoco([{ ...b1, status: 'encerrado' }, { ...b2, status: 'encerrado' }, sf1])?.codigo).toBe('SF1')
    expect(partidaOperacionalEmFoco([b1, b2, { ...sf1, status: 'em_andamento' }])?.codigo).toBe('SF1')
  })

  it('representa GF/GF2 existentes e não declara campeão cedo', () => {
    const gf = jogo('GF', { fase_tipo: 'double', bracket: 'final', time_a_id: null, time_b_id: null })
    expect(estadoDaFinal([gf], null).tipo).toBe('aguardando')
    expect(estadoDaFinal([{ ...gf, time_a_id: 1, time_b_id: 2 }], null).tipo).toBe('partida')
    expect(estadoDaFinal([{ ...gf, status: 'encerrado', vencedor_time_id: 2 }, jogo('GF2', { fase_tipo: 'double', bracket: 'final' })], null)).toMatchObject({ tipo: 'partida', jogo: { codigo: 'GF2' } })
  })

  it('GF ou GF2 só produz campeão quando o backend o confirma', () => {
    const gf: CampeaoPublico = { time_id: 1, nome: 'A', logo: null, jogo_codigo: 'GF' }
    const gf2: CampeaoPublico = { ...gf, time_id: 2, nome: 'B', jogo_codigo: 'GF2' }
    expect(estadoDaFinal([], gf)).toEqual({ tipo: 'campeao', campeao: gf })
    expect(estadoDaFinal([], gf2)).toEqual({ tipo: 'campeao', campeao: gf2 })
  })

  it('a transição de campeão dispara uma vez e polling seguinte não repete', () => {
    const campeao: CampeaoPublico = { time_id: 1, nome: 'A', logo: null, jogo_codigo: 'GF' }
    expect(chaveMudouParaCampeao(null, campeao)).toBe(true)
    expect(chaveMudouParaCampeao(campeao, campeao)).toBe(false)
  })
})
