# syntax=docker/dockerfile:1

# ─── Stage 1: Build Frontend ───────────────────────────────────────────────────
FROM node:22-alpine AS frontend-builder

WORKDIR /app/web

# Copy manifests first — this layer is cached until package*.json changes.
COPY web/package*.json ./

# Mount the npm download cache so packages are not re-fetched on every build.
# The cache dir lives outside the image layer (never bloats the final image).
RUN --mount=type=cache,target=/root/.npm \
    npm ci

COPY web/ ./

# Skip tsc type-checking here — that belongs in CI, not artifact production.
# `build:docker` runs `vite build` only, which is ~2–3× faster than the full
# `tsc -b && vite build` script.
RUN npm run build:docker

# ─── Stage 2: Build Go Binary ──────────────────────────────────────────────────
FROM golang:1.24-alpine AS go-builder

WORKDIR /app

RUN apk add --no-cache git

# Copy manifests first so module downloads are cached independently of source.
COPY go.mod go.sum ./

# Mount the Go module cache and the build cache.
# Both persist across builds and never end up in the image.
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

# Copy source and the built frontend.
COPY . .
COPY --from=frontend-builder /app/web/dist ./internal/api/web/dist

ARG VERSION=dev
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux \
    GOFLAGS="-p=2" \
    GOGC=50 \
    go build \
    -ldflags="-w -s -X github.com/abdulkhobirfauzi/genki-uptime-monitoring/internal/api/handlers.AppVersion=${VERSION}" \
    -o /app/bin/genki \
    ./cmd/server

# ─── Stage 3: Final Minimal Image ──────────────────────────────────────────────
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=go-builder /app/bin/genki .

EXPOSE 8080

USER nobody:nobody

ENTRYPOINT ["./genki"]
