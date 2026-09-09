export type AwardCode = 'mvp' | 'wow' | 'revelacao' | 'jesse'
export interface AwardWinner { pessoa_id: number; nome: string; foto: string | null; time: string | null; votos: number }
export interface AwardProjectionResult { codigo: AwardCode; nome: string; descricao: string; total_votos: number; maior_quantidade: number; vencedores: AwardWinner[]; empate: boolean }

export function resultadoVisivel(resultado: AwardProjectionResult | undefined) {
  return resultado && resultado.maior_quantidade > 0 ? resultado.vencedores : []
}
