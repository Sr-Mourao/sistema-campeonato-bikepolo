<?php
require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/../awards/lib.php';
adminGuard();

$db = getDb();
$admin = (string)($_SESSION['admin_user'] ?? 'admin');

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        if (($_GET['view'] ?? '') === 'projecao') {
            $categorias = [];
            foreach (awardsApuracao($db) as $codigo => $resultado) {
                $categorias[$codigo] = [
                    'codigo' => $codigo,
                    'nome' => $resultado['nome'],
                    'descricao' => $resultado['descricao'],
                    'total_votos' => $resultado['total_votos'],
                    'maior_quantidade' => $resultado['maior_quantidade'],
                    'vencedores' => $resultado['vencedores'],
                    'empate' => $resultado['empate'],
                ];
            }
            respond(['status' => awardsStatus($db), 'categorias' => $categorias]);
        }
        respond(array_merge(awardsPainelAdmin($db), [
            'mtnb' => ['atletas' => awardsAtletasCategoria($db, 'mtnb'), 'categorias' => awardsMtnbListar($db)],
        ]));
    }
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') respondError('Método não suportado', 405);

    $body = getBody();
    $acao = $body['acao'] ?? '';
    if ($acao === 'curadoria') {
        awardsDefinirCuradoria($db, (string)($body['categoria'] ?? ''), is_array($body['pessoa_ids'] ?? null) ? $body['pessoa_ids'] : [], $admin);
    } elseif ($acao === 'adicionar_todos_jesse') {
        awardsDefinirCuradoria($db, 'jesse', array_column(awardsAtletasMisto($db), 'pessoa_id'), $admin);
    } elseif ($acao === 'abrir') {
        awardsAlterarStatus($db, 'aberta', $admin);
    } elseif ($acao === 'encerrar') {
        awardsAlterarStatus($db, 'encerrada', $admin);
    } elseif ($acao === 'zerar_dados') {
        if (($body['confirmacao'] ?? '') !== 'ZERAR AWARDS') {
            throw new AwardsException('Confirmação inválida para zerar os Awards');
        }
        awardsZerarDados($db, $admin);
    } elseif ($acao === 'salvar_mtnb') {
        awardsMtnbSalvar($db, $body, $admin);
    } elseif ($acao === 'excluir_mtnb') {
        awardsMtnbExcluir($db, (int)($body['id'] ?? 0));
    } else {
        throw new AwardsException('Ação inválida');
    }
    respond(array_merge(awardsPainelAdmin($db), [
        'mtnb' => ['atletas' => awardsAtletasCategoria($db, 'mtnb'), 'categorias' => awardsMtnbListar($db)],
    ]));
} catch (AwardsException $e) {
    respondError($e->getMessage(), $e->httpStatus);
}
