# Genki Uptime Monitoring

Genki monitors your HTTP endpoints, TCP ports, DNS records, SSL certificates, and gRPC services on a configurable schedule. It tracks incidents, sends notifications to Slack, Telegram, Google Chat, or any webhook, and serves public status pages — all from a single Docker image backed by PostgreSQL.

---

## Features

- **Monitor types** — HTTP, TCP, ping, DNS, SSL certificate, and gRPC health checks
- **SSL certificate monitoring** — tracks expiry date; warns within a configurable threshold
- **Uptime charts** — time-series sparklines at 1h / 6h / 24h / 7d / 30d with response-time overlay
- **Groups & labels** — organise monitors; filter and search across the dashboard
- **Bulk edit** — apply group, labels, interval, timeout, retries, or favorite status to multiple monitors at once
- **Incident tracking** — automatic open/resolve lifecycle with manual override; recovery notifications include downtime duration
- **Notifications** — Slack, Telegram, Google Chat, generic webhook with separate down/recovery message templates
- **Heartbeat monitoring** — passive checks; alert when your service stops pinging in
- **Public status pages** — a main `/status` page plus per-group pages at `/status/group/<slug>`
- **API keys** — generate `gk_…` tokens for programmatic access
- **Real-time updates** — WebSocket push to the dashboard
- **Backup & Restore** — export/import all monitors and heartbeats as a ZIP archive
- **Light & dark theme**
- **Single binary** — Go backend embeds the React frontend; no separate static server

---

## Quick Start

```yaml
# docker-compose.yml
services:
  app:
    image: your-username/genki-uptime-monitoring:latest
    container_name: genki-app
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      - APP_ENV=production
      - DATABASE_URL=postgres://genki:yourpassword@db:5432/genki?sslmode=disable
      - JWT_SECRET=your-32-char-random-secret
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    container_name: genki-db
    restart: unless-stopped
    environment:
      - POSTGRES_USER=genki
      - POSTGRES_PASSWORD=yourpassword
      - POSTGRES_DB=genki
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U genki -d genki"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

```bash
docker compose up -d
```

Open `http://localhost:8080`. On first run, Genki redirects to `/setup` where you create your admin account.

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `JWT_SECRET` | Yes | — | Random string, min 32 characters |
| `APP_ENV` | No | `development` | `development` or `production` |
| `PORT` | No | `:8080` | HTTP listen address |
| `RESET_SECRET` | No | — | Enables the forgot-password flow |

```bash
# Generate secrets
openssl rand -hex 32   # for JWT_SECRET or RESET_SECRET
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Go 1.23, Echo v4, sqlx, Goose |
| Frontend | React 18, TypeScript, Vite, TanStack Query v5, Recharts |
| Database | PostgreSQL 16 |
| Auth | JWT + API keys (`gk_` prefix) |
| Image size | ~15–20 MB (Alpine) |

---

## Source & Documentation

GitHub: [github.com/legaiabay/genki-uptime-monitoring](https://github.com/legaiabay/genki-uptime-monitoring)

License: MIT
