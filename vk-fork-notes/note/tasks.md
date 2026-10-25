# Tarefas do fork wa-akg

Criado em 2026-10-24. Marque `[x]` ao concluir e registre a mudança em `../changes.md` quando tocar arquivo do upstream.
Itens com *(não confirmado)* vêm de leitura parcial do código: confira antes de agir.

## 1. Segurança (antes de conectar o número real)

- [ ] Copiar `.env.example` para `.env` e trocar todos os valores de exemplo. Não commitar o `.env`.
- [ ] Gerar `AUTH_SECRET` novo (mínimo 32 caracteres aleatórios).
- [ ] Definir `MYSQL_ROOT_PASSWORD` e `ADMIN_PASSWORD` fortes e únicos.
- [ ] Trocar `NEXT_PUBLIC_SWAGGER_USERNAME` e `NEXT_PUBLIC_SWAGGER_PASSWORD`. O compose tem padrão `admin` / `admin123`. Variável `NEXT_PUBLIC_*` pode ir para o JavaScript do navegador *(não confirmado: não achei onde o código as lê)*. Melhor desligar o Swagger (seção 2).
- [ ] Criar um usuário MySQL dedicado ao app, sem ser `root`. Hoje o app conecta como `root` (`DATABASE_URL` no `docker-compose.yml`).
- [ ] Remover a publicação da porta do MySQL no host (`127.0.0.1:${DB_PORT}:3306`), se você não usa cliente externo. O app fala com o banco pela rede do Docker.
- [ ] Manter todas as portas em `127.0.0.1` (já está assim no compose). Acesso de fora só por proxy reverso com HTTPS, decisão sua.
- [ ] Criar o primeiro usuário logo na subida: o primeiro cadastro vira `SUPERADMIN` (`src/app/api/auth/register/route.ts`). Depois confirmar `enableRegistration` desligado em `SystemConfig` *(não confirmado: valor padrão)*.
- [ ] Ligar 2FA no login (ver seção 4, vindo do zap-master). O wa-akg não tem 2FA *(não confirmado)*.
- [ ] Revisar chaves de API geradas (`x-api-key`): criar só as necessárias, com nome que diga o uso, e revogar o resto.
- [ ] Revisar webhooks cadastrados: só URLs que você controla. Webhook leva conteúdo de mensagem para fora.
- [ ] Cifrar ou proteger `dados/` (disco cifrado ou permissão `700`). Ali ficam o banco, as mídias e a sessão do WhatsApp (`AuthState`).
- [ ] Rotina de backup do banco e de `dados/`, com teste de restauração.
- [ ] Rodar `npm audit` e registrar o resultado. Avaliar as atualizações das dependências pendentes no upstream (Prisma, Baileys) antes de aplicar.
- [ ] Antes de qualquer commit: `git status` e conferir que `.env`, `dados/` e `uploads/` não estão no lote.

## 2. Funções a desabilitar

| Item | Como | Por quê |
|---|---|---|
| Telemetria | `ENABLE_TELEMETRY=false` no `.env` (e `DISABLE_TELEMETRY=true`) | Ping a cada 30 s para `api-wa-akg.aikeigroup.net` com nome, versão, plataforma e memória (`src/server/index.ts:105`). Ligado por padrão. |
| Swagger / docs da API | `NEXT_PUBLIC_SWAGGER_ENABLED=false` | Reduz superfície exposta. Reative só para consultar. |
| Verificação de atualização | `ENABLE_AUTO_UPDATE_CHECK=false` *(não confirmado: não achei onde o código lê a variável)* | A rota `src/app/api/system/check-updates/route.ts` consulta o repositório do autor. Conferir se a rota ainda roda e, se sim, apontar para este fork ou removê-la (registrar em `changes.md`). |
| Cadastro de novos usuários | Manter `enableRegistration` desligado | Uso pessoal, um usuário. |
| Indexação por buscadores | `NEXT_PUBLIC_ALLOW_INDEXING=false` (já é o padrão) | Manter. |
| Google Analytics | `NEXT_PUBLIC_GA_ID` vazio | Manter vazio. |
| remove.bg (figurinhas) | `REMOVE_BG_API_KEY` vazio | Envia a imagem para serviço externo (`command-handler.ts:283`). Só use se precisar. |
| Recursos experimentais | `ENABLE_EXPERIMENTAL_FEATURES=false` *(não confirmado: não achei uso no código)* | Manter desligado. |
| Auto-resposta, broadcast, comandos de bot | Não criar regras; desligar na sessão, se houver opção | Uso pessoal de leitura não precisa. Broadcast e auto-resposta aumentam o risco de banimento. |
| Envio pela API | Usar chave de API só de leitura, se o upstream permitir *(não confirmado)* | Começar em somente leitura, como no plano do zap-master. |

