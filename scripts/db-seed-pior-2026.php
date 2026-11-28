<?php
/**
 * Cadastro LOCAL dos 8 times do 2° Pior Campeonato de Bici Polo (Misto) e criação do
 * torneio pelo preset novo (misto_round_robin_8), já com a 1ª fase gerada — sem
 * simular nenhum resultado.
 *
 *     php scripts/db-seed-pior-2026.php                  # cadastra/atualiza (idempotente)
 *     php scripts/db-seed-pior-2026.php --arquivar-demo  # idem + arquiva os times/torneio do seed demo
 *     php scripts/db-seed-pior-2026.php --forcar         # permite APP_URL fora de localhost
 *     php scripts/db-seed-pior-2026.php --regerar-primeira-fase  # refaz a tabela da 1ª fase
 *         (só se NENHUM jogo do torneio saiu de 'agendado' e não há evento registrado)
 *
 * Só nome do time e nome das pessoas (ordem A, B, C). Não cadastra nível, MTNB nem
 * Gringo. E-mails fictícios no domínio reservado example.com (RFC 2606), sem telefone.
 * Rodar de novo não duplica nada: pessoa é achada pelo e-mail, time pelo elenco (os mesmos
 * 3 e-mails) e, se não houver, pelo nome+categoria; torneio pelo preset. Se o elenco já
 * existe com outro número, o time é RENOMEADO (mesmo id) — numeração oficial = Poloperator.
 *
 * --arquivar-demo NÃO apaga: muda a categoria para 'demo_arquivado' apenas dos times Misto
 * cujos atletas são todos do seed demo (atletaN@example.com) e do torneio Misto criado por
 * 'seed-demo'. Volta atrás com UPDATE ... SET categoria='misto'.
 */

$raiz = dirname(__DIR__);
if (!file_exists($raiz . '/public/api/env.php')) {
    fwrite(STDERR, "public/api/env.php não existe. Copie env.example.php e rode scripts/db-init.php antes.\n");
    exit(1);
}

require_once $raiz . '/public/api/db.php';
require_once $raiz . '/public/api/torneio/lib.php';
require_once $raiz . '/public/api/torneio/bracket.php';
require_once $raiz . '/public/api/torneio/setup.php';
require_once $raiz . '/public/api/torneio/round_robin.php';

$forcar = in_array('--forcar', $argv, true);
$arquivarDemo = in_array('--arquivar-demo', $argv, true);
$regerarPrimeiraFase = in_array('--regerar-primeira-fase', $argv, true);
$USUARIO = 'seed-pior-2026';

$host = defined('APP_URL') ? strtolower((string)parse_url(APP_URL, PHP_URL_HOST)) : '';
if (!in_array($host, ['localhost', '127.0.0.1', '::1', '[::1]'], true) && !$forcar) {
    fwrite(STDERR, "APP_URL aponta para '" . (defined('APP_URL') ? APP_URL : '(indefinido)') . "'.\n");
    fwrite(STDERR, "Este script só roda em ambiente local. Use --forcar se tiver certeza.\n");
    exit(1);
}

// Numeração e elencos = base do Poloperator (poloperator.com/pt/tournament/2-pior-campeonato-curitiba-2026),
// com os apelidos usados no cadastro interno. O importador de fotos casa os times pelo elenco.
$TIMES = [
    'Time 1' => ['Deivi', 'Lusca', 'Emi'],
    'Time 2' => ['Kwy', 'Mat', 'Jay'],
    'Time 3' => ['Mourao', 'Lari', 'Buratto'],
    'Time 4' => ['Dox', 'Kelvola', 'Ana'],
    'Time 5' => ['Emily Ethel', 'Jpg', 'Paulo'],
    'Time 6' => ['Jantas', 'Mendonça', 'Carla'],
    'Time 7' => ['Vitinho', 'Marcos', 'Aguidota'],
    'Time 8' => ['Gusta', 'Fábio', 'Gominho'],
];

