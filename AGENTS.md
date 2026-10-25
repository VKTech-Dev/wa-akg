# AGENTS.md — wa-akg (fork VKTech-Dev)

Fork de mrifqidaffaaditya/WA-AKG (MIT). Mantemos a possibilidade de atualizar do upstream.

## Antes de editar código

1. Ler `vk-fork-notes/protected.md`.
2. Prefira arquivos e módulos novos a editar arquivos do upstream.
3. Toda mudança em arquivo do upstream entra em `vk-fork-notes/changes.md` na mesma tarefa.

## Atualizar do upstream

Seguir `vk-fork-notes/upstream-sync.md` e registrar em `vk-fork-notes/upstream-log.md`.

## Regras do workspace

- Docker: dados em `./dados/<servico>`, `dados/` no `.gitignore`, portas em `127.0.0.1`, segredos no `.env`.
- Nunca commitar `.env`, chaves nem credenciais.
- Commit e push só quando o usuário pedir. Antes do push: `npm test` e `npm run build`, se existirem.
- Não editar `LICENSE`.
