# API Keys

API keys let you authenticate against any protected endpoint without a session JWT — useful for scripts, CI/CD pipelines, or external integrations.

## Generating a Key

Go to **Settings → API Keys** and click **Generate Key**. Give it a descriptive name (e.g. `CI pipeline`). The full key is shown **once** — copy it before closing the dialog.

Keys follow the format `gk_<64 hex chars>`.

## Using a Key

Pass the key as a Bearer token in the `Authorization` header, exactly as you would a JWT:

```bash
curl -H "Authorization: Bearer gk_your_key_here" \
  https://your-instance.com/api/v1/monitors
```

```js
const res = await fetch('https://your-instance.com/api/v1/monitors', {
  headers: { 'Authorization': 'Bearer gk_your_key_here' }
})
const { data } = await res.json()
```

```python
import requests
r = requests.get(
    'https://your-instance.com/api/v1/monitors',
    headers={'Authorization': 'Bearer gk_your_key_here'}
)
monitors = r.json()['data']
```

## API Collections

Downloadable Postman (v2.1) and Bruno collections are available directly from **Settings → API Keys**, pre-configured with all endpoints and a bundled environment. Replace the `apiKey` variable in the environment with your generated key.

## Revoking a Key

Click the trash icon next to the key in **Settings → API Keys**. Revoked keys are rejected immediately.

## REST API Reference

Base URL: `https://your-instance.com/api/v1`

All protected routes accept `Authorization: Bearer <jwt-or-api-key>`.

### Public (no auth)

| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/login` | Login, returns JWT + user |
| `POST` | `/auth/register` | Register the first user |
| `POST` | `/heartbeats/:slug` | Push a heartbeat ping |
| `GET` | `/public/status` | All public monitors + logs |
| `GET` | `/public/status/:slug` | Single public monitor |

### Monitors

| Method | Path | Description |
|---|---|---|
| `GET` | `/monitors` | List all monitors |
| `POST` | `/monitors` | Create a monitor |
| `GET` | `/monitors/:id` | Get a single monitor |
| `PUT` | `/monitors/:id` | Update a monitor |
| `DELETE` | `/monitors/:id` | Delete a monitor |
| `GET` | `/monitors/:id/logs` | Get check history |
| `PATCH` | `/monitors/:id/visibility` | Toggle public flag |

### Incidents

| Method | Path | Description |
|---|---|---|
| `GET` | `/incidents` | List incidents |
| `GET` | `/incidents/:id` | Get an incident |
| `PUT` | `/incidents/:id` | Update an incident |

### Heartbeats

| Method | Path | Description |
|---|---|---|
| `GET` | `/heartbeats` | List heartbeat monitors |

### Stats

| Method | Path | Description |
|---|---|---|
| `GET` | `/stats/overview` | Dashboard overview stats |
| `GET` | `/stats/uptime-series` | Time-series uptime (`?range=1h\|6h\|24h\|7d\|30d`) |

### Notifications

| Method | Path | Description |
|---|---|---|
| `GET` | `/notifications` | List notification channels |
| `POST` | `/notifications` | Create or update a channel |
| `DELETE` | `/notifications/:id` | Remove a channel |
| `PATCH` | `/notifications/:id/enabled` | Toggle channel on/off |

### API Keys

| Method | Path | Description |
|---|---|---|
| `GET` | `/api-keys` | List keys (values masked) |
| `POST` | `/api-keys` | Generate a new key (full value returned once) |
| `DELETE` | `/api-keys/:id` | Revoke a key |

### Profile & Settings

| Method | Path | Description |
|---|---|---|
| `GET` | `/profile` | Get your profile |
| `PUT` | `/profile` | Update your profile |
| `POST` | `/profile/password` | Change password |
| `GET` | `/settings/general` | Get app-wide settings |
| `PUT` | `/settings/general` | Update app-wide settings |
