# Protegido: o que não pode mudar

"Não mudar" aqui é decisão de manutenção, não de licença. A MIT permite alterar tudo. Itens marcados *(não confirmado)* vêm de leitura parcial do código.

## Obrigação de licença

- `LICENSE` (MIT, Copyright 2026 Aditya): manter na raiz, sem editar. É a única condição da MIT: preservar o aviso de copyright em todas as cópias.

## Evitar mudar, para não quebrar o merge do upstream ou a conexão

| Item | Motivo |
|---|---|
| Tabela `AuthState` (`prisma/schema.prisma`) | Guarda as credenciais da sessão do Baileys. Alterar pode derrubar a conexão com o celular e exigir novo QR. *(não confirmado: formato exato)* |
| Tabelas existentes `Message`, `Session` | O upstream as altera com frequência. Para dados novos, crie tabelas novas ligadas por chave, em vez de acrescentar colunas. |
| `src/modules/whatsapp/` (Baileys) | Parte mais sensível a mudanças do protocolo do WhatsApp. Extensões entram por eventos ou módulos novos. |
| `src/app/api/system/check-updates/route.ts` | Compara com o repositório do autor (`REPO_OWNER = "mrifqidaffaaditya"`). Se divergir, ele indica atualizações indesejadas. Decidir: apontar para este fork ou desligar. |
| `docs/` | Documentação do upstream. Documentação nossa vai em `vk-fork-notes/`. |

## Telemetria

`src/server/index.ts` envia um ping a cada 30 s para `api-wa-akg.aikeigroup.net` (nome do app, versão, plataforma, versão do Node, memória). Vem ligado por padrão. Desligue com `ENABLE_TELEMETRY=false` no `.env`.

## Regras do cofre que valem aqui

- Compose segue `Rules/DOCKER.md`: dados em `./dados/<servico>`, `dados/` no `.gitignore`, portas em `127.0.0.1`, segredos no `.env`.
- Nunca commitar `.env`, chaves nem credenciais.
- Commit e push só quando o usuário pedir. Antes do commit, ler o `AGENTS.md` deste projeto; antes do push, rodar `npm test` e `npm run build`, se existirem.
