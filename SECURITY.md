# Segurança

## O que este projeto é, honestamente

Este sistema foi construído para operar **um** campeonato de bike polo, sob
pressão de calendário, por um time muito pequeno. Ele rodou de verdade, com
dinheiro de verdade e dados pessoais de verdade — e isso significa que ele
funciona, não que ele foi auditado.

Não trate este código como referência de segurança. Trate-o como algo que
precisa de revisão antes de ir para a internet com dados de outras pessoas.

Se você for usá-lo, leia esta página inteira antes de expor qualquer coisa.

---

## Antes de expor à internet — checklist mínimo

- [ ] `public/api/env.php` criado a partir de `env.example.php`, com **suas**
      credenciais. Nenhuma credencial de outro evento.
- [ ] `ADMIN_PASS` trocada, e de preferência em hash bcrypt
      (`php -r "echo password_hash('senha', PASSWORD_DEFAULT);"`).
- [ ] `APP_DEBUG` em `false` — com `true`, a API devolve mensagem de erro
      interna (caminho de arquivo, SQL, linha) no corpo da resposta.
- [ ] `PAGAMENTO_MOCK` em `false`. Com `true`, existem endpoints públicos que
      marcam pagamentos como pagos **sem cobrar nada**.
- [ ] `MP_WEBHOOK_SECRET` configurado. Vazio, o webhook do Mercado Pago aceita
      qualquer requisição sem validar assinatura — qualquer pessoa poderia
      forjar uma notificação de pagamento aprovado.
- [ ] `APP_URL` apontando para o domínio real (é a allowlist de CORS/origem do
      painel admin e a base dos links de e-mail).
- [ ] HTTPS obrigatório no domínio inteiro. Os cookies de sessão só recebem a
      flag `Secure` quando a requisição chega por HTTPS; em HTTP puro, tanto a
      sessão do admin quanto a da pessoa atleta trafegam em claro.
- [ ] `public/api/data/` **fora** do alcance do servidor web, ou protegida.
      Veja a seção "O banco fica dentro do docroot" abaixo.
- [ ] `.htaccess` de `public/imgs/times/` e `public/imgs/atletas/` presentes no
      servidor (bloqueiam execução de PHP em pastas de upload).
- [ ] Backup do banco configurado, e o backup guardado fora do docroot.

---

## Autenticação — o que existe de fato

### Painel administrativo

- **Usuário único**, definido em `ADMIN_USER` / `ADMIN_PASS`. Não há cadastro de
  usuários, papéis ou permissões: quem entra no painel pode fazer tudo —
  cancelar inscrições, marcar pagamentos, estornar vendas, zerar o torneio.
- Sessão PHP nativa, cookie `HttpOnly` + `SameSite=Lax`, `Secure` só sob HTTPS.
- **A sessão dura 10 anos** e é renovada a cada requisição. Isso foi deliberado:
  o caixa do bar não podia ser deslogado no meio do evento. É péssimo para
  qualquer outro contexto. Se o navegador do caixa for perdido, a sessão
  continua válida — não há revogação remota, só trocar `ADMIN_PASS`.
- **Não há rate limiting no login do admin.** Um ataque de força bruta contra
  `/api/admin/auth.php` não encontra resistência do lado da aplicação. Se você
  expuser isto, ponha `fail2ban`, rate limit no proxy, ou um `.htaccess` com
  autenticação básica na frente de `/admin` e `/api/admin/`.
- `ADMIN_PASS` aceita texto puro (conveniente em dev, ruim em produção) ou hash
  bcrypt. Use bcrypt.

### Pessoas atletas

- Login por e-mail + **código numérico de 8 dígitos** gerado pelo admin
  (`/api/auth.php`). O hash bcrypt fica vinculado à pessoa e o código não expira;
  redefini-lo invalida sessões existentes.
- Após 5 tentativas inválidas, o acesso daquela pessoa bloqueia por 15 minutos.
- O admin exibe o código em texto puro apenas na resposta da geração; entregue-o
  diretamente ao atleta. A área administrativa não permite consultar o hash nem
  recuperar um código já gerado.
- Sessão = token aleatório de 32 bytes na tabela `sessions`, validade
  `SESSION_DURATION` (padrão 30 dias).
- O token viaja no header `X-Session-Token` (fluxo legado) **e** no cookie
  `cb_session` (fluxo da carteira). Os dois convivem — ver "Dívidas" abaixo.

### Carteira

- Acesso por **magic link** com token de 32 bytes; o banco guarda só o
  `sha256` do token. Validade 15 minutos, uso único, e solicitar um novo
  invalida os anteriores. Rate limit de 5 por 15 minutos.
- Endpoints de escrita da carteira chamam `carteiraValidarSameOrigin()`, que
  verifica `Sec-Fetch-Site` e, como fallback, `Origin`/`Referer` contra o host e
  a `APP_URL`. É a proteção anti-CSRF mais séria do projeto.

