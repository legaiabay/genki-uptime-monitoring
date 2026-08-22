# ─── Stage 1: Build Frontend ───────────────────────────────────────────────────
FROM node:22-alpine AS frontend-builder

WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci --frozen-lockfile

COPY web/ ./
RUN npm run build

# ─── Stage 2: Build Go Binary ──────────────────────────────────────────────────
FROM golang:1.23-alpine AS go-builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# Download Go modules first (cache layer)
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Copy built frontend into the expected embed path
COPY --from=frontend-builder /app/web/dist ./internal/api/web/dist

RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-w -s" \
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
