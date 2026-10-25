#!/usr/bin/env bash
# Copia o front do projeto real para o clone (projeto -> clone). Não mexe na camada simulada (MOCKS.list).
# Uso: scripts/atualizar-do-projeto.sh            (mostra o que mudaria)
#      scripts/atualizar-do-projeto.sh --aplicar  (copia de verdade)
# Cuidado: sobrescreve no clone os arquivos de front que você editou e ainda não levou ao projeto.
set -euo pipefail
CLONE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJ="$(cd "$CLONE/../../.." && pwd)"
[ -f "$PROJ/prisma/schema.prisma" ] || { echo "Não achei o projeto real em $PROJ" >&2; exit 1; }

ARGS=(-a --relative --itemize-changes --exclude '__tests__/__pycache__')
[ "${1:-}" = "--aplicar" ] || ARGS+=(--dry-run)
while IFS= read -r p; do case "$p" in ''|'#'*) continue;; esac; ARGS+=(--exclude "**/${p%/}"); done < "$CLONE/MOCKS.list"

cd "$PROJ"
mapfile -t ITENS < <(grep -vE '^\s*(#|$)' "$CLONE/FRONT.list")
rsync "${ARGS[@]}" "${ITENS[@]}" "$CLONE/"
[ "${1:-}" = "--aplicar" ] && echo "Clone atualizado." || echo "(simulação: nada foi copiado; use --aplicar)"
