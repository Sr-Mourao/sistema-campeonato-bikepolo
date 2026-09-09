<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/awards/lib.php';

corsHeaders();
$db = getDb();

try {
    $pessoa = awardsPessoaAutenticada($db, trim($_SERVER['HTTP_X_SESSION_TOKEN'] ?? ''));
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        respond(awardsDadosAtleta($db, $pessoa['pessoa_id']));
    }
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $body = getBody();
        awardsSalvarVotos($db, $pessoa['pessoa_id'], is_array($body['votos'] ?? null) ? $body['votos'] : []);
        respond(['ok' => true, 'dados' => awardsDadosAtleta($db, $pessoa['pessoa_id'])]);
    }
    respondError('Método não suportado', 405);
} catch (AwardsException $e) {
    respondError($e->getMessage(), $e->httpStatus);
}