// Clube por pessoa (FLO / POA / CWB).
$CLUBES = [
    'Floripa'  => ['Marcos', 'Deivi', 'Ana', 'Emily Ethel', 'Mendonça', 'Fábio'],
    'POA'      => ['Kwy'],
    'Curitiba' => ['Lusca', 'Emi', 'Mat', 'Jay', 'Mourao', 'Lari', 'Buratto', 'Dox', 'Kelvola', 'Jpg', 'Paulo',
                   'Jantas', 'Carla', 'Vitinho', 'Aguidota', 'Gusta', 'Gominho'],
];

function emailFicticio(string $nome): string {
    // Tabela fixa (iconv//TRANSLIT varia por SO: no Windows "á" vira "'a").
    $slug = strtr($nome, ['á'=>'a','à'=>'a','â'=>'a','ã'=>'a','é'=>'e','ê'=>'e','í'=>'i','ó'=>'o','ô'=>'o','õ'=>'o','ú'=>'u','ü'=>'u','ç'=>'c',
                          'Á'=>'A','À'=>'A','Â'=>'A','Ã'=>'A','É'=>'E','Ê'=>'E','Í'=>'I','Ó'=>'O','Ô'=>'O','Õ'=>'O','Ú'=>'U','Ç'=>'C']);
    $slug = strtolower(preg_replace('/[^a-z0-9]+/i', '.', $slug));
    return trim($slug, '.') . '@pior.example.com';
}

$db = new PDO('sqlite:' . DB_PATH);
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
$db->exec('PRAGMA foreign_keys=ON');
initSchema($db);

$clubePorPessoa = [];
foreach ($CLUBES as $clube => $pessoas) foreach ($pessoas as $p) $clubePorPessoa[$p] = $clube;

$criados = ['clubes' => 0, 'pessoas' => 0, 'inscricoes' => 0, 'times' => 0, 'membros' => 0];
$timeIds = [];

