<?php
/**
 * Sincronização do streaming persistida no SQLite (public/api/streaming/lib.php).
 * Roda no banco em memória do bootstrap — nunca toca no banco real.
 */

/** Pasta temporária própria para simular a pasta legada data/streaming */
function _streamingTmpDir(): string {
    $dir = sys_get_temp_dir() . '/10cbbp-testes-streaming-' . bin2hex(random_bytes(4));
    mkdir($dir, 0777, true);
    return $dir;
}

function test_streaming_state_preserva_objetos_vazios_e_json_cru(): void {
    $db = testDb();
    // {} vazios (lastBy, texts.on) e [] (events) precisam voltar exatamente como foram
    $raw = '{"rev":1,"lastBy":{},"texts":{"on":{}},"events":[],"a":{"name":"Time Á"}}';
    $r = streamingSalvarState($db, $raw, 1000);
    assertEqualsT(200, $r['status'], 'POST do estado grava');
    assertEqualsT('{"ok":true}', $r['raw'], 'resposta ok só depois de gravar');
    assertEqualsT($raw, streamingLer($db, 'state'), 'GET devolve o JSON cru, byte a byte');

    // Estado que é só {} também é um objeto válido
    $db2 = testDb();
    assertEqualsT(200, streamingSalvarState($db2, '{}', 1000)['status'], '{} aceito');
    assertEqualsT('{}', streamingLer($db2, 'state'), '{} não vira []');
}

function test_streaming_state_sem_linha_devolve_null(): void {
    $db = testDb();
    assertNullT(streamingLer($db, 'state'), 'sem estado gravado: null (o endpoint responde null)');
}

function test_streaming_state_conflito_de_rev_devolve_409_com_estado_atual(): void {
    $db = testDb();
    $atual = '{"rev":5,"a":{"score":2}}';
    streamingSalvarState($db, $atual, 1000);

    foreach ([5, 4, 1] as $revVelho) {
        $r = streamingSalvarState($db, '{"rev":' . $revVelho . ',"a":{"score":0}}', 2000);
        assertEqualsT(409, $r['status'], "rev $revVelho <= 5 é conflito");
        assertEqualsT($atual, $r['raw'], '409 traz o estado atual do servidor no corpo');
    }
    assertEqualsT($atual, streamingLer($db, 'state'), 'conflito não sobrescreve');

    // rev maior grava (inclusive saltando revisões, como hoje)
    assertEqualsT(200, streamingSalvarState($db, '{"rev":6}', 3000)['status'], 'rev 6 grava');
    assertEqualsT(200, streamingSalvarState($db, '{"rev":9}', 3000)['status'], 'rev 9 grava');
    $stmt = $db->query("SELECT rev, atualizado_ms FROM streaming_kv WHERE chave = 'state'");
    $linha = $stmt->fetch();
    assertEqualsT(9, (int) $linha['rev'], 'coluna rev acompanha o estado');
    assertEqualsT(3000, (int) $linha['atualizado_ms'], 'atualizado_ms gravado');
}

function test_streaming_state_distingue_revisao_ausente_de_zero(): void {
    $db = testDb();
    assertEqualsT(200, streamingSalvarState($db, '{}')['status'], 'estado legado sem revisão');
    assertEqualsT(200, streamingSalvarState($db, '{"rev":0}')['status'], 'primeira revisão explícita');
    assertEqualsT(409, streamingSalvarState($db, '{"rev":0}')['status'], 'revisão zero repetida');
}

function test_streaming_state_json_invalido_e_400_sem_gravar(): void {
    $db = testDb();
    foreach (['', 'nao-json', '[1,2]', '"texto"', 'null'] as $ruim) {
        $r = streamingSalvarState($db, $ruim, 1000);
        assertEqualsT(400, $r['status'], "corpo inválido " . var_export($ruim, true) . " é 400");
        assertFalse(str_contains($r['raw'], '"ok"'), 'erro nunca responde ok');
    }
    assertNullT(streamingLer($db, 'state'), 'nada foi gravado');
}

