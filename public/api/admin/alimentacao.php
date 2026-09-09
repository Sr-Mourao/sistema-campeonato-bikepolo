<?php
require_once __DIR__ . '/middleware.php';
adminGuard();

$db  = getDb();
$dia = isset($_GET['dia']) ? (int)$_GET['dia'] : null;

if ($dia && !in_array($dia, [5, 6, 7])) respondError('Dia inválido');

$where  = $dia ? 'WHERE al.dia = ?' : '';
$params = $dia ? [$dia] : [];

$stmt = $db->prepare("
    SELECT
        al.id, al.dia, al.valor, COALESCE(al.pacote, 'completo') AS pacote,
        i.id AS inscricao_id, i.status,
        p.nome, p.cidade, p.nacionalidade,
        i.restricao_alimentar,
        CASE WHEN EXISTS (
            SELECT 1 FROM pagamentos pg
            WHERE pg.inscricao_id = i.id
            AND pg.tipo IN ('alimentacao', 'completo')
            AND pg.status = 'pago'
        ) THEN 1 ELSE 0 END AS alimentacao_confirmada
    FROM alimentacao al
    JOIN inscricoes i ON i.id = al.inscricao_id AND i.status != 'cancelado'
    JOIN pessoas p ON p.id = i.pessoa_id
    $where
    ORDER BY al.dia, al.pacote, p.nome
");
$stmt->execute($params);
$rows = $stmt->fetchAll();

// Tipos de restrição possíveis (espelha RestricoesAlimentaresField no frontend)
$TIPOS_RESTRICAO = ['vegetariano', 'vegano', 'lactose', 'alergia', 'outra'];

// Agrupa por dia (parse + agrupamento em loop único — sem referência)
$por_dia = [];
foreach ($rows as $row) {
    $ra = json_decode($row['restricao_alimentar'] ?? 'null', true);
    $row['restricao_alimentar'] = $ra;
    $row['alimentacao_confirmada'] = (int)($row['alimentacao_confirmada'] ?? 0);

    $d = (string)$row['dia'];
    if (!isset($por_dia[$d])) $por_dia[$d] = [
        'dia' => (int)$row['dia'], 'total' => 0,
        'completo' => 0, 'almoco' => 0,
        'restricoes' => array_fill_keys($TIPOS_RESTRICAO, 0) + ['total' => 0],
        'pessoas' => [],
    ];
    $por_dia[$d]['total']++;
    $pacote = $row['pacote'] ?? 'completo';
    if ($pacote === 'almoco') $por_dia[$d]['almoco']++;
    else $por_dia[$d]['completo']++;
    if ($ra) {
        $tipo = $ra['tipo'] ?? '';
        if (isset($por_dia[$d]['restricoes'][$tipo])) $por_dia[$d]['restricoes'][$tipo]++;
        $por_dia[$d]['restricoes']['total']++;
    }
    $por_dia[$d]['pessoas'][] = $row;
}

respond(array_values($por_dia));
