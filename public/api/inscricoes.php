<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/email.php';
corsHeaders();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $db = getDb();
    respond(['inscricoes_abertas' => getConfigGeral($db)['inscricoes_abertas'] === '1']);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') respondError('Método não suportado', 405);

$body = getBody();

$nome              = trim($body['nome'] ?? '');
$email             = trim($body['email'] ?? '');
$categorias        = $body['categorias'] ?? [];
$tipoParticipacao  = in_array($body['tipoParticipacao'] ?? '', ['atleta', 'acompanhante'])
                     ? $body['tipoParticipacao'] : 'atleta';

if (empty($nome))                                                    respondError('Nome é obrigatório');
if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL))     respondError('Email inválido');
if ($tipoParticipacao === 'atleta' && empty($categorias))            respondError('Selecione pelo menos uma categoria');

$db = getDb();

if (getConfigGeral($db)['inscricoes_abertas'] !== '1') {
    respondError('O período de inscrições para o Campeonato Brasileiro foi encerrado.', 403);
}

// Preços lidos da tabela configuracoes (editáveis pelo admin)
$P = getPrecos($db);
$VALOR_MISTO              = $P['valor_misto'];
$VALOR_MTNB               = $P['valor_mtnb'];
$VALOR_MISTO_COM_MTNB     = $P['valor_misto_com_mtnb'];
$DESCONTO_PT              = $P['desconto_primeiro_torneio'];
$VALOR_ALIM_COMPLETO      = $P['valor_alimentacao_completo'];
$VALOR_ALIM_ALMOCO        = $P['valor_alimentacao_almoco'];
$VALOR_ALOJ_DIARIA        = $P['valor_alojamento_diaria'];

