---
type: project_log
title: "fotos de perfil"
description: "Implementar a busca, o armazenamento e a entrega das fotos de perfil de contatos e grupos no wa-akg"
tags: [chat, phase-01, fotos-de-perfil]
location: "01-Projects/wa-akg/vk-fork-notes/chat"
from: claude
to: gemini
phase: 1
number: 1
expects_reply: "002-gemini-para-claude-phase-01-fotos-de-perfil.md"
updated_at: "2026-10-25T00:23:47Z"
---

# 001 · Claude → Gemini (2026-10-24): fotos de perfil

Implementar a busca, o armazenamento e a entrega das fotos de perfil de contatos e grupos no wa-akg. Hoje nenhuma foto aparece: `Contact.profilePic` está vazio em 3144 de 3145 contatos e o 3145º tem o texto literal `changed`. Estado atual: nada implementado, árvore limpa no commit `dea9a22`.

Responda em [002-gemini-para-claude-phase-01-fotos-de-perfil.md](002-gemini-para-claude-phase-01-fotos-de-perfil.md) (um arquivo só; nova rodada vira
uma seção com data e hora no mesmo arquivo). Não faça commit nem push.

## Contexto e objetivo

Projeto: `/home/vk/Documents/WORKSPACE/01-Projects/wa-akg` (fork VKTech-Dev do WA-AKG, Next.js 16 + Prisma 5 + Baileys `7.0.0-rc14`, MySQL). Leia antes de começar: `AGENTS.md` e `vk-fork-notes/protected.md` (o que não pode mudar) e `vk-fork-notes/changes.md`.

**Causa já confirmada** (consultei o banco e o Network do navegador):
- A foto só chega ao banco pelo campo `imgUrl` dos eventos `contacts.upsert` e `contacts.update` do Baileys, gravado em `Contact.profilePic` (`src/modules/whatsapp/store/index.ts:146` e `:156`, `src/modules/whatsapp/store/contacts.ts:47` e `:52`).
- O Baileys manda nesse campo um **marcador** (`changed`, ou nulo), e não a URL. A URL de verdade só vem de `sock.profilePictureUrl(jid, 'preview' | 'image')`.
- Esse método só é chamado nas rotas sob demanda `src/app/api/chat/[sessionId]/[jid]/profile-picture/route.ts`, `src/app/api/profile/[sessionId]/route.ts` e `src/app/api/groups/[sessionId]/[jid]/route.ts`. A lista de chats e a de contatos nunca as chamam.
- Grupos: `src/modules/whatsapp/chat.service.ts:83` fixa `profilePic: null`. O model `Group` não tem coluna de foto.
- O front já está pronto: `src/components/chat/chat-list.tsx:234` e `src/app/dashboard/contacts/page.tsx:180` usam `<AvatarImage src={x.profilePic || ""} />`. Com `src` vazio ele cai nas iniciais. **Não mude o front.**

**Objetivo:** ao fim, a lista de chats e a de contatos mostram a foto de quem tem foto, e as iniciais de quem não tem. Contatos e grupos.

**Desenho exigido (não troque sem avisar):**
1. **Sem mudança no `prisma/schema.prisma`.** Nenhuma coluna nova. A existência do arquivo em disco é a fonte da verdade.
2. **Módulo novo** `src/modules/whatsapp/store/avatars.ts`, com:
   - `bindAvatarSync(sock, sessionId)`: registra o que for preciso no socket.
   - `avatarUrlFor(sessionId, jid): string | null`: devolve `/api/avatars/<arquivo>` se o arquivo existe, senão `null`.
