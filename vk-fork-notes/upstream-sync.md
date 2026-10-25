# Como atualizar do upstream

Remotos: `origin` = VKTech-Dev/wa-akg (nosso), `upstream` = mrifqidaffaaditya/WA-AKG.

1. Ler `protected.md` e `changes.md`.
2. Árvore limpa (`git status`). Backup do banco em `dados/`, se houver sessão ativa.
3. `git fetch upstream` e olhar o que chegou: `git log --oneline main..upstream/main` e `git diff --stat main upstream/main`.
4. Cruzar os arquivos alterados com os de `changes.md` para prever conflitos.
5. Em branch separada: `git switch -c sync/<versao>` e `git merge upstream/main`.
6. Resolver conflitos mantendo as nossas mudanças registradas e incorporando as novas do upstream.
7. `npm install`, `npx prisma migrate` conforme o upstream pedir, `npm test`, `npm run build`.
8. Subir em teste e conferir que a sessão do celular continua conectada.
9. Registrar em `upstream-log.md` e, se algo de `changes.md` mudou, atualizar lá.
10. Merge na `main` e push só quando o usuário pedir.

Cuidado com migrações do Prisma: o upstream pode alterar tabelas que estendemos. Confira o schema antes de rodar.
