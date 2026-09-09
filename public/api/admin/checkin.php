<?php
require_once __DIR__ . '/middleware.php';
adminGuard();

$db     = getDb();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $db->query("
        SELECT i.id, p.nome, p.email, p.cidade, p.nacionalidade,
               i.status, COALESCE(i.tipo_participacao, 'atleta') AS tipo_participacao,
               (SELECT GROUP_CONCAT(ic.categoria, ', ') FROM inscricao_categorias ic WHERE ic.inscricao_id = i.id) AS categorias,
               COALESCE(ck.presente, 0)              AS presente,
               COALESCE(ck.credenciado, 0)           AS credenciado,
               COALESCE(ck.bike_check, 0)            AS bike_check,
               COALESCE(ck.alojamento_confirmado, 0) AS alojamento_confirmado,
               (SELECT COUNT(*) FROM alojamento al WHERE al.inscricao_id = i.id) AS tem_alojamento,
               CASE WHEN EXISTS (SELECT 1 FROM pagamentos pg WHERE pg.inscricao_id = i.id AND pg.tipo IN ('alojamento','alojamento_extra','completo') AND pg.status = 'pago') THEN 1 ELSE 0 END AS alojamento_pago
        FROM inscricoes i
        JOIN pessoas p ON p.id = i.pessoa_id
        LEFT JOIN checkins ck ON ck.inscricao_id = i.id
        WHERE i.status != 'cancelado'
        ORDER BY p.nome ASC
        LIMIT 500
    ");
    $pessoas = $stmt->fetchAll();

    $ids = array_column($pessoas, 'id');
    $refeicoes_map = [];
    $noites_map    = [];

    if (!empty($ids)) {
        $ph = implode(',', array_fill(0, count($ids), '?'));

        // Refeições: apenas para quem tem pagamento de alimentação pago
        $stmt2 = $db->prepare("
            SELECT a.inscricao_id, a.dia, COALESCE(a.pacote, 'completo') AS pacote,
                   COALESCE(a.retirado_cafe, 0) AS retirado_cafe,
                   COALESCE(a.retirado_almoco, 0) AS retirado_almoco,
                   COALESCE(a.retirado_lanche, 0) AS retirado_lanche
            FROM alimentacao a
            WHERE a.inscricao_id IN ($ph)
            AND EXISTS (
                SELECT 1 FROM pagamentos pg
                WHERE pg.inscricao_id = a.inscricao_id
                AND pg.tipo IN ('alimentacao', 'completo')
                AND pg.status = 'pago'
            )
            ORDER BY a.dia
        ");
        $stmt2->execute($ids);
        foreach ($stmt2->fetchAll() as $r) {
            $refeicoes_map[(int)$r['inscricao_id']][] = [
                'dia'             => (int)$r['dia'],
                'pacote'          => $r['pacote'],
                'retirado_cafe'   => (int)$r['retirado_cafe'],
                'retirado_almoco' => (int)$r['retirado_almoco'],
                'retirado_lanche' => (int)$r['retirado_lanche'],
            ];
        }

        // Noites de alojamento por pessoa
        $stmt3 = $db->prepare("
            SELECT inscricao_id, dia FROM alojamento WHERE inscricao_id IN ($ph) ORDER BY dia
        ");
        $stmt3->execute($ids);
        foreach ($stmt3->fetchAll() as $r) {
            $noites_map[(int)$r['inscricao_id']][] = (int)$r['dia'];
        }
    }

    respond(array_map(function ($p) use ($refeicoes_map, $noites_map) {
        return [
            'id'                   => (int)$p['id'],
            'nome'                 => $p['nome'],
            'email'                => $p['email'],
            'cidade'               => $p['cidade'],
            'status'               => $p['status'],
            'tipo_participacao'    => $p['tipo_participacao'],
            'categorias'           => $p['categorias'] ?? '',
            'presente'             => (int)$p['presente'],
            'credenciado'          => (int)$p['credenciado'],
            'bike_check'           => (int)$p['bike_check'],
            'alojamento_confirmado'=> (int)$p['alojamento_confirmado'],
            'tem_alojamento'       => (int)$p['tem_alojamento'],
            'alojamento_pago'      => (int)$p['alojamento_pago'],
            'refeicoes'            => $refeicoes_map[(int)$p['id']] ?? [],
            'noites'               => $noites_map[(int)$p['id']] ?? [],
        ];
    }, $pessoas));
}

if ($method === 'POST') {
    $body         = getBody();
    $inscricao_id = (int)($body['inscricao_id'] ?? 0);
    $campo        = $body['campo'] ?? '';
    $valor        = (int)($body['valor'] ?? 1);

    if (!$inscricao_id) respondError('inscricao_id obrigatório');

    // Retirada de refeição — cada parte (café/almoço/lanche) é marcada independentemente
    if ($campo === 'refeicao') {
        $dia   = (int)($body['dia'] ?? 0);
        $parte = $body['parte'] ?? '';
        if (!in_array($dia, [5, 6, 7])) respondError('Dia inválido');
        if (!in_array($parte, ['cafe', 'almoco', 'lanche'])) respondError('Parte da refeição inválida');

        $stmt = $db->prepare("SELECT COALESCE(pacote, 'completo') AS pacote FROM alimentacao WHERE inscricao_id = ? AND dia = ?");
        $stmt->execute([$inscricao_id, $dia]);
        $pacote = $stmt->fetchColumn();
        if ($pacote === false) respondError('Alimentação não encontrada para esse dia', 404);
        if ($pacote === 'almoco' && $parte !== 'almoco') {
            respondError('Este pacote inclui apenas o almoço');
        }

        $coluna = "retirado_{$parte}";
        $db->prepare("UPDATE alimentacao SET $coluna = ? WHERE inscricao_id = ? AND dia = ?")
           ->execute([$valor, $inscricao_id, $dia]);
        respond(['ok' => true]);
    }

    $campos_validos = ['presente', 'credenciado', 'bike_check', 'alojamento_confirmado'];
    if (!in_array($campo, $campos_validos)) respondError('Campo inválido');

    $db->prepare("INSERT INTO checkins (inscricao_id) VALUES (?) ON CONFLICT(inscricao_id) DO NOTHING")
       ->execute([$inscricao_id]);
    $db->prepare("UPDATE checkins SET $campo = ?, atualizado_em = datetime('now') WHERE inscricao_id = ?")
       ->execute([$valor, $inscricao_id]);

    respond(['ok' => true]);
}

respondError('Método não permitido', 405);
