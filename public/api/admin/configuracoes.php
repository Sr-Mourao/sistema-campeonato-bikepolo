<?php
require_once __DIR__ . '/middleware.php';
adminGuard();

$db     = getDb();
$method = $_SERVER['REQUEST_METHOD'];

$CAMPOS = [
    'valor_misto'                => ['label' => 'Misto (R$)',          'tipo' => 'float', 'min' => 0],
    'valor_mtnb'                 => ['label' => 'MTNB (R$)',           'tipo' => 'float', 'min' => 0],
    'valor_misto_com_mtnb'       => ['label' => 'Misto + MTNB (R$)',   'tipo' => 'float', 'min' => 0],
    'desconto_primeiro_torneio'  => ['label' => 'Desconto 1º torneio (ex: 0.5 = 50%)', 'tipo' => 'float', 'min' => 0, 'max' => 1],
    'valor_alimentacao_completo' => ['label' => 'Alimentação completo/dia (R$)', 'tipo' => 'float', 'min' => 0],
    'valor_alimentacao_almoco'   => ['label' => 'Alimentação almoço/dia (R$)',   'tipo' => 'float', 'min' => 0],
    'valor_alojamento_diaria'    => ['label' => 'Alojamento/diária (R$)',        'tipo' => 'float', 'min' => 0],
];

// ── GET — retorna valores atuais + metadados ──────────────
if ($method === 'GET') {
    $precos = getPrecos($db);
    $resp = [];
    foreach ($CAMPOS as $chave => $meta) {
        $resp[] = array_merge($meta, [
            'chave' => $chave,
            'valor' => $precos[$chave],
        ]);
    }
    respond($resp);
}

// ── POST — salva um valor ─────────────────────────────────
if ($method === 'POST') {
    $body  = getBody();
    $chave = trim($body['chave'] ?? '');
    $valor = $body['valor'] ?? null;

    if (!isset($CAMPOS[$chave])) respondError('Chave inválida');
    if ($valor === null || $valor === '') respondError('Valor é obrigatório');

    $valorFloat = (float)$valor;
    $meta = $CAMPOS[$chave];
    if (isset($meta['min']) && $valorFloat < $meta['min']) respondError("Valor mínimo: {$meta['min']}");
    if (isset($meta['max']) && $valorFloat > $meta['max']) respondError("Valor máximo: {$meta['max']}");

    $db->prepare("
        INSERT INTO configuracoes (chave, valor, atualizado_em)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em
    ")->execute([$chave, (string)$valorFloat]);

    respond(['ok' => true, 'chave' => $chave, 'valor' => $valorFloat]);
}

respondError('Método não suportado', 405);
