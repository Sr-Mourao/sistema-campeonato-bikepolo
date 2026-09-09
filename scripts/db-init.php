<?php
/**
 * Cria (ou atualiza) o banco SQLite da instalação a partir do schema oficial.
 *
 *     php scripts/db-init.php
 *
 * Não existe pasta de migrations neste projeto: a fonte única do schema é
 * initSchema() em public/api/db.php, que roda CREATE TABLE IF NOT EXISTS +
 * uma lista de ALTER TABLE idempotentes. Chamar qualquer endpoint da API já
 * faria isso; este script só permite fazer explicitamente, antes de subir o
 * servidor, e falhar cedo com uma mensagem clara se faltar permissão ou a
 * extensão pdo_sqlite.
 *
 * É seguro rodar em cima de um banco existente: nada é apagado.
 */

$raiz = dirname(__DIR__);
$envReal = $raiz . '/public/api/env.php';

if (!file_exists($envReal)) {
    fwrite(STDERR, "public/api/env.php não existe.\n");
    fwrite(STDERR, "Rode antes:  cp public/api/env.example.php public/api/env.php\n");
    exit(1);
}

if (!in_array('sqlite', PDO::getAvailableDrivers(), true)) {
    fwrite(STDERR, "A extensão pdo_sqlite não está habilitada neste PHP.\n");
    fwrite(STDERR, "Habilite extension=pdo_sqlite no php.ini.\n");
    exit(1);
}

require_once $raiz . '/public/api/db.php';

$dir = dirname(DB_PATH);
if (!is_dir($dir) && !@mkdir($dir, 0755, true)) {
    fwrite(STDERR, "Não foi possível criar a pasta de dados: $dir\n");
    exit(1);
}
if (!is_writable($dir)) {
    fwrite(STDERR, "Pasta de dados sem permissão de escrita: $dir\n");
    exit(1);
}

$novo = !file_exists(DB_PATH);

$pdo = new PDO('sqlite:' . DB_PATH);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
$pdo->exec('PRAGMA foreign_keys=ON');

initSchema($pdo);

$tabelas = $pdo->query("SELECT COUNT(*) FROM sqlite_master WHERE type='table'")->fetchColumn();

echo ($novo ? "Banco criado" : "Banco atualizado"), ": ", DB_PATH, "\n";
echo "Tabelas: $tabelas\n";
echo $novo
    ? "\nBanco vazio. Para carregar dados fictícios de demonstração:\n  php scripts/db-seed-demo.php\n"
    : "\nSchema conferido. Nenhum dado foi alterado.\n";
