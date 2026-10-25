# Informações trazidas do zap-master e do agente-remoto

Extraído em 2026-10-24 por leitura dos documentos dos dois projetos (`spec.md`, `plan.md`, `research.md`, `tasks.md`, `pendencias-estrutura.md`, constituição, `index.md`, `log.md`, `spec-implantacao.md`, `whatsapp-plan.md`, `deploy/`). Não li `.env`, `*.key` nem `*.pem`. Nada foi executado nem testado. Fontes: `01-Projects/zap-master/` e `01-Projects/agente-remoto/`.

## 1. VPS Oracle (dados da conferência de 2026-10-15, fonte: `agente-remoto/deploy/vps-install.md`)

| Item | Valor |
|---|---|
| Arquitetura | **ARM64** |
| CPU / memória livre / disco livre | 2 CPUs / ~9 GiB / ~31 GB (antes de instalar o Hermes) |
| Sistema | Ubuntu *Minimal*: **sem `cron`**, usa timer do systemd; `rsync` foi o único pacote instalado |
| Docker | 29.8.0 |
| Acesso SSH | atalho `vktech-db`; usuário `ubuntu` com `sudo` sem senha |
| Já rodando na máquina | Coolify, Postgres, API e site do **VK Tech** (produção), rede `coolify`, container `hermes` (3 GB, 1,5 CPU, sem porta publicada) |
| Usuários criados | `agente-run` (UID 10000), `agente-sync` (UID 10001); nenhum no grupo `docker` |
| Pastas | `/srv/agente/{hermes-home,outbox,vault-ro,sync}` |
| Achados fora do escopo (F0) | porta 111 (rpcbind) em escuta; SSH (22) aberto a qualquer origem; portas 6001, 6002, 8000 e 8080 em escuta no host. `iptables` e NSG **não foram conferidos** |

Consequências para o wa-akg (a confirmar na VPS): a imagem precisa rodar em ARM64; a memória não sobra muito com Hermes (3 GB) e produção do VK Tech no mesmo host; as portas 8000 e 8080 já estão em uso, então o wa-akg deve usar outra (o compose usa 3005).

## 2. O que o zap-master queria (e que o wa-akg não tem)

Constituição e spec do zap-master, em resumo:

1. **Somente leitura primeiro (inegociável).** Número novo começa sem envio; só o dono libera. Todo envio passa por um único portão que confere somente leitura e o limite diário. Não existe envio em massa nem mensagem com variável.
2. **Captura fiel.** Mensagem gravada como chegou. Apagar ou editar no WhatsApp **nunca** apaga nem sobrescreve o conteúdo guardado: a apagada ganha marca e horário, e cada edição vira nova versão. Status e canais não são gravados. Reconciliação periódica com a origem, porque o webhook sozinho pode perder mensagem.
3. **Isolamento por dono.** Todo dado chega a um dono; recurso de outro dono responde 404; o administrador vê só o estado das conexões.
4. **Simulador antes do número real.** Tudo testado primeiro contra um simulador. **O número não fica conectado em dois ambientes ao mesmo tempo.**
5. **Ritmo humano:** atraso aleatório de 3 a 10 s entre envios e limite diário de 50.
6. **Segurança:** senha + 2FA, criptografia em repouso (Fernet e `age`), portas em `127.0.0.1`, webhook bloqueado fora da rede Docker, API que nunca devolve segredo.
7. **Captura seletiva por chat:** fila "novos para revisar" e modo piloto.
8. **Mídia no Google Drive** em `<usuário>/<número>/<chat>/<ano-mês>/`, com mídia ligada por chat e prazo de 3 dias para confirmar; mídia excluída fica 30 dias na lixeira do Drive.
9. **Conexão vigiada** (aviso por e-mail ou Telegram, QR para reconectar) e **backup diário com restauração testada**.

Estado em que parou (2026-10-16): 180 de 226 tarefas feitas; back-end completo contra simulador; **nunca ligou o número real**; build das imagens Docker nunca testado (T181); motor WAHA/GOWS versão `2026.9.2`.

