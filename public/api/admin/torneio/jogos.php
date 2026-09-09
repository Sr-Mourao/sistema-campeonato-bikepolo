<?php
/** Lista jogos de um torneio (com nomes de time e fase), pra dashboard/board/chaves. */
require_once __DIR__ . '/../middleware.php';
adminGuard();

$db = getDb();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') respondError('Método não permitido', 405);

$torneioId = (int)($_GET['torneio_id'] ?? 0);
if (!$torneioId) respondError('torneio_id é obrigatório');

$where = ['j.torneio_id = ?'];
$params = [$torneioId];
if (!empty($_GET['fase_tipo'])) { $where[] = 'f.tipo = ?'; $params[] = $_GET['fase_tipo']; }
if (!empty($_GET['rodada']))    { $where[] = 'f.rodada = ?'; $params[] = (int)$_GET['rodada']; }
if (!empty($_GET['status']))    { $where[] = 'j.status = ?'; $params[] = $_GET['status']; }
if (!empty($_GET['fase_id']))   { $where[] = 'j.fase_id = ?'; $params[] = (int)$_GET['fase_id']; }

$sql = "
    SELECT
        j.*, f.tipo AS fase_tipo, f.rodada AS fase_rodada, f.rotulo AS fase_rotulo, f.estado AS fase_estado,
        ta.nome AS time_a_nome, tb.nome AS time_b_nome
    FROM torneio_jogos j
    JOIN torneio_fases f ON f.id = j.fase_id
    LEFT JOIN times ta ON ta.id = j.time_a_id
    LEFT JOIN times tb ON tb.id = j.time_b_id
    WHERE " . implode(' AND ', $where) . "
    ORDER BY f.id, j.ordem
";
$stmt = $db->prepare($sql);
$stmt->execute($params);
respond(['jogos' => $stmt->fetchAll()]);
