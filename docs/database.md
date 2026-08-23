# Database

## Migrations

Genki uses [Goose](https://github.com/pressly/goose) for schema management. Migrations run automatically on every application start via an embedded filesystem — no manual step required.

Migration files live in `internal/database/migrations/` and follow the naming convention `NNNNN_description.sql`.

### Manual migration commands

```bash
make migrate-create name=add_something   # create a new migration file
make migrate-up                          # apply all pending migrations
make migrate-down                        # roll back the last migration
make migrate-status                      # show applied / pending state
```

### Rules

- **Never edit an existing migration file.** Always create a new one.
- New columns or table changes must be in their own migration.
- All migrations are embedded in the binary at build time.

## Schema Notes

| Table | Notes |
|---|---|
| `users` | bcrypt-hashed passwords, role field (`admin` / `member`) |
| `monitors` | `type` is `http`, `tcp`, or `ping`; `public` + `public_slug` for status page; `group_name` and `labels TEXT[]` for organisation |
| `monitor_logs` | partitioned by `monitor_id`; indexed on `checked_at DESC` |
| `incidents` | `monitor_id` is nullable — incidents survive monitor deletion (`ON DELETE SET NULL`) |
| `notification_channels` | `type` is UNIQUE — one config per channel type; config stored as JSONB |
| `app_settings` | key-value table with upsert semantics |
| `api_keys` | `key` is UNIQUE; format `gk_<64 hex chars>`; `expires_at = NULL` means no expiry |
| `heartbeats` | records incoming pings; absence of pings within the interval triggers an incident |

## Groups & Labels

Two optional fields added to the `monitors` table:

| Column | Type | Description |
|---|---|---|
| `group_name` | `VARCHAR(100)` | Free-text group name (e.g. `Production`, `Staging`) |
| `labels` | `TEXT[]` | Array of short tags (e.g. `["api", "critical"]`) |

- `group_name` defaults to `''` (empty string) — monitors without a group are shown in an "Ungrouped" section
- `labels` is a PostgreSQL native array; queried with standard array operators
- Slugified group names (lowercase, spaces → hyphens) are used as URL-safe identifiers for group status pages (e.g. `My API` → `my-api`)
- Labels are stored lowercase with spaces converted to hyphens on input

## Heartbeats

Heartbeat monitors are passive — your service pings Genki rather than Genki polling your service.

### Setup

1. Create a **Heartbeat** monitor in the UI and note its slug.
2. Call the ping endpoint from your service on the expected schedule:

```bash
curl -X POST https://your-instance.com/api/v1/heartbeats/<slug>
```

3. If no ping arrives within the configured interval (plus grace period), Genki opens an incident automatically.

### Use cases

- Cron jobs — verify they ran successfully
- Background workers — confirm they are still alive
- Scheduled scripts — alert if they stop executing
