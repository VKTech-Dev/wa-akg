# Spec: levar a maquete para o sistema real

Estado: **4 telas desenhadas na maquete (Lote 1)**. A maquete manda no desenho; o `src/` manda em tudo que já existe. Só implemente quando o usuário pedir, e siga `AGENTS.md` do projeto (`vk-fork-notes/protected.md` primeiro; mudança em arquivo do upstream entra em `vk-fork-notes/changes.md`).

Convenção: **Existe** é o que o código atual já tem (verificado lendo `src/`). **Falta** é o que precisa ser criado. **Proposta** precisa de aprovação. **Não confirmado** é o que não deu para verificar. Valores, nomes e números da maquete são fictícios.

## 1. O que mudou na maquete

| Mudança | Arquivos na maquete | Arquivo real equivalente |
|---|---|---|
| Tela de autenticação / login com glass-panel e orbes | `login.html` | `src/app/auth/login/page.tsx` |
| Painel com métricas, ações rápidas e sessões ativas | `dashboard.html` | `src/app/dashboard/page.tsx` |
| Interface de conversas com lista, filtros e janela WhatsApp | `chat.html` | `src/app/dashboard/chat/page.tsx`, `src/components/chat/chat-layout-client.tsx`, `src/components/chat/chat-list.tsx`, `src/components/chat/chat-window.tsx` |
| Tabela de contatos com busca, paginação e LIDs | `contatos.html` | `src/app/dashboard/contacts/page.tsx` |

## 2. Decisões já tomadas pelo usuário

- Maquete só de front-end (HTML + Tailwind 4 compilado via browser), com dados fictícios.
- Tema escuro é o padrão (`.dark`); as bolhas do chat seguem o estilo do WhatsApp (variáveis `--wa-*`).
- Uma linha por pessoa na tabela de contatos; formato `~pushname` quando o notify difere do nome.
- Cores e tokens semânticos do sistema (`bg-background`, `bg-card`, `bg-sidebar`, `text-muted-foreground`, etc.).

## 3. Telas

### 3.1 Login (`login.html`)
- **Existe** (`src/app/auth/login/page.tsx`):
  - Formulário com campos `email` e `password`, validação Zod e mensagens i18n (`auth.invalidEmail`, `auth.login.passwordRequired`).
  - Painel com efeito vidro (`glass-panel`), orbes de gradiente no fundo, logo com gradiente esmeralda para primary.
  - Alerta de erro de autenticação (`error`).
  - Botão de envio "Entrar" com ícone `ArrowRight` e estado de carregamento "Autenticando..." (`Loader2`).
  - Seletor de idioma (`LanguageSwitcher`) no topo direito.
  - Link "Criar uma conta" direcionando para `/auth/register`.
- **Mudou na maquete**:
  - Implementação em HTML + Tailwind puro sem React. Incluído botão de alternar tema no topo direito para teste visual de ambos os temas.
- **Falta**:
  - Nenhum item novo de backend. O endpoint NextAuth já existe e atende todos os requisitos.

### 3.2 Painel / Dashboard (`dashboard.html`)
- **Existe** (`src/app/dashboard/page.tsx`, `src/components/dashboard/sidebar-shell.tsx`, `sidebar-nav.tsx`, `navbar.tsx`):
  - Barra superior (Navbar): MobileNav, Relógio em tempo real, Seletor de Sessão ativa, Seletor de idioma, Alternador de tema, Popover de Notificações com sino e badge de não lidas.
  - Menu lateral (Sidebar): Grupos Principal, Mensagens, Contatos, Automação, Desenvolvedor, Administração; rodapé do usuário com avatar, nome, e-mail, botão sair e versão.
  - Grade de estatísticas (4 cartões): Total de Sessões (`QrCode`), Conectado (`Wifi`), Desconectado (`WifiOff`), Regras de Resposta Automática (`Zap`).
  - Ações Rápidas (4 cartões): Nova Sessão, Enviar Mensagem, Configurações do Bot, Monitor do Sistema.
  - Lista de Sessões Recentes: cabeçalho com link "Ver tudo →", cartões com nome, sessionId, badge de status (`CONNECTED` verde, `DISCONNECTED` vermelho, `SCAN_QR` amarelo) e estado vazio quando zero sessões.
