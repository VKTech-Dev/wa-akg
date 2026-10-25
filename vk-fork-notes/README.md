# vk-fork-notes

Registro do fork VKTech-Dev/wa-akg em relação ao upstream (mrifqidaffaaditya/WA-AKG, licença MIT). Serve para manter o histórico de alterações e poder atualizar do upstream quando for preciso.

| Arquivo | Conteúdo |
|---|---|
| `protected.md` | O que não pode mudar, e por quê |
| `changes.md` | O que mudamos em relação ao upstream |
| `upstream-log.md` | O que cada atualização do upstream trouxe e como foi resolvida |
| `upstream-sync.md` | Passo a passo para atualizar |
| `design/` | Maquete visual (HTML + Tailwind) do front. Leia `design/AGENTS.md` |

## Regras

1. Antes de editar o código, ler `protected.md`.
2. Toda mudança em arquivo que existe no upstream entra em `changes.md` na mesma tarefa. Prefira arquivos e módulos novos a editar os existentes: menos conflito nos merges.
3. Antes de atualizar do upstream, ler `protected.md` e `changes.md`. Depois, registrar o resultado em `upstream-log.md`.
4. Esta pasta é nossa e não existe no upstream, então não gera conflito.
