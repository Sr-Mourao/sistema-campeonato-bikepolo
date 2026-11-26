<?php
require_once __DIR__ . '/torneio/ordem.php';
require_once __DIR__ . '/torneio/formato.php';

// A configuração precisa ser carregada ANTES do define abaixo, para que env.php
// possa escolher onde o banco fica. A ordem de require varia entre endpoints
// (uns carregam env.php depois de db.php), então quem garante isso é este
// arquivo. `file_exists` porque a suíte de testes roda sem env.php.
if (file_exists(__DIR__ . '/env.php')) require_once __DIR__ . '/env.php';

/**
 * Onde fica o arquivo SQLite.
 *
 * O padrão é DENTRO do docroot, por herança: é onde o banco sempre esteve, e
 * mudar isso sozinho quebraria instalações existentes. Mas ele contém nome,
 * e-mail, telefone, contato de emergência, plano de saúde e pagamentos de todas
 * as pessoas inscritas — se o servidor web servir esse caminho como arquivo
 * estático, o banco inteiro é baixável por URL.
 *
 * O .htaccess em data/ bloqueia isso NO APACHE. Em nginx, Caddy, LiteSpeed ou
 * no servidor embutido do PHP, ele é ignorado.
 *
 * A defesa que funciona em qualquer servidor é pôr o arquivo fora do docroot:
 * defina DB_PATH em public/api/env.php antes de tudo (ver env.example.php).
 */
if (!defined('DB_PATH')) {
    define('DB_PATH', __DIR__ . '/data/10cbbp.db');
}

// Dias válidos de alojamento (03 a 09/09/2026) — fonte única, não duplicar em outros arquivos
define('ALOJAMENTO_DIAS_VALIDOS', [3, 4, 5, 6, 7, 8, 9]);

// Helper seguro: se middleware admin já tiver definido, usa ele.
// Senão responde com respondError padrão.
function _dbRespondError(string $publicMsg, ?string $debugMsg = null, int $status = 500): void {
    if (function_exists('_respondAdminError')) {
        _respondAdminError($publicMsg, $debugMsg, $status);
        return;
    }
    error_log('[db] ' . ($debugMsg ?? $publicMsg));
    respondError($debugMsg ?? $publicMsg, $status);
}

function getDb(): PDO {
    $dir = dirname(DB_PATH);
    if (!is_dir($dir)) {
        if (!@mkdir($dir, 0755, true)) {
            $msg = 'Sem permissão para criar a pasta de dados em ' . $dir .
                   ' (verifique dono/grupo e chmod 0755/0775 da pasta api/)';
            _dbRespondError('Sem permissão para criar a pasta de dados', $msg, 500);
        }
    }
    if (!is_writable($dir)) {
        $msg = 'Pasta de dados sem permissão de escrita: ' . $dir .
               ' (no servidor, dê permissão de escrita para o usuário do Apache/PHP-FPM)';
        _dbRespondError('Pasta de dados sem permissão de escrita', $msg, 500);
    }
    if (file_exists(DB_PATH) && !is_writable(DB_PATH)) {
        $msg = 'Arquivo do BD existe mas não pode ser escrito: ' . DB_PATH;
        _dbRespondError('Arquivo do banco sem permissão de escrita', $msg, 500);
    }
    if (!in_array('sqlite', PDO::getAvailableDrivers(), true)) {
        $msg = 'SQLite (pdo_sqlite) não está habilitado no servidor. Habilite a extensão php_pdo_sqlite no php.ini.';
        _dbRespondError('SQLite não habilitado', $msg, 500);
    }

    try {
        $pdo = new PDO('sqlite:' . DB_PATH);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $pdo->exec('PRAGMA foreign_keys=ON');
        try { $pdo->exec('PRAGMA journal_mode=WAL'); } catch (\PDOException $e) {}
    } catch (\PDOException $e) {
        $dbg = 'DB error: ' . $e->getMessage() . ' (path: ' . DB_PATH . ')';
        _dbRespondError('Erro ao abrir o banco de dados', $dbg, 500);
    }

    initSchema($pdo);
    return $pdo;
}

