# Referência da API

Não é OpenAPI. É um mapa de o que existe, quem pode chamar e o que faz.

Todo endpoint é um arquivo PHP em `public/api/`. A URL é o caminho do arquivo:
`public/api/torneio-publico.php` → `GET /api/torneio-publico.php`.
Respostas são JSON. Erros vêm como `{"error": "mensagem"}` com status HTTP
apropriado; com `APP_DEBUG=true` ganham também um campo `debug`.

## Como a autorização funciona

| Nível | Como | Onde |
|---|---|---|
| **Público** | nenhuma | `corsHeaders()` com `Allow-Origin: *` |
| **Pessoa atleta** | header `X-Session-Token` (tabela `sessions`) | `me.php`, `awards.php`, serviços |
| **Carteira** | cookie `cb_session` + checagem de mesma origem | `carteira*.php` |
| **Admin** | sessão PHP (`$_SESSION['admin']`) + `adminGuard()` | tudo em `public/api/admin/` |
| **Webhook** | HMAC-SHA256 do header `x-signature` | `webhook-mp*.php` |

Endpoints admin também restringem `Origin` a uma allowlist (`APP_URL` +
localhost). Ver `adminOrigensPermitidas()` em `public/api/admin/middleware.php`.

Muitos endpoints usam um campo `action` (ou `acao`) no corpo JSON em vez de
verbos HTTP diferentes. É POST para tudo que escreve.

---

## Público — torneio

### `GET /api/torneio-publico.php`

O endpoint mais importante do sistema. Somente leitura, sem autenticação.
Serve a página pública do torneio, o telão e **todos os overlays de OBS**.

Parâmetros comuns: `categoria` (`misto` | `mtnb`, padrão `misto`),
`torneio_id` (opcional; sem ele pega o torneio mais recente da categoria),
`action`.

| `action` | Devolve |
|---|---|
| `resumo` *(padrão)* | Torneio, fases e critérios de desempate configurados |
| `classificacao` | Classificação com pontos, saldo, Buchholz, faltas, posição, e o texto do critério que decidiu cada posição |
| `jogos` | Todos os jogos com placar, status, fase, brasões |
| `eventos` | Gols e faltas recentes de uma partida |
| `destaque` | **Partida em foco**, resolvida no backend. É o que os overlays consomem |
| `broadcast` | Pacote agregado para transmissão: classificação + destaque + próximos + recentes |
| `artilharia` | Gols por atleta (só gols do tipo `normal`) |
| `fairplay` | Faltas por time |
| `faltas_individuais` | Faltas por atleta |
| `chaves` | Repescagem + Double Elimination com propagação resolvida |
| `podio` | 1º, 2º e 3º quando definidos |
| `time` | Um time com elenco elegível |
| `resultados` | Memória consolidada do campeonato (usado por `/torneio/resultados`) |

A escolha da partida em destaque é feita **só no backend**
(`resolverPartidaDestaque()`), nunca no frontend — assim telão, overlays e site
sempre mostram a mesma partida.

Colunas internas (`id`, `fase_id`, `torneio_id`) são removidas das respostas
públicas de jogo.

### `GET /api/equipes.php?torneio=brasileiro|mtnb`

Times e elencos, direto da base interna. `brasileiro` → categoria `misto`.

### `GET /api/poloperator.php?torneio=brasileiro|mtnb`