---

## Problemas conhecidos que você deve considerar antes de usar

Lista honesta. Nada aqui está escondido no código.

### Alto

1. **Sem CSRF token no painel admin.** A proteção é `SameSite=Lax` no cookie de
   sessão mais a allowlist de CORS. Isso cobre a maioria dos casos reais, mas
   não é a mesma coisa que um token anti-CSRF por requisição. Endpoints admin de
   escrita aceitam `POST` com `Content-Type: application/json`, o que na prática
   exige um preflight CORS — mas não conte com isso como se fosse um desenho
   defensivo, porque não foi.

2. **Um único login administrativo compartilhado.** Todo mundo que opera o
   evento usa a mesma senha. Não há trilha de quem fez o quê fora do
   `torneio_audit_log` (que registra `admin` para todo mundo) e não há como
   revogar o acesso de uma pessoa só.

3. **Sessão administrativa de 10 anos, sem revogação.**

4. **Sem rate limiting no login do admin.**

5. **`APP_DEBUG=true` vaza detalhe interno para o cliente** (mensagem de exceção,
   caminho, linha). Existe para o painel mostrar o erro real ao operador durante
   o evento. Em produção pública é vazamento de informação.

### Médio

6. **O banco SQLite fica, por padrão, dentro do docroot**
   (`public/api/data/10cbbp.db`) — ou seja, dentro da pasta que o servidor web
   publica. Ele contém nome, e-mail, telefone, plano de saúde, contato de
   emergência e pagamentos de todo mundo.

   O repositório traz um `public/api/data/.htaccess` com `Require all denied`,
   que impede o download por URL — **mas `.htaccess` é um recurso do Apache.**
   Em nginx, Caddy, LiteSpeed ou no servidor embutido do PHP ele é simplesmente
   ignorado, e um `GET /api/data/10cbbp.db` baixa o banco inteiro. Mesmo no
   Apache, ele só vale se `AllowOverride` estiver habilitado para o diretório.

   **A defesa que funciona em qualquer servidor é tirar o arquivo do docroot.**
   Defina `DB_PATH` em `public/api/env.php` apontando para uma pasta acima da
   pasta pública:

   ```php
   define('DB_PATH', __DIR__ . '/../../../dados-bikepolo/10cbbp.db');
   ```

   A pasta precisa existir e ser gravável pelo usuário do PHP. Se você já tem um
   banco rodando, **mova o arquivo** (e os `.db-wal` / `.db-shm`, se houver)
   antes de trocar a constante.

   ### Como testar se você está exposto

   Com o site no ar, rode:

   ```bash
   curl -sI https://SEU-DOMINIO/api/data/10cbbp.db | head -1
   ```

   - `HTTP/... 403` ou `404` → protegido.
   - `HTTP/... 200` → **o banco está público agora.** Pare tudo, mova o arquivo
     para fora do docroot e teste de novo.

   Faça esse teste **toda vez que trocar de servidor ou de hospedagem**.

7. **Enumeração de e-mail.** `/api/check-email.php` responde publicamente se um
   e-mail já tem inscrição. É proposital (avisar a pessoa antes de duplicar a
   inscrição), mas permite testar se alguém participou do evento.

8. **CORS público com `Access-Control-Allow-Origin: *`** nos endpoints não-admin
   (`corsHeaders()` em `db.php`). Eles são de leitura pública ou exigem token no
   header, então o impacto é baixo — mas é um `*` largo demais.

9. **Sem antivírus/reprocessamento nos uploads de imagem.** A validação é: MIME
   real via `finfo`, extensão derivada do MIME (nunca do nome enviado),
   dimensões máximas 4000×4000, tamanho máximo 3 MB, nome de arquivo derivado do
   ID interno. Isso barra path traversal e arquivo disfarçado. Não barra uma
   imagem válida que também explore uma falha de decoder. Os `.htaccess` das
   pastas de upload negam execução de PHP como defesa em profundidade.

10. **Sem cabeçalhos de segurança** (CSP, `X-Content-Type-Options`,
    `Referrer-Policy`, HSTS). Configure no servidor web.

### Baixo / dívida

11. **Dois sistemas de sessão convivendo** (`X-Session-Token` legado e cookie
    `cb_session`). Funciona, mas é superfície duplicada.

12. **Simulação e reset ficam no mesmo painel da operação real.** "Zerar
    resultados" apaga todos os jogos, eventos e fases geradas de um torneio, sem
    confirmação por digitação. Não existe mais um modo sandbox separado.

13. **Sem 2FA em lugar nenhum.**

---

## Dados pessoais

O banco de produção contém, por pessoa inscrita: nome, e-mail, telefone,
gênero, cidade, contato de emergência, plano de saúde e número de carteirinha,
restrição alimentar, histórico de pagamentos e saldo de carteira.

