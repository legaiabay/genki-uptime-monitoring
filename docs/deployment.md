# Deployment

## Docker (Production)

The recommended way to run Genki in production is with the included Docker Compose stack.

```bash
cp .env.example .env
# Fill in DATABASE_URL, JWT_SECRET, and optionally PORT

docker compose up -d --build

# View logs
docker compose logs -f app

# Stop
docker compose down
```

The app will be available on the port configured in `PORT` (default `:8080`).

## Docker Image

The `Dockerfile` uses a three-stage build:

1. **`frontend-builder`** — installs Node dependencies, runs `npm run build`
2. **`go-builder`** — copies the frontend `dist` into the embed path, compiles the binary with `CGO_ENABLED=0`
3. **Final stage** — Alpine 3.20 with only the compiled binary

Result: a single self-contained image of approximately 15–20 MB. No separate Node runtime or static file server is needed.

## Makefile Shortcuts

```bash
make docker-up      # build and start
make docker-down    # stop
make docker-logs    # tail app logs
```

## Reverse Proxy

Genki listens on a single port. To put it behind nginx or Caddy:

**nginx**
```nginx
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

The `Upgrade` / `Connection` headers are required for the WebSocket connection (`/ws`).

**Caddy**
```caddyfile
your.domain.com {
    reverse_proxy localhost:8080
}
```

## Security Checklist

- [ ] Never commit `.env` — it is in `.gitignore`
- [ ] `JWT_SECRET` must be at least 32 characters (`openssl rand -hex 32`)
- [ ] Change the default `admin@genki.local` / `admin123` credentials immediately
- [ ] Run Genki behind a reverse proxy with TLS in production
- [ ] Restrict WebSocket `CheckOrigin` to your own domain (currently allows all origins)
- [ ] Passwords are hashed with bcrypt — no plain-text storage
- [ ] All SQL queries use parameterized placeholders
- [ ] API keys use `crypto/rand` — never `math/rand`
