<?php
/**
 * Torneio: criação, listagem, config (critérios), transições de fase que não
 * são "gerar rodada" (fechar classificação, gerar repescagem/double, reset).
 */
require_once __DIR__ . '/../middleware.php';
require_once __DIR__ . '/../../torneio/lib.php';
require_once __DIR__ . '/../../torneio/bracket.php';
require_once __DIR__ . '/../../torneio/setup.php';
adminGuard();

$db     = getDb();
$method = $_SERVER['REQUEST_METHOD'];
$usuario = $_SESSION['admin_user'] ?? 'admin';

function torneioOu404(PDO $db, $id): array {
    $t = getTorneio($db, (int)$id);
    if (!$t) respondError('Torneio não encontrado', 404);
    return $t;
}

if ($method === 'GET') {
    $id = $_GET['id'] ?? null;

    if ($id) {
        $torneio = torneioOu404($db, $id);
        $torneio['participantes'] = getParticipantes($db, (int)$id);
        $torneio['criterios'] = getCriterios($db, (int)$id);
        $torneio['formato'] = formatoDoTorneio($torneio);
        $torneio['formato_info'] = formatoInfo($torneio);

        // `completa`: fase confirmada E sem nenhum jogo real (não-bye) ainda aberto — é a
        // fonte canônica de "esta fase de fato terminou" (não confundir com `estado`, que só
        // diz se o pareamento foi publicado). Front usa isso pra liberar botões de transição
        // de fase; backend usa a mesma regra em validarSwissCompleto() antes de gerar a
        // Equalização — nunca confia só no que o front mostra.
        $stmt = $db->prepare("
            SELECT f.id, f.tipo, f.rodada, f.rotulo, f.estado, f.gerada_em, f.confirmada_em, f.confirmada_por,
                   CASE WHEN f.estado = 'confirmada'
                        AND COALESCE(SUM(CASE WHEN j.is_bye = 0 AND j.status NOT IN ('encerrado','wo','cancelado') THEN 1 ELSE 0 END), 0) = 0
                   THEN 1 ELSE 0 END AS completa
            FROM torneio_fases f
            LEFT JOIN torneio_jogos j ON j.fase_id = f.id
            WHERE f.torneio_id = ?
            GROUP BY f.id
            ORDER BY f.id
        ");
        $stmt->execute([$id]);
        $torneio['fases'] = array_map(function ($f) { $f['completa'] = (bool)$f['completa']; return $f; }, $stmt->fetchAll());

        // Aviso de inconsistência (seção 3 do brief de acabamento 3) — mesma fonte canônica
        // que decide a partida em destaque no público, reaproveitada aqui só pro banner.
        $destaque = resolverPartidaDestaque($db, (int)$id);
        $torneio['multiplas_em_andamento'] = $destaque['multiplas_em_andamento'];
        $torneio['jogos_em_andamento'] = array_map(fn($j) => $j['codigo'], $destaque['todas_em_andamento']);
        $torneio['jogo_destaque_codigo'] = $destaque['jogo']['codigo'] ?? null;

        respond($torneio);
    }

    // Lista todos os torneios (mais recentes primeiro) — normalmente só existe um.
    $stmt = $db->query("SELECT * FROM torneios ORDER BY id DESC");
    respond(['torneios' => $stmt->fetchAll()]);
}

if ($method === 'POST') {
    $body = getBody();
    $action = $body['action'] ?? '';

    try {
        if ($action === 'criar_preset') {
            $categoria = $body['categoria'] ?? 'misto';
            $id = criarTorneioPreset($db, $categoria, $usuario);
            respond(['id' => $id]);
        }

        if ($action === 'zerar_resultados') {
            $torneio = torneioOu404($db, $body['torneio_id'] ?? 0);
            zerarResultados($db, (int)$torneio['id'], $usuario);
            respond(['ok' => true]);
        }

        if ($action === 'salvar_criterios') {
            $torneio = torneioOu404($db, $body['torneio_id'] ?? 0);
            $anterior = getCriterios($db, (int)$torneio['id']);
            salvarCriterios($db, (int)$torneio['id'], $body['criterios'] ?? []);
            torneioAuditoria($db, (int)$torneio['id'], $usuario, 'salvar_criterios', 'torneio_criterios', null, $anterior, $body['criterios'], null);
            respond(['ok' => true]);
        }

        if ($action === 'fechar_classificacao') {
            $torneio = torneioOu404($db, $body['torneio_id'] ?? 0);
            $classificacao = fecharClassificacao($db, (int)$torneio['id'], $usuario);
            respond(['ok' => true, 'classificacao' => $classificacao]);
        }

        if ($action === 'gerar_repescagem') {
            $torneio = torneioOu404($db, $body['torneio_id'] ?? 0);
            $r = gerarRepescagem($db, (int)$torneio['id'], $usuario);
            respond(['ok' => true] + $r);
        }

        if ($action === 'gerar_double') {
            $torneio = torneioOu404($db, $body['torneio_id'] ?? 0);
            $r = gerarDouble($db, (int)$torneio['id'], $usuario);
            respond(['ok' => true] + $r);
        }
    } catch (\Throwable $e) {
        respondError($e->getMessage(), 400);
    }

    respondError('Ação desconhecida');
}

respondError('Método não permitido', 405);