function initSchema(PDO $pdo): void {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS clubes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL UNIQUE COLLATE NOCASE,
            criado_em TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS pessoas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE COLLATE NOCASE,
            telefone TEXT,
            ddi TEXT DEFAULT '55',
            genero TEXT,
            genero_descricao TEXT,
            clube_id INTEGER REFERENCES clubes(id),
            cidade TEXT,
            nacionalidade TEXT DEFAULT 'brasileire',
            criado_em TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS inscricoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pessoa_id INTEGER NOT NULL REFERENCES pessoas(id),
            status TEXT DEFAULT 'aguardando_pagamento',
            latino INTEGER DEFAULT 0,
            acao_afirmativa INTEGER DEFAULT 0,
            acao_preta INTEGER DEFAULT 0,
            acao_parda INTEGER DEFAULT 0,
            acao_indigena INTEGER DEFAULT 0,
            acao_primeiro_torneio INTEGER DEFAULT 0,
            valor_total REAL DEFAULT 0,
            criado_em TEXT DEFAULT (datetime('now')),
            atualizado_em TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS inscricao_categorias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            inscricao_id INTEGER NOT NULL REFERENCES inscricoes(id),
            categoria TEXT NOT NULL,
            valor REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS times (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            categoria TEXT NOT NULL,
            codigo TEXT NOT NULL UNIQUE,
            logo_path TEXT,
            criador_id INTEGER REFERENCES pessoas(id),
            criado_em TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS membros_time (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            time_id INTEGER NOT NULL REFERENCES times(id),
            inscricao_id INTEGER NOT NULL REFERENCES inscricoes(id),
            UNIQUE(time_id, inscricao_id)
        );

        CREATE TABLE IF NOT EXISTS pagamentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            inscricao_id INTEGER NOT NULL REFERENCES inscricoes(id),
            tipo TEXT DEFAULT 'inscricao',
            metodo TEXT,
            status TEXT DEFAULT 'pendente',
            valor REAL,
            itens_json TEXT,
            referencia_externa TEXT,
            dados_externos TEXT,
            criado_em TEXT DEFAULT (datetime('now')),
            atualizado_em TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS alimentacao (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            inscricao_id INTEGER NOT NULL REFERENCES inscricoes(id),
            dia INTEGER NOT NULL,
            valor REAL NOT NULL,
            UNIQUE(inscricao_id, dia)
        );

        CREATE TABLE IF NOT EXISTS alojamento (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            inscricao_id INTEGER NOT NULL REFERENCES inscricoes(id),
            dia INTEGER NOT NULL,
            valor REAL NOT NULL,
            pagamento_id INTEGER REFERENCES pagamentos(id),
            UNIQUE(inscricao_id, dia)
        );

        CREATE TABLE IF NOT EXISTS login_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL COLLATE NOCASE,
            code_hash TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            used INTEGER DEFAULT 0,
            criado_em TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            token TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL COLLATE NOCASE,
            expires_at TEXT NOT NULL,
            criado_em TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS checkins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            inscricao_id INTEGER NOT NULL REFERENCES inscricoes(id) UNIQUE,
            presente INTEGER DEFAULT 0,
            credenciado INTEGER DEFAULT 0,
            alimentacao_confirmada INTEGER DEFAULT 0,
            alojamento_confirmado INTEGER DEFAULT 0,
            atualizado_em TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS observacoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            inscricao_id INTEGER NOT NULL REFERENCES inscricoes(id),
            texto TEXT NOT NULL,
            tipo TEXT DEFAULT 'manual',
            criado_em TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS configuracoes (
            chave TEXT PRIMARY KEY,
            valor TEXT NOT NULL,
            atualizado_em TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS loj_produtos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            descricao TEXT,
            preco REAL NOT NULL,
            ativo INTEGER DEFAULT 1,
            ordem INTEGER DEFAULT 0,
            criado_em TEXT DEFAULT (datetime('now')),
            atualizado_em TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS loj_produto_imagens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            produto_id INTEGER NOT NULL REFERENCES loj_produtos(id),
            caminho TEXT NOT NULL,
            ordem INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS loj_produto_tamanhos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            produto_id INTEGER NOT NULL REFERENCES loj_produtos(id),
            tamanho TEXT NOT NULL,
            ordem INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS loj_pedidos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT NOT NULL COLLATE NOCASE,
            whatsapp TEXT,
            observacoes TEXT,
            status TEXT DEFAULT 'pendente',
            metodo TEXT,
            valor REAL NOT NULL,
            checkout_token TEXT,
            referencia_externa TEXT,
            dados_externos TEXT,
            codigo_retirada TEXT,
            criado_em TEXT DEFAULT (datetime('now')),
            atualizado_em TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS loj_pedido_itens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pedido_id INTEGER NOT NULL REFERENCES loj_pedidos(id),
            produto_id INTEGER NOT NULL REFERENCES loj_produtos(id),
            produto_nome TEXT NOT NULL,
            tamanho TEXT,
            quantidade INTEGER NOT NULL,
            preco_unitario REAL NOT NULL
        );
    ");

    // ── Módulo de torneio (Swiss modificado + equalização + repescagem + double elimination) ──
    // Times/atletas continuam vindo de `times` / `membros_time` -> `inscricoes` -> `pessoas`
    // (fonte oficial, não duplicada aqui). Tudo abaixo é específico da operação esportiva.
    // Carteira pré-paga vinculada à identidade `pessoas`, nunca à inscrição.
    // Todos os valores financeiros novos são inteiros em centavos.
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS carteiras (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pessoa_id INTEGER NOT NULL UNIQUE REFERENCES pessoas(id),
            qr_token TEXT NOT NULL UNIQUE,
            saldo_centavos INTEGER NOT NULL DEFAULT 0 CHECK (saldo_centavos >= 0),
            status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'bloqueada')),
            criada_em TEXT DEFAULT (datetime('now')),
            atualizada_em TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS carteira_magic_links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pessoa_id INTEGER NOT NULL REFERENCES pessoas(id),
            token_hash TEXT NOT NULL UNIQUE,
            expira_em TEXT NOT NULL,
            usado_em TEXT,
            criado_em TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS carteira_recargas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            carteira_id INTEGER NOT NULL REFERENCES carteiras(id),
            valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
            valor_cobrado_centavos INTEGER CHECK (valor_cobrado_centavos > 0),
            status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'recusada', 'cancelada', 'estornada')),
            metodo TEXT,
            mp_payment_id TEXT UNIQUE,
            referencia_externa TEXT NOT NULL UNIQUE,
            dados_externos TEXT,
            criada_em TEXT DEFAULT (datetime('now')),
            atualizada_em TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS carteira_produtos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            preco_centavos INTEGER NOT NULL CHECK (preco_centavos > 0),
            estoque INTEGER NOT NULL DEFAULT 0 CHECK (estoque >= 0),
            ativo INTEGER NOT NULL DEFAULT 1,
            criado_em TEXT DEFAULT (datetime('now')),
            atualizado_em TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS carteira_vendas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            carteira_id INTEGER NOT NULL REFERENCES carteiras(id),
            admin_usuario TEXT NOT NULL,
            total_centavos INTEGER NOT NULL CHECK (total_centavos > 0),
            status TEXT NOT NULL DEFAULT 'confirmada' CHECK (status IN ('confirmada', 'estornada')),
            request_id TEXT NOT NULL UNIQUE,
            criada_em TEXT DEFAULT (datetime('now')),
            estornada_em TEXT,
            estornada_por TEXT
        );
        CREATE TABLE IF NOT EXISTS carteira_venda_itens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            venda_id INTEGER NOT NULL REFERENCES carteira_vendas(id),
            produto_id INTEGER NOT NULL REFERENCES carteira_produtos(id),
            produto_nome TEXT NOT NULL,
            quantidade INTEGER NOT NULL CHECK (quantidade > 0),
            preco_unitario_centavos INTEGER NOT NULL CHECK (preco_unitario_centavos > 0)
        );
        CREATE TABLE IF NOT EXISTS carteira_movimentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            carteira_id INTEGER NOT NULL REFERENCES carteiras(id),
            tipo TEXT NOT NULL CHECK (tipo IN ('RECARGA', 'COMPRA', 'ESTORNO', 'REEMBOLSO', 'AJUSTE_ADMINISTRATIVO')),
            valor_centavos INTEGER NOT NULL CHECK (valor_centavos != 0),
            saldo_anterior_centavos INTEGER NOT NULL,
            saldo_posterior_centavos INTEGER NOT NULL CHECK (saldo_posterior_centavos >= 0),
            recarga_id INTEGER REFERENCES carteira_recargas(id),
            venda_id INTEGER REFERENCES carteira_vendas(id),
            admin_usuario TEXT,
            observacao TEXT,
            criado_em TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS carteira_estoque_movimentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            produto_id INTEGER NOT NULL REFERENCES carteira_produtos(id),
            tipo TEXT NOT NULL CHECK (tipo IN ('VENDA', 'ESTORNO', 'AJUSTE')),
            quantidade INTEGER NOT NULL CHECK (quantidade != 0),
            estoque_anterior INTEGER NOT NULL,
            estoque_posterior INTEGER NOT NULL CHECK (estoque_posterior >= 0),
            venda_id INTEGER REFERENCES carteira_vendas(id),
            admin_usuario TEXT NOT NULL,
            observacao TEXT,
            criado_em TEXT DEFAULT (datetime('now'))
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_carteira_mov_recarga ON carteira_movimentos(recarga_id) WHERE recarga_id IS NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_carteira_mov_venda_tipo ON carteira_movimentos(venda_id, tipo) WHERE venda_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_carteira_movimentos_carteira ON carteira_movimentos(carteira_id, id DESC);
        CREATE INDEX IF NOT EXISTS idx_carteira_recargas_carteira ON carteira_recargas(carteira_id, id DESC);
        CREATE INDEX IF NOT EXISTS idx_carteira_magic_pessoa ON carteira_magic_links(pessoa_id, criado_em DESC);
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS torneios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            categoria TEXT NOT NULL,
            formato TEXT,
            sandbox INTEGER NOT NULL DEFAULT 0,
            preset TEXT,
            estado TEXT NOT NULL DEFAULT 'CONFIGURACAO',
            rodadas_swiss INTEGER NOT NULL DEFAULT 4,
            equalizacao_habilitada INTEGER NOT NULL DEFAULT 1,
            classificados_diretos INTEGER NOT NULL DEFAULT 6,
            vagas_repescagem INTEGER NOT NULL DEFAULT 2,
            pontos_vitoria REAL NOT NULL DEFAULT 3,
            pontos_empate REAL NOT NULL DEFAULT 1,
            pontos_derrota REAL NOT NULL DEFAULT 0,
            permite_empate_classificatoria INTEGER NOT NULL DEFAULT 1,
            origem_torneio_id INTEGER REFERENCES torneios(id),
            criado_por TEXT,
            criado_em TEXT DEFAULT (datetime('now')),
            atualizado_em TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS torneio_criterios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            torneio_id INTEGER NOT NULL REFERENCES torneios(id),
            ordem INTEGER NOT NULL,
            criterio TEXT NOT NULL,
            UNIQUE(torneio_id, ordem)
        );

        CREATE TABLE IF NOT EXISTS torneio_participantes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            torneio_id INTEGER NOT NULL REFERENCES torneios(id),
            time_id INTEGER NOT NULL REFERENCES times(id),
            seed INTEGER,
            ativo INTEGER NOT NULL DEFAULT 1,
            criado_em TEXT DEFAULT (datetime('now')),
            UNIQUE(torneio_id, time_id)
        );

        CREATE TABLE IF NOT EXISTS torneio_fases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            torneio_id INTEGER NOT NULL REFERENCES torneios(id),
            tipo TEXT NOT NULL,
            rodada INTEGER,
            rotulo TEXT NOT NULL,
            estado TEXT NOT NULL DEFAULT 'pendente',
            conta_classificacao INTEGER NOT NULL DEFAULT 0,
            gerada_em TEXT,
            confirmada_em TEXT,
            confirmada_por TEXT,
            criado_em TEXT DEFAULT (datetime('now')),
            UNIQUE(torneio_id, tipo, rodada)
        );

        CREATE TABLE IF NOT EXISTS torneio_jogos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            torneio_id INTEGER NOT NULL REFERENCES torneios(id),
            fase_id INTEGER NOT NULL REFERENCES torneio_fases(id),
            codigo TEXT NOT NULL,
            bracket TEXT,
            ordem INTEGER NOT NULL DEFAULT 0,
            time_a_id INTEGER REFERENCES times(id),
            time_b_id INTEGER REFERENCES times(id),
            time_a_origem TEXT,
            time_b_origem TEXT,
            is_bye INTEGER NOT NULL DEFAULT 0,
            bye_motivo TEXT,
            status TEXT NOT NULL DEFAULT 'agendado',
            placar_a INTEGER,
            placar_b INTEGER,
            vencedor_time_id INTEGER REFERENCES times(id),
            wo INTEGER NOT NULL DEFAULT 0,
            overtime INTEGER NOT NULL DEFAULT 0,
            horario_previsto TEXT,
            horario_inicio_real TEXT,
            horario_fim_real TEXT,
            observacoes TEXT,
            criado_em TEXT DEFAULT (datetime('now')),
            atualizado_em TEXT DEFAULT (datetime('now')),
            UNIQUE(torneio_id, codigo)
        );

        CREATE TABLE IF NOT EXISTS torneio_eventos_gol (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            torneio_id INTEGER NOT NULL REFERENCES torneios(id),
            jogo_id INTEGER NOT NULL REFERENCES torneio_jogos(id),
            time_id INTEGER NOT NULL REFERENCES times(id),
            membro_id INTEGER REFERENCES membros_time(id),
            contra INTEGER NOT NULL DEFAULT 0,
            minuto INTEGER,
            criado_por TEXT,
            criado_em TEXT DEFAULT (datetime('now')),
            removido INTEGER NOT NULL DEFAULT 0,
            removido_em TEXT,
            removido_por TEXT
        );

        CREATE TABLE IF NOT EXISTS torneio_eventos_falta (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            torneio_id INTEGER NOT NULL REFERENCES torneios(id),
            jogo_id INTEGER NOT NULL REFERENCES torneio_jogos(id),
            time_id INTEGER NOT NULL REFERENCES times(id),
            membro_id INTEGER REFERENCES membros_time(id),
            criado_por TEXT,
            criado_em TEXT DEFAULT (datetime('now')),
            removido INTEGER NOT NULL DEFAULT 0,
            removido_em TEXT,
            removido_por TEXT
        );

        CREATE TABLE IF NOT EXISTS torneio_audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            torneio_id INTEGER NOT NULL REFERENCES torneios(id),
            usuario TEXT,
            acao TEXT NOT NULL,
            entidade TEXT NOT NULL,
            entidade_id INTEGER,
            estado_anterior TEXT,
            estado_novo TEXT,
            motivo TEXT,
            sandbox INTEGER NOT NULL DEFAULT 0,
            revertido INTEGER NOT NULL DEFAULT 0,
            revertido_em TEXT,
            revertido_por TEXT,
            criado_em TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS torneio_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            torneio_id INTEGER NOT NULL REFERENCES torneios(id),
            fase_id INTEGER REFERENCES torneio_fases(id),
            tipo TEXT NOT NULL,
            dados TEXT NOT NULL,
            criado_por TEXT,
            criado_em TEXT DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_torneio_jogos_torneio  ON torneio_jogos(torneio_id);
        CREATE INDEX IF NOT EXISTS idx_torneio_jogos_fase     ON torneio_jogos(fase_id);
        CREATE INDEX IF NOT EXISTS idx_torneio_gols_jogo      ON torneio_eventos_gol(jogo_id);
        CREATE INDEX IF NOT EXISTS idx_torneio_faltas_jogo    ON torneio_eventos_falta(jogo_id);
        CREATE INDEX IF NOT EXISTS idx_torneio_audit_torneio  ON torneio_audit_log(torneio_id);
        CREATE INDEX IF NOT EXISTS idx_torneio_participantes  ON torneio_participantes(torneio_id);
    ");

    $pdo->exec("
        INSERT OR IGNORE INTO clubes (nome) VALUES ('Independente');
        INSERT OR IGNORE INTO clubes (nome) VALUES ('Free Agent');
    ");

    // Migrations seguras (ignoram se coluna já existir)
    // Awards do 2° Pior Campeonato de Bici Polo MISTO. A elegibilidade nunca é uma lista paralela:
    // deriva sempre das inscrições oficiais na categoria `misto`.
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS awards_config (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            status TEXT NOT NULL DEFAULT 'fechada' CHECK (status IN ('fechada', 'aberta', 'encerrada')),
            aberta_em TEXT,
            encerrada_em TEXT,
            atualizado_em TEXT DEFAULT (datetime('now')),
            atualizado_por TEXT
        );
        CREATE TABLE IF NOT EXISTS awards_candidatos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            categoria TEXT NOT NULL CHECK (categoria IN ('revelacao', 'jesse')),
            pessoa_id INTEGER NOT NULL REFERENCES pessoas(id),
            criado_em TEXT DEFAULT (datetime('now')),
            criado_por TEXT,
            UNIQUE(categoria, pessoa_id)
        );
        CREATE TABLE IF NOT EXISTS awards_votos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            eleitor_pessoa_id INTEGER NOT NULL REFERENCES pessoas(id),
            categoria TEXT NOT NULL CHECK (categoria IN ('mvp', 'wow', 'revelacao', 'jesse')),
            candidato_pessoa_id INTEGER NOT NULL REFERENCES pessoas(id),
            criado_em TEXT DEFAULT (datetime('now')),
            atualizado_em TEXT DEFAULT (datetime('now')),
            UNIQUE(eleitor_pessoa_id, categoria),
            CHECK (eleitor_pessoa_id != candidato_pessoa_id)
        );
        CREATE INDEX IF NOT EXISTS idx_awards_votos_categoria ON awards_votos(categoria, candidato_pessoa_id);
        CREATE INDEX IF NOT EXISTS idx_awards_candidatos_categoria ON awards_candidatos(categoria, pessoa_id);
        INSERT OR IGNORE INTO awards_config (id, status) VALUES (1, 'fechada');

        -- Premiações externas do MTNB: cadastro administrativo, sem votação ou
        -- apuração paralela. Os vencedores continuam vinculados às pessoas reais.
        CREATE TABLE IF NOT EXISTS awards_mtnb (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo TEXT NOT NULL UNIQUE,
            nome TEXT NOT NULL,
            descricao TEXT,
            ordem INTEGER NOT NULL DEFAULT 0,
            publicado INTEGER NOT NULL DEFAULT 0 CHECK (publicado IN (0, 1)),
            criado_em TEXT DEFAULT (datetime('now')),
            atualizado_em TEXT DEFAULT (datetime('now')),
            atualizado_por TEXT
        );
        CREATE TABLE IF NOT EXISTS awards_mtnb_vencedores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            award_id INTEGER NOT NULL REFERENCES awards_mtnb(id) ON DELETE CASCADE,
            pessoa_id INTEGER NOT NULL REFERENCES pessoas(id),
            ordem INTEGER NOT NULL DEFAULT 0,
            UNIQUE(award_id, pessoa_id)
        );
        CREATE INDEX IF NOT EXISTS idx_awards_mtnb_ordem ON awards_mtnb(publicado, ordem, id);
        CREATE INDEX IF NOT EXISTS idx_awards_mtnb_vencedores ON awards_mtnb_vencedores(award_id, ordem, id);
    ");

    foreach ([
        "ALTER TABLE torneios ADD COLUMN formato TEXT",
        "ALTER TABLE pagamentos ADD COLUMN tipo TEXT DEFAULT 'inscricao'",
        "ALTER TABLE pagamentos ADD COLUMN itens_json TEXT",
        "ALTER TABLE pagamentos ADD COLUMN checkout_token TEXT",
        "ALTER TABLE inscricoes ADD COLUMN restricao_alimentar TEXT",
        "ALTER TABLE alimentacao ADD COLUMN pacote TEXT DEFAULT 'completo'",
        "ALTER TABLE inscricoes ADD COLUMN tipo_participacao TEXT DEFAULT 'atleta'",
        "ALTER TABLE inscricoes ADD COLUMN contato_emergencia_nome TEXT",
        "ALTER TABLE inscricoes ADD COLUMN contato_emergencia_relacao TEXT",
        "ALTER TABLE inscricoes ADD COLUMN contato_emergencia_telefone TEXT",
        "ALTER TABLE inscricoes ADD COLUMN possui_plano_saude INTEGER DEFAULT 0",
        "ALTER TABLE inscricoes ADD COLUMN plano_saude TEXT",
        "ALTER TABLE inscricoes ADD COLUMN numero_carteirinha TEXT",
        "ALTER TABLE inscricoes ADD COLUMN aceitou_termos INTEGER DEFAULT 0",
        "ALTER TABLE inscricoes ADD COLUMN data_aceite_termos TEXT",
        "ALTER TABLE checkins ADD COLUMN bike_check INTEGER DEFAULT 0",
        "ALTER TABLE alimentacao ADD COLUMN retirado INTEGER DEFAULT 0",
        "ALTER TABLE pagamentos ADD COLUMN reembolsado INTEGER DEFAULT 0",
        "ALTER TABLE pagamentos ADD COLUMN origem_pagamento TEXT",
        "ALTER TABLE alojamento ADD COLUMN pagamento_id INTEGER REFERENCES pagamentos(id)",
        "ALTER TABLE alimentacao ADD COLUMN retirado_cafe INTEGER DEFAULT 0",
        "ALTER TABLE alimentacao ADD COLUMN retirado_almoco INTEGER DEFAULT 0",
        "ALTER TABLE alimentacao ADD COLUMN retirado_lanche INTEGER DEFAULT 0",
        // tipo do gol: 'normal' | 'sem_autoria' | 'gol_contra' — fonte única de verdade pra
        // artilharia (só 'normal' soma individual). Substitui a coluna `contra` (mantida por
        // compatibilidade, não é mais lida pelo código; ver seção 7 do brief de simplificação).
        "ALTER TABLE torneio_eventos_gol ADD COLUMN tipo TEXT",
        // Migração de brasões/fotos do Poloperator pra armazenamento interno — `origem`
        // ('manual'|'importado') decide precedência (upload manual nunca é sobrescrito por
        // reimportação automática); `poloperator_id` é só auditoria/matching pra próxima
        // importação, nunca necessário pra renderizar o site.
        "ALTER TABLE times ADD COLUMN logo_origem TEXT",
        "ALTER TABLE times ADD COLUMN logo_atualizado_em TEXT",
        "ALTER TABLE times ADD COLUMN poloperator_id TEXT",
        "ALTER TABLE pessoas ADD COLUMN foto_path TEXT",
        "ALTER TABLE pessoas ADD COLUMN foto_origem TEXT",
        "ALTER TABLE pessoas ADD COLUMN foto_atualizado_em TEXT",
        "ALTER TABLE pessoas ADD COLUMN poloperator_id TEXT",
    ] as $migration) {
        try { $pdo->exec($migration); } catch (\PDOException $e) {}
    }

    // Formato explícito e retrocompatível: torneios históricos do Misto mantêm
    // identidade/IDs e apenas recebem a estratégia que já executavam.
    try {
        $pdo->exec("UPDATE torneios SET formato = CASE WHEN lower(categoria)='mtnb' THEN 'mtnb_round_robin_5' ELSE 'misto_swiss_13' END WHERE formato IS NULL OR formato = ''");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_torneios_categoria_formato ON torneios(categoria, formato)");
    } catch (\PDOException $e) {}

    // Backfill idempotente (só afeta linhas antigas sem `tipo`, nunca roda de novo depois
    // que todas já têm valor — o app sempre grava `tipo` explicitamente daqui em diante).
    try {
        $pdo->exec("
            UPDATE torneio_eventos_gol
            SET tipo = CASE WHEN contra = 1 THEN 'gol_contra' WHEN membro_id IS NULL THEN 'sem_autoria' ELSE 'normal' END
            WHERE tipo IS NULL
        ");
    } catch (\PDOException $e) {}

    // Backfill de execução única: trava retroativamente dias de alojamento que já foram
    // pagos antes da introdução da coluna pagamento_id. Precisa de um marcador em
    // `configuracoes` — sem ele, rodar isso a cada requisição prenderia erroneamente
    // dias extras novos (ainda soltos) só porque a inscrição já teve algum pagamento
    // de alojamento pago no passado.
    $jaMigrado = $pdo->query("SELECT 1 FROM configuracoes WHERE chave = 'migracao_lock_alojamento_v1'")->fetch();
    if (!$jaMigrado) {
        try {
            $pdo->exec("
                UPDATE alojamento
                SET pagamento_id = (
                    SELECT pg.id FROM pagamentos pg
                    WHERE pg.inscricao_id = alojamento.inscricao_id
                    AND pg.tipo = 'alojamento' AND pg.status = 'pago'
                    ORDER BY pg.id DESC LIMIT 1
                )
                WHERE pagamento_id IS NULL
                AND inscricao_id IN (
                    SELECT inscricao_id FROM pagamentos WHERE tipo = 'alojamento' AND status = 'pago'
                )
            ");
            $pdo->prepare("INSERT OR IGNORE INTO configuracoes (chave, valor) VALUES ('migracao_lock_alojamento_v1', '1')")->execute();
        } catch (\PDOException $e) {}
    }

    // A ordem antiga agrupava toda a Winners antes da Losers e confundia a posição
    // visual da chave com a fila real de jogos. Backfill único e estritamente
    // operacional: não altera participantes, dependências, placares ou progressão.
    $ordemDoubleMigrada = $pdo->query("SELECT 1 FROM configuracoes WHERE chave = 'migracao_ordem_operacional_double_v1'")->fetch();
    if (!$ordemDoubleMigrada) {
        try {
            normalizarOrdemOperacionalDouble($pdo);
            $pdo->prepare("INSERT OR IGNORE INTO configuracoes (chave, valor) VALUES ('migracao_ordem_operacional_double_v1', '1')")->execute();
        } catch (\PDOException $e) {}
    }
}

function corsHeaders(): void {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-Session-Token');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function respond(mixed $data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * Responde com erro.
 * Se $debugMsg for passada e APP_DEBUG estiver ligado, inclui um campo
 * "debug" na resposta para o painel admin exibir o motivo real ao usuário.
 */
function respondError(string $msg, int $status = 400, ?string $debugMsg = null, mixed $meta = null): void {
    $out = ['error' => $msg];
    if (defined('APP_DEBUG') && APP_DEBUG && $debugMsg !== null && $debugMsg !== '') {
        $out['debug'] = $debugMsg;
    }
    if ($meta !== null) {
        $out['meta'] = $meta;
    }
    respond($out, $status);
}

function getBody(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function generateTeamCode(PDO $db): string {
    $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $len = strlen($chars);
    do {
        $code = '';
        for ($i = 0; $i < 6; $i++) $code .= $chars[random_int(0, $len - 1)];
        $stmt = $db->prepare("SELECT id FROM times WHERE codigo = ?");
        $stmt->execute([$code]);
    } while ($stmt->fetch());
    return $code;
}

// Retorna todos os preços configuráveis, com fallback nos padrões
function getPrecos(PDO $pdo): array {
    $defaults = [
        'valor_misto'                 => 182,
        'valor_mtnb'                  => 52,
        'valor_misto_com_mtnb'        => 90,
        'desconto_primeiro_torneio'   => 0.50,
        'valor_alimentacao_completo'  => 51,
        'valor_alimentacao_almoco'    => 21,
        'valor_alojamento_diaria'     => 26,
    ];
    $stmt = $pdo->prepare("SELECT chave, valor FROM configuracoes WHERE chave IN (" .
        implode(',', array_fill(0, count($defaults), '?')) . ")");
    $stmt->execute(array_keys($defaults));
    $rows = $stmt->fetchAll();
    foreach ($rows as $row) {
        $defaults[$row['chave']] = (float)$row['valor'];
    }
    return $defaults;
}

function generateCodigoRetirada(PDO $db): string {
    $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $len = strlen($chars);
    do {
        $code = '';
        for ($i = 0; $i < 6; $i++) $code .= $chars[random_int(0, $len - 1)];
        $stmt = $db->prepare("SELECT id FROM loj_pedidos WHERE codigo_retirada = ?");
        $stmt->execute([$code]);
    } while ($stmt->fetch());
    return $code;
}

// Retorna a configuração da loja (aberta/fechada + mensagem), com fallback nos padrões
function getConfigLoja(PDO $pdo): array {
    $defaults = [
        'loja_aberta'           => '0',
        'loja_mensagem_fechada' => 'O período de encomendas já foi encerrado. Nos vemos no campeonato!',
    ];
    $stmt = $pdo->prepare("SELECT chave, valor FROM configuracoes WHERE chave IN (" .
        implode(',', array_fill(0, count($defaults), '?')) . ")");
    $stmt->execute(array_keys($defaults));
    foreach ($stmt->fetchAll() as $row) {
        $defaults[$row['chave']] = $row['valor'];
    }
    return $defaults;
}

// Retorna a configuração geral de abertura (inscrições / alojamento / alimentação),
// com fallback nos padrões. Independentes entre si — ver seção 11 do brief.
function getConfigGeral(PDO $pdo): array {
    $defaults = [
        'inscricoes_abertas' => '0', // inscrições estão encerradas no estado atual do evento
        'alojamento_aberto'  => '0',
        'alimentacao_aberto' => '0',
        'modulo_checkin'     => '0',
        'modulo_alimentacao' => '0',
        'modulo_alojamento'  => '0',
        'modulo_mtnb'        => '0',
    ];
    $stmt = $pdo->prepare("SELECT chave, valor FROM configuracoes WHERE chave IN (" .
        implode(',', array_fill(0, count($defaults), '?')) . ")");
    $stmt->execute(array_keys($defaults));
    foreach ($stmt->fetchAll() as $row) {
        $defaults[$row['chave']] = $row['valor'];
    }
    return $defaults;
}

// Trava (torna imutáveis) os dias de alojamento ainda soltos de uma inscrição no momento
// em que o pagamento que os cobre é confirmado. Chamada em todo lugar que marca um
// pagamento de tipo alojamento/alojamento_extra como 'pago' (ver PLAN.md).
// Os dias ainda soltos (pagamento_id IS NULL) no momento da confirmação são garantidamente
// os dias cobertos por este pagamento: gerar um novo pagamento é bloqueado enquanto um já
// está pendente, e qualquer edição de seleção cancela o pagamento pendente correspondente.
function lockAlojamentoAoPagar(PDO $db, int $pagamentoId): void {
    $stmt = $db->prepare("SELECT tipo, inscricao_id FROM pagamentos WHERE id = ?");
    $stmt->execute([$pagamentoId]);
    $pg = $stmt->fetch();
    if (!$pg || !in_array($pg['tipo'], ['alojamento', 'alojamento_extra'])) return;

    $db->prepare("UPDATE alojamento SET pagamento_id = ? WHERE inscricao_id = ? AND pagamento_id IS NULL")
       ->execute([$pagamentoId, $pg['inscricao_id']]);
}

// Inverso de lockAlojamentoAoPagar — usado quando um admin reverte um pagamento de
// alojamento/alojamento_extra de 'pago' para pendente (correção de erro).
function desbloqueiaAlojamento(PDO $db, int $pagamentoId): void {
    $db->prepare("UPDATE alojamento SET pagamento_id = NULL WHERE pagamento_id = ?")
       ->execute([$pagamentoId]);
}

// Recalcula valor_total da inscrição (espelha inscricoes.config.ts)
function atualizaValorTotal(PDO $db, int $inscricaoId): void {
    $precos               = getPrecos($db);
    $VALOR_MISTO          = $precos['valor_misto'];
    $VALOR_MTNB           = $precos['valor_mtnb'];
    $VALOR_MISTO_COM_MTNB = $precos['valor_misto_com_mtnb'];
    $DESCONTO_PT          = $precos['desconto_primeiro_torneio'];

    $stmt = $db->prepare("SELECT categoria FROM inscricao_categorias WHERE inscricao_id = ?");
    $stmt->execute([$inscricaoId]);
    $cats     = array_column($stmt->fetchAll(), 'categoria');
    $tem_misto = in_array('misto', $cats);
    $tem_mtnb  = in_array('mtnb', $cats);

    $stmt = $db->prepare("SELECT acao_preta, acao_parda, acao_indigena, acao_primeiro_torneio FROM inscricoes WHERE id = ?");
    $stmt->execute([$inscricaoId]);
    $ins = $stmt->fetch();

    $tem_ppi           = $ins['acao_preta'] || $ins['acao_parda'] || $ins['acao_indigena'];
    $tem_incentivo_mtnb = $tem_misto && $tem_mtnb;
    $tem_pt            = $ins['acao_primeiro_torneio'] && !$tem_incentivo_mtnb;

    $subtotal_base = ($tem_misto ? $VALOR_MISTO : 0) + ($tem_mtnb ? $VALOR_MTNB : 0);

    if ($tem_ppi) {
        $valor_esportivo = 0;
    } elseif ($tem_incentivo_mtnb) {
        $valor_esportivo = $VALOR_MISTO_COM_MTNB + $VALOR_MTNB;
    } elseif ($tem_pt) {
        $valor_esportivo = $subtotal_base * (1 - $DESCONTO_PT);
    } else {
        $valor_esportivo = $subtotal_base;
    }

    $stmt = $db->prepare("SELECT (SELECT COALESCE(SUM(valor),0) FROM alimentacao WHERE inscricao_id=:id) + (SELECT COALESCE(SUM(valor),0) FROM alojamento WHERE inscricao_id=:id) AS servicos");
    $stmt->execute([':id' => $inscricaoId]);
    $servicos = (float)$stmt->fetchColumn();

    $db->prepare("UPDATE inscricoes SET valor_total = ?, atualizado_em = datetime('now') WHERE id = ?")
       ->execute([$valor_esportivo + $servicos, $inscricaoId]);
}
