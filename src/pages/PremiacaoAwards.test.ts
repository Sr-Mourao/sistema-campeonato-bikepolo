import { describe, expect, it } from 'vitest'
import { resultadoVisivel, type AwardProjectionResult, type AwardWinner } from '../components/projection/awardProjectionData'

const winner = (pessoa_id: number, nome: string): AwardWinner => ({ pessoa_id, nome, foto: null, time: null, votos: 1 })
const result = (maior_quantidade: number, vencedores: AwardWinner[]): AwardProjectionResult => ({
  codigo: 'mvp', nome: 'MVP', descricao: 'Melhor Atleta em Quadra', total_votos: maior_quantidade,
  maior_quantidade, vencedores, empate: vencedores.length > 1,
})

describe('resultado visível na projeção de Awards', () => {
  it('exibe normalmente um vencedor com somente um voto', () => {
    expect(resultadoVisivel(result(1, [winner(1, 'Ana')])).map(item => item.nome)).toEqual(['Ana'])
  })

  it('preserva todos os vencedores empatados sem hierarquia', () => {
    expect(resultadoVisivel(result(1, [winner(1, 'Ana'), winner(2, 'Bruno')]))).toHaveLength(2)
  })

  it('não transforma candidatos com zero votos em vencedores', () => {
    expect(resultadoVisivel(result(0, []))).toEqual([])
    expect(resultadoVisivel(result(0, [winner(1, 'Ana')]))).toEqual([])
  })
})
