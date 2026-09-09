<?php
require_once __DIR__ . '/middleware.php';
adminGuard();

$db   = getDb();
$tipo = $_GET['tipo'] ?? 'inscricoes';

function csvRow(array $cols): string {
    return implode(',', array_map(fn($v) => '"' . str_replace('"', '""', (string)$v) . '"', $cols)) . "\n";
}

ob_clean();
// Mesma allowlist do middleware — nunca refletir Origin arbitrária num endpoint
// que despeja PII de todas as pessoas inscritas.
$origin = rtrim($_SERVER['HTTP_ORIGIN'] ?? '', '/');
header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="cb10_' . $tipo . '_' . date('Ymd_His') . '.csv"');
header('Vary: Origin');
if ($origin !== '' && in_array($origin, adminOrigensPermitidas(), true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
}
header('Access-Control-Allow-Credentials: true');

// BOM para Excel reconhecer UTF-8
echo "\xEF\xBB\xBF";

if ($tipo === 'inscricoes') {
    echo csvRow(['ID', 'Nome', 'Email', 'Telefone', 'Cidade', 'Nacionalidade', 'Clube', 'Categorias', 'Status', 'Latino', 'Ação Afirmativa', 'Valor Total', 'Times', 'Alimentação', 'Alojamento', 'Criado em']);
    $stmt = $db->query("
        SELECT i.id, p.nome, p.email, p.telefone, p.cidade, p.nacionalidade, c.nome AS clube,
               (SELECT GROUP_CONCAT(ic.categoria, '|') FROM inscricao_categorias ic WHERE ic.inscricao_id = i.id) AS categorias,
               i.status, i.latino, i.acao_afirmativa, i.valor_total,
               (SELECT GROUP_CONCAT(t.nome, '|') FROM times t JOIN membros_time mt ON mt.time_id = t.id WHERE mt.inscricao_id = i.id) AS times,
               (SELECT GROUP_CONCAT(al.dia, '|') FROM alimentacao al WHERE al.inscricao_id = i.id) AS dias_alimentacao,
               (SELECT GROUP_CONCAT(alj.dia, '|') FROM alojamento alj WHERE alj.inscricao_id = i.id) AS dias_alojamento,
               i.criado_em
        FROM inscricoes i
        JOIN pessoas p ON p.id = i.pessoa_id
        LEFT JOIN clubes c ON c.id = p.clube_id
        WHERE i.status != 'cancelado'
        ORDER BY i.criado_em
    ");
    foreach ($stmt->fetchAll() as $r) {
        echo csvRow([$r['id'], $r['nome'], $r['email'], $r['telefone'], $r['cidade'], $r['nacionalidade'],
            $r['clube'], $r['categorias'], $r['status'], $r['latino'] ? 'Sim' : 'Não',
            $r['acao_afirmativa'] ? 'Sim' : 'Não', number_format($r['valor_total'], 2, ',', '.'),
            $r['times'], $r['dias_alimentacao'], $r['dias_alojamento'], $r['criado_em']]);
    }
}

elseif ($tipo === 'times') {
    echo csvRow(['ID', 'Nome', 'Categoria', 'Código', 'Membros', 'Estrangeiros', 'Latinos', 'Criado em']);
    $stmt = $db->query("
        SELECT t.id, t.nome, t.categoria, t.codigo, t.criado_em,
               COUNT(DISTINCT mt.inscricao_id) AS num_membros,
               SUM(CASE WHEN p.nacionalidade != 'brasileire' THEN 1 ELSE 0 END) AS num_est,
               SUM(CASE WHEN i.latino = 1 THEN 1 ELSE 0 END) AS num_lat
        FROM times t
        LEFT JOIN membros_time mt ON mt.time_id = t.id
        LEFT JOIN inscricoes i ON i.id = mt.inscricao_id AND i.status != 'cancelado'
        LEFT JOIN pessoas p ON p.id = i.pessoa_id
        GROUP BY t.id ORDER BY t.categoria, t.nome
    ");
    foreach ($stmt->fetchAll() as $r) {
        echo csvRow([$r['id'], $r['nome'], $r['categoria'], $r['codigo'], $r['num_membros'], $r['num_est'], $r['num_lat'], $r['criado_em']]);
    }
}

elseif ($tipo === 'alimentacao') {
    $TIPOS_RESTRICAO = [
        'vegetariano' => 'Vegetariano',
        'vegano'      => 'Vegano',
        'lactose'     => 'Intolerância à lactose',
        'alergia'     => 'Alergia alimentar',
        'outra'       => 'Outra restrição',
    ];
    $PACOTE_LABEL = ['completo' => 'Completo', 'almoco' => 'Só almoço'];

    $stmt = $db->query("
        SELECT al.dia, COALESCE(al.pacote, 'completo') AS pacote, p.nome, p.cidade, p.nacionalidade,
               i.restricao_alimentar,
               CASE WHEN EXISTS (
                   SELECT 1 FROM pagamentos pg
                   WHERE pg.inscricao_id = i.id
                   AND pg.tipo IN ('alimentacao', 'completo')
                   AND pg.status = 'pago'
               ) THEN 1 ELSE 0 END AS confirmado
        FROM alimentacao al
        JOIN inscricoes i ON i.id = al.inscricao_id AND i.status != 'cancelado'
        JOIN pessoas p ON p.id = i.pessoa_id
        ORDER BY al.dia, p.nome
    ");
    $rows = $stmt->fetchAll();

    // ── Resumo por dia ────────────────────────────────────
    $resumo = [];
    foreach ($rows as $r) {
        $d = (int)$r['dia'];
        if (!isset($resumo[$d])) {
            $resumo[$d] = ['total' => 0, 'completo' => 0, 'almoco' => 0, 'restricoes' => array_fill_keys(array_keys($TIPOS_RESTRICAO), 0)];
        }
        $resumo[$d]['total']++;
        if ($r['pacote'] === 'almoco') $resumo[$d]['almoco']++; else $resumo[$d]['completo']++;
        $ra = json_decode($r['restricao_alimentar'] ?? 'null', true);
        $rt = $ra['tipo'] ?? null;
        if ($rt && isset($resumo[$d]['restricoes'][$rt])) $resumo[$d]['restricoes'][$rt]++;
    }
    ksort($resumo);

    echo csvRow(['RESUMO POR DIA']);
    echo csvRow(array_merge(['Dia', 'Total', 'Pacote completo', 'Só almoço'], array_values($TIPOS_RESTRICAO), ['Total restritivos']));
    foreach ($resumo as $d => $r) {
        echo csvRow(array_merge(
            ['Dia ' . $d . '/09', $r['total'], $r['completo'], $r['almoco']],
            array_values($r['restricoes']),
            [array_sum($r['restricoes'])]
        ));
    }

    echo csvRow([]);
    echo csvRow(['DETALHAMENTO']);
    echo csvRow(['Dia', 'Nome', 'Cidade', 'Nacionalidade', 'Pacote', 'Restrição', 'Confirmado']);
    foreach ($rows as $r) {
        $ra   = json_decode($r['restricao_alimentar'] ?? 'null', true);
        $rest = $ra ? (($TIPOS_RESTRICAO[$ra['tipo']] ?? $ra['tipo']) . ($ra['descricao'] ? ': ' . $ra['descricao'] : '')) : '';
        echo csvRow([
            'Dia ' . $r['dia'] . '/09', $r['nome'], $r['cidade'], $r['nacionalidade'],
            $PACOTE_LABEL[$r['pacote']] ?? 'Completo', $rest, $r['confirmado'] ? 'Sim' : 'Não',
        ]);
    }
}

elseif ($tipo === 'lojinha') {
    echo csvRow(['ID', 'Nome', 'Email', 'WhatsApp', 'Itens', 'Valor', 'Método', 'Status', 'Código de Retirada', 'Observações', 'Criado em']);
    $stmt = $db->query("
        SELECT p.id, p.nome, p.email, p.whatsapp, p.valor, p.metodo, p.status,
               p.codigo_retirada, p.observacoes, p.criado_em,
               (SELECT GROUP_CONCAT(pi.quantidade || 'x ' || pi.produto_nome || COALESCE(' (' || pi.tamanho || ')', ''), ' | ')
                  FROM loj_pedido_itens pi WHERE pi.pedido_id = p.id) AS itens
        FROM loj_pedidos p
        WHERE p.status != 'cancelado'
        ORDER BY p.criado_em
    ");
    foreach ($stmt->fetchAll() as $r) {
        echo csvRow([$r['id'], $r['nome'], $r['email'], $r['whatsapp'], $r['itens'],
            number_format($r['valor'], 2, ',', '.'), $r['metodo'], $r['status'],
            $r['codigo_retirada'], $r['observacoes'], $r['criado_em']]);
    }
}

elseif ($tipo === 'alojamento') {
    echo csvRow(['Dia', 'Nome', 'Cidade', 'Nacionalidade', 'Confirmado']);
    $stmt = $db->query("
        SELECT al.dia, p.nome, p.cidade, p.nacionalidade,
               COALESCE(ck.alojamento_confirmado, 0) AS confirmado
        FROM alojamento al
        JOIN inscricoes i ON i.id = al.inscricao_id AND i.status != 'cancelado'
        JOIN pessoas p ON p.id = i.pessoa_id
        LEFT JOIN checkins ck ON ck.inscricao_id = i.id
        ORDER BY al.dia, p.nome
    ");
    foreach ($stmt->fetchAll() as $r) {
        echo csvRow(['Dia ' . $r['dia'] . '/09', $r['nome'], $r['cidade'], $r['nacionalidade'], $r['confirmado'] ? 'Sim' : 'Não']);
    }
}

exit;