Isso é dado sensível sob a LGPD. Consequências práticas:

- **Nunca commite o banco.** `.gitignore` cobre `*.db`, `*.sqlite`, `*.bkp` e a
  pasta `public/api/data/` inteira. Confira antes de cada push.
- **Nunca commite exports.** `*.csv`, `*.xls` e `*.xlsx` estão ignorados; o
  painel gera CSV com PII em `/api/admin/export.php`.
- **Nunca commite screenshots tirados contra a base real.** `test-artifacts/`
  está ignorado por isso. Os screenshots em `docs/screenshots/` foram gerados
  contra o seed de demonstração, com dados fictícios.
- Fotos de atleta ficam em `public/imgs/atletas/<id>/` e brasões em
  `public/imgs/times/<id>/`. Ambos ignorados pelo git. **Também precisam entrar
  no seu backup** — o `.db` sozinho não reconstrói o site.

---

## Permissões de arquivo

Princípio: o usuário do PHP precisa escrever no mínimo possível.

| Caminho                  | Precisa de escrita? | Sugestão                        |
|--------------------------|---------------------|---------------------------------|
| `public/api/data/`       | sim (SQLite + WAL)  | dono = usuário do PHP, `0750`   |
| `public/imgs/times/`     | sim (upload)        | dono = usuário do PHP, `0755`   |
| `public/imgs/atletas/`   | sim (upload)        | dono = usuário do PHP, `0755`   |
| `public/imgs/lojinha/`   | sim (upload)        | dono = usuário do PHP, `0755`   |
| `public/api/env.php`     | não                 | `0640`, dono do deploy          |
| resto do código          | não                 | `0644` / `0755` só leitura      |

**Não use `chmod 777`.** Se der erro de permissão, o problema é dono/grupo, não
o modo. O SQLite precisa escrever no **diretório** (arquivos `-wal` e `-shm`),
não só no `.db`.

---

## Backups

O que precisa entrar no backup, junto:

1. `public/api/data/10cbbp.db` (e os `-wal` / `-shm` se existirem, ou faça
   `sqlite3 10cbbp.db ".backup destino.db"` para um snapshot consistente)
2. `public/imgs/times/` e `public/imgs/atletas/` — brasões e fotos
3. `public/imgs/lojinha/` — fotos de produto
4. `public/api/env.php` — guardado com o mesmo cuidado de uma senha

Guarde os backups **fora do docroot**. Um `10cbbp.bkp` esquecido dentro de
`public/` é o banco inteiro baixável por URL.

---

## Webhooks

O webhook do Mercado Pago (`/api/webhook-mp.php` e
`/api/webhook-mp-lojinha.php`) valida a assinatura HMAC-SHA256 do header
`x-signature` contra `MP_WEBHOOK_SECRET`.

**Se `MP_WEBHOOK_SECRET` estiver vazio, a validação é pulada inteira.** O
endpoint então aceita qualquer POST — incluindo um forjado que aprove um
pagamento que nunca aconteceu. Configure o secret no painel do Mercado Pago em
*Suas integrações → Webhooks* e cole em `env.php`.

O webhook nunca confia no corpo da notificação para decidir valor ou status:
ele consulta a API do Mercado Pago pelo ID do pagamento. Isso é bom. Mas sem
assinatura, um atacante pode forçar essa consulta com IDs arbitrários.

---

## Dependências

```bash
npm audit
npm outdated
```

Não há CI configurado, nem Dependabot, nem lockfile de PHP (o backend não usa
Composer — é PHP puro sem dependências externas). Rode `npm audit` de vez em
quando, especialmente antes de um evento.

---

## Reportando uma vulnerabilidade

**Não há um canal privado de segurança dedicado.** Este é um projeto de
comunidade, mantido por quem joga bike polo nas horas vagas — não existe equipe
de resposta a incidentes, e prometer um e-mail que ninguém lê seria pior que
não prometer nada.

O caminho é **abrir uma issue aqui no repositório**, com um cuidado:

- **Descreva a classe do problema, não o exploit.** "O endpoint X não valida Y,
  o que permitiria Z" é útil. Um passo a passo funcional de extração, não —
  pode haver instância de outra pessoa no ar agora.
- Se precisar dar detalhes que não devem ser públicos, **diga isso na issue e
  peça um canal privado**. Alguém responde e a conversa continua por lá.
- Se a falha envolve **dados pessoais de um evento real que já aconteceu**,
  não abra issue pública: peça o contato privado primeiro, sem descrever o
  problema.

Se você mantém a sua própria instância deste sistema, considere colocar aqui um
endereço de contato seu — quem encontrar algo no *seu* deploy vai procurar por
este arquivo.

Não há programa de bug bounty. Isto é um projeto de comunidade, feito por
gente que joga bike polo.
