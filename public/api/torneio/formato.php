<?php
/**
 * Catálogo canônico dos formatos esportivos. A categoria identifica a inscrição;
 * `formato` identifica as regras. Serviços comuns continuam orientados por torneio_id.
 *
 * Toda regra que varia por formato (quantos times, se há Repescagem/Equalização, qual
 * Double) deve passar pelos helpers abaixo — nunca por comparação com o nome do formato
 * espalhada pelo código.
 */
const TORNEIO_FORMATOS = [
    'misto_swiss_13' => [
        'slug' => 'misto', 'nome' => '2° Pior Campeonato de Bici Polo Misto',
        'primeira_fase' => 'swiss', 'repescagem' => true, 'equalizacao' => true,
        'rodadas' => 4, 'participantes' => 13, 'double' => 'repescagem_8',
    ],
    'mtnb_round_robin_5' => [
        'slug' => 'mtnb', 'nome' => '4º Brasileiro MTNB',
        'primeira_fase' => 'round_robin', 'repescagem' => false, 'equalizacao' => false,
        'rodadas' => 5, 'participantes' => 5, 'double' => 'mtnb_5',
    ],
    'misto_round_robin_8' => [
        'slug' => 'misto', 'nome' => '2° Pior Campeonato de Bici Polo',
        'primeira_fase' => 'round_robin', 'repescagem' => false, 'equalizacao' => false,
        'rodadas' => 7, 'participantes' => 8, 'double' => 'direta_8',
    ],
];

/** Formato usado ao CRIAR um torneio novo da categoria (preset atual). */
const TORNEIO_FORMATO_NOVO_POR_CATEGORIA = [
    'misto' => 'misto_round_robin_8',
    'mtnb'  => 'mtnb_round_robin_5',
];

/**
 * Formato LEGADO por categoria — só para torneios antigos gravados sem `formato`
 * (db.php já faz backfill com a mesma regra). Não usar para criar torneio novo.
 */
function formatoPorCategoria(string $categoria): string {
    return strtolower($categoria) === 'mtnb' ? 'mtnb_round_robin_5' : 'misto_swiss_13';
}

function formatoNovoPorCategoria(string $categoria): string {
    $categoria = strtolower(trim($categoria));
    if (!isset(TORNEIO_FORMATO_NOVO_POR_CATEGORIA[$categoria])) throw new InvalidArgumentException('Categoria de torneio inválida.');
    return TORNEIO_FORMATO_NOVO_POR_CATEGORIA[$categoria];
}

function formatoDoTorneio(array $torneio): string {
    return ($torneio['formato'] ?? '') ?: formatoPorCategoria((string)$torneio['categoria']);
}

function configFormato(array $torneio): array {
    $formato = formatoDoTorneio($torneio);
    if (!isset(TORNEIO_FORMATOS[$formato])) throw new RuntimeException("Formato de torneio desconhecido: $formato");
    return TORNEIO_FORMATOS[$formato];
}

function torneioEhMtnb(array $torneio): bool {
    return formatoDoTorneio($torneio) === 'mtnb_round_robin_5';
}

/** 'swiss' | 'round_robin' */
function formatoPrimeiraFase(array $torneio): string { return configFormato($torneio)['primeira_fase']; }
function formatoEhRoundRobin(array $torneio): bool { return formatoPrimeiraFase($torneio) === 'round_robin'; }
function formatoTemRepescagem(array $torneio): bool { return (bool)configFormato($torneio)['repescagem']; }
function formatoTemEqualizacao(array $torneio): bool { return (bool)configFormato($torneio)['equalizacao']; }
function formatoParticipantes(array $torneio): int { return (int)configFormato($torneio)['participantes']; }
function formatoRodadas(array $torneio): int { return (int)configFormato($torneio)['rodadas']; }
/** 'repescagem_8' | 'mtnb_5' | 'direta_8' */
function formatoDouble(array $torneio): string { return configFormato($torneio)['double']; }

/** Total de partidas da 1ª fase em todos contra todos: n·(n−1)/2. */
function formatoJogosRoundRobin(array $torneio): int {
    $n = formatoParticipantes($torneio);
    return intdiv($n * ($n - 1), 2);
}

/** Metadados públicos do formato (front decide abas/textos por aqui, nunca pelo nome). */
function formatoInfo(array $torneio): array {
    $c = configFormato($torneio);
    return [
        'chave' => formatoDoTorneio($torneio),
        'nome' => $c['nome'],
        'primeira_fase' => $c['primeira_fase'],
        'repescagem' => (bool)$c['repescagem'],
        'equalizacao' => (bool)$c['equalizacao'],
        'rodadas' => (int)$c['rodadas'],
        'participantes' => (int)$c['participantes'],
        'jogos_primeira_fase' => $c['primeira_fase'] === 'round_robin'
            ? intdiv((int)$c['participantes'] * ((int)$c['participantes'] - 1), 2) : null,
        'double' => $c['double'],
    ];
}
