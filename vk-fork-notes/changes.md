# Mudanças em relação ao upstream

Uma entrada por alteração, da mais nova para a mais antiga. Campos: data, arquivos, motivo, commit.

## 2026-10-25 — Uma pessoa, uma identidade (telefone) em todas as telas

- Arquivos do upstream editados: `src/app/api/contacts/[sessionId]/route.ts` (esconde o `@lid` que tem gêmeo de telefone, busca também pelo nome do gêmeo, foto pela pessoa), `src/modules/whatsapp/chat.service.ts` (nome e foto da lista de conversas pela pessoa; risco de conflito médio), `src/app/api/labels/[sessionId]/chats/route.ts` (nome pela pessoa), `src/app/api/avatars/by-jid/[sessionId]/[jid]/route.ts` (foto por qualquer id da pessoa), `src/app/dashboard/contacts/page.tsx` (pushname como subtítulo, telefone formatado), `src/components/chat/linkify.tsx` e `whatsapp-theme.css` (link azul).
- Arquivos novos: `src/lib/contact-twins.ts` (`personJids`, `pickPersonName`, `personRows`, `hiddenTwinIds`, `twinPhonesMatching`, `avatarUrlForPerson`), `src/lib/__tests__/contact-twins.test.ts`.
- `lid-sync.ts` ganhou: telefones vindos dos participantes de grupos (`phoneNumber`, +497 `@lid`), refusão de nomes quando `contacts.update/upsert` chega depois (espera 3 s), e `consolidateByPhone`.
- `consolidateByPhone` move para o telefone tudo que estava sob um `@lid` de telefone conhecido: `Message.remoteJid`, `Message.senderJid`, `ChatLabel.chatJid`, `ScheduledMessage.jid`. A linha `@lid` do `Contact` continua, só como tradução. Roda a cada conexão e a cada `lid-mapping.update`; é idempotente.
- Simulação em transação desfeita antes de rodar de verdade: 1542 mensagens e 4590 remetentes movidos; chats distintos 486 -> 485; chats `@lid` 76 -> 0.
- Backup antes da primeira execução: `dados/backups/antes-unificar-lid-20261025-1213.sql` (Message, ChatLabel, ScheduledMessage, Contact; fora do git). Para desfazer, restaurar essas tabelas desse arquivo.
- Fora do alcance: 313 contatos sem nome em nenhuma tabela (64 `@lid`, 249 telefone) continuam sem nome; o WhatsApp não os entregou.
- Commit: pendente.

## 2026-10-25 — Modo escuro e bolhas no estilo WhatsApp

- Arquivos do upstream editados: `src/components/chat/chat-window.tsx` (classes das bolhas, data, citação, hora com tiques de status; removidos `overflow-hidden` e `max-w-3xl` da lista; risco de conflito médio-alto, pois mexe no bloco da mensagem), `src/app/layout.tsx` (1 import e 1 `<script>` no `<head>` que aplica o tema antes do primeiro desenho; baixo), `src/components/dashboard/navbar.tsx` e `mobile-nav.tsx` (1 import e 1 botão cada; baixo), `src/i18n/messages/{pt-BR,en,id}.json` (chave `theme.toggle`; baixo).
- Arquivos novos: `src/lib/theme.ts`, `src/lib/__tests__/theme.test.ts`, `src/components/theme-toggle.tsx`, `src/components/chat/whatsapp-theme.css`.
- Motivo: o CSS já tinha as cores `.dark`, mas nada ligava a classe, então o app ficava sempre claro. Agora o padrão é escuro, o botão sol/lua na barra alterna e a escolha fica no `localStorage` (`vk-theme`). As bolhas seguem o WhatsApp: verde à direita, cinza-escuro à esquerda, rabinho na primeira de cada sequência, hora com tiques (enviada, entregue, lida em azul) dentro da bolha. Todas as cores do chat ficam em variáveis `--wa-*` no CSS novo, para trocar num lugar só.
- Não verificado visualmente: só `tsc` e testes.
- Commit: pendente.

## 2026-10-25 — `.dockerignore` ignora dados de execução

