# Genki Uptime Monitoring — Project Steering

## Overview

Genki is a self-hosted uptime and healthcheck monitoring application. It checks HTTP/TCP/ping endpoints on a configurable schedule, tracks incidents, sends notifications to multiple channels, and exposes a public status page. The entire application ships as a single Docker image.

---

## Tech Stack

### Backend (Go 1.23)

| Package | Purpose |
|---|---|
| `labstack/echo/v4` | HTTP framework, routing, middleware |
| `jmoiron/sqlx` | PostgreSQL query layer with struct scanning |
| `pressly/goose/v3` | Database migrations (embedded via `go:embed`) |
| `robfig/cron/v3` | Scheduler for periodic healthchecks |
| `gorilla/websocket` | WebSocket for real-time UI updates |
| `golang-jwt/jwt/v5` | JWT token generation and validation |
| `joho/godotenv` | `.env` loading in development only |
| `lib/pq` | PostgreSQL driver |
| `golang.org/x/crypto` | bcrypt password hashing |

### Frontend

| Package | Purpose |
|---|---|
| React 18 + TypeScript | UI framework |
| Vite + `@tailwindcss/vite` | Build tool + Tailwind CSS v4 |
| TanStack Query v5 | Server state, caching, refetch |
| React Router v6 | Client-side routing |
| Recharts | Charts (uptime time-series) |
| Zustand | Client-only UI state |
| Axios | HTTP client (singleton in `web/src/lib/api.ts`) |
| Lucide React | Icon set |

### Database

PostgreSQL 16. Schema managed via Goose migrations in `internal/database/migrations/`.

### Deployment

- **Production**: Docker multi-stage build → single Alpine binary image
- **Dev DB**: `docker compose -f docker-compose.dev.yml up -d`
- **Dev backend**: `air` (live reload)
- **Dev frontend**: `cd web && npm run dev` (proxies `/api` and `/ws` to Go on `:8876`)
- **Frontend env**: `web/.env` — Vite reads `VITE_API_TARGET` and `VITE_WS_TARGET` for proxy config (dev only, gitignored)

---

## Project Structure

```
genki-uptime-monitoring/
├── cmd/server/main.go                   # Entrypoint: config → DB → migrate → scheduler → HTTP
├── internal/
│   ├── api/
│   │   ├── server.go                    # Echo setup, all route registrations
│   │   ├── static.go                    # Embed note (prod: web/dist embedded here)
│   │   ├── handlers/
│   │   │   ├── apikey.go                # CRUD /api-keys + LookupAPIKey helper
│   │   │   ├── auth.go                  # POST /auth/login, /auth/register
│   │   │   ├── monitor.go               # CRUD + /logs + /visibility (PATCH)
│   │   │   ├── incident.go              # List/Get/Update incidents
│   │   │   ├── heartbeat.go             # List + public Push endpoint
│   │   │   ├── stats.go                 # GET /stats/overview
│   │   │   ├── uptime_series.go         # GET /stats/uptime-series?range=
│   │   │   ├── notification.go          # CRUD notification_channels
│   │   │   ├── public.go                # GET /public/status (no auth)
│   │   │   ├── profile.go               # GET/PUT /profile, POST /profile/password
│   │   │   ├── websocket.go             # WebSocket hub
│   │   │   └── appsettings.go           # GET/PUT /settings/general
│   │   └── middleware/
│   │       └── jwt.go                   # JWT + API key validation, GetUserID(c)
│   ├── checker/checker.go               # HTTP healthcheck logic → Result
│   ├── config/config.go                 # Env var loading
│   ├── database/
│   │   ├── database.go                  # Connect + goose migrate
│   │   └── migrations/
│   │       ├── 00001_init.sql           # users, monitors, monitor_logs, incidents, heartbeats, api_keys
│   │       ├── 00002_add_monitor_public.sql    # monitors.public + public_slug
│   │       ├── 00003_notification_channels.sql # notification_channels table
│   │       ├── 00004_fix_notification_unique.sql
│   │       ├── 00005_app_settings.sql   # app_settings key-value table
│   │       └── 00006_incidents_soft_fk.sql     # incidents.monitor_id SET NULL on delete
│   ├── models/                          # Plain Go structs matching DB schema
│   ├── notifier/
│   │   ├── notifier.go                  # Payload, Notifier interface, GoogleChat/Telegram/Slack/Webhook senders
│   │   └── dispatcher.go               # Load enabled channels from DB, fan-out goroutines
│   └── scheduler/scheduler.go          # Cron every 10s: check due monitors, insert logs, fire notifs
├── web/                                 # React + Vite frontend
│   ├── .env                             # Frontend env (gitignored) — VITE_API_TARGET, VITE_WS_TARGET
│   ├── .env.example                     # Template for web/.env
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/                  # Sidebar, Layout
│   │   │   └── ui/                      # Card, StatusBadge, MiniSparkline, UptimeBars, NextCheckBar
│   │   ├── hooks/                       # useMonitors, useIncidents, useHeartbeats, useProfile,
│   │   │                                # useNotifications, useUptimeSeries, useOverviewStats,
│   │   │                                # usePublicStatus, useSiteTitle, useApiKeys
│   │   ├── lib/api.ts                   # Axios instance with JWT interceptor + 401 redirect
│   │   ├── pages/                       # Overview, Monitors, Incidents, Heartbeats,
│   │   │                                # Notifications, Settings, Login, PublicStatus
│   │   ├── store/                       # Zustand stores (UI state)
│   │   ├── types/index.ts               # Shared TypeScript types (incl. ApiKey)
│   │   └── App.tsx                      # QueryClient, BrowserRouter, routes
│   └── package.json
├── docker-compose.yml                   # Production: app + postgres
├── docker-compose.dev.yml              # Development: postgres only
├── Dockerfile                           # 3-stage: frontend-builder → go-builder → alpine
├── Makefile                             # make help / migrate-* / dev-* / docker-*
├── .air.toml                            # Go live reload config
└── .env.example                         # Template for environment variables
```

