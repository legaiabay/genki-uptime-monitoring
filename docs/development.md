# Development Guide

## Prerequisites

- Go 1.23+
- Node.js 22+
- PostgreSQL 16
- [air](https://github.com/air-verse/air) for Go live reload

```bash
go install github.com/air-verse/air@latest
```

## Setup

```bash
# 1. Start local PostgreSQL via Docker
make dev-db

# 2. Configure backend environment
cp .env.example .env
# Edit .env as needed

# 3. Configure frontend environment
cp web/.env.example web/.env
# Edit web/.env if your backend runs on a different port

# 4. Start Go backend with live reload
air

# 5. Start frontend dev server (separate terminal)
cd web && npm install && npm run dev
```

| Service | URL |
|---|---|
| Frontend | `http://localhost:5173` |
| API | `http://localhost:8876` |

Vite proxies `/api` and `/ws` to the Go backend automatically. The proxy target is read from `web/.env`.

On first run, the app redirects to `http://localhost:5173/setup` — fill in your name, email, and password to create the admin account. After that, login is via `/login`.

## Frontend Environment Variables

`web/.env` controls the Vite dev server proxy. It is separate from the root `.env` (which is for the Go backend).

| Variable | Default | Description |
|---|---|---|
| `VITE_API_TARGET` | `http://localhost:8876` | Backend URL for `/api` proxy |
| `VITE_WS_TARGET` | `ws://localhost:8876` | Backend URL for `/ws` proxy |

Copy `web/.env.example` to `web/.env` to get started. The file is gitignored — never commit it.

> These variables only affect the local dev server. They have no effect on the production build.

## Backend Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Random string, min 32 chars |
| `APP_ENV` | No | `development` (default) or `production` |
| `PORT` | No | HTTP listen port (default `:8876` via air, `:8080` in production) |
| `RESET_SECRET` | No | If set, enables the forgot-password flow at `POST /api/v1/auth/reset-password` |

## Project Structure

```
genki-uptime-monitoring/
│── cmd/server/main.go          # Entrypoint: config → DB → migrate → scheduler → HTTP
├── internal/
│   ├── api/
│   │   ├── server.go           # Echo setup, all route registrations
│   │   ├── static.go           # Embedded frontend (production)
│   │   ├── handlers/           # One file per resource group
│   │   │   ├── apikey.go       # CRUD /api-keys
│   │   │   ├── auth.go         # POST /auth/login, /auth/register, /auth/reset-password
│   │   │   ├── monitor.go      # CRUD + /logs + /visibility + /groups + /favorite + /bulk
│   │   │   ├── grouplabel.go   # GET/PUT/DELETE /settings/groups + /settings/labels
│   │   │   ├── incident.go     # List/Get/Update incidents
│   │   │   ├── heartbeat.go    # List + public Push endpoint
│   │   │   ├── stats.go        # GET /stats/overview
│   │   │   ├── uptime_series.go
│   │   │   ├── notification.go
│   │   │   ├── public.go       # Public status pages (no auth)
│   │   │   ├── profile.go
│   │   │   ├── websocket.go
│   │   │   └── appsettings.go
│   │   └── middleware/
│   │       └── jwt.go          # JWT + API key auth, GetUserID(c)
│   ├── checker/checker.go      # HTTP/TCP/ping check logic
│   ├── config/config.go        # Env var loading
│   ├── database/
│   │   ├── database.go         # Connect + goose migrate
│   │   └── migrations/         # Goose SQL migration files
│   │       ├── 00001_init.sql
│   │       ├── 00002_add_monitor_public.sql
│   │       ├── 00003_notification_channels.sql
│   │       ├── 00004_fix_notification_unique.sql
│   │       ├── 00005_app_settings.sql
│   │       ├── 00006_incidents_soft_fk.sql
│   │       ├── 00007_monitor_groups_labels.sql   # group_name, labels TEXT[]
│   │       └── 00008_add_monitor_favorite.sql    # favorite BOOLEAN
│   ├── models/                 # Go structs matching DB schema
│   ├── notifier/               # Channel senders + fan-out dispatcher
│   └── scheduler/scheduler.go  # Cron: check due monitors, insert logs, fire notifs
├── web/
│   ├── .env                    # Frontend env (gitignored) — VITE_API_TARGET, VITE_WS_TARGET
│   ├── .env.example            # Template for web/.env
│   └── src/
│       ├── components/         # Layout, UI primitives (Card, StatusBadge, NextCheckBar…)
│       │   ├── layout/         # Sidebar (with theme toggle + user avatar), Layout
│       │   ├── settings/       # Settings tab components (GroupsLabelsTab…)
│       │   └── ui/             # Card, StatusBadge, MiniSparkline, UptimeBars, NextCheckBar, UserAvatar
│       ├── hooks/              # TanStack Query hooks (one file per resource)
│       │   ├── useMonitors.ts  # includes useGroups(), useToggleFavorite(), useBulkUpdateMonitors()
│       │   ├── useGroupsLabels.ts  # Groups & Labels manager hooks
│       │   └── usePublicStatus.ts  # includes useGroupPublicStatus(), usePublicGroups()
│       ├── lib/api.ts          # Axios singleton with JWT interceptor
│       ├── pages/              # One file per route
│       │   ├── ForgotPassword.tsx     # /forgot-password — reset via RESET_SECRET
│       │   ├── PublicStatus.tsx       # /status — all public monitors
│       │   └── GroupPublicStatus.tsx  # /status/group/:groupSlug
│       ├── store/              # Zustand UI state
│       │   └── themeStore.ts   # light/dark theme, persisted to localStorage
│       └── types/index.ts      # Shared TypeScript types
├── docker-compose.yml          # Production stack
├── docker-compose.dev.yml      # Dev: PostgreSQL only
├── Dockerfile
├── Makefile
└── .air.toml
```

## Public Status Pages

There are three public status endpoints, all unauthenticated:

| URL | Description |
|---|---|
| `/status` | All public monitors, grouped by group |
| `/status/group/:groupSlug` | Monitors belonging to one group |

Group slugs are derived from the group name: lowercase, spaces replaced with hyphens. For example, `My API` → `my-api`.

The main `/status` page shows group nav pills linking to each group page when groups exist.

## Makefile Reference

```
make dev-db              Start local PostgreSQL via Docker
make dev-db-stop         Stop local PostgreSQL
make run                 Start Go server with air (live reload)
make build               Build Go binary → ./bin/genki
make migrate-create      Create new migration file (name=xxx)
make migrate-up          Apply pending migrations
make migrate-down        Roll back last migration
make migrate-status      Show migration status
make frontend-dev        Start Vite dev server
make frontend-build      Build frontend for production
make docker-up           Build and start production stack
make docker-down         Stop production stack
make docker-logs         Tail application logs
```

## Coding Conventions

### Go

- Package names: lowercase single word (`handlers`, `checker`, `scheduler`)
- Handler structs receive `db *sqlx.DB` via `New*` constructor
- Use `echo.NewHTTPError(statusCode, message)` for all API errors
- Always pass `context.Context` to DB queries and outbound HTTP requests
- Never put business logic in `main.go`
- Use `$1, $2, ...` PostgreSQL placeholders — no string interpolation in queries
- New columns always in a new migration file; never edit existing migrations
- Use `pq.StringArray` / `pq.Array()` for PostgreSQL `TEXT[]` columns

### TypeScript / React

- Functional components only, one component per file (PascalCase filename)
- All API calls through the Axios singleton in `web/src/lib/api.ts`
- TanStack Query for all server state; Zustand for UI-only state
- Custom hooks in `web/src/hooks/`, prefixed with `use`
- Inline styles for component styling (no Tailwind classes in JSX — Tailwind only via `index.css` for globals)
- Prefer CSS variables from `index.css` over hardcoded color/background values
- Shared utilities (e.g. `labelColor`, `groupSlugify`, `MiniBar`, `MonitorCard`) exported from `PublicStatus.tsx` and re-used in `GroupPublicStatus.tsx`