Observação: `ENABLE_RATE_LIMITING`, `ENABLE_NOTIFICATIONS`, `ENABLE_AUTO_UPDATE_CHECK` e `ENABLE_EXPERIMENTAL_FEATURES` aparecem no `.env.example`, mas não achei leitura delas em `src/`. Podem não ter efeito. Confirmar antes de confiar no limite de requisições.

- [ ] Aplicar todos os itens acima no `.env` e conferir (a telemetria deixa de aparecer no tráfego de saída).
- [ ] Varrer o código por outras chamadas externas além de telemetria, `check-updates` e remove.bg.
- [ ] Ajustar fuso e idioma: `TZ=America/Sao_Paulo`, `LOCALE=pt-BR`, `DEFAULT_LANGUAGE=pt-BR` (o exemplo vem com Jakarta e `id-ID`).

## 3. Verificações no código (antes de customizar)

- [ ] Descobrir se o wa-akg guarda o conteúdo original de mensagem apagada ou editada (`src/modules/whatsapp/store/index.ts`; `Message` não tem campo para isso).
- [ ] Descobrir o formato do `AuthState` e o que acontece se ele for perdido (novo QR?).
- [ ] Listar o que o dashboard envia ou lê de serviços externos.
- [ ] Escrever em `../protected.md` o que for descoberto.

## 4. Pendente trazido do zap-master (projeto pausado)

Fonte: `01-Projects/zap-master/specs/001-super-whatsapp-pessoal/` (`spec.md`, `tasks.md`, `pendencias-estrutura.md`). Em 2026-10-16 estavam feitas 180 de 226 tarefas. O zap-master parou sem ligar o número real. Nada abaixo foi implementado no wa-akg.

### Prioridade alta
- [ ] **Histórico com apagadas e editadas** (US1): manter o conteúdo original com marca "apagada" e as versões de cada edição. Implementar em tabela nova, sem mexer em `Message`.
- [ ] **Captura seletiva por chat** (US1): fila de "novos para revisar", modo piloto (nada é guardado até ligar a captura) e filtro que ignora Status e canais.
- [ ] **Somente leitura primeiro** (fase 8): conectar o número real sem enviar nada, medir histórico e memória, e só depois liberar envio. Regra do zap-master: nenhum código de envio antes disso. O wa-akg já envia, então desligar o envio para o início.
- [ ] **Conexão vigiada** (US4): aviso quando a sessão cair (e-mail ou Telegram) e QR para reconectar.
- [ ] **Backup diário** com restauração testada (US4).

### Prioridade média
- [ ] **Mídia no Google Drive** (US2): pasta `<usuário>/<número>/<chat>/<ano-mês>/`, mídia ligada por chat, regra de 3 dias para confirmar, figurinha fora. Depende de conta e credencial do Google Cloud.
- [ ] **Busca no histórico** por palavra e por pessoa, em todos os chats (US3).
- [ ] **Etiquetas** por contexto: Igreja, Trabalho, Pessoal (US3). O wa-akg já tem labels; verificar se bastam.
- [ ] **2FA** com app autenticador (US3).
- [ ] **Criptografia dos dados em repouso** (zap-master usava Fernet e `age`).
- [ ] **Limites anti-ban de envio**: espaço de 3 a 10 s entre mensagens e teto diário (US3). O broadcast do wa-akg usa 10 a 30 s.
- [ ] **Grupo de gastos vira planilha** (US5, P2).

