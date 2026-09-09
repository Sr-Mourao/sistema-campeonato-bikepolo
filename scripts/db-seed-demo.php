<?php
/**
 * Seed de DEMONSTRAÇÃO — dados 100% fictícios.
 *
 *     php scripts/db-seed-demo.php          # popula
 *     php scripts/db-seed-demo.php --forcar # popula mesmo se já houver dados
 *
 * Para que serve: dar a quem clonou o repositório algo para olhar. Sem isto o
 * site sobe funcionando mas completamente vazio — não dá para entender a
 * classificação, a Double Elimination, os overlays ou a carteira.
 *
 * O que ele NÃO é: uma versão anonimizada de dados reais. Nenhuma pessoa,
 * time, clube, e-mail, foto ou placar aqui corresponde a alguém de verdade.
 * Os nomes são inventados de propósito. Nunca substitua isto por um dump de
 * produção com os e-mails trocados — anonimização superficial não é seed.
 *
 * O que ele cria:
 *   · 3 clubes, 18 times (13 Misto + 5 MTNB), 72 pessoas com inscrição paga
 *   · torneio Misto: 4 rodadas de suíço simuladas + classificação congelada
 *   · torneio MTNB: todos contra todos simulado
 *   · produtos de bar com estoque e uma carteira com saldo
 *   · alguns produtos da lojinha
 *
 * Placares, gols e faltas são gerados pelo MESMO caminho da súmula real
 * (simularPartidasPendentes → registrarGol/registrarFalta), então estatística,
 * artilharia e fair play saem coerentes em vez de inventadas na mão.
 */

$raiz = dirname(__DIR__);

if (!file_exists($raiz . '/public/api/env.php')) {
    fwrite(STDERR, "public/api/env.php não existe. Rode antes:\n");
    fwrite(STDERR, "  cp public/api/env.example.php public/api/env.php\n");
    fwrite(STDERR, "  php scripts/db-init.php\n");
    exit(1);
}

require_once $raiz . '/public/api/db.php';
require_once $raiz . '/public/api/torneio/lib.php';
require_once $raiz . '/public/api/torneio/swiss.php';
require_once $raiz . '/public/api/torneio/bracket.php';
require_once $raiz . '/public/api/torneio/sumula.php';
require_once $raiz . '/public/api/torneio/setup.php';
require_once $raiz . '/public/api/torneio/round_robin.php';
require_once $raiz . '/public/api/torneio/simulator.php';
require_once $raiz . '/public/api/carteira/lib.php';

$forcar = in_array('--forcar', $argv, true);
$USUARIO = 'seed-demo';

$db = new PDO('sqlite:' . DB_PATH);
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
$db->exec('PRAGMA foreign_keys=ON');
initSchema($db);

