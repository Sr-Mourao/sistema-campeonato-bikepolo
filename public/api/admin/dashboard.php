<?php
require_once __DIR__ . '/middleware.php';
adminGuard();

$db = getDb();

// Totais gerais
$totais = $db->query("
    SELECT
        SUM(CASE WHEN COALESCE(tipo_participacao,'atleta') != 'acompanhante' THEN 1 ELSE 0 END) AS total_inscritos,
        SUM(CASE WHEN COALESCE(tipo_participacao,'atleta') = 'acompanhante' THEN 1 ELSE 0 END) AS total_acompanhantes,
        SUM(CASE WHEN status = 'pago' AND COALESCE(tipo_participacao,'atleta') != 'acompanhante' THEN 1 ELSE 0 END) AS total_pagos,
        SUM(CASE WHEN status = 'aguardando_pagamento' THEN 1 ELSE 0 END) AS aguardando,
        SUM(CASE WHEN status = 'cancelado' THEN 1 ELSE 0 END) AS cancelados,
        SUM(CASE WHEN latino = 1 THEN 1 ELSE 0 END) AS total_latino,
        SUM(CASE WHEN acao_afirmativa = 1 THEN 1 ELSE 0 END) AS total_aa
    FROM inscricoes
    WHERE status != 'cancelado'
")->fetch();

// Financeiro por categoria: esperado (todo pagamento não cancelado) x pago (efetivo, não reembolsado)
$finRows = $db->query("
    SELECT
        CASE
            WHEN pag.tipo IN ('inscricao', 'completo') THEN 'inscricao'
            WHEN pag.tipo = 'alojamento_extra' THEN 'alojamento'
            ELSE pag.tipo
        END AS grupo,
        SUM(CASE WHEN pag.status != 'cancelado' THEN pag.valor ELSE 0 END) AS esperado,
        SUM(CASE WHEN pag.status = 'pago' AND pag.reembolsado = 0 THEN pag.valor ELSE 0 END) AS pago
    FROM pagamentos pag
    JOIN inscricoes i ON i.id = pag.inscricao_id
    WHERE i.status != 'cancelado'
    GROUP BY grupo
")->fetchAll();

$financeiro = [
    'inscricao'   => ['esperado' => 0.0, 'pago' => 0.0],
    'alimentacao' => ['esperado' => 0.0, 'pago' => 0.0],
    'alojamento'  => ['esperado' => 0.0, 'pago' => 0.0],
];
foreach ($finRows as $row) {
    if (isset($financeiro[$row['grupo']])) {
        $financeiro[$row['grupo']] = [
            'esperado' => (float)$row['esperado'],
            'pago'     => (float)$row['pago'],
        ];
    }
}
$financeiro['total'] = [
    'esperado' => array_sum(array_column($financeiro, 'esperado')),
    'pago'     => array_sum(array_column($financeiro, 'pago')),
];

// Reembolsos pendentes: inscrições canceladas com pagamento pago e não reembolsado
$a_reembolsar = $db->query("
    SELECT COALESCE(SUM(pag.valor), 0)
    FROM pagamentos pag
    JOIN inscricoes i ON i.id = pag.inscricao_id
    WHERE pag.status = 'pago' AND pag.reembolsado = 0 AND i.status = 'cancelado'
")->fetchColumn();

$n_reembolso_pendente = $db->query("
    SELECT COUNT(DISTINCT pag.inscricao_id)
    FROM pagamentos pag
    JOIN inscricoes i ON i.id = pag.inscricao_id
    WHERE pag.status = 'pago' AND pag.reembolsado = 0 AND i.status = 'cancelado'
")->fetchColumn();

// Total misto (inscricoes com categoria misto)
$total_misto = $db->query("
    SELECT COUNT(DISTINCT ic.inscricao_id)
    FROM inscricao_categorias ic
    JOIN inscricoes i ON i.id = ic.inscricao_id
    WHERE ic.categoria = 'misto' AND i.status != 'cancelado'
")->fetchColumn();

// Total MTNB
$total_mtnb = $db->query("
    SELECT COUNT(DISTINCT ic.inscricao_id)
    FROM inscricao_categorias ic
    JOIN inscricoes i ON i.id = ic.inscricao_id
    WHERE ic.categoria = 'mtnb' AND i.status != 'cancelado'
")->fetchColumn();

// Alimentação por dia
$alim = $db->query("
    SELECT dia, COUNT(*) AS total FROM alimentacao
    JOIN inscricoes i ON i.id = alimentacao.inscricao_id AND i.status != 'cancelado'
    GROUP BY dia ORDER BY dia
")->fetchAll();
$alimentacao_por_dia = [];
foreach ($alim as $row) $alimentacao_por_dia[(string)$row['dia']] = (int)$row['total'];

// Alojamento por dia
$aloj = $db->query("
    SELECT dia, COUNT(*) AS total FROM alojamento
    JOIN inscricoes i ON i.id = alojamento.inscricao_id AND i.status != 'cancelado'
    GROUP BY dia ORDER BY dia
")->fetchAll();
$alojamento_por_dia = [];
foreach ($aloj as $row) $alojamento_por_dia[(string)$row['dia']] = (int)$row['total'];

// Check-in stats
$checkin = $db->query("
    SELECT
        SUM(presente) AS presentes,
        SUM(credenciado) AS credenciados
    FROM checkins
")->fetch();

respond([
    'total_inscritos'     => (int)($totais['total_inscritos'] ?? 0),
    'total_acompanhantes' => (int)($totais['total_acompanhantes'] ?? 0),
    'total_pagos'         => (int)($totais['total_pagos'] ?? 0),
    'aguardando'         => (int)($totais['aguardando'] ?? 0),
    'cancelados'         => (int)($totais['cancelados'] ?? 0),
    'total_latino'       => (int)($totais['total_latino'] ?? 0),
    'total_aa'           => (int)($totais['total_aa'] ?? 0),
    'total_misto'        => (int)$total_misto,
    'total_mtnb'         => (int)$total_mtnb,
    'financeiro'           => $financeiro,
    'a_reembolsar'         => (float)$a_reembolsar,
    'n_reembolso_pendente' => (int)$n_reembolso_pendente,
    'alimentacao_por_dia' => $alimentacao_por_dia,
    'alojamento_por_dia'  => $alojamento_por_dia,
    'checkin_presentes'  => (int)($checkin['presentes'] ?? 0),
    'checkin_credenciados' => (int)($checkin['credenciados'] ?? 0),
]);