- **Mudou na maquete**:
  - Dados estáticos fictícios com sessões de exemplo. Visual consistente com glass-panel e tokens semânticos.
- **Falta**:
  - Nenhum item novo de backend. Todas as estatísticas e sessões já são fornecidas pelo Prisma e pelos endpoints atuais.

### 3.3 Chat (`chat.html`)
- **Existe** (`src/app/dashboard/chat/page.tsx`, `src/components/chat/chat-layout-client.tsx`, `src/components/chat/chat-list.tsx`, `src/components/chat/chat-window.tsx`):
  - Painel duplo: lista de conversas à esquerda e janela da conversa à direita (no mobile, alterna com botão voltar).
  - Lista de conversas: busca de conversas, filtros "Todas" (`all`), "Conversas" (`private`), "Grupos" (`groups`), botão de nova conversa com input de telefone, dots coloridos de etiquetas, horário e prévia da última mensagem (texto ou tipo de mídia 📎).
  - Janela de conversa: cabeçalho com avatar, nome, JID e botão voltar (mobile); área de mensagens com fundo `.wa-chat`, pílulas de data `.wa-pill`, bolhas `.wa-bubble` (`wa-bubble-in` / `wa-bubble-out`) com rabinho `.wa-tail`; tiques de status (`PENDING` relógio, `SENT` um tique, `DELIVERED` dois tiques, `READ` dois tiques azuis `.wa-read`); exibição de citação (`wa-quote`); tipos de mídia (texto, imagem, áudio, figurinha, documento); links em azul (`wa-link`).
  - Barra inferior de envio: popover de anexo (imagem, vídeo, áudio, documento, interativo), atalho interativo, barra de citação/resposta ativa, textarea expansível e botão Enviar.
- **Mudou na maquete**:
  - Maquete estática demonstrando conversa aberta com mais de 10 mensagens abrangendo todos os 4 estados de tique, citação, imagem, link clicável, áudio, documento e figurinha. Mobile com visualização adaptada e botão voltar.
- **Falta**:
  - Nenhum item novo de backend. O backend do wa-akg e os componentes de socket/ações já possuem suporte a todos os tipos de mensagem e status mostrados.

### 3.4 Contatos (`contatos.html`)
- **Existe** (`src/app/dashboard/contacts/page.tsx`):
  - Cabeçalho com título "Contatos" e subtítulo explicativo.
  - Cartão com título "Lista de Contatos" e contador "Total: N contatos encontrados".
  - Barra de ferramentas com seletor de limite por página ("10 / página", "25 / página", etc.) e campo de busca com ícone de lupa.
  - Tabela com 4 colunas: Foto (`colImage`), Nome / Pushname (`colName`), JID (ID) (`colJid`), Telefone / Alt (`colPhone`).
  - Uma linha por pessoa: subtítulo com `~pushname` quando diferente do nome; selo de verificado `✓` em verde quando `verifiedName` presente; fallback para telefone quando sem nome; ícone de usuário quando sem foto.
  - Paginação: botões Anterior / Próximo e texto "Página 1 de N".
- **Mudou na maquete**:
  - 8+ contatos fictícios inventados com telefones no padrão `55119000000NN` e JIDs `@s.whatsapp.net` e `@lid`.
- **Falta**:
  - Nenhum item novo de backend. A rota `/api/contacts/[sessionId]` já entrega todos os campos e paginação.

## 4. Pontos do upstream a respeitar

- `src/components/chat/chat-window.tsx` já foi editado no fork (bolhas, links); mexer de novo aumenta o risco de conflito no merge.
- Textos novos entram nas três línguas (`src/i18n/messages/`), senão o teste de i18n falha.
- Componentes e classes devem utilizar os tokens de `globals.css` compilados em `app.css`.

## 5. Ordem sugerida de implementação

1. `src/app/auth/login/page.tsx` (revisão de estilo visual e classes glass-panel, sem impacto em APIs).
2. `src/app/dashboard/page.tsx` (ajustes visuais nos cartões de métricas e lista de sessões).
3. `src/app/dashboard/contacts/page.tsx` (ajustes finos de tabela, avatares e badges).
4. `src/components/chat/*` (aplicação das classes validadas na maquete para mensagens, cabeçalho e anexo).
