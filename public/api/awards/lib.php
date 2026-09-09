<?php
require_once __DIR__ . '/../midia/lib.php';

const AWARDS_CATEGORIAS = ['mvp', 'wow', 'revelacao', 'jesse'];
const AWARDS_CURADORIA = ['revelacao', 'jesse'];

class AwardsException extends RuntimeException
{
    public int $httpStatus;
    public function __construct(string $message, int $httpStatus = 400)
    {
        parent::__construct($message);
        $this->httpStatus = $httpStatus;
    }
}

function awardsMetadados(): array
{
    return [
        'mvp' => ['nome' => 'MVP', 'descricao' => 'Melhor Atleta em Quadra. Reconhece quem mais se destacou esportivamente durante o torneio.'],
        'wow' => ['nome' => 'WOW', 'descricao' => 'Para quem já conhecíamos, mas evoluiu demais e fez todo mundo pensar: WOW, está jogando muito!'],
        'revelacao' => ['nome' => 'Revelação', 'descricao' => 'Um atleta novo na comunidade, prioritariamente em seu primeiro torneio, que impressionou a galera.'],
        'jesse' => ['nome' => 'Jessé', 'descricao' => 'Para aquela pessoa queridona e colaborativa que melhora o torneio — com zero freio e histórias que só ela consegue criar.'],
    ];
}

function awardsStatus(PDO $db): string
{
    $status = $db->query("SELECT status FROM awards_config WHERE id = 1")->fetchColumn();
    return in_array($status, ['fechada', 'aberta', 'encerrada'], true) ? $status : 'fechada';
}

/** Fonte canônica de eleitores e candidatos: inscrição esportiva ativa no Brasileiro MISTO. */
function awardsAtletasMisto(PDO $db): array
{
    return awardsAtletasCategoria($db, 'misto');
}

