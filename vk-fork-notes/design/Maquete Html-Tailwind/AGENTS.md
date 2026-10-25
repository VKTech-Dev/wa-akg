# Maquete HTML + Tailwind (WA-AKG)

> Antes de tudo, leia `../AGENTS.md`: ele diz o que não pode mudar, o que pede cuidado e o que é livre.

Cópia navegável das telas do WA-AKG, **só front-end**. Abra qualquer `.html` com duplo clique, sem Node, sem servidor e sem internet.

## Regras

1. **Só esta pasta.** Não edite `src/`, `prisma/` nem nada fora de `vk-fork-notes/design/`. A maquete não chama API, não lê banco e não grava nada.
2. **Dados fictícios.** Nomes, números e mensagens inventados. Nunca copie contato, telefone, mensagem ou foto reais do banco ou de capturas do sistema para cá.
3. **Comece pelo `_modelo.html`.** Copie, renomeie (`contatos.html`, `chat.html`...) e troque o conteúdo. Cada tela carrega os mesmos 4 arquivos, na mesma ordem (veja o cabeçalho do `_modelo.html`).
4. **Use as cores do sistema.** Classes semânticas: `bg-background`, `bg-card`, `bg-sidebar`, `text-muted-foreground`, `bg-primary`, `border`. Não use cor fixa (`#...`, `bg-green-500`) onde existe token. Exceção: o chat usa as variáveis `--wa-*` de `assets/app.css` (bolhas, data, tiques).
5. **Tema escuro é o padrão.** Funciona o `dark:` (o sistema real usa). O botão com `data-tema-toggle` alterna e grava `vk-theme` no `localStorage`, a mesma chave do sistema.
6. **Português do Brasil**, `lang="pt-BR"`, um `<h1>` por tela, `aria-label` em botão só de ícone, `alt` em imagem.
7. **Mobile.** Confira em 390 px de largura. Sem rolagem horizontal na página.
8. **Atualize o `index.html`** (tabela de telas) e o `SPEC-implementacao.md` a cada tela feita ou mudada.

## Como o CSS funciona

- `assets/app.css` é o CSS **compilado do sistema real** (Next + Tailwind 4): tem os tokens, o tema escuro e as bolhas do chat. Não edite à mão; se o sistema mudar de visual, recompile a imagem e copie de novo (passos em `../README.md`).
- `assets/tailwind-browser-4.1.18.js` + `assets/tailwind-theme.js` existem só para as classes **novas** que você usar ao editar. O tema vem do `globals.css` real. Mesma versão do projeto (4.1.18).
- `assets/maquete.css` recria a fonte Geist (que o Next injeta em tempo de execução). As fontes estão em `assets/media/`.

## Fonte de verdade

`src/` manda. A maquete só vira `.tsx` quando o usuário pedir, com as mesmas classes. O `SPEC-implementacao.md` diz o que falta para levar cada tela ao sistema real.

## Telas do sistema real (para escolher o que montar)

Dashboard, Sessões, Conversas, Broadcast, Interativas, Stickers, Contatos, Grupos, Etiquetas, Config. do Bot, Auto-resposta, Perfil, Agendador, Webhooks, Mídia, Acesso à sessão, Usuários, Configurações, Monitor do sistema, Notificações, Login. Rotas em `src/app/dashboard/` e `src/app/auth/`.

## Validação visual

`node vk-fork-notes/design/ferramentas/validar-visual.mjs --pagina index,_modelo,contatos` (acrescente `--tema claro`). Mede rolagem horizontal, contraste, alvos de toque e rótulos, e compara com a última versão aprovada. Nunca use `--aceitar` sem pedido do usuário. Precisa de Chrome (`/usr/bin/google-chrome`, ou a variável `CHROME_PATH`) e de `python3` com Pillow.
