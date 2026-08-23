# v1.2.0 (2026-08-24)

## Features

- **Favorite Monitors**: star any monitor to pin it to the top of the list; favorite state persisted in the DB (`monitors.favorite` boolean column, migration `00008`)
  - `PATCH /api/v1/monitors/:id/favorite` — toggle favorite for a single monitor (`{ "favorite": true|false }`)
  - Monitor list ordered by `favorite DESC, group_name ASC, created_at DESC`
  - Overview uptime chart gains an **All / Favorites** toggle — defaults to Favorites when any monitor is starred, falls back to All otherwise
  - `GET /api/v1/stats/uptime-series?favorites_only=true` — server-side filter for the chart
  - `useToggleFavorite` hook with optimistic invalidation

- **Bulk Edit**: select multiple monitors on the Monitors page and apply shared fields in one request
  - `PATCH /api/v1/monitors/bulk` — accepts `ids[]` plus any combination of `type`, `interval`, `timeout`, `expected_status`, `max_retries`, `group_name`, `labels` / `set_labels`, `favorite` / `set_favorite`; only supplied fields are written
  - Checkbox column added to the monitor table; select-all toggle in the header
  - Bulk Edit modal with per-field enable toggles — unchecked fields are not changed
  - `useBulkUpdateMonitors` mutation hook; `BulkUpdatePayload` type exported from `useMonitors.ts`

- **Groups & Labels Manager**: new **Groups & Labels** tab in Settings for global rename and delete operations
  - `GET /api/v1/settings/groups` — list distinct non-empty group names with monitor counts
  - `PUT /api/v1/settings/groups/:name` — rename group across all monitors (`{ "name": "new name" }`)
  - `DELETE /api/v1/settings/groups/:name` — clear group from all monitors (sets `group_name = ''`)
  - `GET /api/v1/settings/labels` — list distinct labels with usage counts
  - `PUT /api/v1/settings/labels/:name` — rename label across all monitors
  - `DELETE /api/v1/settings/labels/:name` — remove label from all monitors
  - `internal/api/handlers/grouplabel.go` — new handler (`GroupLabelHandler`)
  - `useGroupsLabels.ts` hook file with `useGroupsWithCount`, `useLabelsWithCount`, `useRenameGroup`, `useDeleteGroup`, `useRenameLabel`, `useDeleteLabel`
  - `GroupsLabelsTab.tsx` settings component with inline rename inputs and delete-confirm modal

- **Downtime Duration in Recovery Notifications**: recovery notifications now include the total downtime duration
  - Scheduler queries `incidents.started_at` on recovery to compute elapsed time
  - `formatDuration` helper produces human-readable strings like `1h 23m 45s`
  - `notifier.Payload.DowntimeDuration` field — only populated for `EventRecovery`
  - Template variable `{{downtime_duration}}` available in `recovery_message` templates
  - Default recovery message appends `Downtime duration: …` when duration is known

- **Response Time Overlay on Uptime Chart**: uptime series now carries average response time per bucket
  - `uptimePoint.avg_response_time` added to the SQL query
  - `UptimeMonitorSeries.ResponseTimeValues []float64` — parallel to `Values`; available to the frontend chart

- **Light / Dark Theme**: toggle between light and dark mode from the sidebar footer
  - `themeStore.ts` — Zustand store with `persist` middleware; persisted under `genki-theme` in `localStorage`; defaults to dark
  - `index.css` gains a full `html.light { … }` CSS variable overrides block
  - Sidebar shows Sun / Moon icon toggle; logo swaps to `logo-dark.png` in light mode
  - Theme class applied to `<html>` in `Layout.tsx`

- **User Avatar**: generated avatar displayed in the sidebar next to the logged-in user's name
  - `UserAvatar.tsx` component wraps `boring-avatars` (beam variant, custom red palette)
  - Avatar derived from the user's display name — consistent across sessions

## Changes

- Settings page tabs are now URL-driven — active tab synced to `?tab=` query param; navigating directly to `/settings?tab=groups-labels` works
- Danger Zone moved to its own **Danger Zone** tab in Settings (previously inline at bottom of General)
- `web/package.json` gains `boring-avatars` dependency
- Old logo assets (`logo-old.png`, `logo-old-2.png`) removed from `web/src/assets/`

---

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
