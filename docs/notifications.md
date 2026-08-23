# Notifications

Configure notification channels in **Settings → Notifications** (or via the sidebar link).

## Supported Channels

| Channel | What you need |
|---|---|
| **Slack** | Incoming webhook URL |
| **Google Chat** | Incoming webhook URL |
| **Telegram** | Bot token + chat ID |
| **Webhook** | Any HTTP endpoint that accepts a POST request |

## When Notifications Fire

Genki sends a notification when:

- A monitor transitions to **down** (was not already down) — uses the *down message* template
- A monitor recovers to **up** from **down** — uses the *recovery message* template

Each event is dispatched as an independent goroutine, so a slow or failing channel does not block others.

## Message Templates

Both the down and recovery messages support the following template variables:

| Variable | Description |
|---|---|
| `{{monitor_name}}` | Human-readable monitor name |
| `{{monitor_url}}` | Target URL or address |
| `{{status}}` | `down` or `up` |
| `{{response_time}}` | Response time in milliseconds |
| `{{error_message}}` | Error detail (populated on down events) |
| `{{checked_at}}` | ISO 8601 timestamp of the check |
| `{{downtime_duration}}` | Human-readable downtime length, e.g. `1h 23m 45s` (recovery events only) |

### Example templates

**Down message**
```
🔴 *{{monitor_name}}* is DOWN
URL: {{monitor_url}}
Error: {{error_message}}
Time: {{checked_at}}
```

**Recovery message**
```
✅ *{{monitor_name}}* is back UP
Response time: {{response_time}}ms
Downtime: {{downtime_duration}}
Recovered at: {{checked_at}}
```

> `{{downtime_duration}}` is only populated for recovery events. On down-event templates it renders as an empty string.

## Channel Configuration (JSONB)

Each channel stores its config as JSONB. Supported fields:

| Field | Description |
|---|---|
| `webhook_url` / `url` | Destination webhook endpoint |
| `down_message` | Template used for down events |
| `recovery_message` | Template used for recovery events |
| `custom_message` | Legacy single-template fallback |

For Telegram, the config also requires `chat_id` alongside `token`.
