<?php
/**
 * Fetch + cache dos dados públicos de equipes do Poloperator — fonte canônica única,
 * reaproveitada pelo proxy público (`public/api/poloperator.php`, consumido por
 * `/equipes` legado) E pelo importador de mídia (`admin/poloperator-import.php`). Nunca
 * duplicar esta chamada de rede/parsing em outro lugar.
 */

const POLOPERATOR_TORNEIOS = [
    // Slot do Misto. Hoje = 2° Pior Campeonato de Bici Polo 2026
    // (poloperator.com/pt/tournament/2-pior-campeonato-curitiba-2026).
    // Antes: Brasileiro 2026 = 'cmqd65ei4004d5lyuacl6ovhr'.
    'brasileiro' => 'cmwtzkh58004qvqb7frjo8cmh',
    'mtnb'       => 'cmqd6acwa004i5lyub7d3l0ln',
];

/**
 * Nome no Poloperator → apelido usado no cadastro interno, por torneio. Só para atletas
 * cujo nome difere; nomes iguais (após normalizaNome) já casam sozinhos. Depois da
 * primeira importação o poloperator_id fica gravado e passa a ter prioridade.
 */
const POLOPERATOR_APELIDOS = [
    'brasileiro' => [
        'João Pedro Gnoatto Lopes'          => 'Jpg',
        'Emily Ethel Chika'                 => 'Emily Ethel',
        'Marcos Normelio Antunes da Costa'  => 'Marcos',
        'Ana Carolina Alencar de Barros'    => 'Ana',
        'Dox Lucchin'                       => 'Dox',
        'Fábio Luiz Kuntze'                 => 'Fábio',
        'Carla Thais Maiewski'              => 'Carla',
        'Lucas Mendonça'                    => 'Mendonça',
        'Larissa Torres'                    => 'Lari',
        'Rafael Buratto'                    => 'Buratto',
        'Mati'                              => 'Mat',
        'Luqueta'                           => 'Lusca',
        'Emiliane Mayumi Ito'               => 'Emi',
    ],
];

/** Projeta um atleta pro shape usado no site — omite campo ausente/vazio em vez de null. */
function projetaAtletaPoloperator(array $entry): array {
    $p = $entry['player'] ?? [];
    $out = [
        'id'   => $p['id'] ?? ($entry['playerId'] ?? null),
        'name' => $p['name'] ?? '',
    ];
    if (!empty($p['city']))          $out['city']      = $p['city'];
    if (!empty($p['country']))       $out['country']   = $p['country'];
    if (!empty($p['photoPath']))     $out['photoPath'] = $p['photoPath'];
    if (!empty($p['startYear']))     $out['startYear'] = $p['startYear'];
    if (!empty($p['hand']))          $out['hand']      = $p['hand'];
    if (!empty($entry['isCaptain'])) $out['isCaptain'] = true;
    return $out;
}

/**
 * Busca (com cache de 180s em disco) os times+atletas de um torneio Poloperator
 * ('brasileiro'|'mtnb'). Lança InvalidArgumentException pra torneio desconhecido e
 * RuntimeException se a rede falhar e não houver cache (nem expirado) pra servir.
 */
function buscarTorneioPoloperator(string $torneio): array {
    if (!isset(POLOPERATOR_TORNEIOS[$torneio])) {
        throw new InvalidArgumentException('Torneio inválido. Use: brasileiro ou mtnb');
    }
    $id        = POLOPERATOR_TORNEIOS[$torneio];
    $cacheDir  = __DIR__ . '/../data/cache';
    $cacheFile = $cacheDir . "/poloperator_{$torneio}.json";
    $ttl       = 180; // segundos — dado "quase ao vivo" sem martelar a API deles

    if (!is_dir($cacheDir)) @mkdir($cacheDir, 0755, true);

    $lerCache = function () use ($cacheFile): ?array {
        if (!file_exists($cacheFile)) return null;
        $cached = file_get_contents($cacheFile);
        if ($cached === false) return null;
        $decoded = json_decode($cached, true);
        return is_array($decoded) ? $decoded : null;
    };

    if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < $ttl) {
        $fresco = $lerCache();
        if ($fresco !== null) return $fresco;
    }

    $ch = curl_init("https://poloperator.com/api/tournaments/{$id}");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 12,
        CURLOPT_HTTPHEADER     => ['Accept: application/json'],
    ]);
    $raw  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);

    if ($raw === false || $code !== 200) {
        // Serve cache velho (mesmo expirado) em vez de quebrar, se existir.
        $velho = $lerCache();
        if ($velho !== null) return $velho;
        throw new RuntimeException('Não foi possível carregar os dados do torneio agora. Tente novamente em instantes.' . ($err ? " ($err)" : " (HTTP $code)"));
    }

    $data = json_decode($raw, true);
    if (!is_array($data)) throw new RuntimeException('Resposta inválida do Poloperator');

    $teams = [];
    foreach (($data['teams'] ?? []) as $team) {
        $players = array_map('projetaAtletaPoloperator', $team['players'] ?? []);

        // Time não tem campo de logo próprio — deriva do 1º atleta com teamLogoPath
        $logoPath = null;
        foreach (($team['players'] ?? []) as $entry) {
            $tlp = $entry['player']['teamLogoPath'] ?? null;
            if (!empty($tlp)) { $logoPath = $tlp; break; }
        }

        $teamOut = [
            'id'      => $team['id'] ?? null,
            'name'    => $team['name'] ?? '',
            'players' => $players,
        ];
        if (isset($team['seed']) && $team['seed'] !== null) $teamOut['seed'] = $team['seed'];
        if (!empty($team['city'])) $teamOut['city'] = $team['city'];
        if ($logoPath) $teamOut['logoPath'] = $logoPath;

        $teams[] = $teamOut;
    }

    $out = [
        'tournament' => [
            'name'      => trim($data['name'] ?? ''),
            'dateStart' => $data['dateStart'] ?? null,
            'dateEnd'   => $data['dateEnd']   ?? null,
        ],
        'teams' => $teams,
    ];

    $json = json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    @file_put_contents($cacheFile, $json);

    return $out;
}