### Prioridade baixa
- [ ] **Lembretes e agendamento** (US6): o wa-akg já tem agendador; verificar se atende.
- [ ] **Organização de trabalho** (US7).
- [ ] **Assistente de IA** (US8), por n8n ou serviço à parte, fora do núcleo.
- [ ] **Segunda pessoa e segundo número** (US9): o wa-akg já tem várias sessões.
- [ ] **Extras** (US10).

### Dependências de conta (não é código)
- [ ] Google Cloud e Drive (T013, T114 do zap-master).
- [ ] SMTP para e-mail de aviso (T014).
- [ ] Bot do Telegram (T015).
- [ ] App autenticador (T016).

### Lições que valem para o fork
- A API de `GET /api/sendText` do WAHA também enviava mensagem: no wa-akg, tratar toda rota que envia como "envio" na hora de bloquear.
- Teste com simulador antes do número real: o zap-master tinha um simulador do WAHA e travas que impedem tocar o banco real. Avaliar equivalente (banco e sessão de teste separados) no wa-akg.
- O compose do zap-master bloqueava `/api/webhook/` fora da rede Docker. Avaliar o mesmo para as rotas de webhook do wa-akg.

## 5. Organização

- [ ] Registrar em `../changes.md` cada item concluído que tocar arquivo do upstream.
- [ ] Rever esta lista quando uma atualização do upstream entrar (`../upstream-log.md`).

## 6. Verificação e importação (2026-10-24)

Detalhes em `verification.md` (achados de segurança do código) e `import-zap-master-agente-remoto.md` (o que veio do zap-master e do agente-remoto, dados da VPS Oracle).

- [ ] Decidir quem é o único dono da conexão do WhatsApp (wa-akg ou Hermes). Hoje o Hermes já está pareado ao número pessoal.
- [ ] Ligar `antiDelete` na sessão e criar tabela de versões de edição (a edição hoje sobrescreve o original).
- [ ] Guardar a chave de API como hash e criar chaves por finalidade.
- [ ] Criar usuário MySQL dedicado (hoje é `root`).
- [ ] Revisar o `exec` do `ffmpeg` em `command-handler.ts:257`.
- [ ] Confirmar se o app compila e roda em ARM64 antes de subir na Oracle.
- [ ] Conferir `docs/qr-code.key` no zap-master (não abri) antes de qualquer push.
- [ ] Fechar portas e regras de firewall da VPS (achados F0: 111, 6001, 6002, 8000, 8080, SSH aberto).

## 7. Lembretes para o dia de subir na VPS (decididos em 2026-10-24)

- [ ] **Dono da conexão do WhatsApp: o wa-akg.** Até subir na VPS nada muda: o Hermes continua pareado ao número pessoal. No dia de subir: (1) desligar o bridge de WhatsApp do Hermes (`WHATSAPP_ENABLED` no `.env` da VPS, sem ler os valores; reiniciar o gateway); (2) remover o aparelho "Hermes" em WhatsApp > Aparelhos conectados; (3) só então parear o número no wa-akg; (4) apontar o Hermes para a API e o webhook do wa-akg (T5 a T8 do `agente-remoto/whatsapp-plan.md`).
- [ ] **Decisão do usuário (2026-10-24): durante o teste local, o número fica pareado no wa-akg local e no Hermes (VPS) ao mesmo tempo.** Risco aceito por ele. Cuidados: (a) nenhuma auto-resposta, comando de bot nem webhook ativo no wa-akg que responda no mesmo chat em que o Hermes responde (o Hermes usa o self-chat "Mensagem para você"), para não gerar laço de respostas; (b) o wa-akg local começa sem envio; (c) **o mesmo QR/sessão do wa-akg nunca roda local e na VPS ao mesmo tempo**: ao subir na VPS, desparear o aparelho do wa-akg local antes.
- [ ] **Banco: MySQL em container próprio** (o que o upstream usa). Migrar para Postgres só se faltar memória na VPS; nesse caso registrar a troca do `provider` em `changes.md` e testar as migrações a cada atualização. Nunca usar o Postgres do VK Tech sem banco e usuário separados.

