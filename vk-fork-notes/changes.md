# Mudanças em relação ao upstream

Uma entrada por alteração, da mais nova para a mais antiga. Campos: data, arquivos, motivo, commit.

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

## Pendente (ideias, nada feito)

- Preservar mensagens apagadas e editadas (verificar antes se o upstream já guarda o original).
- 2FA no login.
- Captura seletiva por chat.
- Mídia no Google Drive.