---

## API Routes

### Public (no auth)
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/auth/login` | Login, returns JWT + user |
| POST | `/api/v1/auth/register` | Register first user |
| POST | `/api/v1/heartbeats/:slug` | Push heartbeat ping |
| GET  | `/api/v1/public/status` | All public monitors + logs |
| GET  | `/api/v1/public/status/:slug` | Single public monitor |

### Protected (Bearer JWT or API key)

All protected endpoints accept `Authorization: Bearer <jwt>` **or** `Authorization: Bearer gk_<apikey>`.

| Method | Path | Description |
|---|---|---|
| GET/PUT | `/api/v1/profile` | Get/update user profile |
| POST | `/api/v1/profile/password` | Change password |
| GET/PUT | `/api/v1/settings/general` | App-wide settings (site_name, timezone, etc.) |
| GET | `/api/v1/monitors` | List monitors (includes `last_response_time`) |
| POST | `/api/v1/monitors` | Create monitor |
| GET/PUT/DELETE | `/api/v1/monitors/:id` | Get, update, delete |
| GET | `/api/v1/monitors/:id/logs` | Check history |
| PATCH | `/api/v1/monitors/:id/visibility` | Toggle public flag |
| GET/PUT/DELETE | `/api/v1/incidents/:id` | Incident management |
| GET | `/api/v1/heartbeats` | List heartbeats |
| GET | `/api/v1/stats/overview` | Dashboard stats |
| GET | `/api/v1/stats/uptime-series?range=` | Time-series uptime (1h/6h/24h/7d/30d) |
| GET/POST | `/api/v1/notifications` | List/upsert notification channels |
| DELETE | `/api/v1/notifications/:id` | Remove channel |
| PATCH | `/api/v1/notifications/:id/enabled` | Toggle channel on/off |
| GET | `/api/v1/api-keys` | List API keys (key values masked) |
| POST | `/api/v1/api-keys` | Generate new API key (full key returned once) |
| DELETE | `/api/v1/api-keys/:id` | Revoke API key |

---

## Environment Variables

### Backend (`.env`)

| Variable | Required | Description |
|---|---|---|
| `APP_ENV` | No | `development` or `production` (default: `development`) |
| `PORT` | No | HTTP listen address (default: `:8080`) |
| `DATABASE_URL` | Yes | Full PostgreSQL connection string |
| `JWT_SECRET` | Yes | Min 32-char random string |

Copy `.env.example` to `.env` for local development. **Never commit `.env`.**

### Frontend (`web/.env`)

Only used by the Vite dev server — has no effect on production builds.

| Variable | Default | Description |
|---|---|---|
| `VITE_API_TARGET` | `http://localhost:8876` | Backend URL for `/api` proxy |
| `VITE_WS_TARGET` | `ws://localhost:8876` | Backend URL for `/ws` proxy |

