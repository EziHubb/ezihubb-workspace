.PHONY: help setup dev stop build \
        db-migrate db-seed db-reset db-studio lint type-check clean \
        logs shell-api

# Default target
help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n\nTargets:\n"} \
		/^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

# ── First-time setup ─────────────────────────────────────────────────────────
# Assumes DATABASE_URL/REDIS_URL in .env already point at a reachable
# Postgres/Redis (local or remote) — no bundled local infra to start here.
setup: ## Install deps, run migrations, seed DB
	cp -n .env.example .env || true
	pnpm install
	$(MAKE) db-migrate
	$(MAKE) db-seed
	@echo "\n✅  Setup complete. Run 'make dev' to start."

# ── Development ──────────────────────────────────────────────────────────────
dev: ## Start all apps in dev mode (api + client + admin)
	pnpm nx run-many -t serve -p client admin api --parallel=3

dev-api: ## Start API only
	pnpm nx serve api

dev-client: ## Start storefront only
	pnpm nx serve client

dev-admin: ## Start admin only
	pnpm nx serve admin

# ── Docker infra ─────────────────────────────────────────────────────────────
# docker-compose.yml is the production stack for the dedicated AWS EC2
# instance — pulls prebuilt images from GHCR (built by
# .github/workflows/docker-publish.yml); Postgres runs on RDS instead of in
# a container. Only relevant when running/debugging that stack directly.
stop: ## Stop all containers (docker-compose.yml)
	docker compose down

logs: ## Tail logs from all containers (docker-compose.yml)
	docker compose logs -f

# ── Database ──────────────────────────────────────────────────────────────────
db-migrate: ## Run pending migrations
	pnpm exec prisma migrate dev --schema=prisma/schema.prisma

db-migrate-deploy: ## Apply migrations (production-safe, no interactive prompts)
	pnpm exec prisma migrate deploy --schema=prisma/schema.prisma

db-seed: ## Seed database with default data
	pnpm exec ts-node prisma/seed.ts

db-reset: ## Drop all tables and re-run migrations + seed
	pnpm exec prisma migrate reset --force --schema=prisma/schema.prisma

db-studio: ## Open Prisma Studio
	pnpm exec prisma studio --schema=prisma/schema.prisma

db-generate: ## Re-generate Prisma client after schema changes
	pnpm exec prisma generate --schema=prisma/schema.prisma

# ── Code Quality ──────────────────────────────────────────────────────────────
lint: ## Lint all projects
	pnpm nx run-many -t lint --parallel=3

lint-fix: ## Lint and auto-fix
	pnpm nx run-many -t lint --parallel=3 -- --fix

type-check: ## Type-check all projects
	pnpm nx run-many -t type-check --parallel=3

# ── Build ─────────────────────────────────────────────────────────────────────
build: ## Build all apps for production
	pnpm nx run-many -t build

build-api: ## Build API only
	pnpm nx build api --configuration=production

build-client: ## Build storefront only
	pnpm nx build client --configuration=production

build-admin: ## Build admin only
	pnpm nx build admin --configuration=production

# ── Utilities ─────────────────────────────────────────────────────────────────
shell-api: ## Open a shell in the running API container
	docker compose exec api sh

clean: ## Remove all build artifacts and node_modules
	pnpm nx reset
	rm -rf dist coverage node_modules apps/*/node_modules libs/*/node_modules

install: ## Install all dependencies
	pnpm install

update-deps: ## Interactively update dependencies
	pnpm update --interactive --latest
