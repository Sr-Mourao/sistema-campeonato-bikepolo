<?php
require_once __DIR__ . '/db.php';

corsHeaders();

$token = $_SERVER['HTTP_X_SESSION_TOKEN'] ?? '';
if (empty($token)) respondError('Não autenticado', 401);

$db = getDb();

// Valida sessão
$stmt = $db->prepare("
    SELECT * FROM sessions
    WHERE token = ? AND expires_at > datetime('now')
");
$stmt->execute([$token]);
$session = $stmt->fetch();

if (!$session) respondError('Sessão expirada ou inválida', 401);

$email = $session['email'];

// Pessoa
$stmt = $db->prepare("
    SELECT p.*, c.nome as clube_nome
    FROM pessoas p
    LEFT JOIN clubes c ON c.id = p.clube_id
    WHERE p.email = ? COLLATE NOCASE
");
$stmt->execute([$email]);
$pessoa = $stmt->fetch();

if (!$pessoa) {
    // Email autenticado mas sem inscrição ainda
    respond([
        'autenticado' => true,
        'email'       => $email,
        'pessoa'      => null,
        'inscricao'   => null,
    ]);
}

$pessoaId = $pessoa['id'];

// Inscrição mais recente
$stmt = $db->prepare("
    SELECT * FROM inscricoes
    WHERE pessoa_id = ?
    ORDER BY criado_em DESC LIMIT 1
");
$stmt->execute([$pessoaId]);
$inscricao = $stmt->fetch();

if (!$inscricao) {
    respond([
        'autenticado' => true,
        'email'       => $email,
        'pessoa'      => formatPessoa($pessoa),
        'inscricao'   => null,
    ]);
}

$inscricaoId = $inscricao['id'];

// Categorias
$stmt = $db->prepare("SELECT categoria, valor FROM inscricao_categorias WHERE inscricao_id = ?");
$stmt->execute([$inscricaoId]);
$categorias = $stmt->fetchAll();

// Times
$stmt = $db->prepare("
    SELECT t.nome, t.categoria, t.codigo, t.logo_path,
           CASE WHEN t.criador_id = ? THEN 1 ELSE 0 END as criou
    FROM membros_time mt
    JOIN times t ON t.id = mt.time_id
    WHERE mt.inscricao_id = ?
");
$stmt->execute([$pessoaId, $inscricaoId]);
$times = $stmt->fetchAll();

// Alimentação
$stmt = $db->prepare("SELECT dia, valor, COALESCE(pacote, 'completo') AS pacote FROM alimentacao WHERE inscricao_id = ? ORDER BY dia");
$stmt->execute([$inscricaoId]);
$alimentacao = $stmt->fetchAll();

// Alojamento
$stmt = $db->prepare("SELECT dia, valor, pagamento_id FROM alojamento WHERE inscricao_id = ? ORDER BY dia");
$stmt->execute([$inscricaoId]);
$alojamento = $stmt->fetchAll();

// Pagamentos (todos, em ordem cronológica)
$stmt = $db->prepare("
    SELECT id, tipo, status, valor, metodo, itens_json, criado_em
    FROM pagamentos
    WHERE inscricao_id = ?
    ORDER BY criado_em ASC
");
$stmt->execute([$inscricaoId]);
$pagamentos = $stmt->fetchAll();

$configGeral = getConfigGeral($db);

respond([
    'autenticado' => true,
    'email'       => $email,
    'pessoa'      => formatPessoa($pessoa),
    'config'      => [
        'alojamento_aberto'  => $configGeral['alojamento_aberto']  === '1',
        'alimentacao_aberto' => $configGeral['alimentacao_aberto'] === '1',
    ],
    'inscricao'   => [
        'id'                   => (int)$inscricao['id'],
        'status'               => $inscricao['status'],
        'tipo_participacao'    => $inscricao['tipo_participacao'] ?? 'atleta',
        'latino'               => (bool)$inscricao['latino'],
        'acao_afirmativa'      => (bool)$inscricao['acao_afirmativa'],
        'acao_preta'           => (bool)$inscricao['acao_preta'],
        'acao_parda'           => (bool)$inscricao['acao_parda'],
        'acao_indigena'        => (bool)$inscricao['acao_indigena'],
        'acao_primeiro_torneio'=> (bool)$inscricao['acao_primeiro_torneio'],
        'valor_total'          => (float)$inscricao['valor_total'],
        'criado_em'            => $inscricao['criado_em'],
        'categorias'           => $categorias,
        'times'                => array_map(fn($t) => [
            'nome'      => $t['nome'],
            'categoria' => $t['categoria'],
            'codigo'    => $t['codigo'],
            'logo_path' => $t['logo_path'],
            'criou'     => (bool)$t['criou'],
        ], $times),
        'restricao_alimentar'  => (function() use ($inscricao) {
            $raw = $inscricao['restricao_alimentar'] ?? null;
            if (!$raw) return null;
            $parsed = json_decode($raw, true);
            // Backward compat: if stored as plain text, treat as 'outra'
            return is_array($parsed) ? $parsed : ['tipo' => 'outra', 'descricao' => $raw];
        })(),
        'alimentacao' => array_map(fn($a) => ['dia' => (int)$a['dia'], 'valor' => (float)$a['valor'], 'pacote' => $a['pacote'] ?? 'completo'], $alimentacao),
        'alojamento'  => array_map(fn($a) => ['dia' => (int)$a['dia'], 'valor' => (float)$a['valor'], 'pago' => $a['pagamento_id'] !== null], $alojamento),
        'pagamentos'  => array_map(fn($p) => [
            'id'         => (int)$p['id'],
            'tipo'       => $p['tipo'] ?? 'inscricao',
            'status'     => $p['status'],
            'valor'      => (float)$p['valor'],
            'metodo'     => $p['metodo'],
            'itens'      => $p['itens_json'] ? json_decode($p['itens_json'], true) : null,
            'criado_em'  => $p['criado_em'],
        ], $pagamentos),
    ],
]);

function formatPessoa(array $p): array {
    return [
        'id'           => (int)$p['id'],
        'nome'         => $p['nome'],
        'email'        => $p['email'],
        'telefone'     => $p['telefone'],
        'genero'       => $p['genero'],
        'clube'        => $p['clube_nome'],
        'cidade'       => $p['cidade'],
        'nacionalidade'=> $p['nacionalidade'],
    ];
}
