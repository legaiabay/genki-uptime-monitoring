.PHONY: help dev-db dev-db-stop run build migrate-create migrate-up migrate-down migrate-status migrate-reset frontend-dev frontend-build docker-up docker-down

# Load .env so DATABASE_URL is available to goose
include .env
export

MIGRATION_DIR := internal/database/migrations
GOOSE := goose -dir $(MIGRATION_DIR) postgres "$(DATABASE_URL)"

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ─── Development ──────────────────────────────────────────────────────────────

dev-db: ## Start PostgreSQL for local development
	docker compose -f docker-compose.dev.yml up -d

dev-db-stop: ## Stop local PostgreSQL
	docker compose -f docker-compose.dev.yml down

run: ## Run Go server with live reload (requires air)
	air

build: ## Build Go binary
	go build -o bin/genki ./cmd/server

# ─── Migrations ───────────────────────────────────────────────────────────────

migrate-create: ## Create a new migration. Usage: make migrate-create name=add_something
ifndef name
	$(error Usage: make migrate-create name=add_something)
endif
	goose -dir $(MIGRATION_DIR) create $(name) sql

migrate-up: ## Apply all pending migrations
	$(GOOSE) up

migrate-up-one: ## Apply the next pending migration only
	$(GOOSE) up-by-one

migrate-down: ## Roll back the last migration
	$(GOOSE) down

migrate-status: ## Show migration status
	$(GOOSE) status

migrate-version: ## Show current migration version
	$(GOOSE) version

migrate-reset: ## Roll back ALL migrations (destructive)
	$(GOOSE) reset

# ─── Frontend ─────────────────────────────────────────────────────────────────

frontend-dev: ## Start Vite dev server
	cd web && npm run dev

frontend-build: ## Build frontend for production
	cd web && npm run build

# ─── Docker (production) ──────────────────────────────────────────────────────

docker-up: ## Build and start production stack
	docker compose up -d --build

docker-down: ## Stop production stack
	docker compose down

docker-logs: ## Tail app logs
	docker compose logs -f app
