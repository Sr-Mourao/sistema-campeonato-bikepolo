<?php
require_once __DIR__ . '/middleware.php';
adminGuard();

$db = getDb();

// Visão consolidada: uma linha por pessoa, com o status de cada dia (03–09/set).
// Contratação original e dias extras aparecem juntos aqui — a distinção entre
// "alojamento" e "alojamento extra" só importa no financeiro (ver financeiro.php).
$stmt = $db->query("
    SELECT
        al.inscricao_id, al.dia, al.valor,
        (al.pagamento_id IS NOT NULL) AS pago,
        p.nome, p.cidade, p.nacionalidade
    FROM alojamento al
    JOIN inscricoes i ON i.id = al.inscricao_id AND i.status != 'cancelado'
    JOIN pessoas p ON p.id = i.pessoa_id
    ORDER BY p.nome, al.dia
");
$rows = $stmt->fetchAll();

$pessoas = [];
$porDia  = [];
foreach (ALOJAMENTO_DIAS_VALIDOS as $d) $porDia[$d] = ['total' => 0, 'pagos' => 0];

foreach ($rows as $row) {
    $id = (int)$row['inscricao_id'];
    if (!isset($pessoas[$id])) {
        $pessoas[$id] = [
            'inscricao_id'  => $id,
            'nome'          => $row['nome'],
            'cidade'        => $row['cidade'],
            'nacionalidade' => $row['nacionalidade'],
            'dias'          => array_fill_keys(ALOJAMENTO_DIAS_VALIDOS, null),
        ];
    }
    $dia = (int)$row['dia'];
    $pago = (bool)$row['pago'];
    $pessoas[$id]['dias'][$dia] = $pago ? 'pago' : 'pendente';

    if (isset($porDia[$dia])) {
        $porDia[$dia]['total']++;
        if ($pago) $porDia[$dia]['pagos']++;
    }
}

respond([
    'pessoas' => array_values($pessoas),
    'por_dia' => $porDia,
    'dias'    => ALOJAMENTO_DIAS_VALIDOS,
]);