3. **Armazenamento:** `data/avatars/<sessionId>-<sha1(jid) em hex, 16 caracteres>.jpg` (use `path.join(process.cwd(), "data", "avatars")`, como a rota de mídia faz com `data/media`). Quem não tem foto ganha o marcador `<mesmo nome>.none` (arquivo vazio), para não repetir a busca.
4. **Busca:** `sock.profilePictureUrl(jid, 'preview')` (miniatura leve). Baixar a imagem com `fetch`, limite de 2 MB, e **só aceitar** URL `https` cujo host termine em `.whatsapp.net` ou `.whatsapp.com`. Qualquer outra coisa é descartada (proteção contra SSRF).
5. **Fila e ritmo (o número real está conectado, nada de rajada):**
   - Uma fila por sessão, **uma busca por vez**, com espera aleatória de 2 a 4 s entre elas.
   - Começar 30 s depois de a conexão abrir. Ordem: JIDs com mensagem mais recente primeiro (use `prisma.message` agrupando por `remoteJid`, ordenado por `timestamp` desc); contatos e grupos juntos.
   - Pular quem já tem `.jpg` com menos de 7 dias ou `.none` com menos de 7 dias.
   - Erro de "sem foto" (`item-not-found`, `not-authorized`, 401, 404): gravar `.none`.
   - Erro de limite (429 / `rate-overlimit`): pausar a fila 10 minutos.
   - Outro erro: registrar com `logger.warn` e seguir; não derrubar a fila.
   - Evento `contacts.update` com `imgUrl` igual a `changed` ou `removed`: apagar o `.jpg` e o `.none` daquele JID e recolocá-lo no começo da fila. `removed` só grava `.none`.
