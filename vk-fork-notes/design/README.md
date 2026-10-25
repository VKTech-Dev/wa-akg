# design

Maquete visual do WA-AKG, só visual, do mesmo jeito das outras (`vk-tech/docs/design`). Abre no navegador, sem Node. Fica em `vk-fork-notes/` porque `docs/` é do upstream.

| Pasta | O quê |
|---|---|
| `AGENTS.md` | **Leia primeiro.** O que não pode mudar, o que pede cuidado e o que é livre |
| `Maquete Html-Tailwind/` | As telas em HTML. Leia o `AGENTS.md` de lá antes de editar. `index.html` lista as telas; `_modelo.html` é a base para copiar |
| `ferramentas/` | `validar-visual.mjs` (audita e compara telas no Chrome sem janela) e `imagens.py` (auxiliar dele) |
| `Referencia/` | Imagens e textos de inspiração. Veja o `README.md` de lá |
| `Logo/` | Marca do projeto, quando houver |
| `screenshot/` | `validar-visual/` (capturas aprovadas) e `real-vs-maquete/` (comparações lado a lado) |

## Abrir

Duplo clique em `Maquete Html-Tailwind/index.html`.

## Atualizar o CSS da maquete (quando o visual do sistema mudar)

1. `docker compose up -d --build app` na raiz do projeto.
2. Descobrir os arquivos de CSS que a página carrega (`curl -s http://127.0.0.1:3005/auth/login | grep -o '/_next/static/[^"]*\.css'`) e copiá-los do container (`docker cp wa-akg-app:/app/.next/static/chunks/<arquivo>.css`). O CSS do chat (bolhas) fica num arquivo à parte, que tem `wa-bubble`.
3. Juntar tudo em `assets/app.css`, trocando `url(../media/` por `url(media/`. Fontes: `docker exec wa-akg-app sh -c 'cd .next/static/media && tar cf - *.woff2' | tar xf - -C assets/media`.
4. Se o `@theme inline` do `src/app/globals.css` mudou, refazer `assets/tailwind-theme.js`.

## Regras

- Não edite `src/` por aqui. Dados reais (contatos, mensagens, fotos) não entram nesta pasta, nem em `Referencia/`, a menos que o usuário peça.
- Mudança aprovada na maquete só vai para o `src/` por pedido do usuário (ver `SPEC-implementacao.md`).