- Arquivo do upstream editado: `.dockerignore` (linhas `dados` e `data`).
- Motivo: o contexto de build incluía `dados/mysql`, que pertence ao usuário do MySQL, e o build falhava com `permission denied` em `#innodb_redo`. Também reduz o contexto de 747 MB.
- Risco de conflito no merge: baixo.
- Commit: pendente.

## 2026-10-25 — Links clicáveis e nome/foto de canais (@newsletter)

- Arquivos do upstream editados: `src/components/chat/chat-window.tsx` (1 import e o texto da mensagem passa por `<Linkify>`, risco de conflito baixo), `src/modules/whatsapp/instance.ts` (1 import e 1 chamada `syncNewsletters`).
- Arquivos novos: `src/components/chat/linkify.tsx`, `src/components/chat/__tests__/linkify.test.ts`, `src/modules/whatsapp/store/newsletters.ts`, `src/modules/whatsapp/__tests__/newsletters.test.ts`.
- Motivo: o texto das mensagens era renderizado como string pura, então os links não clicavam. Canais nunca aparecem em `groupFetchAllParticipating` e `isFetchableJid` os exclui, então ficavam sem nome e sem foto. Agora `newsletterMetadata` grava o nome num `Contact` e a foto no mesmo armazém de avatares.
- Descoberto no primeiro rebuild: no Baileys rc14, `newsletterMetadata` devolve o objeto cru (`thread_metadata.name.text`, `thread_metadata.picture.direct_path`), não o formato parseado; `readNewsletterInfo` lê os dois. Não confirmado: o host exato da foto (`pps` ou `mmg.whatsapp.net`); o módulo tenta os dois.
- Grupos: 62 dos 68 grupos com mensagens têm nome. Os outros 6 não estão mais em `groupFetchAllParticipating` (saída do grupo, provavelmente: não confirmado), então o WhatsApp não entrega o nome. Dos grupos, 42 têm foto e 20 não têm foto no WhatsApp (marcador `.none`).
- Commit: pendente.

## 2026-10-25 — Vínculo LID ↔ telefone nos contatos

- Arquivos do upstream editados: `src/modules/whatsapp/instance.ts` (1 import e 1 chamada `bindLidSync` ao lado de `bindAvatarSync`), `src/app/dashboard/contacts/page.tsx` (a coluna Nome cai para o telefone antes de "Desconhecido").
- Arquivos novos: `src/modules/whatsapp/store/lid-sync.ts`, `src/modules/whatsapp/__tests__/lid-sync.test.ts`.
- Motivo: 2099 dos 3165 contatos são `@lid` e nenhum tinha `remoteJidAlt`, então a coluna "Telefone / Alt" vinha vazia e a busca por número não os achava. O Baileys já guarda o par LID↔telefone nas chaves `lid-mapping-*` da sessão (526 dos contatos `@lid` têm telefone conhecido). O módulo novo grava `remoteJidAlt` no `@lid` e `lid` no telefone (backfill na conexão e a cada `lid-mapping.update`) e completa só os nomes vazios de um lado com o do outro, sem sobrescrever.
- Também usa o vínculo `lid` já gravado nas linhas de telefone (694), o que leva o nome da agenda ao `@lid` que só tem nome mascarado (43 contatos hoje, p. ex. `117695156592675@lid`).
- Limite: contato `@lid` sem par no mapeamento continua sem telefone; o dado só chega quando o WhatsApp o entrega (mensagem do contato, por exemplo).
- Risco de conflito no merge: baixo (linhas isoladas).
- Commit: pendente.

## 2026-10-24 — Nome mascarado não sobrescreve o nome do contato