try {
    $db->beginTransaction();

    // ── 1. Clube ──────────────────────────────────────────
    $clube_id = null;
    if (!empty($body['clubeId'])) {
        $clube_id = (int)$body['clubeId'];
    } elseif (!empty($body['clubeNome'])) {
        $n = trim($body['clubeNome']);
        $s = $db->prepare("SELECT id FROM clubes WHERE nome = ? COLLATE NOCASE");
        $s->execute([$n]);
        $c = $s->fetch();
        if ($c) {
            $clube_id = $c['id'];
        } else {
            $s = $db->prepare("INSERT INTO clubes (nome) VALUES (?)");
            $s->execute([$n]);
            $clube_id = (int)$db->lastInsertId();
        }
    }

    // ── 2. Pessoa ─────────────────────────────────────────
    $s = $db->prepare("SELECT id FROM pessoas WHERE email = ? COLLATE NOCASE");
    $s->execute([$email]);
    $existente = $s->fetch();

    if ($existente) {
        $s = $db->prepare("SELECT id FROM inscricoes WHERE pessoa_id = ? AND status != 'cancelado' LIMIT 1");
        $s->execute([$existente['id']]);
        if ($s->fetch()) {
            $db->rollBack();
            respondError('Este email já possui uma inscrição. Acesse a área da pessoa atleta 💛', 409);
        }
    }

    $dados = [
        $nome,
        $body['telefone'] ?? null,
        $body['ddi'] ?? '55',
        $body['genero'] ?? null,
        $body['generoDescricao'] ?? null,
        $clube_id,
        $body['cidade'] ?? null,
        $body['nacionalidade'] ?? 'brasileire',
    ];

    if ($existente) {
        $pessoa_id = $existente['id'];
        $s = $db->prepare("
            UPDATE pessoas SET nome=?, telefone=?, ddi=?, genero=?, genero_descricao=?,
            clube_id=?, cidade=?, nacionalidade=? WHERE id=?
        ");
        $s->execute([...$dados, $pessoa_id]);
    } else {
        $s = $db->prepare("
            INSERT INTO pessoas (nome, email, telefone, ddi, genero, genero_descricao, clube_id, cidade, nacionalidade)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $s->execute(array_merge([$nome, $email], array_slice($dados, 1)));
        $pessoa_id = (int)$db->lastInsertId();
    }

    // ── 3. Cálculo do valor (espelha inscricoes.config.ts) ────
    $tem_misto = in_array('misto', $categorias);
    $tem_mtnb  = in_array('mtnb', $categorias);

    $subtotal_base = ($tem_misto ? $VALOR_MISTO : 0) + ($tem_mtnb ? $VALOR_MTNB : 0);

    // PPI = pessoas pretas, pardas, indígenas → isenção total
    $tem_ppi = !empty($body['acaoPreta']) || !empty($body['acaoParda']) || !empty($body['acaoIndigena']);

    // Incentivo MTNB: só quando ambas as categorias selecionadas; não acumula com PT
    $tem_incentivo_mtnb = $tem_misto && $tem_mtnb;

    // Primeiro torneio: NÃO aplica quando Misto+MTNB (incentivo MTNB já está ativo)
    $tem_pt = !empty($body['acaoPrimeiroTorneio']) && !$tem_incentivo_mtnb;

    $desc_tipo = null;
    $desc_valor = 0;

    if ($tem_ppi && $subtotal_base > 0) {
        $valor_total = 0;
        $desc_valor  = $subtotal_base;
        $desc_tipo   = 'ppi';
    } elseif ($tem_incentivo_mtnb) {
        $valor_total = $VALOR_MISTO_COM_MTNB + $VALOR_MTNB;
        $desc_valor  = $subtotal_base - $valor_total;
        $desc_tipo   = 'mtnb';
    } elseif ($tem_pt) {
        $valor_total = $subtotal_base * (1 - $DESCONTO_PT);
        $desc_valor  = $subtotal_base * $DESCONTO_PT;
        $desc_tipo   = 'primeiro_torneio';
    } else {
        $valor_total = $subtotal_base;
    }

    // Alimentação: [{dia, pacote}] onde pacote = 'completo' | 'almoco'
    $alim_entries = [];
    foreach ($body['alimentacao'] ?? [] as $item) {
        $dia    = (int)($item['dia'] ?? 0);
        $pacote = in_array($item['pacote'] ?? '', ['completo', 'almoco']) ? $item['pacote'] : 'completo';
        if (!in_array($dia, [5, 6, 7])) continue;
        $valor_dia = $pacote === 'almoco' ? $VALOR_ALIM_ALMOCO : $VALOR_ALIM_COMPLETO;
        $alim_entries[$dia] = ['pacote' => $pacote, 'valor' => $valor_dia];
    }
    $valor_alim = array_sum(array_column($alim_entries, 'valor'));

    $dias_aloj_ok  = array_filter(array_map('intval', $body['alojamento']  ?? []), fn($d) => in_array($d, ALOJAMENTO_DIAS_VALIDOS));
    $valor_aloj    = count($dias_aloj_ok) * $VALOR_ALOJ_DIARIA;

    // ── 4. Inscrição ──────────────────────────────────────
    $restricaoTipo = $body['restricaoTipo'] ?? null;
    $restricao_alimentar = null;
    if (!empty($restricaoTipo)) {
        $restricaoDescricao = trim($body['restricaoDescricao'] ?? '');
        $restricao_alimentar = json_encode(
            ['tipo' => $restricaoTipo, 'descricao' => $restricaoDescricao ?: null],
            JSON_UNESCAPED_UNICODE
        );
    }

    $aceitouTermos    = !empty($body['aceitouTermos']);
    $dataAceiteTermos = $aceitouTermos ? date('c') : null;

    $s = $db->prepare("
        INSERT INTO inscricoes (
            pessoa_id, status, latino, acao_afirmativa,
            acao_preta, acao_parda, acao_indigena, acao_primeiro_torneio, valor_total, restricao_alimentar,
            tipo_participacao,
            contato_emergencia_nome, contato_emergencia_relacao, contato_emergencia_telefone,
            possui_plano_saude, plano_saude, numero_carteirinha,
            aceitou_termos, data_aceite_termos
        )
        VALUES (?, 'aguardando_pagamento', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $s->execute([
        $pessoa_id,
        empty($body['latino'])              ? 0 : 1,
        $tem_ppi                            ? 1 : 0,
        empty($body['acaoPreta'])           ? 0 : 1,
        empty($body['acaoParda'])           ? 0 : 1,
        empty($body['acaoIndigena'])        ? 0 : 1,
        $tem_pt                             ? 1 : 0,
        $valor_total,
        $restricao_alimentar,
        $tipoParticipacao,
        trim($body['emergNome'] ?? '') ?: null,
        trim($body['emergRelacao'] ?? '') ?: null,
        trim($body['emergTelefone'] ?? '') ?: null,
        !empty($body['possuiPlanoSaude'])    ? 1 : 0,
        trim($body['planoSaude'] ?? '') ?: null,
        trim($body['numeroCarteirinha'] ?? '') ?: null,
        $aceitouTermos                      ? 1 : 0,
        $dataAceiteTermos,
    ]);
    $inscricao_id = (int)$db->lastInsertId();

    // ── 5. Categorias ─────────────────────────────────────
    foreach ($categorias as $cat) {
        $val = $cat === 'misto' ? $VALOR_MISTO : $VALOR_MTNB;
        $s = $db->prepare("INSERT INTO inscricao_categorias (inscricao_id, categoria, valor) VALUES (?, ?, ?)");
        $s->execute([$inscricao_id, $cat, $val]);
    }

    // ── 6. Times ──────────────────────────────────────────
    $times_criados = [];
    foreach (['misto', 'mtnb'] as $cat) {
        if (!in_array($cat, $categorias)) continue;

        $td   = $body['time' . ucfirst($cat)] ?? [];
        $acao = $td['acao'] ?? '';

        if ($acao === 'criar' && !empty($td['nome'])) {
            $nomeTime = trim($td['nome']);
            $codigo   = generateTeamCode($db);
            $s = $db->prepare("INSERT INTO times (nome, categoria, codigo, criador_id) VALUES (?, ?, ?, ?)");
            $s->execute([$nomeTime, $cat, $codigo, $pessoa_id]);
            $time_id = (int)$db->lastInsertId();
            $times_criados[] = ['cat' => $cat, 'nome' => $nomeTime, 'codigo' => $codigo];

        } elseif ($acao === 'entrar' && !empty($td['codigo'])) {
            $cod = strtoupper(trim($td['codigo']));
            $s = $db->prepare("SELECT id FROM times WHERE codigo = ? AND categoria = ?");
            $s->execute([$cod, $cat]);
            $t = $s->fetch();
            if (!$t) {
                $db->rollBack();
                respondError("Time {$cod} não encontrado para a categoria {$cat}");
            }
            $time_id = $t['id'];

        } else {
            continue;
        }

        $s = $db->prepare("INSERT OR IGNORE INTO membros_time (time_id, inscricao_id) VALUES (?, ?)");
        $s->execute([$time_id, $inscricao_id]);
    }

    // ── 7. Alimentação ────────────────────────────────────
    foreach ($alim_entries as $dia => $entry) {
        $s = $db->prepare("INSERT OR IGNORE INTO alimentacao (inscricao_id, dia, valor, pacote) VALUES (?, ?, ?, ?)");
        $s->execute([$inscricao_id, $dia, $entry['valor'], $entry['pacote']]);
    }

    // ── 8. Alojamento ─────────────────────────────────────
    foreach ($body['alojamento'] ?? [] as $dia) {
        $dia = (int)$dia;
        if (!in_array($dia, ALOJAMENTO_DIAS_VALIDOS)) continue;
        $s = $db->prepare("INSERT OR IGNORE INTO alojamento (inscricao_id, dia, valor) VALUES (?, ?, ?)");
        $s->execute([$inscricao_id, $dia, $VALOR_ALOJ_DIARIA]);
    }

    // ── 9. Pagamentos (registros separados por tipo) ─────────
    // Inscrição esportiva
    $itens_ins = [];
    foreach ($categorias as $cat) {
        $itens_ins[] = [
            'descricao' => $cat === 'misto' ? 'Brasileiro Misto' : 'Brasileiro MTNB',
            'valor'     => $cat === 'misto' ? $VALOR_MISTO : $VALOR_MTNB,
        ];
    }
    if ($desc_tipo === 'ppi') {
        $itens_ins[] = ['descricao' => 'Isenção ações afirmativas', 'valor' => -$desc_valor];
    } elseif ($desc_tipo === 'mtnb') {
        $itens_ins[] = ['descricao' => 'Incentivo MTNB no Misto', 'valor' => -$desc_valor];
    } elseif ($desc_tipo === 'primeiro_torneio') {
        $itens_ins[] = ['descricao' => 'Desconto primeiro torneio (50%)', 'valor' => -$desc_valor];
    }

    $checkout_token = bin2hex(random_bytes(24));

    // Isento (valor=0): cria já como pago e marca inscrição paga
    $status_ins = ($valor_total == 0) ? 'pago' : 'pendente';
    $metodo_ins = ($valor_total == 0) ? ($tipoParticipacao === 'acompanhante' ? 'apoio' : 'isencao') : null;

    $s = $db->prepare("INSERT INTO pagamentos (inscricao_id, tipo, status, valor, itens_json, checkout_token, metodo) VALUES (?, 'inscricao', ?, ?, ?, ?, ?)");
    $s->execute([$inscricao_id, $status_ins, $valor_total, json_encode($itens_ins, JSON_UNESCAPED_UNICODE), $checkout_token, $metodo_ins]);
    $pg_id = (int)$db->lastInsertId();

    if ($valor_total == 0) {
        $db->prepare("UPDATE inscricoes SET status='pago', atualizado_em=datetime('now') WHERE id=?")
           ->execute([$inscricao_id]);
    }

    // Alimentação (pagamento separado)
    $itens_alim = [];
    if ($valor_alim > 0) {
        $pacote_labels = ['completo' => 'Pacote completo', 'almoco' => 'Apenas almoço'];
        foreach ($alim_entries as $dia => $entry) {
            $label = $pacote_labels[$entry['pacote']] ?? 'Pacote completo';
            $itens_alim[] = ['descricao' => "Alimentação dia {$dia}/set — {$label}", 'valor' => $entry['valor']];
        }
        $s = $db->prepare("INSERT INTO pagamentos (inscricao_id, tipo, status, valor, itens_json) VALUES (?, 'alimentacao', 'pendente', ?, ?)");
        $s->execute([$inscricao_id, $valor_alim, json_encode($itens_alim, JSON_UNESCAPED_UNICODE)]);
    }

    // Alojamento (pagamento separado)
    $itens_aloj = [];
    if ($valor_aloj > 0) {
        foreach ($dias_aloj_ok as $dia) {
            $itens_aloj[] = ['descricao' => "Alojamento dia {$dia}/set", 'valor' => $VALOR_ALOJ_DIARIA];
        }
        $s = $db->prepare("INSERT INTO pagamentos (inscricao_id, tipo, status, valor, itens_json) VALUES (?, 'alojamento', 'pendente', ?, ?)");
        $s->execute([$inscricao_id, $valor_aloj, json_encode($itens_aloj, JSON_UNESCAPED_UNICODE)]);
    }

    $db->commit();

    $valor_checkout = $valor_total + $valor_alim + $valor_aloj;
    sendConfirmationEmail($email, $nome, (string)$inscricao_id, $valor_checkout);

    // Para o checkout do formulário: combina todos os itens para exibição
    $itens_checkout = array_merge($itens_ins, $itens_alim, $itens_aloj);

    respond([
        'success'        => true,
        'inscricao_id'   => $inscricao_id,
        'valor_total'    => $valor_checkout,
        'valor_esportivo'=> $valor_total,
        'status'         => 'aguardando_pagamento',
        'times'          => $times_criados,
        'pagamento'      => [
            'id'             => $pg_id,
            'tipo'           => 'inscricao',
            'status'         => $status_ins,   // 'pago' se isento, 'pendente' caso contrário
            'valor'          => $valor_checkout, // valor combinado para exibição
            'metodo'         => $metodo_ins,
            'itens'          => $itens_checkout,
            'checkout_token' => $checkout_token,
        ],
    ], 201);

} catch (\Exception $e) {
    $db->rollBack();

    if (str_contains($e->getMessage(), 'UNIQUE constraint failed: pessoas.email')) {
        respondError('Este email já possui uma inscrição. Fala com a gente se precisar de ajuda 💛', 409);
    }

    respondError('Erro ao salvar inscrição: ' . $e->getMessage(), 500);
}
