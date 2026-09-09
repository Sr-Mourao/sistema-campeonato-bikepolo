# Arquitetura

## Em uma frase

React SPA no navegador, PHP puro sem framework no servidor, SQLite num arquivo,
Apache servindo os dois. Sem build no backend, sem ORM, sem fila, sem cache,
sem Docker.

Isso não é minimalismo por elegância. É o que dava para hospedar numa
hospedagem compartilhada barata e manter no ar durante um campeonato.

```
navegador
   │
   ├── /            → index.html + bundle React (Vite)   ← roteamento no cliente
   └── /api/*.php   → PHP direto, um arquivo por endpoint
                          │
                          └── SQLite: public/api/data/10cbbp.db
```

---

## Decisões que explicam o resto do código

### Sem framework no backend

Cada endpoint é um arquivo PHP que faz `require` do que precisa, checa o método,
despacha por um campo `action` no corpo JSON e responde. Não há router, DI,
middleware stack nem controllers.

`public/api/db.php` é o núcleo compartilhado: conexão, schema, helpers de
resposta (`respond`, `respondError`, `getBody`, `corsHeaders`) e as regras de
preço. Quase todo endpoint começa com `require_once __DIR__ . '/db.php'`.

**Consequência:** é trivial ler um endpoint inteiro de cima a baixo. E é fácil
esquecer uma checagem de autorização, porque não há nada obrigando. Sempre
confira se um endpoint novo em `admin/` chama `adminGuard()`.

### Sem migrations

Não existe pasta `migrations/`. `initSchema()` (em `public/api/db.php`) é a
fonte única do schema e roda **em toda conexão**:

1. `CREATE TABLE IF NOT EXISTS` para as 41 tabelas
2. uma lista de `ALTER TABLE ... ADD COLUMN` dentro de `try/catch` — falham
   silenciosamente se a coluna já existe
3. backfills marcados por uma chave em `configuracoes`, para rodarem uma vez só

**Vantagens:** um clone novo cria o banco sozinho, sem passo extra; a suíte de
testes usa exatamente o mesmo schema da produção, sem duplicar `CREATE TABLE`.

**Desvantagens:** não há down migration, não há histórico versionado de schema,
e cada requisição paga o custo (pequeno) de reexecutar os `IF NOT EXISTS`.

`scripts/db-init.php` só chama `initSchema()` explicitamente, com mensagens de
erro melhores.

### Roteamento no cliente, sem biblioteca

`src/App.tsx` é uma cadeia de `if (path === '...')` sobre
`window.location.pathname`, com `useState` + `popstate`. Sem react-router.

O `.htaccess` em `public/` faz o fallback: se o arquivo não existe no disco,
serve `index.html` e o React resolve a rota.

Overlays e admin são carregados por `lazy()`, então a home não baixa o painel.

**Detalhe importante:** antes de qualquer render, `App.tsx` testa se o path é de
overlay e marca o documento como transparente. Sem isso, a Browser Source do OBS
piscaria branco enquanto o chunk carrega.

### O motor esportivo é a parte séria

`public/api/torneio/` é a única parte do sistema escrita com cuidado real, com
128 testes cobrindo. Faz sentido: um bug aqui estraga um campeonato de verdade,
na frente de todo mundo.

| Arquivo | Responsabilidade |
|---|---|
| `lib.php` | Motor canônico: classificação, critérios, Buchholz, artilharia, fair play, partida em destaque, auditoria, snapshots |
| `swiss.php` | Pareamento suíço — sugestão e confirmação |
| `round_robin.php` | Todos contra todos (circle method) |
| `bracket.php` | Equalização, Repescagem, Double Elimination, propagação |
| `sumula.php` | Ciclo de vida da partida, gols, faltas |
| `simulator.php` | Simulação, pelos mesmos caminhos da súmula |
| `resultados.php` | Consolidação final somente leitura |
| `formato.php` | Catálogo de formatos (categoria ≠ formato) |
| `ordem.php` | Ordem operacional da Double |
| `setup.php` | Presets e reset |

Quatro invariantes que o código inteiro respeita:

1. **Placar é derivado de eventos, nunca escrito direto.** Um gol registrado
   recalcula o placar (`recalcularPlacarDeEventos`). Isso garante que súmula,
   artilharia, fair play e classificação nunca discordem entre si — inclusive
   nas partidas simuladas, que chamam exatamente as mesmas funções.
2. **Eventos são soft-delete** (`removido = 1`), nunca `DELETE`. O histórico
   fica auditável.
3. **Bye não é partida.** Não soma J/V/E/D/GP/GC/SG/pontos/faltas, não gera
   estatística e não entra na lista de adversários para o Buchholz. É uma linha
   em `torneio_jogos` com `is_bye = 1`, só para o registro.
4. **Nada é gerado sozinho.** Toda geração de fase é `sugerir` (puro, sem efeito
   colateral) seguido de `confirmar` (persiste, dentro de transaction, com
   revalidação no servidor).

### Propagação da chave

Cada jogo pendente da Double guarda em `time_a_origem` / `time_b_origem` um JSON
descrevendo de onde o time vem:

```json
{"tipo": "jogo", "codigo": "QA", "resultado": "vencedor"}
{"tipo": "fixo", "time_id": 7}
```

`resolverPendencias()` varre os jogos com time nulo e preenche assim que o jogo
de origem encerra. Roda em ponto fixo (até 10 iterações) para resolver cadeias —
B3 depende de B1, que depende de QA e QB. É chamada sempre após encerrar uma
partida, e é idempotente.

`torneio_jogos.ordem` é a **fila operacional** de jogos, deliberadamente
independente da topologia visual da chave (ver `ordem.php`). A ordem em que os
jogos acontecem na quadra não é a ordem em que aparecem desenhados.

### Categoria ≠ formato

`categoria` (`misto` | `mtnb`) identifica a **inscrição**: em que a pessoa se
inscreveu, quanto pagou, de que time ela é.

`formato` (`misto_swiss_13` | `mtnb_round_robin_5`) identifica as **regras**:
como a primeira fase é gerada, se há repescagem, qual chave de Double usar.

Essa separação existe em `formato.php` justamente para permitir formatos novos
sem tocar em inscrição. Adicionar um formato é adicionar uma entrada no catálogo
e a estratégia de geração correspondente.

### Dinheiro é inteiro em centavos — na carteira

A carteira (`carteira_*`) usa `INTEGER` em centavos, com `CHECK` no banco
garantindo saldo não-negativo, e atualiza saldo por compare-and-swap:

```sql
UPDATE carteiras SET saldo_centavos = ? WHERE id = ? AND saldo_centavos = ?
```

Se o `rowCount()` não for 1, alguém alterou no meio: a operação aborta.
Vendas são idempotentes por `request_id`.

**As tabelas antigas (`pagamentos`, `inscricoes.valor_total`, `loj_pedidos`)
usam `REAL`**, porque vieram antes dessa decisão. É uma inconsistência real do
sistema. A carteira, que é a parte que movimenta dinheiro no balcão do bar em
tempo real, é a que foi feita direito.

### Mídia: banco guarda caminho, disco guarda arquivo

Nunca base64, nunca BLOB. `public/imgs/times/<id>/logo.webp` e
`public/imgs/atletas/<id>/foto.webp`.

O nome do arquivo é derivado do **ID interno + MIME real detectado** — nunca do
nome enviado pelo cliente. Isso elimina path traversal e upload disfarçado de
uma vez só.

`origem` (`manual` | `importado`) decide precedência: um upload manual do admin
nunca é sobrescrito por uma reimportação automática do Poloperator.

URLs saem com `?v=<timestamp>` (`urlComCacheBust`), então trocar a imagem sempre
muda a URL e nunca fica cache velho no navegador.

---

## Fluxo de dados do torneio

