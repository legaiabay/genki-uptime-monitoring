<div align="center">

<img src="docs/logo.png" alt="Genki" width="400" />

**Self-hosted uptime monitoring with a clean dark UI**

[![Go](https://img.shields.io/badge/Go-1.23-00ADD8?style=flat&logo=go&logoColor=white)](https://golang.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat&logo=postgresql&logoColor=white)](https://postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=flat&logo=docker&logoColor=white)](https://docker.com)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat)](LICENSE)

</div>

---

Genki monitors your HTTP endpoints, TCP ports, and services on a configurable schedule, tracks incidents, fires notifications to Slack/Telegram/Google Chat, and serves a public status page — all from a single Docker image.

## Features

- **Monitor types** — HTTP, TCP, ping with configurable intervals and timeouts
- **Incident tracking** — automatic open/resolve lifecycle with manual override
- **Notifications** — Slack, Telegram, Google Chat, generic webhook with separate down/recovery templates
- **Public status page** — per-monitor visibility toggle, no login required
- **Heartbeat monitoring** — passive checks; alert when your service stops pinging in
- **Uptime charts** — time-series sparklines at 1h / 6h / 24h / 7d / 30d resolution
- **API keys** — generate `gk_…` tokens for programmatic access
- **Real-time updates** — WebSocket push to the dashboard
- **Single binary** — Go backend embeds the React frontend; one Docker image, no separate static server

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Go 1.23, Echo v4, sqlx, Goose, robfig/cron |
| Frontend | React 18, TypeScript, Vite, TanStack Query v5, Recharts |
| Database | PostgreSQL 16 |
| Auth | JWT (session) + API keys (`gk_` prefix) |
| Deploy | Docker multi-stage build → Alpine image (~15–20 MB) |

## Quick Start

### With Docker (recommended)

```bash
cp .env.example .env
# Edit .env — set DATABASE_URL and JWT_SECRET at minimum

docker compose up -d --build
```

Open `http://localhost:8080`. On first run, Genki detects there are no users and redirects you to the setup screen where you create your admin account (name, email, password). After submitting, you're logged in automatically.

> Registration is only available on the first run. Once an admin account exists, the setup screen is no longer accessible.

### Local Development

```bash
make dev-db              # start local PostgreSQL
cp .env.example .env     # configure backend environment
cp web/.env.example web/.env  # configure frontend dev proxy

air                      # Go backend with live reload (separate terminal)
cd web && npm install && npm run dev  # frontend dev server
```

Open `http://localhost:5173`. On first run you'll be prompted to create your admin account, same as above.

See [docs/development.md](docs/development.md) for the full local setup guide.

## Configuration

### Backend (`.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `JWT_SECRET` | Yes | — | Random string, min 32 characters |
| `APP_ENV` | No | `development` | `development` or `production` |
| `PORT` | No | `:8080` | HTTP listen address |

### Frontend (`web/.env`)

Only used by the Vite dev server — has no effect on production builds.

| Variable | Default | Description |
|---|---|---|
| `VITE_API_TARGET` | `http://localhost:8876` | Backend URL for `/api` proxy |
| `VITE_WS_TARGET` | `ws://localhost:8876` | Backend URL for `/ws` proxy |

```bash
# Generate a secure JWT secret
openssl rand -hex 32

# Example DATABASE_URL
postgres://genki:password@localhost:5432/genki?sslmode=disable
```

## Documentation

| Topic | File |
|---|---|
| Local development & project structure | [docs/development.md](docs/development.md) |
| Docker & production deployment | [docs/deployment.md](docs/deployment.md) |
| API keys & REST API usage | [docs/api-keys.md](docs/api-keys.md) |
| Notifications setup | [docs/notifications.md](docs/notifications.md) |
| Database migrations & heartbeats | [docs/database.md](docs/database.md) |

## License

[MIT](LICENSE)
