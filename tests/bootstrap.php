<?php
/**
 * Bootstrap dos testes do motor de torneio.
 *
 * Roda contra um SQLite em memória — reusa initSchema() de public/api/db.php
 * como ÚNICA fonte de verdade do schema (nunca duplicar CREATE TABLE aqui:
 * se o schema real mudar, os testes acompanham automaticamente).
 *
 * Nunca toca no banco real (public/api/data/10cbbp.db) nem na mídia real
 * (public/imgs/**): MIDIA_RAIZ abaixo desvia toda gravação/remoção de imagem
 * para um diretório temporário, definido ANTES de carregar midia/lib.php.
 */

/**
 * O banco de teste é em memória, então a primeira pessoa e o primeiro time criados
 * recebem sempre id = 1 — os mesmos ids de gente real em produção. Sem esta raiz
 * separada, um `php tests/run.php` apagava public/imgs/atletas/1 e public/imgs/times/1
 * do disco, deixando o banco real apontando pra arquivos inexistentes.
 */
define('MIDIA_RAIZ', sys_get_temp_dir() . '/10cbbp-testes-midia');
if (!is_dir(MIDIA_RAIZ)) mkdir(MIDIA_RAIZ, 0777, true);

require_once __DIR__ . '/../public/api/db.php';
require_once __DIR__ . '/../public/api/torneio/lib.php';
require_once __DIR__ . '/../public/api/torneio/swiss.php';
require_once __DIR__ . '/../public/api/torneio/bracket.php';
require_once __DIR__ . '/../public/api/torneio/resultados.php';
require_once __DIR__ . '/../public/api/torneio/sumula.php';
require_once __DIR__ . '/../public/api/torneio/setup.php';
require_once __DIR__ . '/../public/api/torneio/round_robin.php';
require_once __DIR__ . '/../public/api/torneio/simulator.php';
require_once __DIR__ . '/../public/api/midia/lib.php';
require_once __DIR__ . '/../public/api/admin/poloperator_import_lib.php';
require_once __DIR__ . '/../public/api/poloperator/lib.php';
if (!defined('SESSION_DURATION')) define('SESSION_DURATION', 30 * 24 * 3600);
require_once __DIR__ . '/../public/api/carteira/lib.php';
require_once __DIR__ . '/../public/api/carteira/auth_lib.php';
require_once __DIR__ . '/../public/api/awards/lib.php';
require_once __DIR__ . '/../public/api/streaming/lib.php';

function testDb(): PDO {
    $pdo = new PDO('sqlite::memory:');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec('PRAGMA foreign_keys=ON');
    initSchema($pdo);
    return $pdo;
}

/**
 * Cria $n times fictícios (categoria 'misto') com elenco (pessoas/inscricoes/membros_time).
 * Sufixo aleatório no código/email pra permitir chamar várias vezes no mesmo $db de teste
 * sem colidir em UNIQUE(times.codigo)/UNIQUE(pessoas.email).
 */
function seedTimes(PDO $db, int $n = 13, int $atletasPorTime = 4, string $categoria = 'misto'): array {
    $ids = [];
    $sufixo = substr(bin2hex(random_bytes(3)), 0, 5);
    for ($i = 1; $i <= $n; $i++) {
        $codigo = 'T' . $sufixo . str_pad((string)$i, 2, '0', STR_PAD_LEFT);
        $db->prepare("INSERT INTO times (nome, categoria, codigo) VALUES (?, ?, ?)")
           ->execute(["Time $i-$sufixo", $categoria, $codigo]);
        $timeId = (int)$db->lastInsertId();
        $ids[] = $timeId;

        for ($j = 1; $j <= $atletasPorTime; $j++) {
            $db->prepare("INSERT INTO pessoas (nome, email) VALUES (?, ?)")
               ->execute(["Atleta $i.$j", "atleta{$sufixo}_{$i}_{$j}@teste.local"]);
            $pessoaId = (int)$db->lastInsertId();
            $db->prepare("INSERT INTO inscricoes (pessoa_id, status) VALUES (?, 'pago')")
               ->execute([$pessoaId]);
            $inscricaoId = (int)$db->lastInsertId();
            $db->prepare("INSERT INTO membros_time (time_id, inscricao_id) VALUES (?, ?)")
               ->execute([$timeId, $inscricaoId]);
        }
    }
    return $ids;
}

function primeiroMembroDoTime(PDO $db, int $timeId): int {
    $stmt = $db->prepare("SELECT id FROM membros_time WHERE time_id = ? LIMIT 1");
    $stmt->execute([$timeId]);
    return (int)$stmt->fetchColumn();
}

function assertTrue($cond, string $msg): void { if (!$cond) throw new Exception("FALHOU: $msg"); }
function assertFalse($cond, string $msg): void { if ($cond) throw new Exception("FALHOU: $msg"); }
function assertEqualsT($expected, $actual, string $msg): void {
    if ($expected != $actual) throw new Exception("FALHOU: $msg — esperado " . var_export($expected, true) . ", obtido " . var_export($actual, true));
}
function assertNullT($v, string $msg): void { if ($v !== null) throw new Exception("FALHOU: $msg — esperado null, obtido " . var_export($v, true)); }
function assertNotNullT($v, string $msg): void { if ($v === null) throw new Exception("FALHOU: $msg — obtido null"); }
function assertThrowsT(callable $fn, string $msg): void {
    try { $fn(); } catch (\Throwable $e) { return; }
    throw new Exception("FALHOU (esperava exceção): $msg");
}
