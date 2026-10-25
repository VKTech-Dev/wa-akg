# Verificação do wa-akg (2026-10-24)

Leitura estática do código em `01-Projects/wa-akg` (commit `39cff8b`, versão 1.7.0), mais o `.env.example` e o `docker-compose.yml`. **Nada foi executado, compilado ou testado.** Cada item diz o que foi visto e onde. "Não verificado" quer dizer que não li o trecho.

## A. Respostas às dúvidas anteriores

| Dúvida | Resposta | Onde |
|---|---|---|
| O wa-akg guarda a mensagem original ao apagar? | **Só se ligar `antiDelete` na configuração da sessão.** Ligado: mantém o texto e acrescenta "🛡️ [Deleted by sender — preserved]". Desligado (padrão): troca o conteúdo por "[This message was deleted]" e marca `status = FAILED`. | `src/modules/whatsapp/store/index.ts:326-368` |
| E ao editar? | **Sobrescreve** o `content` pelo texto novo. Não guarda a versão anterior nem as edições. | `store/index.ts:300-322` |
| Mídia da mensagem apagada? | Não verificado (não li se o arquivo em `data/media` é mantido). | — |
| Tem 2FA? | Não achei. | `src/auth.config.ts`, `src/lib/auth.ts` (leitura parcial) |
| Tem limite de requisições? | **Não.** `ENABLE_RATE_LIMITING` e `RATE_LIMIT_PER_MINUTE` não são lidos em nenhum arquivo de `src/`. | grep em `src/` |
| Cadastro aberto? | `enableRegistration` tem padrão `false`. Mas o **primeiro cadastro vira SUPERADMIN**. | `prisma/schema.prisma:298`, `src/app/api/auth/register/route.ts` |
| Tem integração com Drive? | Não achei. | grep |

## B. Achados de segurança

Gravidade: **A** alta, **M** média, **B** baixa.

| # | Gr. | Achado | Onde | Ação sugerida |
|---|---|---|---|---|
| 1 | A | Telemetria ligada por padrão: ping a cada 30 s para `api-wa-akg.aikeigroup.net` (nome do app, versão, plataforma, Node, memória). | `src/server/index.ts:105-135` | `ENABLE_TELEMETRY=false`; avaliar remover o bloco |
| 2 | A | Sessão do WhatsApp (`AuthState`, JSON com as credenciais do Baileys) fica **em texto no MySQL**. Quem lê o banco assume o WhatsApp. | `prisma/schema.prisma:195-202` | Proteger o banco e o backup; cifrar o dump; não expor o MySQL |
| 3 | A | A edição **destrói o original** e a apagada só é preservada com opt-in. Para o objetivo do zap-master (histórico à prova de apagamento), é lacuna. | `store/index.ts` | Tabela nova de versões; `antiDelete` ligado por padrão (mudança mínima no upstream) |
| 4 | M | Chave de API guardada **em texto** em `User.apiKey` e comparada por igualdade; sem expiração nem escopo. | `src/lib/api-auth.ts`, `src/app/api/user/api-key/route.ts` | Guardar hash; chaves por finalidade; rotacionar |
| 5 | M | Sem limite de requisições (item A). | — | Proxy reverso com limite, ou implementar |
| 6 | M | O app usa o usuário `root` do MySQL. | `docker-compose.yml` (`DATABASE_URL`) | Usuário dedicado com permissão só no banco `wa_akg` |
| 7 | M | Swagger com usuário e senha padrão `admin` / `admin123` no compose; variáveis `NEXT_PUBLIC_*` podem ir ao navegador. Onde são lidas: **não achei**. | `docker-compose.yml` | Trocar ou desligar o Swagger |
| 8 | M | `trustHost: true` e `AUTH_TRUST_HOST=true`. Atrás de proxy reverso é o esperado; sem proxy confiável, permite forjar o host. | `src/auth.config.ts:39` | Manter só atrás do proxy; definir `NEXTAUTH_URL` real |
| 9 | M | `exec` com `ffmpeg` montando comando em texto para figurinha animada. Os nomes dos arquivos temporários parecem gerados internamente, mas **não li de onde vêm**. | `src/modules/whatsapp/bot/command-handler.ts:257` | Revisar a origem de `tempInput`/`tempOutput`; preferir `execFile` com argumentos |
| 10 | B | `ENABLE_NOTIFICATIONS`, `ENABLE_AUTO_UPDATE_CHECK`, `ENABLE_EXPERIMENTAL_FEATURES` não aparecem em `src/`: provavelmente não fazem nada. | grep | Não confiar nelas para desligar nada |
| 11 | B | Senha de teste `password123` em `scripts/setup-test-user.ts`. | `scripts/` | Não rodar em produção; considerar remover |
| 12 | B | `.env.example` com fuso `Asia/Jakarta` e `id-ID`. | `.env.example` | Ajustar |

## C. O que já está bem (visto no código)

- Rotas `/api/*` exigem sessão ou `x-api-key` (`src/proxy.ts`).
- Rota de mídia: exige autenticação, bloqueia `..`, `/` e `\` no nome, confere se o caminho resolvido fica dentro de `data/media` e confere acesso à sessão do arquivo (`src/app/api/media/[filename]/route.ts`).
- Webhooks têm checagem de SSRF antes de chamar a URL (`src/lib/webhook.ts:162` e `:311`). **Não revisei se a lista de bloqueio é completa.**
- Cadastro desligado por padrão e papéis `SUPERADMIN`, `STAFF`, `USER`; usuário novo recebe o menor papel.
- CORS do socket.io limitado à `BASE_URL` (`src/server/index.ts:65-80`).
- Compose já com portas em `127.0.0.1`, dados em `./dados/`, segredos no `.env`.

## D. Não verificado (precisa de teste ou leitura adicional)

- Se o app roda em ARM64 (Prisma, `sharp`/ffmpeg e o build do Next).
- Quanta memória o app e o MySQL usam em repouso, com o Hermes e o VK Tech no mesmo host.
- Se o `antiDelete` aparece na interface ou só na API.
- Como o upstream trata a migração do schema (`prisma migrate` ou `db push`) e o risco de perder dados ao atualizar.
- Se existem outras chamadas externas além de telemetria, `check-updates` e remove.bg.
- Número máximo de aparelhos vinculados no WhatsApp e risco de dois clientes não oficiais no mesmo número.
- A VPS: regras de `iptables`, NSG e se a instância é a mesma citada em `vps-install.md` (suposição minha, a confirmar).
- `docs/qr-code.key` do zap-master: arquivo com extensão de chave dentro do repositório; **não abri**. Conferir se está no `.gitignore` e não é um QR real antes de qualquer push.

## E. Decisões que dependem do usuário

1. **Um só dono do WhatsApp:** o wa-akg assume a conexão e o bridge do Hermes é desligado? (recomendado)
2. **Banco na VPS:** manter MySQL em container (como está no compose, +RAM) ou migrar o Prisma para o Postgres que já existe na VPS (mudança de `provider` no schema, conflita com o upstream).
3. **Número:** testar primeiro com um número secundário.
4. **Modelo do Hermes:** continua na NVIDIA ou muda? (independe do wa-akg)
5. **Acesso ao painel:** público com HTTPS ou só por VPN (Tailscale) / túnel SSH.
