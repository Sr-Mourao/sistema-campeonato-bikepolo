<?php
/**
 * Catálogo canônico dos formatos esportivos. A categoria identifica a inscrição;
 * `formato` identifica as regras. Serviços comuns continuam orientados por torneio_id.
 */
const TORNEIO_FORMATOS = [
    'misto_swiss_13' => [
        'slug' => 'misto', 'nome' => '2° Pior Campeonato de Bici Polo Misto',
        'primeira_fase' => 'swiss', 'repescagem' => true,
        'rodadas' => 4, 'participantes' => 13,
    ],
    'mtnb_round_robin_5' => [
        'slug' => 'mtnb', 'nome' => '4º Brasileiro MTNB',
        'primeira_fase' => 'round_robin', 'repescagem' => false,
        'rodadas' => 5, 'participantes' => 5,
    ],
];

function formatoPorCategoria(string $categoria): string {
    return strtolower($categoria) === 'mtnb' ? 'mtnb_round_robin_5' : 'misto_swiss_13';
}

function formatoDoTorneio(array $torneio): string {
    return $torneio['formato'] ?: formatoPorCategoria((string)$torneio['categoria']);
}

function configFormato(array $torneio): array {
    $formato = formatoDoTorneio($torneio);
    if (!isset(TORNEIO_FORMATOS[$formato])) throw new RuntimeException("Formato de torneio desconhecido: $formato");
    return TORNEIO_FORMATOS[$formato];
}

function torneioEhMtnb(array $torneio): bool {
    return formatoDoTorneio($torneio) === 'mtnb_round_robin_5';
}
