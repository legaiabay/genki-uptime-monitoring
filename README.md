<div align="center">

<img src="docs/logo.png" alt="Genki" width="400" />

**Lightweight self-hosted uptime monitoring**

[![Latest Release](https://img.shields.io/github/v/release/legaiabay/genki-uptime-monitoring?style=flat&label=version&color=brightgreen)](https://github.com/legaiabay/genki-uptime-monitoring/releases/latest)
[![Go](https://img.shields.io/badge/Go-1.23-00ADD8?style=flat&logo=go&logoColor=white)](https://golang.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat&logo=postgresql&logoColor=white)](https://postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=flat&logo=docker&logoColor=white)](https://docker.com)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat)](LICENSE)

</div>

---

Genki monitors your HTTP endpoints, TCP ports, and services on a configurable schedule, tracks incidents, fires notifications to Slack/Telegram/Google Chat, and serves public status pages — all from a single Docker image.

## Features

- **Monitor types** — HTTP, TCP, ping, DNS, SSL certificate, and gRPC health checks with configurable intervals and timeouts
- **SSL certificate monitoring** — tracks expiry date; warns when cert expires within a configurable threshold (days); expiry badge on monitor rows
- **Uptime charts** — time-series sparklines at 1h / 6h / 24h / 7d / 30d resolution with response-time overlay; filter by favorites on the Overview page
- **Groups & labels** — organise monitors into groups with colour-coded labels; filter and search by group or label across the dashboard
- **Bulk edit** — select multiple monitors and apply group, labels, type, interval, timeout, retries, or favorite status in one operation
- **Favorite monitors** — star any monitor to pin it to the top of the list; favorited monitors filter the uptime chart on the Overview dashboard
- **Multiple public status pages** — each group gets its own public page at `/status/group/<slug>`; the main `/status` page aggregates all public monitors
- **Incident tracking** — automatic open/resolve lifecycle with manual override; recovery notifications include the total downtime duration
- **Notifications** — Slack, Telegram, Google Chat, generic webhook with separate down/recovery templates
- **Heartbeat monitoring** — passive checks; alert when your service stops pinging in
- **API keys** — generate `gk_…` tokens for programmatic access
- **Real-time updates** — WebSocket push to the dashboard
- **App log viewer** — live application log stream in Settings → Logs; ring-buffer snapshot on load, real-time tail via WebSocket, filter by level, search, pause/resume, and download as `.txt`
- **Password reset** — forgot-password flow gated by a server-side `RESET_SECRET` env var; no email required
- **Backup & Restore** — export all monitors and heartbeats to a JSON/ZIP archive; import back with full field mapping; accessible from Settings → Backup & Restore
- **Light & dark theme** — toggle between light and dark mode from the sidebar
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

### Pull from Docker Hub (easiest)

No build step needed — pull the pre-built image directly.

1. Create a `docker-compose.yml`:

```yaml
services:
  app:
    image: legaiabay/genki-uptime-monitoring:latest
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

2. Start the stack:

```bash
docker compose up -d
```

Open `http://localhost:8080`. On first run, Genki redirects to `/setup` where you create your admin account.

```bash
# Generate secure secrets
openssl rand -hex 32   # use for JWT_SECRET (and optionally RESET_SECRET)
```

### Build from source

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
