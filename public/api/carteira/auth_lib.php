<?php
require_once __DIR__ . '/lib.php';

function carteiraGerarMagicLink(PDO $db, int $pessoaId, int $duracao = 900): array {
    $token = bin2hex(random_bytes(32));
    $hash = hash('sha256', $token);
    $expira = gmdate('Y-m-d H:i:s', time() + $duracao);
    $db->beginTransaction();
    try {
        $db->prepare("UPDATE carteira_magic_links SET usado_em=datetime('now') WHERE pessoa_id=? AND usado_em IS NULL")->execute([$pessoaId]);
        $db->prepare('INSERT INTO carteira_magic_links (pessoa_id,token_hash,expira_em) VALUES (?,?,?)')->execute([$pessoaId,$hash,$expira]);
        $db->commit();
    } catch(Throwable $e){ if($db->inTransaction())$db->rollBack(); throw $e; }
    return ['token'=>$token,'expira_em'=>$expira];
}

function carteiraConsumirMagicLink(PDO $db, string $token): array {
    if (!preg_match('/^[a-f0-9]{64}$/', $token)) throw new DomainException('Link de acesso inválido');
    $hash = hash('sha256', $token);
    $db->beginTransaction();
    try {
        $stmt=$db->prepare("SELECT ml.*,p.email,p.nome FROM carteira_magic_links ml JOIN pessoas p ON p.id=ml.pessoa_id WHERE ml.token_hash=? AND ml.usado_em IS NULL AND ml.expira_em > datetime('now')");
        $stmt->execute([$hash]); $link=$stmt->fetch();
        if(!$link) throw new DomainException('Link inválido, expirado ou já utilizado');
        $up=$db->prepare("UPDATE carteira_magic_links SET usado_em=datetime('now') WHERE id=? AND usado_em IS NULL");
        $up->execute([$link['id']]); if($up->rowCount()!==1) throw new DomainException('Link já utilizado');
        carteiraCriarOuObter($db,(int)$link['pessoa_id']);
        $db->commit();
        return $link;
    } catch(Throwable $e){ if($db->inTransaction())$db->rollBack(); throw $e; }
}
