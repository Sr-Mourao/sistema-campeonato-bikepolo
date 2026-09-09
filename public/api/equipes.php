<?php
/**
 * Equipes/atletas — fonte 100% interna (times/membros_time/inscricoes/pessoas), sem
 * dependência de runtime do Poloperator (ver migração de mídia). Substitui, pra
 * renderização pública de /equipes, o antigo `poloperator.php` — que continua existindo
 * (usado pelo importador admin), mas não é mais chamado pelo site público.
 *
 * Campos que só existiam no Poloperator sem equivalente interno (cidade/país do atleta,
 * "bike polo desde", mão dominante, capitão) NÃO são inventados aqui — simplesmente não
 * existem nesta resposta.
 */
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/midia/lib.php';
corsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') respondError('Método não suportado', 405);

$torneio = $_GET['torneio'] ?? '';
$CATEGORIA_POR_TORNEIO = ['brasileiro' => 'misto', 'mtnb' => 'mtnb'];
if (!isset($CATEGORIA_POR_TORNEIO[$torneio])) {
    respondError('Torneio inválido. Use: brasileiro ou mtnb');
}
$categoria = $CATEGORIA_POR_TORNEIO[$torneio];

$db = getDb();

$stmtTimes = $db->prepare("SELECT id, nome, logo_path, logo_atualizado_em FROM times WHERE categoria = ? ORDER BY nome");
$stmtTimes->execute([$categoria]);
$times = $stmtTimes->fetchAll();

$stmtRoster = $db->prepare("
    SELECT p.id, p.nome, p.foto_path, p.foto_atualizado_em
    FROM membros_time mt
    JOIN inscricoes i ON i.id = mt.inscricao_id AND i.status != 'cancelado'
    JOIN pessoas p ON p.id = i.pessoa_id
    WHERE mt.time_id = ?
    ORDER BY p.nome
");

$teams = [];
foreach ($times as $t) {
    $stmtRoster->execute([$t['id']]);
    $players = array_map(function ($p) {
        return [
            'id' => $p['id'],
            'name' => $p['nome'],
            'photoPath' => urlComCacheBust($p['foto_path'], $p['foto_atualizado_em']),
        ];
    }, $stmtRoster->fetchAll());

    $teams[] = [
        'id' => $t['id'],
        'name' => $t['nome'],
        'logoPath' => urlComCacheBust($t['logo_path'], $t['logo_atualizado_em']),
        'players' => $players,
    ];
}

respond(['tournament' => ['name' => '', 'categoria' => $categoria], 'teams' => $teams]);
