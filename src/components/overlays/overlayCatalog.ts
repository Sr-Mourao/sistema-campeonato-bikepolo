export type OverlayGroup = 'Ao vivo' | 'Fases' | 'Pausas' | 'Projeção / Palco'

export interface OverlayCatalogItem {
  nome: string
  descricao: string
  path: string
  grupo: OverlayGroup
  resolucao: string
  observacao?: string
  destino?: 'OBS' | 'PROJETOR'
}

export const OVERLAY_CATALOG: OverlayCatalogItem[] = [
  { nome: 'Placar', descricao: 'Scorebug permanente da partida principal.', path: '/torneio/overlay/placar', grupo: 'Ao vivo', resolucao: '1920×1080 / 1280×720', observacao: 'Mantenha ativo durante o jogo.' },
  { nome: 'Eventos', descricao: 'Entradas automáticas de gols e faltas.', path: '/torneio/overlay/eventos', grupo: 'Ao vivo', resolucao: '1920×1080 / 1280×720', observacao: 'Pode permanecer aberto; eventos entram pela fila oficial.' },
  { nome: 'Emissora', descricao: 'Assinatura institucional da transmissão.', path: '/torneio/overlay/emissora', grupo: 'Ao vivo', resolucao: '1920×1080 / 1280×720' },
  { nome: 'Confronto', descricao: 'Apresentação da partida principal.', path: '/torneio/overlay/confronto', grupo: 'Ao vivo', resolucao: '1920×1080 / 1280×720', observacao: 'Use na apresentação ou antes do início.' },
  { nome: 'Classificação', descricao: 'Classificação oficial e etapa atual da Primeira Fase.', path: '/torneio/overlay/classificacao', grupo: 'Fases', resolucao: '1920×1080 / 1280×720' },
  { nome: 'Repescagem', descricao: 'Chave completa e classificados para a Double.', path: '/torneio/overlay/repescagem', grupo: 'Fases', resolucao: '1920×1080 / 1280×720' },
  { nome: 'Double Elimination', descricao: 'Winners e Losers Bracket na mesma composição.', path: '/torneio/overlay/double', grupo: 'Fases', resolucao: '1920×1080 / 1280×720' },
  { nome: 'Grande Final', descricao: 'Final, GF2 e celebração do campeão oficial.', path: '/torneio/overlay/final', grupo: 'Fases', resolucao: '1920×1080 / 1280×720', observacao: 'A mesma fonte se transforma no estado de campeão.' },
  { nome: 'Intervalo', descricao: 'Peça de pausa com informações da transmissão.', path: '/torneio/overlay/intervalo', grupo: 'Pausas', resolucao: '1920×1080 / 1280×720' },
  { nome: 'Pódio — Brasileiro Misto', descricao: 'Cerimônia do 1º, 2º e 3º lugares oficiais.', path: '/overlays/podio', grupo: 'Projeção / Palco', resolucao: '1920×1080 / 1366×768', destino: 'PROJETOR', observacao: 'Disponível após a definição oficial do pódio.' },
  { nome: 'Awards — Geral', descricao: 'Os vencedores de MVP, WOW, Revelação e Jessé em uma tela.', path: '/overlays/awards', grupo: 'Projeção / Palco', resolucao: '1920×1080 / 1366×768', destino: 'PROJETOR', observacao: 'Entre no admin neste navegador antes de abrir.' },
  { nome: 'MVP', descricao: 'Revelação do prêmio de Melhor Atleta em Quadra.', path: '/overlays/awards/mvp', grupo: 'Projeção / Palco', resolucao: '1920×1080 / 1366×768', destino: 'PROJETOR', observacao: 'Recarregue a página para repetir a animação.' },
  { nome: 'WOW', descricao: 'Revelação do prêmio de Atleta que Mais Evoluiu.', path: '/overlays/awards/wow', grupo: 'Projeção / Palco', resolucao: '1920×1080 / 1366×768', destino: 'PROJETOR', observacao: 'Recarregue a página para repetir a animação.' },
  { nome: 'Revelação', descricao: 'Revelação do Award de Atleta Revelação.', path: '/overlays/awards/revelacao', grupo: 'Projeção / Palco', resolucao: '1920×1080 / 1366×768', destino: 'PROJETOR', observacao: 'Recarregue a página para repetir a animação.' },
  { nome: 'Jessé', descricao: 'Revelação do prêmio Coração e Caos da Comunidade.', path: '/overlays/awards/jesse', grupo: 'Projeção / Palco', resolucao: '1920×1080 / 1366×768', destino: 'PROJETOR', observacao: 'Recarregue a página para repetir a animação.' },
]

/** URLs estáveis próprias do MTNB; reutilizam as mesmas páginas/componentes via contexto. */
export const MTNB_OVERLAY_CATALOG: OverlayCatalogItem[] = [
  { nome: 'Placar', descricao: 'Scorebug permanente da partida principal MTNB.', path: '/torneio/mtnb/overlay/placar', grupo: 'Ao vivo', resolucao: '1920×1080 / 1280×720' },
  { nome: 'Eventos', descricao: 'Entradas automáticas de gols e faltas do MTNB.', path: '/torneio/mtnb/overlay/eventos', grupo: 'Ao vivo', resolucao: '1920×1080 / 1280×720' },
  { nome: 'Confronto', descricao: 'Apresentação da partida principal MTNB.', path: '/torneio/mtnb/overlay/confronto', grupo: 'Ao vivo', resolucao: '1920×1080 / 1280×720' },
  { nome: 'Classificação', descricao: 'Classificação do todos contra todos.', path: '/torneio/mtnb/overlay/classificacao', grupo: 'Fases', resolucao: '1920×1080 / 1280×720' },
  { nome: 'Double Elimination', descricao: 'Chave específica de cinco times.', path: '/torneio/mtnb/overlay/double', grupo: 'Fases', resolucao: '1920×1080 / 1280×720' },
  { nome: 'Grande Final', descricao: 'GF, GF2 e campeão do MTNB.', path: '/torneio/mtnb/overlay/final', grupo: 'Fases', resolucao: '1920×1080 / 1280×720' },
]

export function overlayUrl(path: string, origin = window.location.origin): string {
  return new URL(path, origin).href
}
