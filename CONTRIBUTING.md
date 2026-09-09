# Contribuindo

Este projeto nasceu para organizar um campeonato de bike polo. Se você chegou
aqui, provavelmente também joga, também organiza, ou está tentando fazer um
evento acontecer com pouca gente e pouco tempo. Bem-vinde.

Não existe processo corporativo aqui. Existem três coisas que a gente pede de
verdade, e o resto é conversa.

---

## As três regras que importam

### 1. Nunca commite dado de pessoa real

Nem por acidente, nem "só pra testar", nem num screenshot.

Antes de abrir um PR, confira que você não está incluindo:

- banco (`*.db`, `*.sqlite`, `*.bkp`) ou dumps
- `public/api/env.php` ou qualquer arquivo com credencial
- exports CSV/XLS do painel
- fotos de atleta (`public/imgs/atletas/`) ou brasões (`public/imgs/times/`)
- screenshots tirados contra uma base real — inclusive `test-artifacts/`
- e-mails, telefones ou nomes de gente de verdade em fixture de teste

O `.gitignore` cobre tudo isso, mas ele só protege quem não usa `git add -f`.

Se precisar de dados para testar, use `php scripts/db-seed-demo.php` — é
inteiramente fictício, de propósito. Fixtures novas seguem a mesma regra:
nomes inventados, e-mails em `example.com` (reservado pela RFC 2606).

### 2. Nunca commite credencial

Nem de teste, nem "que já foi trocada", nem comentada. Se uma credencial passar
num commit, considere que ela vazou e rotacione — o histórico do git é público
para sempre.

Variáveis novas de configuração entram em `public/api/env.example.php` com
valor vazio e um comentário explicando para que servem.

### 3. Não quebre o evento de quem já está usando

Se alguém está com o sistema no ar durante um campeonato, um PR que muda o
schema, renomeia uma rota ou muda o formato de uma resposta pode derrubar a
operação no meio de um jogo.

Mudanças de schema vão em `initSchema()` (`public/api/db.php`) como
`CREATE TABLE IF NOT EXISTS` ou como um `ALTER TABLE` idempotente na lista de
migrations — nunca como um `ALTER` destrutivo. Não há down migrations e não há
como reverter: pense duas vezes.

---

## Issues

Abra uma. Não precisa de template.

O que ajuda muito:

- **Bug:** o que você fez, o que esperava, o que aconteceu. Se der erro na API,
  o painel tem um botão de copiar detalhes no banner de erro — cole isso
  (**depois de conferir que não tem dado pessoal dentro**).
- **Ideia:** conte o problema operacional antes da solução. "Preciso saber
  quantas pessoas já pegaram o almoço do dia 6" é mais útil que "adicionar
  coluna X na tabela Y".
- **Formato esportivo novo:** descreva as regras completas — quantos times,
  quantas rodadas, como classifica, como desempata, o que acontece com número
  ímpar de times.

Se for uma falha de segurança, leia [SECURITY.md](SECURITY.md) antes de abrir
issue pública.

---

## Pull requests

```bash
git checkout -b minha-mudanca
# ... trabalhe ...
npm test           # vitest (frontend)
npm run test:php   # suíte PHP (motor esportivo, carteira, mídia, awards)
npm run build      # o build precisa passar
git push origin minha-mudanca
```

- Branch a partir de `main`.
- Um PR por assunto. PR gigante misturando refactor + feature + correção é
  difícil de revisar e mais difícil de reverter no meio de um evento.
- Descreva **o que muda para quem está operando**, não só o que mudou no código.
- Se mexeu no motor esportivo (`public/api/torneio/`), **escreva um teste**. É a
  parte do sistema onde um bug estraga um campeonato de verdade.

### Testes

```bash
npm run test:php   # 128 testes, SQLite em memória, sem tocar em nada real
npm test           # 52 testes de frontend
```

A suíte PHP roda contra `sqlite::memory:` e redireciona a raiz de mídia para um
diretório temporário — ela não toca no banco nem nas imagens da sua instalação.
Rode antes de abrir o PR.

`npm run lint` hoje reporta **19 erros pré-existentes**, quase todos
`react-hooks/set-state-in-effect` em telas do torneio. Não são seus. Se quiser
corrigir, faça num PR separado só disso — misturar isso com outra mudança
esconde o que realmente mudou.

---

## Estilo

Não há prettier, nem husky, nem hook de commit. O estilo é "pareça com o código
ao redor":

- **PHP:** funções soltas, sem classes (exceto exceptions), 4 espaços. Toda
  escrita passa por transaction. Nomes em português.
- **TypeScript/React:** function components, hooks, sem state manager. 2
  espaços, sem ponto e vírgula. Nomes em português no domínio, inglês nos
  utilitários genéricos.
- **Comentários:** o código existente comenta *por que*, não *o quê* — em
  português, explicando a decisão operacional por trás. Mantenha isso; é o que
  torna o sistema legível meses depois.
- **Mensagens de commit:** `tipo(escopo): descrição` em português
  (`fix(torneio): ...`, `feat(carteira): ...`). Não é obrigatório.

---

## O que a gente adoraria receber

Sem promessa de prazo, mas em ordem de utilidade:

- **Separar o software do 10º Brasileiro.** Hoje há bastante coisa hardcoded
  (ver a seção "Usando em outro campeonato" no README). Tornar nome do evento,
  datas, categorias e textos configuráveis ajudaria todo mundo.
- **Formatos esportivos novos.** O motor já separa formato de categoria
  (`public/api/torneio/formato.php`); adicionar um formato é adicionar uma
  entrada no catálogo e uma estratégia de geração de fase.
- **Traduções.** Está tudo em português. Bike polo é uma comunidade
  latino-americana e internacional.
- **Docker / docker-compose.** Não existe. Facilitaria muito a vida de quem
  quer só olhar.
- **CI.** Não existe. Um workflow rodando as duas suítes já seria um ganho.
- **Endurecer a autenticação admin** (múltiplos usuários, rate limit, CSRF
  token). Ver SECURITY.md.

---

## Comunidade

Bike polo é uma comunidade pequena, mista e bastante ciosa de ser um espaço
acolhedor. Esse cuidado vale aqui também.

Discussão técnica pode ser dura; com as pessoas, não. Machismo, racismo,
transfobia, LGBTfobia, capacitismo e xenofobia não têm espaço — nem em issue,
nem em PR, nem em comentário de código.

Se você discorda de uma decisão técnica, argumente pela decisão. Se você acha
que algo é vibe code mal feito: provavelmente é, está escrito no README, e um
PR é mais útil que um comentário.

---

## Licença

Ao contribuir, você concorda que sua contribuição é distribuída sob a
**Licença LATINHA (Liberdade Ainda que à Tardinha) v0.3.1**, a mesma do resto do
projeto — que é share-alike: o que sai daqui volta livre. Veja
[LICENSE](LICENSE).
