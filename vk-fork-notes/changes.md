# Mudanças em relação ao upstream

Uma entrada por alteração, da mais nova para a mais antiga. Campos: data, arquivos, motivo, commit.

## 2026-10-24 — Compose no padrão de persistência local

- Arquivos: `docker-compose.yml`, `.env.example`, `.gitignore`.
- Motivo: aplicar `Rules/DOCKER.md` do cofre (bind mount em `./dados/`, `dados/` ignorado, portas em `127.0.0.1`).
- Commit: `39cff8b`.
- Risco de conflito no merge: alto em `docker-compose.yml`, médio em `.env.example`.

## 2026-10-24 — Criação desta pasta

- Arquivos novos: `vk-fork-notes/`, `AGENTS.md`.
- Motivo: registrar o histórico do fork.
- Risco de conflito: nenhum (arquivos inexistentes no upstream).

## Pendente (ideias, nada feito)

- Preservar mensagens apagadas e editadas (verificar antes se o upstream já guarda o original).
- 2FA no login.
- Captura seletiva por chat.
- Mídia no Google Drive.