Proxy para a API pública do [Poloperator](https://poloperator.com), com cache em
disco de 180 s. **Legado**: o site público não usa mais isto — só o importador
de mídia do admin. Não é necessário para rodar o sistema.

---

## Público — configuração

### `GET /api/config-publica.php`

`{ "mp_public_key": "...", "pagamento_mock": false }`. Só o que pode ser lido
por qualquer pessoa. A chave pública do Mercado Pago vem daqui em vez de estar
hardcoded no bundle.

### `GET /api/cidades.php` · `GET /api/clubes.php`

Listas auxiliares do formulário de inscrição.

### `GET /api/check-email.php?email=...`

`{ "exists": bool }` — se o e-mail já tem inscrição ativa. Permite enumeração de
e-mail por design; ver SECURITY.md.

---

## Autenticação

### `POST /api/auth.php`

Login por código de e-mail, em dois passos.

```jsonc
// 1) pede o código
{ "email": "pessoa@example.com" }
// → { "sent": true, "code_dev": "123456" }   // code_dev só no modo dev

// 2) verifica
{ "email": "pessoa@example.com", "code": "123456" }
// → { "token": "...", "expires_at": "..." }
```

Código de 6 dígitos, hash bcrypt, validade 10 min, uso único.
Rate limit: 5 códigos por e-mail a cada 15 min (HTTP 429).
`code_dev` só é devolvido quando `RESEND_API_KEY` está no valor sentinela
`re_COLOQUE_SUA_CHAVE_AQUI` — o modo de desenvolvimento sem servidor de e-mail.

O token vai no header `X-Session-Token` das requisições seguintes.

### `GET /api/me.php` — requer `X-Session-Token`

Perfil completo: pessoa, inscrição, categorias, times, alimentação, alojamento,
pagamentos, e as flags de abertura dos serviços.

---

## Inscrições e serviços

| Endpoint | Método | Auth | O que faz |
|---|---|---|---|
| `/api/inscricoes.php` | POST | pública | Cria a inscrição inteira: pessoa, categorias, ações afirmativas, times, alimentação, alojamento, pagamento |
| `/api/times.php` | GET/POST | mista | Consulta time por código; entra em time existente |
| `/api/servicos/alimentacao.php` | GET/POST | sessão | Altera a seleção de alimentação (respeita `ALIMENTACAO_EDITAVEL_ATE`) |
| `/api/servicos/alojamento.php` | GET/POST | sessão | Idem alojamento. Dias já pagos ficam travados (`pagamento_id`) |
| `/api/pagamentos.php` | GET/POST | sessão ou `checkout_token` | Lista e cria pagamentos |

O valor total nunca é calculado pelo cliente: `atualizaValorTotal()` em
`db.php` recalcula no servidor, espelhando `src/inscricoes.config.ts`.

`POST /api/pagamentos.php` e `/api/lojinha.php` com `acao=simular_pago` quitam
pagamentos **sem cobrar nada**. Exigem `PAGAMENTO_MOCK=true` no `env.php`;
com o padrão (`false`) devolvem HTTP 403.

---

## Pagamentos — Mercado Pago

| Endpoint | Auth | O que faz |
|---|---|---|
| `POST /api/mp-payment.php` | sessão ou `checkout_token` | Cria pagamento Pix ou cartão da inscrição |
| `POST /api/mp-payment-lojinha.php` | `checkout_token` | Idem, para pedido da lojinha |
| `POST /api/webhook-mp.php` | HMAC | Notificação do MP: inscrições **e** recargas de carteira |
| `POST /api/webhook-mp-lojinha.php` | HMAC | Notificação do MP para a lojinha |

O webhook **nunca confia** no corpo da notificação: ele consulta
`GET /v1/payments/{id}` na API do Mercado Pago para descobrir status e valor
reais (`mercadoPagoBuscarPagamento()` em `mercadopago.php`).

Recargas de carteira usam `external_reference` no formato
`carteira_recarga:<id>:<nonce>` mais `metadata.origem = "carteira_recarga"`, e
o valor confirmado é comparado ao valor esperado antes de creditar. Uma recarga
já aprovada nunca credita duas vezes.

⚠️ Com `MP_WEBHOOK_SECRET` vazio, a verificação de assinatura é **pulada por
completo**.

---

## Carteira (cashless)

| Endpoint | Auth | O que faz |
|---|---|---|
| `POST /api/carteira-auth.php` | mesma origem | `solicitar` (magic link), `consumir`, `ponte_sessao`, `logout` |
| `GET/POST /api/carteira.php` | cookie `cb_session` | Saldo, movimentos, `criar_recarga` |
| `POST /api/carteira-pagamento.php` | cookie `cb_session` | Pagamento MP da recarga |
| `GET /api/carteira-recargas.php` | cookie `cb_session` | Status das recargas |

Magic link: token de 32 bytes, só o `sha256` vai ao banco, validade 15 min, uso
único, e pedir um novo invalida os anteriores. Rate limit 5/15 min.

Recarga: mínimo R$ 5,00, máximo R$ 1.000,00.

Todo valor financeiro da carteira é **inteiro em centavos**. Nada de float.

### Admin da carteira — `GET/POST /api/admin/carteira.php`

`acao=`: `produtos`, `carteiras`, `resolver_qr`, `vendas`, `resumo`,
`criar_carteira`, `salvar_produto`, `ajustar_estoque`, `vender`,
`estornar_venda`, `reembolsar`, `ajustar_saldo`, `zerar_operacao`.

`vender` exige um `request_id` (≥16 caracteres) e é **idempotente**: repetir o
mesmo `request_id` devolve a venda existente em vez de cobrar de novo. O saldo é
atualizado com compare-and-swap (`WHERE saldo_centavos = <anterior>`), então
duas vendas concorrentes não conseguem gastar o mesmo saldo.

---

## Admin — operação do evento

Todos exigem sessão admin. Todos em `public/api/admin/`.

| Endpoint | O que faz |
|---|---|
| `auth.php` | GET: status da sessão · POST: `login` / `logout` |
| `dashboard.php` | Contadores e resumo financeiro |
| `inscricoes.php` | Lista e filtra; `marcar_pago_manual`, `cancelar`, `reativar`, `marcar_reembolsado`, `add_observacao` |
| `times.php` | Times e elencos; `renomear`, `renomear_atleta`, `mover` |
| `midia.php` | `upload_logo_time`, `remover_logo_time`, `upload_foto_pessoa`, `remover_foto_pessoa` (multipart) |
| `financeiro.php` | Pagamentos; `update_status` |
| `checkin.php` | Presença, credenciamento, bike check, retirada de refeição |
| `alimentacao.php` | Contagem por dia e refeição |
| `alojamento.php` | Ocupação por dia |
| `lojinha-produtos.php` | CRUD de produtos (multipart para imagens) |
| `lojinha-pedidos.php` | `marcar_retirado`, `cancelar`, `marcar_pago_manual` |
| `lojinha-config.php` | Abre/fecha a loja |
| `configuracoes.php` | Preços (chave/valor em `configuracoes`) |
| `config-geral.php` | Liga/desliga inscrições, alojamento, alimentação |
| `observacoes.php` | Notas internas por inscrição |
| `export.php` | **CSV com PII** — `?tipo=inscricoes\|times\|alimentacao\|alojamento\|lojinha` |
| `awards.php` | Curadoria, abrir/encerrar votação, apuração, awards MTNB, `zerar_dados` |
| `carteira.php` | Ver acima |
| `poloperator-import.php` | Preview e importação de brasões/fotos do Poloperator |

---

## Admin — torneio

Em `public/api/admin/torneio/`.

| Endpoint | Método | O que faz |
|---|---|---|
| `torneio.php` | GET | Lista torneios, ou um com participantes, critérios e fases |
| `torneio.php` | POST | `criar_preset`, `zerar_resultados`, `salvar_criterios`, `fechar_classificacao`, `gerar_repescagem`, `gerar_double` |
| `swiss.php` | GET | **Sugere** o pareamento da rodada — sem efeito colateral |
| `swiss.php` | POST | **Confirma** o pareamento (persiste jogos + bye) |
| `equalizacao.php` | GET/POST | Sugere / confirma a fase de Equalização |
| `round-robin.php` | POST | Gera o todos contra todos (MTNB) |
| `jogos.php` | GET | Jogos com elenco para a súmula |
| `sumula.php` | POST | `gol`, `falta`, `remover_evento`, `recalcular_placar`, `atualizar_partida` |
| `estatisticas.php` | GET | Artilharia, fair play, faltas individuais |
| `audit.php` | GET | Log de auditoria + snapshots |
| `audit.php` | POST | **Desfazer** uma entrada (só `registrar_gol`, `registrar_falta`, `atualizar_partida`) |
| `simulador.php` | POST | `partida` ou `fase` — simula pelos mesmos caminhos da súmula |

### O padrão sugerir → confirmar

Nenhuma geração de fase acontece sozinha. O backend calcula uma **sugestão**
sem escrever nada, o admin revisa (e pode editar), e só então confirma. A
confirmação revalida no servidor: nenhum time pode aparecer duas vezes, e o time
do bye não pode estar pareado.

### Desfazer

`audit.php` só desfaz o que sabe reverter com segurança. Uma rodada confirmada
não é desfeita automaticamente — porque os resultados já podem ter propagado
para jogos dependentes da chave. Se você desfizer um resultado que já resolveu
dependências, o motivo registrado avisa quais códigos precisam de revisão
manual.

---

## Awards

| Endpoint | Auth | O que faz |
|---|---|---|
| `GET /api/awards.php` | `X-Session-Token` | Candidatos e os votos da pessoa |
| `POST /api/awards.php` | `X-Session-Token` | Salva os 4 votos (todos de uma vez) |
| `GET /api/admin/awards.php` | admin | Painel: curadoria, participação, apuração |
| `GET /api/admin/awards.php?view=projecao` | admin | Payload da tela de projeção |
| `POST /api/admin/awards.php` | admin | `curadoria`, `adicionar_todos_jesse`, `abrir`, `encerrar`, `zerar_dados`, `salvar_mtnb`, `excluir_mtnb` |

Categorias: `mvp`, `wow`, `revelacao`, `jesse`.
Eleitores e candidatos derivam sempre das inscrições ativas na categoria
`misto` — nunca de uma lista paralela. Ninguém vota em si (constraint no banco).
Voto é único por categoria (`UNIQUE(eleitor_pessoa_id, categoria)`).

**Voto individual nunca é público.** `/api/awards.php` devolve só os votos de
quem está autenticado; a apuração agregada e quem votou ficam apenas no painel
admin. As telas de projeção (`/overlays/awards/*`) consomem o endpoint **admin**
— por isso é preciso estar logado no admin, no mesmo navegador, antes de abrir a
tela de projeção.
