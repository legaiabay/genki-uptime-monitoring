# syntax=docker/dockerfile:1

# ─── Stage 1: Build Frontend ───────────────────────────────────────────────────
FROM node:22-alpine AS frontend-builder

WORKDIR /app/web

# Copy manifests first — this layer is cached until package*.json changes.
COPY web/package*.json ./

# Mount the npm download cache so packages are not re-fetched on every build.
RUN --mount=type=cache,target=/root/.npm \
    npm ci

COPY web/ ./

# Cap Node.js V8 heap at 1 GB so the GC kicks in aggressively before the
# OOM killer does. Rollup's peak RSS can exceed 1.5 GB with defaults, which
# exhausts a t3.small (2 GB) when OS + Docker overhead is included.
ENV NODE_OPTIONS="--max-old-space-size=1024"

# `build:docker` runs `vite build` only (no tsc type-check).
RUN npm run build:docker

# ─── Stage 2: Build Go Binary ──────────────────────────────────────────────────
FROM golang:1.24-alpine AS go-builder

WORKDIR /app

RUN apk add --no-cache git

# Copy manifests first so module downloads are cached independently of source.
COPY go.mod go.sum ./

# Mount the Go module cache and the build cache.
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

# Copy source and the built frontend.
COPY . .
COPY --from=frontend-builder /app/web/dist ./internal/api/web/dist

ARG VERSION=dev

# -p=1      — one compiler process at a time; prevents two concurrent
#             compilations from doubling peak RSS.
# GOGC=30   — GC triggers at 30% heap growth instead of the default 100%;
#             trades a bit of CPU for much lower peak memory.
# GOMEMLIMIT — hard cap on the Go runtime heap; forces collection before the
#              OOM killer can fire. Leave ~400 MB headroom for OS + Docker.
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux \
    GOFLAGS="-p=1" \
    GOGC=30 \
    GOMEMLIMIT=1200MiB \
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