Copy `web/.env.example` to `web/.env` for local development. **Never commit `web/.env`** (it is gitignored in `web/.gitignore`).

---

## Database Notes

- All migrations are in `internal/database/migrations/` as `NNNNN_description.sql`
- Goose runs migrations automatically on app start via embedded FS
- New migrations: `make migrate-create name=describe_change`
- Never edit existing migration files — always add a new one
- `incidents.monitor_id` is nullable — incidents survive monitor deletion (`ON DELETE SET NULL`)
- `notification_channels.type` is UNIQUE — one config per channel type
- `app_settings` is a key-value table with upsert semantics
- `api_keys.key` is UNIQUE; keys start with `gk_` followed by 64 hex chars

---

## API Keys

- Keys are generated with `crypto/rand` — format: `gk_` + 64 random hex chars
- The full key is returned **once** at creation time and never again (list endpoint masks to prefix + `…`)
- `api_keys.last_used` is updated asynchronously (goroutine) on each successful request
- Expired keys (past `expires_at`) are rejected; `expires_at = NULL` means no expiry
- The JWT middleware (`middleware.JWT(secret, db)`) handles both JWT and API key auth transparently — downstream handlers call `middleware.GetUserID(c)` as usual

---

## Notification Channels

Supported channels: `google_chat`, `slack`, `telegram`, `webhook`.

Each channel config (stored as JSONB) supports:
- `webhook_url` / `url` — destination endpoint
- `down_message` — template for monitor-down events
- `recovery_message` — template for recovery events
- `custom_message` — legacy fallback (single template)

Template variables: `{{monitor_name}}`, `{{monitor_url}}`, `{{status}}`, `{{response_time}}`, `{{error_message}}`, `{{checked_at}}`

Notifications are dispatched as goroutines by `notifier.Dispatcher` when:
- Monitor status transitions to `down` (was not already down)
- Monitor status transitions to `up` from `down` (recovery)

---

## Coding Conventions

### Go
- Package names: lowercase single word (`handlers`, `checker`, `scheduler`)
- Handler structs inject `db *sqlx.DB` via `New*` constructor
- Return `echo.NewHTTPError(statusCode, message)` for all API errors — include real error detail in message for non-500 errors
- Always use `context.Context` for DB queries and HTTP requests
- Never put business logic in `main.go`
- Use `$1, $2, ...` PostgreSQL placeholders — never string concatenation in queries
- New DB columns always in a new migration file, never edit existing ones

### TypeScript / React
- Functional components only, one component per file (PascalCase filename)
- All API calls through Axios instance in `web/src/lib/api.ts`
- TanStack Query for all server state; Zustand for UI-only state
- Custom hooks in `web/src/hooks/`, prefixed with `use`
- Inline styles for component styling (no Tailwind classes in component JSX — Tailwind only via `index.css` for globals)
- No inline styles for `color`, `background` — use CSS variables from `index.css` where possible

---

## Development Workflow

```bash
# 1. Start PostgreSQL
make dev-db

# 2. Copy and fill backend environment
cp .env.example .env

# 3. Copy and fill frontend environment
cp web/.env.example web/.env

# 4. Start Go with live reload
air

# 5. Start frontend dev server (separate terminal)
cd web && npm run dev
```

Frontend at `http://localhost:5173`, Go API at `http://localhost:8876`.
Vite proxies `/api` and `/ws` to the Go server using targets from `web/.env`.

On first run, the app redirects to `/setup` — create your admin account there. After that, login is via `/login`.

---

## Production Build (Docker)

```bash
# Build and start
docker compose up -d --build

# View logs
make docker-logs

# Stop
make docker-down
```

The Dockerfile uses a 3-stage build:
1. `frontend-builder` — `npm ci && npm run build`
2. `go-builder` — copies `web/dist` into embed path, `CGO_ENABLED=0 go build`
3. Final `alpine:3.20` — only the compiled binary (~15–20 MB image)

---

## Security Notes

- `.env` is in `.gitignore` — never commit it
- `JWT_SECRET` must be at least 32 characters
- WebSocket `CheckOrigin` should be restricted in production (currently allows all origins)
- Passwords are hashed with bcrypt (cost=10)
- All SQL queries use parameterized placeholders
- API keys use `crypto/rand` — never `math/rand`