## 8. Dois WhatsApps, cada pessoa com login e senha (planejado em 2026-10-24)

Leitura do código (`prisma/schema.prisma`, `src/lib/session-access.ts`, `src/app/api/sessions/route.ts`); nada testado.

**O que o wa-akg já faz:** cada `Session` (um número) pertence a um `User` (login e senha). Usuário comum (`USER`) só lista e abre as sessões dele ou as que forem compartilhadas com ele (`SessionAccess`). Mensagens, contatos, grupos, agendamentos, webhooks e configuração ficam ligados à sessão. Cada usuário tem a própria chave de API.

**O que muda:**
- Duas sessões, cada uma com o próprio QR, escaneado pelo dono do número.
- Duas contas: você e a outra pessoa. Cada uma com e-mail e senha.
- `antiDelete`, captura e demais opções são **por sessão** (`Session.config`): configurar uma vez para cada número.
- Webhooks e chaves de API por usuário.
- Consumo de memória maior (um socket do Baileys por número), a medir.
- O banco e o backup passam a guardar conversas das duas pessoas.

**Cuidados:**
- [ ] **SUPERADMIN vê todas as sessões** (`canAccessSession` libera tudo). Sua conta de administrador vê as conversas da outra pessoa. Para o outro número ficar realmente privado, ver a opção abaixo.
- [ ] Criar a conta da outra pessoa: o cadastro público vem desligado (`enableRegistration = false`). Ligar só para criar a conta e desligar em seguida, ou criar pelo painel de usuários (`src/app/api/users`, **não li**).
- [ ] Papel da outra pessoa: `USER`, nunca `STAFF` nem `SUPERADMIN`.
- [ ] Só li o isolamento da listagem de sessões e da rota de mídia. **Não auditei as demais rotas** (mensagens, contatos, chats, webhooks, scheduler). Escrever teste com dois usuários provando que um não alcança dados do outro (regra III do zap-master).
- [ ] Combinar com a outra pessoa o que é guardado e quem vê. É conversa de terceiros e o número dela tem risco de banimento próprio.
- [ ] Cada uma com 2FA quando for implementado, e senha forte.
- [ ] Backup e restauração cobrindo as duas sessões (`AuthState` de cada uma).

**Decisão (2026-10-24): opção (b).** Uma conta `SUPERADMIN` só de administração, e contas `USER` para o uso diário (a do usuário e a da outra pessoa). O administrador continua vendo todas as sessões; o usuário sabe disso.
- [ ] Criar o primeiro cadastro como a conta administrativa (o primeiro vira `SUPERADMIN`), com e-mail e senha próprios, só para gerir. Sem sessão de WhatsApp nela.
- [ ] Criar as contas `USER` do usuário e da outra pessoa (cadastro ligado só nesse momento, depois desligar).
- [ ] Cada número é pareado na conta `USER` do dono dele, nunca na administrativa.
- [ ] Usar a conta administrativa só para configurar. Entrar nela é o único caminho para ver a sessão alheia.
- [ ] Informar a outra pessoa de que existe uma conta administrativa com acesso técnico.
- [ ] Guardar a senha do administrador à parte (gerenciador de senhas), com 2FA quando existir.
- Não precisa alterar código do upstream.
- Opção (c), esconder sessões do administrador no código, fica descartada por ora.