```
       inscrição                        operação                   público
  ─────────────────            ───────────────────────        ─────────────────

  pessoas                      admin cria torneio             torneio-publico.php
     │                         (preset + participantes)               │
  inscricoes ───┐                        │                            ├── site
     │          │              sugerir pareamento                     ├── telão
  inscricao_    │                        │                            └── overlays
  categorias    │              admin confirma                            (8 s)
                │                        │
  times ────────┤              torneio_fases + torneio_jogos
     │          │                        │
  membros_time ─┘              súmula: registrarGol / registrarFalta
                                         │
                               torneio_eventos_gol / _falta
                                         │
                               recalcularPlacarDeEventos
                                         │
                               atualizarPartida (encerra) → resolverPendencias
                                         │
                               calcularClassificacao (com critérios)
```

Times e atletas **não são duplicados** no módulo de torneio: `torneio_participantes`
aponta para `times`, e o elenco vem de `membros_time → inscricoes → pessoas`.
A inscrição é a fonte oficial de quem existe.

---

## Tabelas por domínio

**Identidade e inscrição** — `clubes`, `pessoas`, `inscricoes`,
`inscricao_categorias`, `times`, `membros_time`, `observacoes`, `checkins`

**Serviços e dinheiro** — `pagamentos`, `alimentacao`, `alojamento`,
`configuracoes`

**Autenticação** — `login_codes`, `sessions`, `carteira_magic_links`

**Torneio** — `torneios`, `torneio_criterios`, `torneio_participantes`,
`torneio_fases`, `torneio_jogos`, `torneio_eventos_gol`,
`torneio_eventos_falta`, `torneio_audit_log`, `torneio_snapshots`

**Carteira / bar** — `carteiras`, `carteira_recargas`, `carteira_produtos`,
`carteira_vendas`, `carteira_venda_itens`, `carteira_movimentos`,
`carteira_estoque_movimentos`

**Awards** — `awards_config`, `awards_candidatos`, `awards_votos`,
`awards_mtnb`, `awards_mtnb_vencedores`

**Lojinha** — `loj_produtos`, `loj_produto_imagens`, `loj_produto_tamanhos`,
`loj_pedidos`, `loj_pedido_itens`

O schema completo, comentado, está em `initSchema()` no
[`public/api/db.php`](../public/api/db.php).

---

## Frontend

```
src/
  App.tsx                roteador (cadeia de ifs sobre pathname)
  main.tsx               entrada
  site.config.ts         identidade e contatos da instância
  inscricoes.config.ts   valores e cálculo de preço (espelha o PHP)

  pages/                 páginas públicas + overlays
    torneio/             abas da página pública do torneio
  admin/                 painel administrativo
    torneio/             módulo de torneio do admin (7 abas)
    pages/               demais seções
  components/
    broadcast/           blocos de transmissão (placar, timeline, campeão)
    obs/                 overlays de OBS e previews
    overlays/            catálogo de overlays
    projection/          telas de projeção (pódio, awards)
    torneio/             componentes compartilhados do torneio
    equipes/ inscricoes/ atleta/
  hooks/
    useTournamentLive    polling de 8 s da partida em destaque
    useEventQueue        fila de eventos animados, com chave estável
  services/
    torneioPublico.ts    cliente tipado do endpoint público
  contexts/
    TournamentContext    categoria (misto|mtnb) — é o que faz as URLs
                         /torneio/mtnb/* reusarem as mesmas páginas
```

Sem gerenciador de estado. Sem react-query. `fetch` + `useState` + `useEffect`.

`src/inscricoes.config.ts` **duplica deliberadamente** a lógica de preço que
existe em `atualizaValorTotal()` no PHP — o frontend mostra o total enquanto a
pessoa preenche, o backend recalcula antes de cobrar. Se você mudar uma regra
de preço, **mude nos dois lugares**.

---

## O que não existe

Vale dizer explicitamente, para você não procurar:

- Docker / docker-compose
- CI/CD
- Composer (o backend não tem dependência externa; PHP puro)
- ORM ou query builder
- Sistema de migrations versionado
- Cache (Redis, memcached) — só um cache em disco de 180 s do Poloperator
- Fila / worker / cron
- WebSocket (a transmissão é polling de 8 s)
- Logging estruturado (só `error_log()`)
- Métricas ou APM
- Múltiplos usuários administrativos