function test_streaming_erro_de_banco_sobe_excecao_e_nunca_ok(): void {
    // Sem a tabela, a gravação falha: a lib precisa LANÇAR (o endpoint vira 500),
    // nunca devolver {"ok":true} como a versão em arquivo fazia.
    $db = testDb();
    $db->exec('DROP TABLE streaming_kv');
    assertThrowsT(fn() => streamingSalvarState($db, '{"rev":1}', 1000), 'state: erro de banco lança');
    assertThrowsT(fn() => streamingSalvarTeams($db, '[]', 1000), 'teams: erro de banco lança');

    // Banco somente leitura (como um servidor sem permissão de escrita)
    $arquivo = sys_get_temp_dir() . '/10cbbp-streaming-ro-' . bin2hex(random_bytes(4)) . '.db';
    $rw = new PDO('sqlite:' . $arquivo);
    $rw->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    initSchema($rw);
    $rw = null;
    $ro = new PDO('sqlite:' . $arquivo, null, null, [PDO::SQLITE_ATTR_OPEN_FLAGS => PDO::SQLITE_OPEN_READONLY]);
    $ro->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $ro->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    assertThrowsT(fn() => streamingSalvarState($ro, '{"rev":1}', 1000), 'banco somente leitura: lança');
    assertThrowsT(fn() => streamingHello($ro, ['id' => 'x'], 1000), 'hello em banco somente leitura: lança');

    $diag = streamingDiag($ro, 1000);
    assertFalse($diag['ok'], 'diag acusa o problema');
    assertTrue($diag['banco']['leitura'], 'diag: leitura funciona');
    assertFalse($diag['banco']['gravacao'], 'diag: gravação não funciona');
    $ro = null;
}

function test_streaming_rollback_desfaz_transacao_com_erro(): void {
    $db = testDb();
    streamingSalvarState($db, '{"rev":1,"x":"antes"}', 1000);
    assertThrowsT(fn() => streamingTransacao($db, function () use ($db) {
        streamingGravar($db, 'state', 2, '{"rev":2,"x":"depois"}', 2000);
        throw new RuntimeException('falha no meio');
    }), 'exceção dentro da transação sobe');
    assertEqualsT('{"rev":1,"x":"antes"}', streamingLer($db, 'state'), 'ROLLBACK desfez a gravação');
    // e o banco continua utilizável (nenhuma transação pendurada)
    assertEqualsT(200, streamingSalvarState($db, '{"rev":2}', 3000)['status'], 'grava depois do rollback');
}

function test_streaming_teams_lista_crua_e_validacao(): void {
    $db = testDb();
    $raw = '[{"id":"t1","name":"Time 1","players":[]}]';
    assertEqualsT(200, streamingSalvarTeams($db, $raw, 1000)['status'], 'times gravados');
    assertEqualsT($raw, streamingLer($db, 'teams'), 'times devolvidos crus');
    assertEqualsT(200, streamingSalvarTeams($db, '[]', 1000)['status'], 'lista vazia é válida');
    assertEqualsT(400, streamingSalvarTeams($db, '{"a":1}', 1000)['status'], 'objeto não é lista de times');
}

function test_streaming_hello_lista_so_os_vivos_e_apaga_os_antigos(): void {
    $db = testDb();
    $t = 1_000_000;
    streamingHello($db, ['id' => 'velho', 'name' => 'V', 'role' => 'mesa'], $t - 90_000);   // sumiu há 90 s
    streamingHello($db, ['id' => 'parado', 'name' => 'P', 'role' => 'overlays'], $t - 20_000); // sumiu há 20 s
    streamingHello($db, ['id' => 'vivo', 'name' => 'Árbitro', 'role' => 'mesa'], $t - 3_000);

    $lista = streamingHello($db, ['id' => 'obs', 'name' => 'OBS', 'role' => 'completo'], $t);
    $ids = array_column($lista, 'id');
    sort($ids);
    assertEqualsT(['obs', 'vivo'], $ids, 'só os vistos nos últimos 7 s');
    $vivo = $lista[array_search('vivo', array_column($lista, 'id'))];
    assertEqualsT(['id' => 'vivo', 'name' => 'Árbitro', 'role' => 'mesa', 'seen' => $t - 3_000], $vivo, 'formato igual ao da versão em arquivo');

    $restantes = $db->query('SELECT id FROM streaming_presenca ORDER BY id')->fetchAll(PDO::FETCH_COLUMN);
    assertEqualsT(['obs', 'parado', 'vivo'], $restantes, 'apaga só quem sumiu há mais de 60 s');

    // GET (sem dispositivo) só lista; UPSERT atualiza o mesmo id
    streamingHello($db, ['id' => 'obs', 'name' => 'OBS 2', 'role' => 'overlays'], $t + 1000);
    $obs = $db->query("SELECT name, role, seen_ms FROM streaming_presenca WHERE id = 'obs'")->fetch();
    assertEqualsT(['name' => 'OBS 2', 'role' => 'overlays', 'seen_ms' => $t + 1000], $obs, 'UPSERT do mesmo aparelho');
    assertEqualsT(2, count(streamingHello($db, null, $t + 1000)), 'hello sem corpo só lista');
}