torneioTx($db, function (PDO $db) use ($TIMES, $CLUBES, $clubePorPessoa, &$criados, &$timeIds) {
    $clubeIds = [];
    $selClube = $db->prepare('SELECT id FROM clubes WHERE nome = ?');
    foreach (array_keys($CLUBES) as $nome) {
        $selClube->execute([$nome]);
        $id = $selClube->fetchColumn();
        if (!$id) {
            $db->prepare('INSERT INTO clubes (nome) VALUES (?)')->execute([$nome]);
            $id = $db->lastInsertId();
            $criados['clubes']++;
        }
        $clubeIds[$nome] = (int)$id;
    }

    $selPessoa = $db->prepare('SELECT id, clube_id FROM pessoas WHERE email = ?');
    $selInsc = $db->prepare("SELECT id FROM inscricoes WHERE pessoa_id = ? AND status != 'cancelado' ORDER BY id LIMIT 1");
    $selCat = $db->prepare("SELECT 1 FROM inscricao_categorias WHERE inscricao_id = ? AND categoria = 'misto'");
    $selTime = $db->prepare("SELECT id FROM times WHERE nome = ? AND categoria = 'misto'");
    // Time cujo elenco tem exatamente estes e-mails (independe do número/nome atual).
    $timePorElenco = function (array $emails) use ($db): ?int {
        $marc = implode(',', array_fill(0, count($emails), '?'));
        $stmt = $db->prepare("
            SELECT t.id FROM times t
            JOIN membros_time mt ON mt.time_id = t.id
            JOIN inscricoes i ON i.id = mt.inscricao_id AND i.status != 'cancelado'
            JOIN pessoas p ON p.id = i.pessoa_id
            WHERE t.categoria = 'misto'
            GROUP BY t.id
            HAVING COUNT(*) = CAST(? AS INTEGER) AND SUM(CASE WHEN p.email IN ($marc) THEN 1 ELSE 0 END) = CAST(? AS INTEGER)
        ");
        $stmt->execute(array_merge([count($emails)], $emails, [count($emails)]));
        $ids = $stmt->fetchAll(PDO::FETCH_COLUMN);
        return count($ids) === 1 ? (int)$ids[0] : null;
    };
    $selMembro = $db->prepare('SELECT 1 FROM membros_time WHERE time_id = ? AND inscricao_id = ?');

    foreach ($TIMES as $nomeTime => $atletas) {
        $timeId = $timePorElenco(array_map('emailFicticio', $atletas));
        if ($timeId) {
            $db->prepare("UPDATE times SET nome = ? WHERE id = ? AND nome != ?")->execute([$nomeTime, $timeId, $nomeTime]);
            if ($db->query('SELECT changes()')->fetchColumn() > 0) $criados['renomeados'] = ($criados['renomeados'] ?? 0) + 1;
        } else {
            $selTime->execute([$nomeTime]);
            $timeId = $selTime->fetchColumn();
        }
        if (!$timeId) {
            $db->prepare("INSERT INTO times (nome, categoria, codigo) VALUES (?, 'misto', ?)")->execute([$nomeTime, generateTeamCode($db)]);
            $timeId = $db->lastInsertId();
            $criados['times']++;
        }
        $timeId = (int)$timeId;
        $timeIds[] = $timeId;

        foreach ($atletas as $nome) { // ordem A, B, C = ordem de inserção
            $email = emailFicticio($nome);
            $clubeId = isset($clubePorPessoa[$nome]) ? $clubeIds[$clubePorPessoa[$nome]] : null;
            $selPessoa->execute([$email]);
            $pessoa = $selPessoa->fetch();
            if (!$pessoa) {
                $db->prepare('INSERT INTO pessoas (nome, email, telefone, clube_id) VALUES (?, ?, NULL, ?)')->execute([$nome, $email, $clubeId]);
                $pessoaId = (int)$db->lastInsertId();
                $criados['pessoas']++;
            } else {
                $pessoaId = (int)$pessoa['id'];
                if ((int)$pessoa['clube_id'] !== (int)$clubeId) {
                    $db->prepare('UPDATE pessoas SET clube_id = ? WHERE id = ?')->execute([$clubeId, $pessoaId]);
                }
            }

            $selInsc->execute([$pessoaId]);
            $inscId = $selInsc->fetchColumn();
            if (!$inscId) {
                $db->prepare("INSERT INTO inscricoes (pessoa_id, status, valor_total) VALUES (?, 'pago', 0)")->execute([$pessoaId]);
                $inscId = $db->lastInsertId();
                $criados['inscricoes']++;
            }
            $inscId = (int)$inscId;
            $selCat->execute([$inscId]);
            if (!$selCat->fetchColumn()) {
                $db->prepare("INSERT INTO inscricao_categorias (inscricao_id, categoria, valor) VALUES (?, 'misto', 0)")->execute([$inscId]);
            }

            $selMembro->execute([$timeId, $inscId]);
            if (!$selMembro->fetchColumn()) {
                $db->prepare('INSERT INTO membros_time (time_id, inscricao_id) VALUES (?, ?)')->execute([$timeId, $inscId]);
                $criados['membros']++;
            }
        }
    }
});

echo "Cadastro: " . json_encode($criados) . " (0 = já existia)\n";

if ($arquivarDemo) {
    $marcadores = implode(',', array_fill(0, count($timeIds), '?'));
    // Só times Misto em que TODOS os atletas são do seed demo (atletaN@example.com).
    $stmt = $db->prepare("
        UPDATE times SET categoria = 'demo_arquivado'
        WHERE categoria = 'misto' AND id NOT IN ($marcadores)
          AND EXISTS (SELECT 1 FROM membros_time mt WHERE mt.time_id = times.id)
          AND NOT EXISTS (
              SELECT 1 FROM membros_time mt
              JOIN inscricoes i ON i.id = mt.inscricao_id
              JOIN pessoas p ON p.id = i.pessoa_id
              WHERE mt.time_id = times.id AND p.email NOT LIKE 'atleta%@example.com'
          )
    ");
    $stmt->execute($timeIds);
    $nTimes = $stmt->rowCount();
    $stmt = $db->prepare("UPDATE torneios SET categoria = 'demo_arquivado', atualizado_em = datetime('now') WHERE categoria = 'misto' AND criado_por = 'seed-demo'");
    $stmt->execute();
    echo "Arquivados: $nTimes time(s) demo e " . $stmt->rowCount() . " torneio(s) demo (categoria 'demo_arquivado', nada apagado).\n";
}

$stmt = $db->prepare("SELECT id FROM torneios WHERE categoria = 'misto' AND preset = 'pior_2026_round_robin_8' ORDER BY id DESC LIMIT 1");
$stmt->execute();
$torneioId = (int)$stmt->fetchColumn();
if (!$torneioId) {
    $torneioId = criarTorneioPreset($db, 'misto', $USUARIO, null, 'misto_round_robin_8', $timeIds);
    echo "Torneio criado: #$torneioId (preset pior_2026_round_robin_8).\n";
} else {
    echo "Torneio já existia: #$torneioId.\n";
}

$participantes = array_map(fn($p) => (int)$p['time_id'], getParticipantes($db, $torneioId));
sort($participantes);
$esperados = $timeIds; sort($esperados);
if ($participantes !== $esperados) {
    fwrite(STDERR, "ATENÇÃO: os participantes do torneio #$torneioId não são exatamente os 8 times. Nada foi gerado.\n");
    exit(1);
}

// Seeds = ordem dos times (Time 1..8), que define a tabela do todos contra todos.
$seedsAtuais = $db->prepare('SELECT tp.time_id FROM torneio_participantes tp WHERE tp.torneio_id = ? ORDER BY tp.seed');
$seedsAtuais->execute([$torneioId]);
$seedsOk = array_map('intval', $seedsAtuais->fetchAll(PDO::FETCH_COLUMN)) === $timeIds;

$stmt = $db->prepare("SELECT COUNT(*) FROM torneio_fases WHERE torneio_id = ? AND tipo = 'round_robin'");
$stmt->execute([$torneioId]);
$temPrimeiraFase = (int)$stmt->fetchColumn() > 0;

if ($temPrimeiraFase && !$seedsOk) {
    if (!$regerarPrimeiraFase) {
        echo "ATENÇÃO: a 1ª fase foi gerada com a numeração antiga dos times. Rode com --regerar-primeira-fase para refazer a tabela.
";
    } else {
        $mexido = $db->prepare("SELECT (SELECT COUNT(*) FROM torneio_jogos WHERE torneio_id = ? AND status != 'agendado') + (SELECT COUNT(*) FROM torneio_eventos_gol WHERE torneio_id = ?) + (SELECT COUNT(*) FROM torneio_eventos_falta WHERE torneio_id = ?)");
        $mexido->execute([$torneioId, $torneioId, $torneioId]);
        if ((int)$mexido->fetchColumn() > 0) {
            fwrite(STDERR, "Recusado: já há jogo iniciado/encerrado ou evento no torneio #$torneioId. Nada foi alterado.
");
            exit(1);
        }
        zerarResultados($db, $torneioId, $USUARIO);
        $temPrimeiraFase = false;
        echo "1ª fase antiga removida (só jogos agendados, sem resultados).
";
    }
}
if (!$seedsOk && !$temPrimeiraFase) {
    $upd = $db->prepare('UPDATE torneio_participantes SET seed = ? WHERE torneio_id = ? AND time_id = ?');
    foreach ($timeIds as $i => $tid) $upd->execute([$i + 1, $torneioId, $tid]);
}
if (!$temPrimeiraFase) {
    $r = gerarPrimeiraFaseRoundRobin($db, $torneioId, $USUARIO);
    echo "1ª fase gerada: {$r['rodadas']} rodadas, " . count($r['codigos']) . " jogos (nenhum resultado simulado).\n";
} else {
    echo "1ª fase já estava gerada.\n";
}