Lições técnicas do `research.md`:
- O GOWS teve bugs graves em 2026 (sessão que para de mandar webhook mas fica "WORKING"; mensagem `fromMe` na conversa errada; mensagem de grupo `@lid` perdida em silêncio). Vale reconciliar sempre. O Baileys do wa-akg é outro motor: não herda esses bugs, mas pode ter os seus.
- `@lid`: o WhatsApp passou a identificar contatos por LID em vez de telefone. O wa-akg anuncia suporte a LID nos contatos; **não verifiquei**.
- OAuth do Google em modo "Testing" expira o token em 7 dias; em produção com escopo não sensível não exige verificação (fonte: `research.md`, parcialmente confirmado).
- Em `GET /api/sendText` do WAHA também enviava mensagem: toda rota que envia conta como envio.

## 3. O que o agente-remoto já decidiu e fez

Hermes Agent (Nous Research, MIT) em container na VPS Oracle, modelo NVIDIA NIM (`nvidia/nemotron-3-super-120b-a12b`), canal Telegram validado, WhatsApp **pareado em 2026-10-18** no modo self-chat com o **número pessoal do usuário**, pelo bridge nativo do Hermes (Baileys).

- Escreve só em `/outbox`; um sincronizador (timer de 5 min, usuário `agente-sync`) sobe `.md` novos para a branch `agente/inbox`; o merge é do usuário.
- Nota com senha só sobe com `send_confirmed: true`; chave de API é recusada.
- Objetivos do WhatsApp (uso amador): **lembretes programados para a esposa** e **ler um grupo e gravar num documento**.
- Pendentes do `whatsapp-plan.md`: T5 (esposa é destino válido?), T6 (lembrete programado), T7 (`wacli` se falhar), T8 (ler grupo), T9 (painel web), T10 (Discord), limpeza (`GOOGLE_API_KEY` com 1 caractere no `.env` da VPS; revogar chave antiga da NVIDIA se vazou).
- Pendentes da `spec-implantacao.md`: trava da `master` (indisponível no plano gratuito do GitHub), plano pago do modelo, `SOUL.md` ensinar `send_confirmed`, endurecimento do container (`read_only`, `cap_drop`, filtro de saída), backup de `/srv/agente/hermes-home`, atualização por digest, documentar em `manual-stack-tecnologica.md`, revisão final das regras do cofre.

### Conflito importante: dois clientes não oficiais no mesmo número
O Hermes já está pareado ao número pessoal. Conectar o wa-akg ao mesmo número cria **dois dispositivos vinculados não oficiais**. A constituição do zap-master proibia o número em dois ambientes. O limite de aparelhos vinculados e o efeito sobre o risco de banimento **não foram verificados**.

Recomendação (a decidir): o wa-akg passa a ser o **único dono da conexão com o WhatsApp**, como o debate Claude × Gemini já tinha decidido para o WAHA (fonte: `agente-remoto/Chat/conclusao.md`, citado em `log.md`). O Hermes usa o wa-akg por API e webhook, e o bridge nativo dele é desligado. Isso cobre T5 a T8 do plano do Hermes (lembretes e leitura de grupo) com o agendador e a API que o wa-akg já tem.

## 4. O que cada projeto tem de útil para o wa-akg

| Necessidade | Fonte no zap-master/agente-remoto | Situação no wa-akg |
|---|---|---|
| Histórico com versões | constituição II, `data-model.md` | Falta (ver `verification.md`) |
| Somente leitura / portão de envio | constituição I | Falta |
| Captura seletiva | spec US1 | Falta |
| Drive | spec US2, `research.md` | Falta |
| Backup + restauração | US4, `ferramentas/restaurar_backup.py` | Falta |
| Lembrete / agendamento | spec US6 | Existe (`ScheduledMessage`) |
| Etiquetas | spec US3 | Existe (`Label`, `ChatLabel`) |
| Várias sessões | spec US9 | Existe |
| Webhook / automação | agente-remoto | Existe (webhooks e nós n8n) |
| Servidor sem cron | agente-remoto (systemd timer) | Usar timer para backup e rotinas |
| Container não root, UID fixo, sem porta publicada | `compose.vps.yaml` | Aplicar ao wa-akg |

Material reaproveitável sem código: `zap-master/specs/001-super-whatsapp-pessoal/` (`spec.md`, `data-model.md`, `contracts/`, `research.md`) e `src/backend/ferramentas/` (backup e restauração, em Python; só como referência).
