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

Genki monitors your HTTP endpoints, TCP ports, and services on a configurable schedule, tracks incidents, fires notifications to Slack/Telegram/Google Chat, and serves public status pages — all from a single Docker image.

## Features

- **Monitor types** — HTTP, TCP, ping with configurable intervals and timeouts
- **Groups & labels** — organise monitors into groups with colour-coded labels; filter and search by group or label across the dashboard
- **Multiple public status pages** — each group gets its own public page at `/status/group/<slug>`; the main `/status` page aggregates all public monitors
- **Incident tracking** — automatic open/resolve lifecycle with manual override
- **Notifications** — Slack, Telegram, Google Chat, generic webhook with separate down/recovery templates
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

Open `http://localhost:8080`. On first run, Genki detects there are no users and redirects to `/setup` where you create your admin account. After submitting, you're logged in automatically.

> The setup screen is only available on first run. Once an admin account exists, it redirects to `/login`.

### Local Development

```bash
make dev-db                           # start local PostgreSQL
cp .env.example .env                  # configure backend
cp web/.env.example web/.env          # configure frontend dev proxy

air                                   # Go backend with live reload
cd web && npm install && npm run dev  # frontend dev server (separate terminal)
```

Open `http://localhost:5173`. On first run you'll be redirected to `/setup`.

See [docs/development.md](docs/development.md) for the full local setup guide.

## Groups & Labels

Monitors can be assigned a **group** and any number of **labels**.

- Set group and labels when creating or editing a monitor in the Add/Edit Monitor modal
- **Grouped view** on the Monitors page collapses monitors by group with a collapsible section per group; switch to flat view anytime
- **Sidebar filters** let you click any group or label to filter the list instantly
- **Search** matches name, URL, group name, and labels simultaneously
- Each group with public monitors automatically gets its own status page at `/status/group/<group-slug>` (e.g. `Production` → `/status/group/production`)
- The main `/status` page shows all public monitors grouped by group with nav pills to each group page

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