/** Atletas reais inscritos na categoria, reutilizados pelo cadastro manual MTNB. */
function awardsAtletasCategoria(PDO $db, string $categoria): array
{
    $categoria = strtolower(trim($categoria));
    if (!in_array($categoria, ['misto', 'mtnb'], true)) throw new AwardsException('Categoria de atletas inválida');
    $rows = $db->query("
        SELECT p.id AS pessoa_id, p.nome, p.foto_path, p.foto_atualizado_em,
               GROUP_CONCAT(DISTINCT t.nome) AS times
        FROM pessoas p
        JOIN inscricoes i ON i.pessoa_id = p.id
          AND COALESCE(i.tipo_participacao, 'atleta') = 'atleta'
          AND i.status != 'cancelado'
        JOIN inscricao_categorias ic ON ic.inscricao_id = i.id
          AND LOWER(ic.categoria) = " . $db->quote($categoria) . "
        LEFT JOIN membros_time mt ON mt.inscricao_id = i.id
        LEFT JOIN times t ON t.id = mt.time_id AND LOWER(t.categoria) = " . $db->quote($categoria) . "
        GROUP BY p.id, p.nome, p.foto_path, p.foto_atualizado_em
        ORDER BY p.nome COLLATE NOCASE, p.id
    ")->fetchAll();

    return array_map(static fn(array $row): array => [
        'pessoa_id' => (int)$row['pessoa_id'],
        'nome' => $row['nome'],
        'foto' => urlComCacheBust($row['foto_path'] ?? null, $row['foto_atualizado_em'] ?? null),
        'time' => $row['times'] ?: null,
    ], $rows);
}

function awardsMtnbListar(PDO $db, bool $somentePublicados = false): array
{
    $where = $somentePublicados ? 'WHERE a.publicado = 1' : '';
    $rows = $db->query("
        SELECT a.id, a.codigo, a.nome, a.descricao, a.ordem, a.publicado,
               p.id AS pessoa_id, p.nome AS pessoa_nome, p.foto_path, p.foto_atualizado_em,
               GROUP_CONCAT(DISTINCT t.nome) AS times, av.ordem AS vencedor_ordem
          FROM awards_mtnb a
          LEFT JOIN awards_mtnb_vencedores av ON av.award_id = a.id
          LEFT JOIN pessoas p ON p.id = av.pessoa_id
          LEFT JOIN inscricoes i ON i.pessoa_id = p.id AND i.status != 'cancelado'
          LEFT JOIN membros_time mt ON mt.inscricao_id = i.id
          LEFT JOIN times t ON t.id = mt.time_id AND LOWER(t.categoria) = 'mtnb'
          $where
         GROUP BY a.id, av.id
         ORDER BY a.ordem, a.id, av.ordem, av.id
    ")->fetchAll();
    $awards = [];
    foreach ($rows as $row) {
        $id = (int)$row['id'];
        if (!isset($awards[$id])) {
            $awards[$id] = [
                'id' => $id, 'codigo' => $row['codigo'], 'nome' => $row['nome'],
                'descricao' => $row['descricao'] ?: '', 'ordem' => (int)$row['ordem'],
                'publicado' => (bool)$row['publicado'], 'vencedores' => [],
            ];
        }
        if ($row['pessoa_id'] !== null) {
            $awards[$id]['vencedores'][] = [
                'pessoa_id' => (int)$row['pessoa_id'], 'nome' => $row['pessoa_nome'],
                'foto' => urlComCacheBust($row['foto_path'] ?? null, $row['foto_atualizado_em'] ?? null),
                'time' => $row['times'] ?: null,
            ];
        }
    }
    return array_values($awards);
}

function awardsMtnbSalvar(PDO $db, array $dados, string $admin): void
{
    $id = (int)($dados['id'] ?? 0);
    $nome = trim((string)($dados['nome'] ?? ''));
    $descricao = trim((string)($dados['descricao'] ?? ''));
    $publicado = !empty($dados['publicado']) ? 1 : 0;
    $ordem = max(0, (int)($dados['ordem'] ?? 0));
    $ids = array_values(array_unique(array_map('intval', is_array($dados['pessoa_ids'] ?? null) ? $dados['pessoa_ids'] : [])));
    if ($nome === '') throw new AwardsException('Informe o nome da premiação MTNB');
    if ($publicado && count($ids) === 0) throw new AwardsException('Selecione ao menos uma pessoa vencedora antes de publicar');
    $aptos = array_column(awardsAtletasCategoria($db, 'mtnb'), 'pessoa_id');
    foreach ($ids as $pessoaId) if ($pessoaId <= 0 || !in_array($pessoaId, $aptos, true)) throw new AwardsException('A premiação contém pessoa que não é atleta do MTNB');

    $db->beginTransaction();
    try {
        if ($id > 0) {
            $stmt = $db->prepare("UPDATE awards_mtnb SET nome=?, descricao=?, ordem=?, publicado=?, atualizado_em=datetime('now'), atualizado_por=? WHERE id=?");
            $stmt->execute([$nome, $descricao, $ordem, $publicado, $admin, $id]);
            if ($stmt->rowCount() === 0 && !(bool)$db->query("SELECT 1 FROM awards_mtnb WHERE id=" . $id)->fetchColumn()) throw new AwardsException('Premiação MTNB não encontrada', 404);
        } else {
            $base = strtolower(iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $nome) ?: $nome);
            $codigo = trim(preg_replace('/[^a-z0-9]+/', '-', $base), '-') ?: 'premio';
            $codigo .= '-' . bin2hex(random_bytes(3));
            $stmt = $db->prepare("INSERT INTO awards_mtnb (codigo,nome,descricao,ordem,publicado,atualizado_por) VALUES (?,?,?,?,?,?)");
            $stmt->execute([$codigo, $nome, $descricao, $ordem, $publicado, $admin]);
            $id = (int)$db->lastInsertId();
        }
        $db->prepare('DELETE FROM awards_mtnb_vencedores WHERE award_id=?')->execute([$id]);
        $stmt = $db->prepare('INSERT INTO awards_mtnb_vencedores (award_id,pessoa_id,ordem) VALUES (?,?,?)');
        foreach ($ids as $indice => $pessoaId) $stmt->execute([$id, $pessoaId, $indice]);
        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        throw $e;
    }
}

function awardsMtnbExcluir(PDO $db, int $id): void
{
    if ($id <= 0) throw new AwardsException('Premiação MTNB inválida');
    $stmt = $db->prepare('DELETE FROM awards_mtnb WHERE id=?');
    $stmt->execute([$id]);
    if ($stmt->rowCount() === 0) throw new AwardsException('Premiação MTNB não encontrada', 404);
}

function awardsPessoaEhAtletaMisto(PDO $db, int $pessoaId): bool
{
    $stmt = $db->prepare("
        SELECT 1
        FROM inscricoes i
        JOIN inscricao_categorias ic ON ic.inscricao_id = i.id
        WHERE i.pessoa_id = ?
          AND COALESCE(i.tipo_participacao, 'atleta') = 'atleta'
          AND i.status != 'cancelado'
          AND LOWER(ic.categoria) = 'misto'
        LIMIT 1
    ");
    $stmt->execute([$pessoaId]);
    return (bool)$stmt->fetchColumn();
}

function awardsPessoaAutenticada(PDO $db, string $token): array
{
    if ($token === '') throw new AwardsException('Não autenticado', 401);
    $stmt = $db->prepare("
        SELECT p.id AS pessoa_id, p.nome, p.email
        FROM sessions s
        JOIN pessoas p ON p.email = s.email COLLATE NOCASE
        WHERE s.token = ? AND s.expires_at > datetime('now')
        LIMIT 1
    ");
    $stmt->execute([$token]);
    $pessoa = $stmt->fetch();
    if (!$pessoa) throw new AwardsException('Sessão expirada ou inválida', 401);
    $pessoa['pessoa_id'] = (int)$pessoa['pessoa_id'];
    if (!awardsPessoaEhAtletaMisto($db, $pessoa['pessoa_id'])) {
        throw new AwardsException('Awards disponíveis exclusivamente para atletas inscritos no Brasileiro Misto', 403);
    }
    return $pessoa;
}

function awardsIdsCurados(PDO $db, string $categoria): array
{
    $stmt = $db->prepare("SELECT pessoa_id FROM awards_candidatos WHERE categoria = ? ORDER BY pessoa_id");
    $stmt->execute([$categoria]);
    return array_map('intval', array_column($stmt->fetchAll(), 'pessoa_id'));
}

function awardsCandidatos(PDO $db, string $categoria, ?int $excluirPessoaId = null): array
{
    if (!in_array($categoria, AWARDS_CATEGORIAS, true)) throw new AwardsException('Categoria de Award inválida');
    $atletas = awardsAtletasMisto($db);
    $permitidos = in_array($categoria, AWARDS_CURADORIA, true)
        ? array_flip(awardsIdsCurados($db, $categoria))
        : null;
    return array_values(array_filter($atletas, static function (array $atleta) use ($permitidos, $excluirPessoaId): bool {
        if ($excluirPessoaId !== null && $atleta['pessoa_id'] === $excluirPessoaId) return false;
        return $permitidos === null || isset($permitidos[$atleta['pessoa_id']]);
    }));
}

function awardsVotosPessoa(PDO $db, int $pessoaId): array
{
    $stmt = $db->prepare("SELECT categoria, candidato_pessoa_id FROM awards_votos WHERE eleitor_pessoa_id = ?");
    $stmt->execute([$pessoaId]);
    $votos = [];
    foreach ($stmt->fetchAll() as $row) $votos[$row['categoria']] = (int)$row['candidato_pessoa_id'];
    return $votos;
}

function awardsDadosAtleta(PDO $db, int $pessoaId): array
{
    $status = awardsStatus($db);
    $votos = awardsVotosPessoa($db, $pessoaId);
    $categorias = [];
    if ($status === 'aberta') {
        foreach (awardsMetadados() as $codigo => $meta) {
            $categorias[] = array_merge(['codigo' => $codigo], $meta, [
                'candidatos' => awardsCandidatos($db, $codigo, $pessoaId),
            ]);
        }
    }
    return [
        'status' => $status,
        'categorias' => $categorias,
        'meus_votos' => $votos,
        'completo' => count($votos) === count(AWARDS_CATEGORIAS),
    ];
}

function awardsSalvarVotos(PDO $db, int $eleitorId, array $votos): void
{
    $db->beginTransaction();
    try {
        // Adquire o lock de escrita antes de conferir o estado: o admin não consegue
        // encerrar a votação entre a validação e o upsert dos quatro votos.
        $db->exec("UPDATE awards_config SET id = id WHERE id = 1");
        if (awardsStatus($db) !== 'aberta') throw new AwardsException('A votação não está aberta', 409);
        if (!awardsPessoaEhAtletaMisto($db, $eleitorId)) throw new AwardsException('Eleitor não é atleta do Brasileiro Misto', 403);
        if (count($votos) !== 4 || array_diff(AWARDS_CATEGORIAS, array_keys($votos)) !== []) {
            throw new AwardsException('Escolha exatamente um candidato em cada categoria');
        }

        $normalizados = [];
        foreach (AWARDS_CATEGORIAS as $categoria) {
            $candidatoId = filter_var($votos[$categoria] ?? null, FILTER_VALIDATE_INT);
            if (!$candidatoId || $candidatoId <= 0) throw new AwardsException('Candidato inválido em ' . $categoria);
            if ($candidatoId === $eleitorId) throw new AwardsException('Não é permitido votar em si mesmo');
            $elegiveis = array_column(awardsCandidatos($db, $categoria), 'pessoa_id');
            if (!in_array($candidatoId, $elegiveis, true)) throw new AwardsException('Candidato inelegível em ' . $categoria);
            $normalizados[$categoria] = $candidatoId;
        }

        $stmt = $db->prepare("
            INSERT INTO awards_votos (eleitor_pessoa_id, categoria, candidato_pessoa_id)
            VALUES (?, ?, ?)
            ON CONFLICT(eleitor_pessoa_id, categoria) DO UPDATE SET
              candidato_pessoa_id = excluded.candidato_pessoa_id,
              atualizado_em = datetime('now')
        ");
        foreach ($normalizados as $categoria => $candidatoId) $stmt->execute([$eleitorId, $categoria, $candidatoId]);
        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        throw $e;
    }
}

function awardsDefinirCuradoria(PDO $db, string $categoria, array $pessoaIds, string $admin): void
{
    if (!in_array($categoria, AWARDS_CURADORIA, true)) throw new AwardsException('Esta categoria não possui curadoria');
    if (awardsStatus($db) !== 'fechada') throw new AwardsException('A curadoria fica bloqueada após a abertura', 409);
    $ids = array_values(array_unique(array_map('intval', $pessoaIds)));
    $aptos = array_column(awardsAtletasMisto($db), 'pessoa_id');
    foreach ($ids as $id) if ($id <= 0 || !in_array($id, $aptos, true)) throw new AwardsException('A curadoria contém pessoa que não é atleta do Brasileiro Misto');

    $db->beginTransaction();
    try {
        $db->prepare("DELETE FROM awards_candidatos WHERE categoria = ?")->execute([$categoria]);
        $stmt = $db->prepare("INSERT INTO awards_candidatos (categoria, pessoa_id, criado_por) VALUES (?, ?, ?)");
        foreach ($ids as $id) $stmt->execute([$categoria, $id, $admin]);
        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        throw $e;
    }
}

function awardsAlterarStatus(PDO $db, string $novoStatus, string $admin): void
{
    $atual = awardsStatus($db);
    if ($novoStatus === 'aberta') {
        if ($atual !== 'fechada') throw new AwardsException('Somente uma votação fechada pode ser aberta', 409);
        if (count(awardsAtletasMisto($db)) === 0) throw new AwardsException('Não existem atletas do Brasileiro Misto aptos a votar');
        if (count(awardsCandidatos($db, 'revelacao')) === 0) throw new AwardsException('Selecione pelo menos um elegível para Revelação');
        if (count(awardsCandidatos($db, 'jesse')) === 0) throw new AwardsException('Selecione pelo menos um elegível para Jessé');
        $db->prepare("UPDATE awards_config SET status = 'aberta', aberta_em = datetime('now'), atualizado_em = datetime('now'), atualizado_por = ? WHERE id = 1")->execute([$admin]);
        return;
    }
    if ($novoStatus === 'encerrada') {
        if ($atual !== 'aberta') throw new AwardsException('Somente uma votação aberta pode ser encerrada', 409);
        $db->prepare("UPDATE awards_config SET status = 'encerrada', encerrada_em = datetime('now'), atualizado_em = datetime('now'), atualizado_por = ? WHERE id = 1")->execute([$admin]);
        return;
    }
    throw new AwardsException('Transição de status inválida');
}

/**
 * Reinicia somente o processo de Awards. Preserva pessoas, inscrições, times e
 * toda a estrutura esportiva; remove votos/curadorias e retorna à preparação.
 */
function awardsZerarDados(PDO $db, string $admin): void
{
    $db->beginTransaction();
    try {
        $db->exec("DELETE FROM awards_votos");
        $db->exec("DELETE FROM awards_candidatos");
        $stmt = $db->prepare("
            UPDATE awards_config
               SET status = 'fechada', aberta_em = NULL, encerrada_em = NULL,
                   atualizado_em = datetime('now'), atualizado_por = ?
             WHERE id = 1
        ");
        $stmt->execute([$admin]);
        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        throw $e;
    }
}

function awardsApuracao(PDO $db): array
{
    $resultado = [];
    foreach (awardsMetadados() as $categoria => $meta) {
        $candidatos = awardsCandidatos($db, $categoria);
        $stmt = $db->prepare("SELECT candidato_pessoa_id, COUNT(*) AS votos FROM awards_votos WHERE categoria = ? GROUP BY candidato_pessoa_id");
        $stmt->execute([$categoria]);
        $contagens = [];
        foreach ($stmt->fetchAll() as $row) $contagens[(int)$row['candidato_pessoa_id']] = (int)$row['votos'];
        foreach ($candidatos as &$candidato) $candidato['votos'] = $contagens[$candidato['pessoa_id']] ?? 0;
        unset($candidato);
        usort($candidatos, static fn(array $a, array $b): int => $b['votos'] <=> $a['votos'] ?: strcasecmp($a['nome'], $b['nome']));
        $total = array_sum(array_column($candidatos, 'votos'));
        $posicao = 0; $anterior = null;
        foreach ($candidatos as $indice => &$candidato) {
            if ($anterior === null || $candidato['votos'] !== $anterior) $posicao = $indice + 1;
            $candidato['posicao'] = $posicao;
            $candidato['percentual'] = $total > 0 ? round($candidato['votos'] * 100 / $total, 1) : 0;
            $anterior = $candidato['votos'];
        }
        unset($candidato);
        $maior = $total > 0 ? max(array_column($candidatos, 'votos')) : 0;
        $vencedores = $maior > 0 ? array_values(array_filter($candidatos, static fn(array $c): bool => $c['votos'] === $maior)) : [];
        $resultado[$categoria] = array_merge(['codigo' => $categoria], $meta, [
            'ranking' => $candidatos,
            'total_votos' => $total,
            'maior_quantidade' => $maior,
            'vencedores' => $vencedores,
            'empate' => count($vencedores) > 1,
        ]);
    }
    return $resultado;
}

function awardsPainelAdmin(PDO $db): array
{
    $atletas = awardsAtletasMisto($db);
    $stmt = $db->query("
        SELECT v.eleitor_pessoa_id, v.categoria, v.candidato_pessoa_id, p.nome AS candidato_nome
        FROM awards_votos v JOIN pessoas p ON p.id = v.candidato_pessoa_id
    ");
    $porEleitor = [];
    foreach ($stmt->fetchAll() as $row) $porEleitor[(int)$row['eleitor_pessoa_id']][$row['categoria']] = [
        'pessoa_id' => (int)$row['candidato_pessoa_id'], 'nome' => $row['candidato_nome'],
    ];
    $participacao = [];
    foreach ($atletas as $atleta) {
        $votos = $porEleitor[$atleta['pessoa_id']] ?? [];
        $participacao[] = array_merge($atleta, [
            'status' => count($votos) === 4 ? 'votou' : (count($votos) > 0 ? 'incompleto' : 'nao_votou'),
            'votos' => $votos,
        ]);
    }
    $votaram = count(array_filter($participacao, static fn(array $p): bool => $p['status'] === 'votou'));
    return [
        'status' => awardsStatus($db),
        'atletas' => $atletas,
        'curadoria' => [
            'revelacao' => awardsIdsCurados($db, 'revelacao'),
            'jesse' => awardsIdsCurados($db, 'jesse'),
        ],
        'participacao' => $participacao,
        'resumo' => ['aptos' => count($atletas), 'votaram' => $votaram, 'nao_votaram' => count($atletas) - $votaram],
        'apuracao' => awardsApuracao($db),
    ];
}