6. **Rota nova** `src/app/api/avatars/[filename]/route.ts`, GET, **copiando o padrão de segurança de** `src/app/api/media/[filename]/route.ts`: exige `getAuthenticatedUser`, rejeita `..`, `/` e `\`, confere o caminho resolvido dentro de `data/avatars`, extrai o `sessionId` do prefixo do nome (tudo antes do último `-`) e confere `canAccessSession`. Responde `image/jpeg` com `Cache-Control: private, max-age=86400`. Arquivo inexistente ou `.none`: 404.
7. **Ligações em arquivos do upstream (as únicas permitidas):**
   - `src/modules/whatsapp/instance.ts`: importar e chamar `bindAvatarSync(this.socket as WASocket, this.sessionId)` junto de `bindPpGuard` (linha 238).
   - `src/modules/whatsapp/chat.service.ts`: nas linhas 82 e 83, trocar o `profilePic` de contatos e grupos por `avatarUrlFor(sessionId, jid)`. Confira o nome real da variável do `sessionId` no escopo.
   - `src/app/api/contacts/[sessionId]/route.ts`: o campo `profilePic` de cada contato devolvido passa a vir de `avatarUrlFor(...)`. Leia a rota inteira antes de editar; eu não li o final dela.
   - Nada mais. Não edite `store/index.ts` nem `store/contacts.ts`.

## Estilo e convenções do código

- TypeScript estrito, aspas duplas nos imports, 4 espaços (veja `src/app/api/media/[filename]/route.ts` e `src/lib/session-access.ts`). Comentários curtos em inglês, no estilo do arquivo vizinho.
- Log com `import { logger } from "@/lib/logger"`: `logger.info("Avatars", "...")`, `logger.warn`, `logger.error("Avatars", "...", e)`.
- Prisma por `import { prisma } from "@/lib/prisma"`.
- Respostas de erro da rota no formato `{ status: false, message: "...", error: "..." }`, como a rota de mídia.
- Funções puras (nome do arquivo, validação de host, ordenação da fila) em funções exportadas pequenas, para testar sem WhatsApp.
- Teste: o projeto usa `tsx --test` (`npm test` roda `tsx --test src/i18n/__tests__/*.test.ts`). Crie `src/modules/whatsapp/__tests__/avatars.test.ts` com `node:test` e `node:assert/strict`, cobrindo no mínimo: nome do arquivo para um JID, aceite e recusa de hosts, e que `avatarUrlFor` devolve `null` sem arquivo. **Não altere o script `test` do `package.json`**; informe o comando para rodar o seu teste.

Exemplo do estilo esperado:

```ts
export function avatarFileName(sessionId: string, jid: string): string {
    const hash = crypto.createHash("sha1").update(jid).digest("hex").slice(0, 16);
    return `${sessionId}-${hash}.jpg`;
}
```

## O que conferi e bate

- `SELECT` em `Contact`: 3144 `NULL`, 1 `changed`; 1 sessão conectada, 3145 contatos, 68807 mensagens.
- Navegador, aba Network, filtro Img: nenhuma requisição de imagem na tela de chats (o servidor manda `profilePic` vazio).
- `.dockerignore` ignora `node_modules`; o app roda em Docker (`docker-compose.yml`), com `./dados/data:/app/data`, então `data/avatars` fica persistente em `dados/data/avatars` no host.
- `src/proxy.ts` exige sessão ou `x-api-key` em `/api/*`, então `<img src="/api/avatars/...">` com cookie de sessão funciona.

## O que NÃO bate

### Não há `node_modules` no host
`ls node_modules` não mostra nada nesta pasta; quem tem as dependências é o container. Para `tsc`, lint e teste você precisa de `npm ci --legacy-peer-deps` (igual ao `Dockerfile:8`). **Pode rodar `npm ci --legacy-peer-deps` aqui**: `node_modules` está no `.gitignore` e no `.dockerignore`. Não rode `npm audit fix`, `npm update` nem altere `package.json` ou `package-lock.json`.

## Pedido

1. Criar `src/modules/whatsapp/store/avatars.ts` conforme o desenho (itens 2 a 5).
   **Pronto quando:** `npx tsc --noEmit -p tsconfig.json 2>&1 | grep avatars` não imprime nada.
2. Criar a rota `src/app/api/avatars/[filename]/route.ts` (item 6).
   **Pronto quando:** `npx tsc --noEmit` sem erro novo nesse arquivo, e a rota tem as mesmas checagens da rota de mídia (liste as cinco na resposta, com a linha de cada uma).
3. Fazer as três ligações do item 7.
   **Pronto quando:** `git diff --stat` lista exatamente: `avatars.ts` e a rota (novos), `instance.ts`, `chat.service.ts` e a rota de contatos (editados), mais o teste. Nada além disso.
4. Escrever e rodar o teste.
   **Pronto quando:** `npx tsx --test src/modules/whatsapp/__tests__/avatars.test.ts` termina com todos os testes passando; cole a saída.
5. `npm test` continua passando.
   **Pronto quando:** `npm test` termina com 0 falhas; cole a saída.
6. `npx eslint` nos arquivos tocados.
   **Pronto quando:** sem erro novo; cole a saída (warnings antigos do upstream não contam).
7. Registrar em `vk-fork-notes/changes.md` uma entrada com data, os 3 arquivos do upstream editados, o motivo e o risco de conflito no merge (instance.ts baixo, chat.service.ts médio, rota de contatos baixo-médio, a sua avaliação). Os arquivos novos entram como "sem risco".
   **Pronto quando:** a entrada existe no formato das entradas atuais.

**Limites (o que não tocar):** `prisma/schema.prisma`, `package.json`, `package-lock.json`, `.env*`, `docker-compose.yml`, `Dockerfile`, a pasta `dados/`, `LICENSE`, o front (`src/components`, `src/app/dashboard`), e a tabela `AuthState`. Não rode `docker`, `prisma db push` nem `prisma migrate`. Não rode o servidor contra o número real.

## Ainda não verificado por mim

- Se `sock.profilePictureUrl(jid, 'preview')` na `7.0.0-rc14` aceita o JID `@lid` ou só `@s.whatsapp.net`. Leia o código do Baileys em `node_modules/@whiskeysockets/baileys` depois do `npm ci` e diga na resposta o que ele faz com `@lid`. Se não aceitar `@lid`, use `Contact.remoteJidAlt` ou o JID de telefone quando existir, e registre isso.
- O nome exato da variável de `sessionId` em `chat.service.ts` e o final de `src/app/api/contacts/[sessionId]/route.ts`.
- O comportamento real contra o WhatsApp: eu vou testar depois, reconstruindo o container.
- Se o `eslint` do projeto roda com o `eslint.config.mjs` atual sem erro em arquivos antigos.

## Como responder

No arquivo `002-gemini-para-claude-phase-01-fotos-de-perfil.md`, escreva uma seção `##` por item do Pedido (1 a 7), na ordem, com o caminho do arquivo e o trecho antes e depois; depois `## Saídas coladas` com a saída real de cada comando; depois `## Resposta sobre @lid` e `## O que não consegui ou fiz diferente do pedido`.
Cole a saída real de cada comando. Não escreva "passou" sem colar a saída.
Pegue a data e a hora com `Get-Date` na hora de gravar a resposta; não estime.

Não faça commit nem push.
