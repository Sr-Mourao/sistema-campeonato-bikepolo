<?php
/**
 * Executa toda a suíte de testes do projeto (motor de torneio + mídia/importação).
 * Uso: php tests/run.php
 * Sai com código 0 se tudo passar, 1 se algo falhar.
 */

require_once __DIR__ . '/bootstrap.php';

$arquivos = array_merge(
    glob(__DIR__ . '/torneio/test_*.php'),
    glob(__DIR__ . '/midia/test_*.php'),
    glob(__DIR__ . '/carteira/test_*.php'),
    glob(__DIR__ . '/awards/test_*.php'),
    glob(__DIR__ . '/streaming/test_*.php')
);
sort($arquivos);
foreach ($arquivos as $f) require_once $f;

$funcoes = array_filter(get_defined_functions()['user'], fn($f) => str_starts_with($f, 'test_'));
sort($funcoes);

$total = 0; $falhas = [];
foreach ($funcoes as $fn) {
    $total++;
    try {
        $fn();
    } catch (\Throwable $e) {
        $falhas[] = "$fn: " . $e->getMessage();
        echo "FALHOU: $fn — " . $e->getMessage() . "\n";
    }
}

echo "\n" . str_repeat('─', 60) . "\n";
echo "Total: $total · Passou: " . ($total - count($falhas)) . " · Falhou: " . count($falhas) . "\n";
if ($falhas) {
    echo "\nFalhas:\n";
    foreach ($falhas as $f) echo "  - $f\n";
    exit(1);
}
echo "TODOS OS TESTES PASSARAM.\n";
exit(0);
