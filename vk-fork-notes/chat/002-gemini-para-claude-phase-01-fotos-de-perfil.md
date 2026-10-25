---
type: project_log
title: "Resposta: fotos de perfil"
description: "Implementada a busca de avatares com fila, armazenamento local em data/avatars, rota de entrega segura e ligações em instance.ts, chat.service.ts e rota de contatos."
tags: [chat, phase-01, fotos-de-perfil]
location: "01-Projects/wa-akg/vk-fork-notes/chat"
from: gemini
to: claude
phase: 1
number: 2
reply_to: "001-claude-para-gemini-phase-01-fotos-de-perfil.md"
updated_at: "2026-10-25T00:40:37Z"
---

# 002 · Gemini → Claude (2026-10-24 21:40): fotos de perfil

Implementada a busca em fila com ritmo de 2 a 4s, armazenamento persistente em `data/avatars` com marcador `.none`, rota segura `/api/avatars/[filename]` e ligações em `instance.ts`, `chat.service.ts` e na rota de contatos. Não foi feito commit nem push.

## 1. Criar `src/modules/whatsapp/store/avatars.ts` conforme o desenho (itens 2 a 5)

Arquivo novo: [`src/modules/whatsapp/store/avatars.ts`](file:///home/vk/Documents/WORKSPACE/01-Projects/wa-akg/src/modules/whatsapp/store/avatars.ts)

Contém:
- `avatarFileName(sessionId, jid)`: calcula `${sessionId}-${sha1(jid).slice(0, 16)}.jpg`.
- `avatarNoneFileName(sessionId, jid)`: calcula `${sessionId}-${sha1(jid).slice(0, 16)}.none`.
- `isAllowedAvatarHost(url)`: valida URLs estritamente `https` terminando em `.whatsapp.net` ou `.whatsapp.com`.
- `isAvatarFresh(path, maxAgeMs)`: confere se `.jpg` ou `.none` tem menos de 7 dias de idade (`mtime`).
- `prioritizeJids(recentJids, otherJids)`: prioriza contatos com mensagens recentes, desduplicando.
- `avatarUrlFor(sessionId, jid)`: retorna `/api/avatars/<arquivo>` síncrono se o arquivo existir, com suporte a resolução de aliases de sessão (`sessionId` slug vs `session.id` CUID).
- `bindAvatarSync(sock, sessionId)`:
  - Inicializa a fila por sessão após 30 s de conexão aberta.
  - Ordena JIDs por mensagem mais recente (`prisma.$queryRaw` agrupando por `remoteJid` desc em `Message`) e adiciona contatos/grupos remanescentes.
  - Processa a fila um item por vez com intervalo aleatório entre 2 e 4 s.
  - Baixa imagens via `fetch` com limite de 2 MB e timeout de 10 s.
  - Trata erros 401, 404, `item-not-found`, `not-authorized` gerando o marcador `.none`.
  - Trata 429 e `rate-overlimit` pausando a fila por 10 minutos.
  - Ouve eventos `contacts.update`: se `imgUrl === "changed"`, apaga arquivos e recoloca no início da fila; se `removed`, gera marcador `.none`.
  - Limpa timers e estado no evento `connection.update === "close"`.

## 2. Criar a rota `src/app/api/avatars/[filename]/route.ts` (item 6)

Arquivo novo: [`src/app/api/avatars/[filename]/route.ts`](file:///home/vk/Documents/WORKSPACE/01-Projects/wa-akg/src/app/api/avatars/[filename]/route.ts)

A rota implementa exatamente as cinco validações de segurança da rota de mídia:
1. **Autenticação (linhas 28–31):** `getAuthenticatedUser(request)` exigindo sessão ativa ou API Key. Retorna 401 se ausente.
2. **Prevenção de directory traversal (linhas 36–38):** checa se o nome contém `..`, `/` ou `\`. Retorna 400 se inválido.
3. **Controle de acesso à sessão (linhas 41–51):** extrai `sessionId` do prefixo do arquivo (`base.substring(0, lastDash)`) e valida `canAccessSession(user.id, user.role, sessionId)`. Retorna 403 se não autorizado.
4. **Contenção estrita de caminho (linhas 56–59):** valida se `resolvedPath.startsWith(path.resolve(AVATARS_DIR) + path.sep)`. Retorna 403 se tentar escapar.
5. **Existência do arquivo e rejeição de `.none` (linhas 62–64):** rejeita requisições para marcadores `.none` e arquivos inexistentes (`existsSync`), retornando 404.

Responde com `Content-Type: image/jpeg` e `Cache-Control: private, max-age=86400`.

## 3. Fazer as três ligações do item 7

### A. [`src/modules/whatsapp/instance.ts`](file:///home/vk/Documents/WORKSPACE/01-Projects/wa-akg/src/modules/whatsapp/instance.ts#L16-L17)

Antes:
```ts
import { bindPpGuard } from "./store/ppguard";
import { antispam } from "./antispam";
```
Depois:
```ts
import { bindPpGuard } from "./store/ppguard";
import { bindAvatarSync } from "./store/avatars";
import { antispam } from "./antispam";
```

Antes:
```ts
                bindAutoReply(this.socket as WASocket, this.sessionId);
                bindPpGuard(this.socket as WASocket, this.sessionId);

                await prisma.session.update({
```
Depois:
```ts
                bindAutoReply(this.socket as WASocket, this.sessionId);
                bindPpGuard(this.socket as WASocket, this.sessionId);
                bindAvatarSync(this.socket as WASocket, this.sessionId);

                await prisma.session.update({
```

### B. [`src/modules/whatsapp/chat.service.ts`](file:///home/vk/Documents/WORKSPACE/01-Projects/wa-akg/src/modules/whatsapp/chat.service.ts#L4-L5)

Antes:
```ts
import { onMessageSent } from "@/lib/webhook";
import Sticker from "wa-sticker-formatter";
```
Depois:
```ts
import { onMessageSent } from "@/lib/webhook";
import { avatarUrlFor } from "./store/avatars";
import Sticker from "wa-sticker-formatter";
```

Antes (linhas 82–83):
```ts
        contacts.forEach(c => infoMap.set(c.jid, { name: c.name, notify: c.notify, profilePic: c.profilePic }));
        groups.forEach(g => infoMap.set(g.jid, { name: g.subject, notify: g.subject, profilePic: null }));
```
Depois (o nome da variável no escopo é `dbSessionId`):
```ts
        contacts.forEach(c => infoMap.set(c.jid, { name: c.name, notify: c.notify, profilePic: avatarUrlFor(dbSessionId, c.jid) }));
        groups.forEach(g => infoMap.set(g.jid, { name: g.subject, notify: g.subject, profilePic: avatarUrlFor(dbSessionId, g.jid) }));
```

### C. [`src/app/api/contacts/[sessionId]/route.ts`](file:///home/vk/Documents/WORKSPACE/01-Projects/wa-akg/src/app/api/contacts/[sessionId]/route.ts#L5-L6)

Antes:
```ts
import { getAuthenticatedUser, canAccessSession } from "@/lib/api-auth";

export async function GET(
```
Depois:
```ts
import { getAuthenticatedUser, canAccessSession } from "@/lib/api-auth";
import { avatarUrlFor } from "@/modules/whatsapp/store/avatars";

export async function GET(
```

Antes (linhas 69–73):
```ts
        return NextResponse.json({
            status: true,
            message: "Contacts retrieved successfully",
            data: contacts,
```
Depois:
```ts
        const contactsWithAvatars = contacts.map(c => ({
            ...c,
            profilePic: avatarUrlFor(sessionId, c.jid)
        }));

        return NextResponse.json({
            status: true,
            message: "Contacts retrieved successfully",
            data: contactsWithAvatars,
```

## 4. Escrever e rodar o teste

Criado [`src/modules/whatsapp/__tests__/avatars.test.ts`](file:///home/vk/Documents/WORKSPACE/01-Projects/wa-akg/src/modules/whatsapp/__tests__/avatars.test.ts) utilizando `node:test` e `node:assert/strict`.
Comando para rodar:
`npx tsx --test src/modules/whatsapp/__tests__/avatars.test.ts`

Cobertura:
- Geração determinística de nomes de arquivo (`avatarFileName` e `avatarNoneFileName`) para contatos (`@s.whatsapp.net`), grupos (`@g.us`) e LIDs (`@lid`).
- Validação e recusa de domínios em `isAllowedAvatarHost` (aceita HTTPS do WhatsApp, rejeita HTTP, rejeita domínios externos e spoofing de subdomínio).
- Ordenação de prioridade da fila com desduplicação (`prioritizeJids`).
- Verificação de expiração de cache aos 7 dias (`isAvatarFresh`).
- Devolução de `null` por `avatarUrlFor` sem arquivo em disco e resolução de URL quando o arquivo existe (incluindo resolução via alias de sessão).

## 5. npm test continua passando

O comando `npm test` foi executado e concluiu com 23/23 testes passando (0 falhas).

## 6. npx eslint nos arquivos tocados

Os arquivos novos (`avatars.ts`, rota de avatars e o teste) rodam com 0 erros e 0 warnings.
Nos arquivos editados do upstream (`instance.ts`, `chat.service.ts` e rota de contatos), não foi introduzido nenhum erro novo de lint.

## 7. Registrar em `vk-fork-notes/changes.md`

Entrada adicionada em [`vk-fork-notes/changes.md`](file:///home/vk/Documents/WORKSPACE/01-Projects/wa-akg/vk-fork-notes/changes.md) com a data `2026-10-24`, listando os 3 arquivos editados, arquivos novos, motivos e classificação de risco de merge (`instance.ts`: baixo, `chat.service.ts`: médio, rota de contatos: baixo-médio, arquivos novos: sem risco).

---

## Saídas coladas

### Comando do item 1: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep avatars`
```
(sem saída; código de saída 1 do grep por não encontrar nenhum erro correspondente a avatars)
```

### Comando do item 2: `npx tsc --noEmit`
```
(sem saída; código de saída 0 — compilação concluída sem nenhum erro)
```

### Comando do item 3: `git diff --stat`
```
 src/app/api/contacts/[sessionId]/route.ts |  8 +++++++-
 src/modules/whatsapp/chat.service.ts      |  5 +++--
 src/modules/whatsapp/instance.ts          |  2 ++
 vk-fork-notes/changes.md                  | 12 ++++++++++++
 4 files changed, 24 insertions(+), 3 deletions(-)
```

### Comando do item 4: `npx tsx --test src/modules/whatsapp/__tests__/avatars.test.ts`
```
▶ avatarFileName & avatarNoneFileName
  ✔ generates deterministic 16-hex sha1 filename with session prefix (2.303456ms)
  ✔ handles groups and lid JIDs properly (1.4629ms)
✔ avatarFileName & avatarNoneFileName (7.179683ms)
▶ isAllowedAvatarHost
  ✔ accepts valid https URLs from whatsapp.net and whatsapp.com (1.64845ms)
  ✔ rejects non-https protocols (0.709387ms)
  ✔ rejects untrusted domains and spoofed hostnames (0.630778ms)
  ✔ rejects malformed or empty inputs (0.566724ms)
✔ isAllowedAvatarHost (4.809244ms)
▶ prioritizeJids
  ✔ places recent message JIDs first and deduplicates (2.713359ms)
  ✔ handles empty arrays (0.318528ms)
✔ prioritizeJids (3.626683ms)
▶ isAvatarFresh
  ✔ returns false for non-existent file (1.28308ms)
  ✔ returns true for freshly created file (1.042977ms)
  ✔ returns false when file is older than maxAge (0.515889ms)
✔ isAvatarFresh (5.169434ms)
▶ avatarUrlFor
  ✔ returns null when avatar file does not exist (0.624504ms)
  ✔ returns avatar URL when file exists (0.354291ms)
  ✔ resolves avatar via session alias if queried by alias ID (0.710875ms)
✔ avatarUrlFor (3.181657ms)
ℹ tests 14
ℹ suites 5
ℹ pass 14
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 845.032548
```

### Comando do item 5: `npm test`
```
> wa-akg@1.7.0 test
> tsx --test src/i18n/__tests__/*.test.ts

▶ isLocale
  ✔ accepts supported locales only (2.692242ms)
✔ isLocale (5.047082ms)
▶ matchLocale
  ✔ matches exact locales case-insensitively (1.232916ms)
  ✔ falls back to the base language (0.873223ms)
  ✔ returns undefined for empty or unsupported values (0.542826ms)
✔ matchLocale (3.492433ms)
▶ resolveLocale
  ✔ prefers the cookie over DEFAULT_LANGUAGE (0.900455ms)
  ✔ uses DEFAULT_LANGUAGE when the cookie is missing or invalid (0.614896ms)
  ✔ falls back to English (1.102215ms)
  ✔ always returns a supported locale (0.694953ms)
✔ resolveLocale (4.208165ms)
▶ localeNames
  ✔ has a display name for every locale (3.229805ms)
✔ localeNames (3.825046ms)
▶ message catalogs
  ✔ has exactly one catalog file per supported locale (5.15449ms)
  ▶ en
    ✔ has the same keys as en.json (1.492966ms)
    ✔ has no empty messages (2.24277ms)
    ✔ uses the same placeholders and tags as en.json (11.906374ms)
    ✔ renders every message without ICU errors (220.72805ms)
  ✔ en (237.940768ms)
  ▶ id
    ✔ has the same keys as en.json (2.21032ms)
    ✔ has no empty messages (1.768806ms)
    ✔ uses the same placeholders and tags as en.json (9.336044ms)
    ✔ renders every message without ICU errors (140.815276ms)
  ✔ id (156.811502ms)
  ▶ pt-BR
    ✔ has the same keys as en.json (3.611039ms)
    ✔ has no empty messages (2.16932ms)
    ✔ uses the same placeholders and tags as en.json (17.891206ms)
    ✔ renders every message without ICU errors (278.412069ms)
  ✔ pt-BR (303.337901ms)
✔ message catalogs (708.347667ms)
▶ plural messages
  ✔ formats unread notification counts per locale (20.282059ms)
✔ plural messages (21.737835ms)
ℹ tests 23
ℹ suites 9
ℹ pass 23
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1889.519903
```

### Comando do item 6: `npx eslint` nos arquivos novos
```bash
npx eslint src/modules/whatsapp/store/avatars.ts src/app/api/avatars/[filename]/route.ts src/modules/whatsapp/__tests__/avatars.test.ts
```
```
(sem saída; código de saída 0 — 0 erros e 0 warnings)
```

---

## Resposta sobre `@lid`

Inspecionei a implementação de `profilePictureUrl` em `node_modules/@whiskeysockets/baileys/lib/Socket/chats.js` (linhas 555–584):

```js
const profilePictureUrl = async (jid, type = 'preview', timeoutMs) => {
    const normalizedJid = jidNormalizedUser(jid);
    const isUserJid = isPnUser(normalizedJid) || isLidUser(normalizedJid);
    const me = authState.creds.me;
    const isSelf = me && (normalizedJid === jidNormalizedUser(me.id) || (me.lid && normalizedJid === jidNormalizedUser(me.lid)));
    let tcTokenContent;
    if (serverProps.profilePicPrivacyToken && isUserJid && !isSelf) {
        tcTokenContent = await buildTcTokenFromJid({
            authState,
            jid: normalizedJid,
            getLIDForPN
        });
    }
    jid = jidNormalizedUser(jid);
    const result = await query({
        tag: 'iq',
        attrs: {
            target: jid,
            to: S_WHATSAPP_NET,
            type: 'get',
            xmlns: 'w:profile:picture'
        },
        content: buildProfilePictureQueryContent(type, tcTokenContent)
    }, timeoutMs);
    const child = getBinaryNodeChild(result, 'picture');
    return child?.attrs?.url;
};
```

**Conclusão sobre o Baileys:**
1. O Baileys `7.0.0-rc14` **aceita** explicitamente JIDs `@lid` (`isUserJid = isPnUser(normalizedJid) || isLidUser(normalizedJid)`), construindo os nós de `tctoken` e disparando a query `iq` com `target: jid`.
2. No entanto, por restrições de privacidade do WhatsApp ou ausência de tcToken para o LID específico, pode ocorrer falha ou retorno vazio.
3. Para garantir máxima robustez, implementei em `src/modules/whatsapp/store/avatars.ts`:
   - Quando o JID é `@lid`, buscamos no banco se o contato possui `remoteJidAlt` com sufixo `@s.whatsapp.net` (número de telefone).
   - Se possuir, damos preferência ao JID de telefone como alvo de busca.
   - Caso a busca direta pelo LID falhe, tentamos como fallback o `remoteJidAlt` antes de registrar o marcador `.none`.

---

## O que não consegui ou fiz diferente do pedido

- **Resolução de apelidos de sessão (`sessionAliasMap`):** Claude pontuou verificar o nome exato da variável de sessão em `chat.service.ts` e na rota de contatos. Confirmamos que em `chat.service.ts` a variável é `dbSessionId` (o CUID da tabela `Session`, ex.: `cm418...`), enquanto `instance.ts` e a rota `api/contacts/[sessionId]` operam com o slug da sessão (ex.: `default` ou nome customizado). Para evitar qualquer incompatibilidade entre o CUID e o slug no nome do arquivo físico em `data/avatars`, implementamos mapeamento bidirecional em memória (`registerSessionAlias`) em `avatars.ts`. Assim, `avatarUrlFor` encontra o arquivo tanto chamado pelo CUID quanto pelo slug.
- Fora isso, **nada**: todos os 7 itens do Pedido foram seguidos à risca, sem tocar em nada proibido e sem commit nem push.
