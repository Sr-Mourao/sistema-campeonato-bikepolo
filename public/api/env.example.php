<?php
/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TEMPLATE DE CONFIGURAÇÃO — copie para public/api/env.php e preencha.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   cp public/api/env.example.php public/api/env.php
 *
 * public/api/env.php está no .gitignore e NUNCA deve ser commitado.
 * Não existe .env / dotenv neste projeto: o backend é PHP puro e lê estas
 * constantes direto. (Há um .env.example na raiz, mas ele é só um espelho
 * documental — quem manda é este arquivo.)
 *
 * Todas as constantes abaixo precisam existir, mesmo que com valor vazio:
 * o código faz `define()`-check em algumas, mas usa outras direto.
 */

// ─────────────────────────────────────────────────────────────────────────────
// URL pública da instalação
// ─────────────────────────────────────────────────────────────────────────────
// Sem barra no final. Usada no notification_url do webhook do Mercado Pago,
// nos links de e-mail (magic link da carteira, confirmações) e na allowlist de
// CORS/origem do painel admin. Em desenvolvimento use a URL do Vite.
define('APP_URL', 'http://localhost:5173');

// ─────────────────────────────────────────────────────────────────────────────
// Onde fica o banco de dados  ← LEIA ISTO ANTES DE IR PARA PRODUÇÃO
// ─────────────────────────────────────────────────────────────────────────────
// Sem esta constante, o banco fica em public/api/data/10cbbp.db — ou seja,
// DENTRO da pasta que o servidor web publica. O arquivo contém nome, e-mail,
// telefone, contato de emergência, plano de saúde e pagamentos de todas as
// pessoas inscritas.
//
// Existe um .htaccess em data/ que bloqueia o download, MAS ele só funciona no
// Apache (e só com AllowOverride habilitado). Em nginx, Caddy, LiteSpeed ou no
// servidor embutido do PHP, esse .htaccess é simplesmente ignorado, e um
// GET /api/data/10cbbp.db baixa o banco inteiro.
//
// A defesa que funciona em QUALQUER servidor é tirar o arquivo do docroot.
// Descomente a linha abaixo apontando para uma pasta ACIMA da pasta pública:
//
//   docroot em ~/public_html  →  banco em ~/dados-bikepolo/
//
// A pasta precisa existir e ser gravável pelo usuário do PHP. Se você já tem um
// banco rodando, MOVA o arquivo (e os .db-wal/.db-shm, se houver) antes.
//
// define('DB_PATH', __DIR__ . '/../../../dados-bikepolo/10cbbp.db');
//
// Depois de subir, confirme que a proteção funciona — deve responder 403 ou 404:
//   curl -sI https://SEU-DOMINIO/api/data/10cbbp.db | head -1

// ─────────────────────────────────────────────────────────────────────────────
// Admin
// ─────────────────────────────────────────────────────────────────────────────
// Usuário/senha ÚNICOS do painel administrativo (não há cadastro de usuários).
// ADMIN_PASS aceita texto puro OU um hash bcrypt. Em produção use bcrypt:
//   php -r "echo password_hash('sua-senha-forte', PASSWORD_DEFAULT), PHP_EOL;"
// e cole o resultado (começa com $2y$) aqui.
define('ADMIN_USER', 'admin');
define('ADMIN_PASS', 'troque-esta-senha');

// ─────────────────────────────────────────────────────────────────────────────
// Debug
// ─────────────────────────────────────────────────────────────────────────────
// true = respostas de erro da API incluem um campo "debug" com a mensagem real
// (arquivo, linha, SQL). Ótimo em dev, VAZAMENTO DE INFORMAÇÃO em produção.
define('APP_DEBUG', false);

// ─────────────────────────────────────────────────────────────────────────────
// Sessões das pessoas atletas
// ─────────────────────────────────────────────────────────────────────────────
// Validade, em segundos, do token de sessão criado pelo login por e-mail e
// pelo magic link da carteira. Padrão: 30 dias.
define('SESSION_DURATION', 30 * 24 * 3600);

// ─────────────────────────────────────────────────────────────────────────────
// E-mail transacional (Resend — https://resend.com)
// ─────────────────────────────────────────────────────────────────────────────
// Usado para: código de login, magic link da carteira, confirmação de inscrição,
// convite de time, pagamento aprovado/recusado, cancelamento, pedido da lojinha.
//
// MODO DEV SEM E-MAIL: mantenha o valor literal 're_COLOQUE_SUA_CHAVE_AQUI'.
// Nesse modo, /api/auth.php devolve o código de login no próprio JSON (campo
// `code_dev`) e /api/carteira-auth.php devolve o token do magic link
// (`token_dev`), permitindo testar login sem servidor de e-mail.
// NUNCA deixe esse valor sentinela em produção.
define('RESEND_API_KEY', 're_COLOQUE_SUA_CHAVE_AQUI');

// Remetente. O domínio precisa estar verificado no Resend.
define('EMAIL_FROM', 'noreply@exemplo.com.br');
define('EMAIL_FROM_NAME', '2° Pior Campeonato de Bici Polo');

// ─────────────────────────────────────────────────────────────────────────────
// Mercado Pago
// ─────────────────────────────────────────────────────────────────────────────
// NÃO USE CREDENCIAIS DE PRODUÇÃO DE OUTRO EVENTO. Crie sua própria aplicação
// em https://www.mercadopago.com.br/developers e comece pelas credenciais de
// TESTE antes de mexer com dinheiro real.
//
// MP_PUBLIC_KEY  → chave pública; vai para o navegador via /api/config-publica.php
//                  (é pública por design; ainda assim identifica a SUA conta).
// MP_ACCESS_TOKEN → credencial de servidor. Segredo. Nunca vai ao navegador.
// MP_WEBHOOK_SECRET → gerado no painel MP em "Suas integrações → Webhooks".
//                  Se ficar VAZIO, public/api/webhook-mp.php ACEITA QUALQUER
//                  requisição sem validar assinatura — qualquer pessoa poderia
//                  forjar uma notificação de pagamento. Configure isto.
define('MP_PUBLIC_KEY',     '');
define('MP_ACCESS_TOKEN',   '');
define('MP_WEBHOOK_SECRET', '');

// ─────────────────────────────────────────────────────────────────────────────
// Simulação de pagamento (SÓ desenvolvimento)
// ─────────────────────────────────────────────────────────────────────────────
// true habilita `acao=simular_pago` em /api/pagamentos.php e /api/lojinha.php,
// que marcam pagamentos como PAGOS sem cobrar nada. É um backdoor financeiro:
// deixe SEMPRE false em qualquer instalação exposta à internet.
define('PAGAMENTO_MOCK', false);

// ─────────────────────────────────────────────────────────────────────────────
// Prazos de edição dos serviços
// ─────────────────────────────────────────────────────────────────────────────
// null = sem prazo. Formato: 'YYYY-MM-DD HH:MM:SS'.
// Depois da data, a pessoa atleta não consegue mais alterar a seleção.
define('ALIMENTACAO_EDITAVEL_ATE', null);
define('ALOJAMENTO_EDITAVEL_ATE',  null);
