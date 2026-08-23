<div align="center">

<img src="docs/logo.png" alt="Genki" width="400" />

**Lightweight self-hosted uptime monitoring**

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
- **Show/hide URLs on public pages** — global toggle (Settings → Monitors or the monitors toolbar) controls whether monitor URLs are visible on public status pages
- **Incident tracking** — automatic open/resolve lifecycle with manual override
- **Notifications** — Slack, Telegram, Google Chat, generic webhook with separate down/recovery templates
- **Heartbeat monitoring** — passive checks; alert when your service stops pinging in
- **Uptime charts** — time-series sparklines at 1h / 6h / 24h / 7d / 30d resolution
- **API keys** — generate `gk_…` tokens for programmatic access
- **Real-time updates** — WebSocket push to the dashboard
- **App log viewer** — live application log stream in Settings → Logs; ring-buffer snapshot on load, real-time tail via WebSocket, filter by level, search, pause/resume, and download as `.txt`
- **Password reset** — forgot-password flow gated by a server-side `RESET_SECRET` env var; no email required
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

## Public Status Pages

Genki serves shareable, unauthenticated status pages so you can keep your users informed without giving them access to the dashboard.

### Main status page — `/status`

Shows all monitors marked as public, grouped by group name. Each group appears as a nav pill at the top — clicking one jumps to that group's section or navigates to the group-scoped page.

### Group status page — `/status/group/<slug>`

Each group with at least one public monitor gets its own dedicated page. The slug is derived from the group name: lowercase with spaces replaced by hyphens (e.g. `Production Services` → `/status/group/production-services`).

The group page includes:
- A breadcrumb back to the main status page
- An overall status banner (all systems operational / partial outage / major outage)
- A stat row showing total monitors, up count, and overall uptime
- Individual monitor cards with response time, 90-day uptime bars, and any labels

### Making a monitor public

Toggle the **Public** switch when creating or editing a monitor. Public monitors appear on `/status` and, if they belong to a group, on that group's page. Private monitors are never exposed.

## Configuration

### Backend (`.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `JWT_SECRET` | Yes | — | Random string, min 32 characters |
| `APP_ENV` | No | `development` | `development` or `production` |
| `PORT` | No | `:8080` | HTTP listen address |
| `RESET_SECRET` | No | — | Enables the forgot-password flow — see [Password Reset](#password-reset) |

### Password Reset

Genki does not send email. Instead, password reset is protected by a shared secret you control on the server.

1. Add `RESET_SECRET=<a-strong-random-value>` to your `.env` and restart the app.
2. On the login page, click **Forgot password?**
3. Enter the `RESET_SECRET` value, your new password, and confirm.
4. After a successful reset, log in with the new password.

If `RESET_SECRET` is not set, the reset endpoint returns `403` and the feature is effectively disabled.

```bash
# Generate a secure reset secret
openssl rand -hex 32
```

### Frontend (`web/.env`)

Only used by the Vite dev server — has no effect on production builds.

| Variable | Default | Description |
|---|---|---|
| `VITE_API_TARGET` | `http://localhost:8876` | Backend URL for `/api` proxy |
| `VITE_WS_TARGET` | `ws://localhost:8876` | Backend URL for `/ws` proxy |

> The Vite dev proxy routes `/api/v1/ws` with `ws: true` before the generic `/api` rule so WebSocket upgrade is handled correctly.

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
