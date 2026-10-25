#!/usr/bin/env bash
# Leva o front editado no clone para o projeto real (clone -> projeto). Nunca leva a camada simulada.
# Uso: scripts/levar-para-projeto.sh            (só mostra o que mudaria; padrão)
#      scripts/levar-para-projeto.sh --aplicar  (copia de verdade; só o usuário roda isto)
# Não apaga nada no projeto: arquivo removido no clone fica no projeto (apague à mão se for o caso).
# Depois de aplicar: no projeto, rode npm test e npm run build e registre em vk-fork-notes/changes.md.
set -euo pipefail
CLONE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJ="$(cd "$CLONE/../../.." && pwd)"
[ -f "$PROJ/prisma/schema.prisma" ] || { echo "Não achei o projeto real em $PROJ" >&2; exit 1; }

ARGS=(-a --relative --itemize-changes --checksum)
[ "${1:-}" = "--aplicar" ] || ARGS+=(--dry-run)
while IFS= read -r p; do case "$p" in ''|'#'*) continue;; esac; ARGS+=(--exclude "**/${p%/}"); done < "$CLONE/MOCKS.list"

cd "$CLONE"
mapfile -t ITENS < <(grep -vE '^\s*(#|$)' "$CLONE/FRONT.list")
rsync "${ARGS[@]}" "${ITENS[@]}" "$PROJ/"
[ "${1:-}" = "--aplicar" ] && echo "Front levado ao projeto." || echo "(simulação: nada foi copiado; confira a lista acima e use --aplicar)"
