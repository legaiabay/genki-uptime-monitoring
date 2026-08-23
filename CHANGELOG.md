# v1.1.0 (2026-08-23)

## Features

- **Password Reset**: forgot-password flow at `/forgot-password` — gated by `RESET_SECRET` env var; enter the secret + new password to reset without email; if `RESET_SECRET` is unset the endpoint returns `403` and the link is non-functional
  - `POST /api/v1/auth/reset-password` (public endpoint)
  - `ForgotPassword.tsx` page linked from the login screen

- **Show/Hide URLs on Public Pages**: global toggle in the Monitors toolbar controls whether monitor URLs are visible on all public status pages
  - `GET /api/v1/settings/show-url` — read current value
  - `PATCH /api/v1/settings/show-url` — update value (`{ "show_url": true|false }`)
  - Stored in `app_settings` table under key `show_url_on_public`
  - `useShowURLSetting` / `useToggleShowURL` hooks with optimistic update
  - Public status handlers (`/public/status`, `/public/status/group/:slug`) respect the setting

- **App Log Viewer**: live application log stream accessible at Settings → Logs
  - In-memory ring buffer (`internal/applog`) captures all `log.Printf` output — 500 entries, FIFO eviction
  - `GET /api/v1/logs` returns a JSON snapshot of buffered entries (protected endpoint)
  - WebSocket broadcasts each new log entry as `{"type":"log","payload":{...}}` in real time
  - Frontend toolbar: live/disconnected badge, entry count, message search, level filter (info/warn/error/debug), pause/resume auto-scroll, download as `.txt`, clear view
  - Log levels auto-detected from message content; default is `info`
  - JWT middleware extended to accept token via `?token=` query parameter — required because browsers cannot send custom headers during WebSocket upgrade

## Changes

- `RESET_SECRET` added to `.env.example` (commented out by default)
- `internal/config` loads `RESET_SECRET` env var
- Vite proxy: `/api/v1/ws` rule with `ws: true` added before the generic `/api` rule so WebSocket upgrade is handled correctly in dev

---

# v1.0.0 (2026-08-23)

## Features

- **Monitor Groups**: assign monitors to named groups — grouped view on the Monitors page with collapsible sections and inline up/down counts per group
- **Monitor Labels**: tag monitors with free-text labels — label chips displayed on monitor rows, public cards, and group pages
- **Sidebar Filters**: click any group or label in the sidebar to filter the monitor list; active filters shown as dismissible badges in the toolbar
- **Monitor Search**: search across monitor name, URL, group name, and labels simultaneously
- **MonitorModal**: group autocomplete input with inline group creation; labels tag input (Enter or comma to add, Backspace to remove)
- **Public Group Pages**: `GET /api/v1/public/status/group/:groupSlug` — public status page scoped to one group with breadcrumb, stat row, and monitor cards
- **Public Groups API**: `GET /api/v1/public/groups` — list groups that have public monitors with status summary (up/down/degraded counts)
- **Monitor Groups API**: `GET /api/v1/monitors/groups` — list distinct group names for the authenticated user
- **GroupPublicStatus Page**: new `/status/group/:groupSlug` frontend route with breadcrumb navigation, responsive stat row, and labeled monitor cards
- **Group Nav Pills**: main `/status` page shows group navigation pills linking to individual group pages
- **Overview Group Filter**: search bar and group filter pills on the monitor table in the Overview dashboard
- **API Keys**: generate and manage API keys (`gk_` + 64 random hex chars) for programmatic access to all protected endpoints
- **API Keys CRUD**: `GET`, `POST /api/v1/api-keys`, `DELETE /api/v1/api-keys/:id` — full key returned once at creation, masked in list responses
- **API Key Expiry**: optional `expires_at`; expired keys are rejected; `last_used` updated asynchronously on each successful request
- **Dual Auth**: JWT middleware transparently accepts both `Bearer <jwt>` and `Bearer gk_<apikey>` — all protected handlers call `middleware.GetUserID(c)` as usual
- **HTTP Monitoring**: periodic HTTP endpoint healthchecks on a configurable cron schedule
- **Incident Tracking**: automatic incident creation and resolution on status transitions; incidents survive monitor deletion (`ON DELETE SET NULL`)
- **Check History**: per-monitor check log available via `GET /api/v1/monitors/:id/logs`
- **Heartbeats**: push-based heartbeat monitoring via `POST /api/v1/heartbeats/:slug`; heartbeat list in the dashboard
- **Public Status Pages**: `GET /api/v1/public/status` (all public monitors) and `GET /api/v1/public/status/:slug` (single monitor); toggle visibility via `PATCH /api/v1/monitors/:id/visibility`
- **Notifications**: Google Chat, Slack, Telegram, and Webhook channels; per-channel `down_message` and `recovery_message` templates; fan-out dispatch via goroutines on status transitions
- **Notification Templates**: variables `{{monitor_name}}`, `{{monitor_url}}`, `{{status}}`, `{{response_time}}`, `{{error_message}}`, `{{checked_at}}`
- **App Settings**: key-value settings store (`GET/PUT /api/v1/settings/general`) for site name, timezone, and other app-wide config
- **Authentication**: JWT-based login with bcrypt password hashing (cost=10); first-run setup flow at `/setup`
- **User Profile**: `GET/PUT /api/v1/profile` and `POST /api/v1/profile/password` for profile management and password change
- **WebSocket**: real-time UI updates pushed to connected clients via `gorilla/websocket`
- **Single Docker Image**: 3-stage build (frontend builder → Go binary → Alpine runtime); `docker compose up -d --build` for production

## Changes

- Monitor list ordered by `group_name` then `created_at`
- Public status page groups monitors by `group_name` with section headers
- Removed hardcoded default user creation on first start — replaced by the `/setup` onboarding flow
- `NextCheckBar` indicator turns yellow while a check is actively in progress (previously red)
- Route registration order enforced: `/monitors/groups` before `/monitors/:id`; `/public/status/group/:groupSlug` before `/public/status/:slug` to prevent Echo parameter conflicts
- Public status pages fully mobile-responsive (single-column grid on ≤640 px; `min-width: 0` on grid children; percentage text moved below bar to prevent overflow)