function test_streaming_importa_legado_uma_unica_vez_so_lendo(): void {
    $db = testDb();
    $dir = _streamingTmpDir();
    $state = '{"rev":974,"lastBy":{},"a":{"score":2}}';
    file_put_contents("$dir/state.json", $state);
    file_put_contents("$dir/teams.json", '[{"id":"t1"}]');
    $antes = [md5_file("$dir/state.json"), md5_file("$dir/teams.json")];

    assertEqualsT(2, streamingImportarLegado($db, $dir, 1000), 'importa state e teams');
    assertEqualsT($state, streamingLer($db, 'state'), 'estado importado cru');
    assertEqualsT(974, (int) $db->query("SELECT rev FROM streaming_kv WHERE chave='state'")->fetchColumn(), 'rev vem do arquivo');
    assertEqualsT('[{"id":"t1"}]', streamingLer($db, 'teams'), 'times importados');

    // Segunda vez não faz nada, mesmo se o arquivo mudar
    file_put_contents("$dir/state.json", '{"rev":1}');
    assertEqualsT(0, streamingImportarLegado($db, $dir, 2000), 'não importa de novo');
    assertEqualsT($state, streamingLer($db, 'state'), 'banco não é sobrescrito pelo arquivo');

    // Só leitura: arquivos continuam lá (teams intacto)
    assertTrue(is_file("$dir/state.json") && is_file("$dir/teams.json"), 'arquivos legados não são apagados');
    assertEqualsT($antes[1], md5_file("$dir/teams.json"), 'arquivo legado não é reescrito');
}

function test_streaming_importacao_reverte_estado_quando_catalogo_falha(): void {
    $db = testDb();
    $dir = _streamingTmpDir();
    file_put_contents("$dir/state.json", '{"rev":2}');
    file_put_contents("$dir/teams.json", '[]');
    $db->exec("CREATE TRIGGER impedir_catalogo BEFORE INSERT ON streaming_kv
        WHEN NEW.chave = 'teams' BEGIN SELECT RAISE(ABORT, 'falha de teste'); END");

    try {
        streamingImportarLegado($db, $dir);
        throw new RuntimeException('A importação deveria falhar');
    } catch (PDOException $e) {
        assertTrue(str_contains($e->getMessage(), 'falha de teste'), 'falha ao gravar o catálogo');
    }
    assertNullT(streamingLer($db, 'state'), 'estado revertido junto com o catálogo');
    $db->exec('DROP TRIGGER impedir_catalogo');
    assertEqualsT(2, streamingImportarLegado($db, $dir), 'nova tentativa importa os dois arquivos');
}

function test_streaming_importa_legado_ignora_ausente_invalido_e_pasta_que_e_arquivo(): void {
    $db = testDb();
    assertEqualsT(0, streamingImportarLegado($db, sys_get_temp_dir() . '/nao-existe-' . bin2hex(random_bytes(4))), 'sem pasta: nada');

    $dir = _streamingTmpDir();
    file_put_contents("$dir/state.json", 'corrompido{');
    assertEqualsT(0, streamingImportarLegado($db, $dir), 'JSON inválido não é importado');
    assertNullT(streamingLer($db, 'state'), 'nada gravado');

    // Produção: "data/streaming" que nem é pasta
    $arquivo = $dir . '/streaming';
    file_put_contents($arquivo, 'x');
    assertEqualsT(0, streamingImportarLegado($db, $arquivo), 'caminho que é arquivo: nada');
}

function test_streaming_diag_resume_sem_caminhos(): void {
    $db = testDb();
    streamingSalvarState($db, '{"rev":7}', 10_000);
    streamingHello($db, ['id' => 'a', 'name' => 'A', 'role' => 'mesa'], 10_500);
    $d = streamingDiag($db, 12_000);
    assertTrue($d['ok'] && $d['banco']['leitura'] && $d['banco']['gravacao'], 'banco ok');
    assertEqualsT(['rev' => 7, 'atualizado_ms' => 10_000, 'idade_s' => 2.0], $d['state'], 'rev e idade do estado');
    assertNullT($d['teams'], 'sem times gravados');
    assertEqualsT(1, $d['dispositivos_vivos'], 'aparelhos vivos');
    assertNullT(streamingLer($db, '_diag'), 'a prova de escrita do diag é desfeita');
    $json = json_encode($d);
    assertFalse(str_contains($json, sys_get_temp_dir()) || str_contains($json, '.db') || preg_match('#[A-Za-z]:\\\\|/(home|var|tmp)/#', $json), 'diag sem caminhos');
}