$jaTem = (int)$db->query('SELECT COUNT(*) FROM pessoas')->fetchColumn();
if ($jaTem > 0 && !$forcar) {
    fwrite(STDERR, "O banco já tem $jaTem pessoa(s) cadastrada(s).\n");
    fwrite(STDERR, "Este seed é para bancos vazios. Se tem certeza, rode com --forcar.\n");
    fwrite(STDERR, "NUNCA rode isto contra o banco de um evento real.\n");
    exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Elenco fictício
// ─────────────────────────────────────────────────────────────────────────────
$CLUBES = ['Clube Capivara Polo', 'Pedal Cósmico', 'Mallet Fantasma'];

$TIMES_MISTO = [
    'Capivaras Elétricas', 'Pedal Cósmico A', 'Mallet Fantasma', 'Tatu-Bola FC',
    'Curupira Bike Polo', 'Jabuti Veloz', 'Saci Rolante', 'Boitatá Polo',
    'Quero-Quero Racing', 'Bicho-Preguiça Só Que Não', 'Aro Livre', 'Guaxinim Tático',
    'Última Roda',
];
$TIMES_MTNB = ['Capivaras B', 'Pedal Cósmico B', 'Iara Polo', 'Piracema FC', 'Vento Sul'];

$PRIMEIROS = [
    'Ana', 'Bruno', 'Carla', 'Dani', 'Edu', 'Fê', 'Gabi', 'Hugo', 'Ivo', 'Joana',
    'Kau', 'Lia', 'Marco', 'Nina', 'Otto', 'Pri', 'Quim', 'Rafa', 'Sol', 'Tom',
    'Uli', 'Vera', 'Wil', 'Xu', 'Yara', 'Zeca', 'Alex', 'Bel', 'Caio', 'Duda',
    'Elis', 'Fabio', 'Gal', 'Heitor', 'Iris', 'Jorge',
];
$SOBRENOMES = [
    'Andrade', 'Bittencourt', 'Cardoso', 'Duarte', 'Esteves', 'Fontes', 'Guedes',
    'Horta', 'Iglesias', 'Junqueira', 'Klein', 'Lacerda', 'Mendes', 'Nogueira',
    'Oliveira', 'Pacheco', 'Quintana', 'Rebouças', 'Sampaio', 'Teixeira',
];

/** Nome fictício estável: mesmo índice → mesmo nome, sem colisão. */
function nomeFicticio(int $i, array $primeiros, array $sobrenomes): string {
    return $primeiros[$i % count($primeiros)] . ' ' .
           $sobrenomes[intdiv($i, count($primeiros)) % count($sobrenomes)] .
           ' ' . chr(65 + ($i % 26));
}

echo "Criando clubes…\n";
$clubeIds = [];
$insClube = $db->prepare('INSERT OR IGNORE INTO clubes (nome) VALUES (?)');
$selClube = $db->prepare('SELECT id FROM clubes WHERE nome = ?');
foreach ($CLUBES as $nome) {
    $insClube->execute([$nome]);
    $selClube->execute([$nome]);
    $clubeIds[] = (int)$selClube->fetchColumn();
}

echo "Criando times, pessoas e inscrições…\n";

$insPessoa   = $db->prepare('INSERT INTO pessoas (nome, email, telefone, genero, clube_id, cidade) VALUES (?,?,?,?,?,?)');
$insInscr    = $db->prepare("INSERT INTO inscricoes (pessoa_id, status, tipo_participacao, valor_total, aceitou_termos) VALUES (?, 'pago', 'atleta', 0, 1)");
$insCategoria= $db->prepare('INSERT INTO inscricao_categorias (inscricao_id, categoria, valor) VALUES (?,?,?)');
$insTime     = $db->prepare('INSERT INTO times (nome, categoria, codigo, criador_id) VALUES (?,?,?,?)');
$insMembro   = $db->prepare('INSERT INTO membros_time (time_id, inscricao_id) VALUES (?,?)');

$generos = ['mulher cis', 'homem cis', 'não-binárie', 'travesti'];
$contador = 0;

/** Cria um time com $atletas pessoas fictícias já inscritas e pagas. */
function criarTimeDemo(
    PDO $db, string $nome, string $categoria, int $atletas,
    array $clubeIds, array $primeiros, array $sobrenomes, array $generos, int &$contador,
    $insPessoa, $insInscr, $insCategoria, $insTime, $insMembro
): int {
    $insTime->execute([$nome, $categoria, generateTeamCode($db), null]);
    $timeId = (int)$db->lastInsertId();

    for ($i = 0; $i < $atletas; $i++) {
        $pessoa = nomeFicticio($contador, $primeiros, $sobrenomes);
        // example.com / example.org são reservados pela RFC 2606 justamente
        // para documentação: nunca vão entregar e-mail para ninguém de verdade.
        $email = 'atleta' . $contador . '@example.com';
        $insPessoa->execute([
            $pessoa, $email, null,
            $generos[$contador % count($generos)],
            $clubeIds[$contador % count($clubeIds)],
            'Cidade Exemplo',
        ]);
        $pessoaId = (int)$db->lastInsertId();

        $insInscr->execute([$pessoaId]);
        $inscricaoId = (int)$db->lastInsertId();
        $insCategoria->execute([$inscricaoId, $categoria, 0]);
        $insMembro->execute([$timeId, $inscricaoId]);

        if ($i === 0) {
            $db->prepare('UPDATE times SET criador_id = ? WHERE id = ?')->execute([$pessoaId, $timeId]);
        }
        $contador++;
    }
    return $timeId;
}

$db->beginTransaction();
foreach ($TIMES_MISTO as $nome) {
    criarTimeDemo($db, $nome, 'misto', 4, $clubeIds, $PRIMEIROS, $SOBRENOMES, $generos, $contador,
        $insPessoa, $insInscr, $insCategoria, $insTime, $insMembro);
}
foreach ($TIMES_MTNB as $nome) {
    criarTimeDemo($db, $nome, 'mtnb', 4, $clubeIds, $PRIMEIROS, $SOBRENOMES, $generos, $contador,
        $insPessoa, $insInscr, $insCategoria, $insTime, $insMembro);
}
$db->commit();
echo "  " . count($TIMES_MISTO) . " times Misto, " . count($TIMES_MTNB) . " times MTNB, $contador pessoas.\n";

// ─────────────────────────────────────────────────────────────────────────────
// Torneio Misto — 4 rodadas de suíço, simuladas pelo motor real
// ─────────────────────────────────────────────────────────────────────────────
echo "Criando torneio Misto e simulando a Primeira Fase…\n";
$mistoId = criarTorneioPreset($db, 'misto', $USUARIO, 'Brasileiro Demo — Misto');

for ($rodada = 1; $rodada <= 4; $rodada++) {
    $sugestao = sugerirPareamentoSwiss($db, $mistoId, $rodada, ['seed_prng' => 20260905 + $rodada]);
    $r = confirmarRodadaSwiss($db, $mistoId, $rodada, $sugestao['bye'], $sugestao['pares'], $USUARIO);
    $res = simularPartidasPendentes($db, $mistoId, (int)$r['fase_id'], $USUARIO);
    echo "  Rodada $rodada: " . count($res['partidas'] ?? $res) . " partidas simuladas.\n";
}

// ─────────────────────────────────────────────────────────────────────────────
// Torneio MTNB — todos contra todos, simulado
// ─────────────────────────────────────────────────────────────────────────────
echo "Criando torneio MTNB e simulando o todos contra todos…\n";
$mtnbId = criarTorneioPreset($db, 'mtnb', $USUARIO, 'Brasileiro Demo — MTNB');
gerarPrimeiraFaseRoundRobin($db, $mtnbId, $USUARIO);
foreach ($db->query("SELECT id FROM torneio_fases WHERE torneio_id = $mtnbId AND tipo = 'round_robin' ORDER BY id") as $fase) {
    simularPartidasPendentes($db, $mtnbId, (int)$fase['id'], $USUARIO);
}
echo "  Todas as rodadas do MTNB simuladas.\n";

// ─────────────────────────────────────────────────────────────────────────────
// Bar / carteira cashless
// ─────────────────────────────────────────────────────────────────────────────
echo "Criando produtos do bar e uma carteira com saldo…\n";
$insProduto = $db->prepare('INSERT INTO carteira_produtos (nome, preco_centavos, estoque) VALUES (?,?,?)');
foreach ([['Água', 400, 80], ['Cerveja', 1000, 120], ['Suco natural', 800, 40], ['Lanche', 1800, 30]] as [$n, $p, $e]) {
    $insProduto->execute([$n, $p, $e]);
}

$pessoaCarteira = (int)$db->query('SELECT id FROM pessoas ORDER BY id LIMIT 1')->fetchColumn();
$carteira = carteiraCriarOuObter($db, $pessoaCarteira);
carteiraRegistrarMovimento($db, (int)$carteira['id'], 'AJUSTE_ADMINISTRATIVO', 5000, [
    'admin_usuario' => $USUARIO,
    'observacao'    => 'Saldo fictício do seed de demonstração',
]);

// ─────────────────────────────────────────────────────────────────────────────
// Lojinha
// ─────────────────────────────────────────────────────────────────────────────
echo "Criando produtos da lojinha…\n";
$insLoja = $db->prepare('INSERT INTO loj_produtos (nome, descricao, preco, ativo, ordem) VALUES (?,?,?,1,?)');
$insTam  = $db->prepare('INSERT INTO loj_produto_tamanhos (produto_id, tamanho, ordem) VALUES (?,?,?)');
foreach ([
    ['Camiseta do campeonato', 'Algodão, estampa serigrafada.', 80.0],
    ['Meia de cano alto',      'Par, tamanho único.',           35.0],
] as $ordem => [$n, $d, $p]) {
    $insLoja->execute([$n, $d, $p, $ordem]);
    $produtoId = (int)$db->lastInsertId();
    foreach (['P', 'M', 'G', 'GG'] as $i => $tam) $insTam->execute([$produtoId, $tam, $i]);
}
$db->prepare("INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES ('loja_aberta', '1')")->execute();

// ─────────────────────────────────────────────────────────────────────────────
echo "\n";
echo "Seed de demonstração carregado em " . DB_PATH . "\n\n";
echo "O que olhar:\n";
echo "  /torneio/misto              classificação e fases do Misto\n";
echo "  /torneio/mtnb               todos contra todos do MTNB\n";
echo "  /torneio/resultados         memória consolidada do campeonato\n";
echo "  /equipes                    times e elencos\n";
echo "  /overlays                   central de overlays de transmissão\n";
echo "  /admin                      painel (login com ADMIN_USER/ADMIN_PASS)\n\n";
echo "Para avançar o torneio: /admin → Torneio → fechar classificação,\n";
echo "gerar Repescagem e gerar a Double Elimination.\n";
