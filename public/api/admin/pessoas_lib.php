<?php

/**
 * Renomeia uma pessoa pelo ID interno. Deliberadamente atualiza apenas `pessoas.nome`:
 * mídia, ID externo e todos os vínculos permanecem fora deste write.
 */
function renomearPessoa(PDO $db, int $pessoaId, string $nome): string {
    $nome = trim($nome);
    if ($pessoaId <= 0) throw new InvalidArgumentException('pessoa_id obrigatório');
    if ($nome === '') throw new InvalidArgumentException('Nome não pode ficar vazio');
    if (mb_strlen($nome) > 120) throw new InvalidArgumentException('Nome muito longo (máx. 120 caracteres)');

    $stmt = $db->prepare('SELECT id FROM pessoas WHERE id = ?');
    $stmt->execute([$pessoaId]);
    if (!$stmt->fetchColumn()) throw new RuntimeException('Pessoa não encontrada');

    $db->prepare('UPDATE pessoas SET nome = ? WHERE id = ?')->execute([$nome, $pessoaId]);
    return $nome;
}