- Arquivos do upstream editados: `src/modules/whatsapp/store/contacts.ts` (3 linhas de `update.name`), `src/modules/whatsapp/store/index.ts` (1 linha em `contacts.upsert` mais 1 import).
- Arquivos novos: `src/modules/whatsapp/store/contact-names.ts`, `src/modules/whatsapp/__tests__/contact-names.test.ts`.
- Motivo: o WhatsApp manda `+55 ∙∙∙∙∙∙∙∙ 46` como nome de quem não está salvo no aparelho vinculado, e o `messaging-history.set` gravava isso por cima do nome da agenda (38 contatos afetados). Agora o valor mascarado é ignorado no `update`.
- Dados: em 2026-10-24 os 38 nomes foram restaurados a partir de `Contact.data.name` (UPDATE em transação, confirmada com 38 linhas). Restam 28 contatos mascarados que nunca tiveram nome real no banco.
- Risco de conflito no merge: baixo-médio nos dois arquivos (linhas isoladas dentro de blocos `update`).
- Commit: pendente.

## 2026-10-24 — Sincronização e entrega de fotos de perfil (avatars)

- Arquivos do upstream editados: `src/modules/whatsapp/instance.ts`, `src/modules/whatsapp/chat.service.ts`, `src/app/api/contacts/[sessionId]/route.ts`, `.gitignore` (linha `/data/avatars/*`, risco de conflito baixo), `src/components/chat/chat-window.tsx` (cabeçalho do chat mostra a foto via `AvatarImage`, 2 linhas, risco de conflito baixo-médio).
- Arquivos novos: `src/modules/whatsapp/store/avatars.ts`, `src/app/api/avatars/[filename]/route.ts`, `src/modules/whatsapp/__tests__/avatars.test.ts`, `src/app/api/avatars/by-jid/[sessionId]/[jid]/route.ts`.
- Motivo: busca sob demanda/fila, armazenamento local em `data/avatars` e entrega autenticada de fotos de perfil de contatos e grupos, populando `profilePic` na lista de chats e contatos.
- Commit: pendente (aguardando aprovação do usuário).
- Risco de conflito no merge:
  - `src/modules/whatsapp/instance.ts`: baixo (adição de import e chamada de `bindAvatarSync` junto aos outros hooks de inicialização).
  - `src/modules/whatsapp/chat.service.ts`: médio (substituição do valor estático de `profilePic` pelo resultado de `avatarUrlFor` na montagem do `infoMap`).
  - `src/app/api/contacts/[sessionId]/route.ts`: baixo-médio (mapeamento de `contacts` com `profilePic` vindo de `avatarUrlFor`).
  - Arquivos novos (`avatars.ts`, rota de avatars, teste): sem risco (inexistentes no upstream).

## 2026-10-24 — Compose no padrão de persistência local

- Arquivos: `docker-compose.yml`, `.env.example`, `.gitignore`.
- Motivo: aplicar `Rules/DOCKER.md` do cofre (bind mount em `./dados/`, `dados/` ignorado, portas em `127.0.0.1`).
- Commit: `39cff8b`.
- Risco de conflito no merge: alto em `docker-compose.yml`, médio em `.env.example`.

## 2026-10-24 — Criação desta pasta

- Arquivos novos: `vk-fork-notes/`, `AGENTS.md`.
- Motivo: registrar o histórico do fork.
- Risco de conflito: nenhum (arquivos inexistentes no upstream).

## 2026-10-25 — Mídia de grupo não era baixada

- Arquivos do upstream editados: `src/lib/webhook.ts` (`downloadAndSaveMedia` usa `findMediaMessageType` em vez de `Object.keys(...)[0]`, 3 linhas, risco de conflito baixo).
- Arquivos novos: `src/lib/media-type.ts`, `src/lib/__tests__/media-type.test.ts`.
- `.dockerignore`: linha `vk-fork-notes`. O `front-clone` (maquete do Gemini) estava entrando no `tsc` do `next build` e quebrava o build da imagem.
- Motivo: a função tratava a primeira chave do conteúdo como o tipo; quando `messageContextInfo` vem antes de `imageMessage`, saía sem tentar baixar e a mensagem ficava com `mediaUrl` nulo. Causa ainda a confirmar com mensagens novas após o rebuild. Mídia antiga sem URL não tem como ser recuperada (a chave da mídia não é guardada).
- Commit: pendente (aguardando aprovação do usuário).

## Pendente (ideias, nada feito)

- Preservar mensagens apagadas e editadas (verificar antes se o upstream já guarda o original).
- 2FA no login.
- Captura seletiva por chat.
- Mídia no Google Drive.
