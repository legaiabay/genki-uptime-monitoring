# Genki Uptime Monitoring

A self-hosted uptime and healthcheck monitoring application. Genki checks HTTP, TCP, and ping endpoints on a configurable schedule, tracks incidents, sends notifications to multiple channels, and provides a public status page.

The entire application ships as a single Docker image containing both the Go backend and the React frontend.

---

## Features

- HTTP, TCP, and ping healthchecks on configurable intervals
- Real-time uptime and response time dashboard
- Automatic incident creation and resolution
- Notifications: Google Chat, Slack, Telegram, custom webhook
- Separate message templates for down and recovery events
- Public status page (no login required)
- Per-monitor public visibility toggle
- Heartbeat monitoring (passive checks from your own services)
- Time-series uptime charts (1h, 6h, 24h, 7d, 30d)
- API key management
- Multi-user support with JWT authentication

---

## Tech Stack

**Backend:** Go 1.23, Echo, sqlx, PostgreSQL, Goose (migrations), robfig/cron

**Frontend:** React 18, TypeScript, Vite, TanStack Query, Recharts, React Router

**Database:** PostgreSQL 16

**Deployment:** Docker (multi-stage build, single binary)

---

## Quick Start

### Requirements

- Docker and Docker Compose
- Or: Go 1.23+, Node.js 22+, PostgreSQL 16

### Run with Docker

```bash
# Copy and fill environment variables
cp .env.example .env

# Edit .env — set DATABASE_URL and JWT_SECRET at minimum

# Build and start
docker compose up -d --build

# View logs
docker compose logs -f app
```

The application will be available at `http://localhost:8080`.

Default credentials on first start:
- Email: `admin@genki.local`
- Password: `admin123`

Change the password immediately after first login via Settings.

---

## Local Development

### 1. Start the database

```bash
docker compose -f docker-compose.dev.yml up -d
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env as needed
```

### 3. Start the Go backend

Requires [air](https://github.com/air-verse/air) for live reload:

```bash
go install github.com/air-verse/air@latest
air
```

Or without live reload:

```bash
go run ./cmd/server
```

### 4. Start the frontend dev server

```bash
cd web
npm install
npm run dev
```

Frontend: `http://localhost:5173`
Backend API: `http://localhost:8876`

The Vite dev server proxies `/api` and `/ws` to the Go backend.

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `APP_ENV` | No | `development` | `development` or `production` |
| `PORT` | No | `:8080` | HTTP listen address |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `JWT_SECRET` | Yes | — | Random string, minimum 32 characters |

Example `DATABASE_URL`:

```
postgres://genki:password@localhost:5432/genki?sslmode=disable
```

---

## Database Migrations

Migrations run automatically on startup. To manage them manually:

```bash
# Create a new migration
make migrate-create name=add_something

# Run pending migrations
make migrate-up

# Roll back one step
make migrate-down

# Check status
make migrate-status
```

Migrations are located in `internal/database/migrations/` and use [Goose](https://github.com/pressly/goose).

---

## Notifications

Supported channels:

- **Google Chat** — incoming webhook
- **Slack** — incoming webhook
- **Telegram** — bot token + chat ID
- **Webhook** — generic HTTP POST

Each channel supports separate message templates for down and recovery events. Templates support the following variables:

| Variable | Description |
|---|---|
| `{{monitor_name}}` | Monitor name |
| `{{monitor_url}}` | Monitor URL |
| `{{status}}` | Current status |
| `{{response_time}}` | Response time in ms |
| `{{error_message}}` | Error detail when down |
| `{{checked_at}}` | Timestamp |

---

## Public Status Page

Any monitor can be made publicly visible from the Monitors page (toggle the Public switch per row).

The public status page is available at `/status` without authentication and shows uptime bars and current status for all public monitors.

---

## Heartbeats

Heartbeat monitors accept incoming pings from your own services. If no ping is received within the expected interval, an incident is created.

To send a ping:

```bash
curl -X POST https://your-genki-instance.com/api/v1/heartbeats/monitor-{id}
```

---

## Docker Build

The Dockerfile uses a three-stage build:

1. **frontend-builder** — installs Node dependencies and builds the React app
2. **go-builder** — copies the frontend dist into the embed path and compiles the Go binary with `CGO_ENABLED=0`
3. **Final stage** — Alpine 3.20 with only the compiled binary (approximately 15-20 MB image)

---

## Makefile Reference

```
make help           Show all available targets
make dev-db         Start local PostgreSQL via Docker
make dev-db-stop    Stop local PostgreSQL
make run            Start Go server with live reload (air)
make build          Build Go binary to ./bin/genki
make migrate-create name=xxx   Create new migration file
make migrate-up     Apply all pending migrations
make migrate-down   Roll back the last migration
make migrate-status Show migration status
make frontend-dev   Start Vite dev server
make frontend-build Build frontend for production
make docker-up      Build and start production stack
make docker-down    Stop production stack
make docker-logs    Tail application logs
```

---

## Security

- Never commit `.env` — it is listed in `.gitignore`
- `JWT_SECRET` must be at least 32 characters
- Passwords are hashed with bcrypt
- All database queries use parameterized placeholders

---

## License

MIT
