export type OverlayGroup = 'Ao vivo' | 'Fases' | 'Pausas' | 'Projeção / Palco'

export interface OverlayCatalogItem {
  nome: string
  descricao: string
  path: string
  grupo: OverlayGroup
  resolucao: string
  observacao?: string
  destino?: 'OBS' | 'PROJETOR'
  /** Só faz sentido em formatos com Repescagem (some no 2° Pior de 8). */
  requerRepescagem?: boolean
}

export const OVERLAY_CATALOG: OverlayCatalogItem[] = [
  { nome: 'Placar', descricao: 'Scorebug permanente da partida principal.', path: '/torneio/overlay/placar', grupo: 'Ao vivo', resolucao: '1920×1080 / 1280×720', observacao: 'Mantenha ativo durante o jogo.' },
  { nome: 'Eventos', descricao: 'Entradas automáticas de gols e faltas.', path: '/torneio/overlay/eventos', grupo: 'Ao vivo', resolucao: '1920×1080 / 1280×720', observacao: 'Pode permanecer aberto; eventos entram pela fila oficial.' },
  { nome: 'Emissora', descricao: 'Assinatura institucional da transmissão.', path: '/torneio/overlay/emissora', grupo: 'Ao vivo', resolucao: '1920×1080 / 1280×720' },
  { nome: 'Confronto', descricao: 'Apresentação da partida principal.', path: '/torneio/overlay/confronto', grupo: 'Ao vivo', resolucao: '1920×1080 / 1280×720', observacao: 'Use na apresentação ou antes do início.' },
  { nome: 'Classificação', descricao: 'Classificação oficial e etapa atual da Primeira Fase.', path: '/torneio/overlay/classificacao', grupo: 'Fases', resolucao: '1920×1080 / 1280×720' },
  { nome: 'Repescagem', descricao: 'Chave completa e classificados para a Double.', path: '/torneio/overlay/repescagem', grupo: 'Fases', resolucao: '1920×1080 / 1280×720', requerRepescagem: true },
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

/** URLs do sistema de Livestream Streaming (Overlays + Mesa de Controle) */
export const STREAMING_OVERLAY_CATALOG: OverlayCatalogItem[] = [
  {
    nome: 'Placar Streaming 1080p',
    descricao: 'Scorebug em tempo real com relógio, gols, faltas, alertas e textos na tela.',
    path: '/streaming/overlay',
    grupo: 'Ao vivo',
    resolucao: '1920×1080',
    observacao: 'Fonte de navegador para OBS / vMix (transparente por padrão, aceita ?bg=green).',
  },
  {
    nome: 'Overlay Ajustado (Mobile)',
    descricao: 'Overlay com auto-ajuste de proporção e escala para telas de celular.',
    path: '/streaming/overlay/ajustado',
    grupo: 'Ao vivo',
    resolucao: 'Auto-ajustável / Mobile',
    observacao: 'Para celulares de transmissão (Moblin, Streamlabs).',
  },
  {
    nome: 'Mesa de Controle Streaming',
    descricao: 'Painel operacional com cronômetro, atribuição de gols/faltas e controle de textos.',
    path: '/streaming/mesa',
    grupo: 'Ao vivo',
    resolucao: 'Responsivo / Celular / PC',
    observacao: 'Mesa de arbitragem e operadores de overlay.',
  },
]

export function overlayUrl(path: string, origin = window.location.origin): string {
  return new URL(path, origin).href
}

/** Catálogo filtrado pelo formato ativo — o overlay de Repescagem some quando o formato não tem. */
export function catalogoDoFormato(itens: OverlayCatalogItem[], comRepescagem: boolean): OverlayCatalogItem[] {
  return comRepescagem ? itens : itens.filter(item => !item.requerRepescagem)
}
