#!/bin/bash

# EziHubb — Deploy to AWS EC2 (builds directly on the instance)
#
# Runs from your local machine: SSHes into the EC2 instance, pulls the
# latest code, rebuilds only the Docker images whose own files (or a shared
# dependency) changed, runs pending Prisma migrations against RDS, and
# restarts the stack (docker-compose.yml: redis, mongodb, api, client,
# admin — Postgres runs on RDS, not a container).
#
# GitHub Actions CI-build (.github/workflows/docker-publish.yml, pushing to
# GHCR) is on hold for now — building happens here instead. Switching back
# later just means changing docker-compose.yml's `build:` blocks to
# `image: ${DOCKER_IMAGE_BASE}-...` pulls; this script would need the pull
# variant back too.
#
# Config (server IP/user, SSH key path, deploy path) lives in
# scripts/.deploy-config — gitignored, never commit real values.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/.deploy-config"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🚀 EziHubb — Deploy to EC2"
echo "=========================="
echo ""

if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}✗ Missing $CONFIG_FILE${NC}"
    echo "Create it with SERVER_IP, SERVER_USER, SSH_KEY, DEPLOY_PATH."
    exit 1
fi
# shellcheck source=/dev/null
source "$CONFIG_FILE"

: "${SERVER_IP:?SERVER_IP not set in $CONFIG_FILE}"
: "${SERVER_USER:?SERVER_USER not set in $CONFIG_FILE}"
: "${SSH_KEY:?SSH_KEY not set in $CONFIG_FILE}"
: "${DEPLOY_PATH:?DEPLOY_PATH not set in $CONFIG_FILE}"
GIT_BRANCH="${GIT_BRANCH:-main}"
if [ -z "$GIT_REPO" ]; then
    GIT_REPO="$(git -C "$SCRIPT_DIR/.." remote get-url origin 2>/dev/null || true)"
fi

if [ ! -f "$SSH_KEY" ]; then
    echo -e "${RED}✗ SSH key not found: $SSH_KEY${NC}"
    exit 1
fi
chmod 600 "$SSH_KEY" 2>/dev/null || true

SSH="ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new $SERVER_USER@$SERVER_IP"

# Safe minimum before touching the Docker builder at all — a `next build`'s
# own transient memory spike can push this into swap thrashing otherwise.
MIN_RAM_MB=400
MIN_DISK_GB=3

check_resources() {
    local avail_ram avail_disk
    avail_ram="$($SSH "free -m | awk '/^Mem:/{print \$7}'" 2>/dev/null)"
    avail_disk="$($SSH "df --output=avail -BG / | tail -1 | tr -dc '0-9'" 2>/dev/null)"
    echo "  RAM available: ${avail_ram:-?}MB | Disk available: ${avail_disk:-?}GB"
    if [ -z "$avail_ram" ] || [ "$avail_ram" -lt "$MIN_RAM_MB" ]; then
        echo -e "${RED}✗ RAM available (${avail_ram:-unknown}MB) is below the safe threshold (${MIN_RAM_MB}MB).${NC}"
        echo "Refusing to build. Check swap is enabled (free -h) and nothing else is eating memory."
        exit 1
    fi
    if [ -z "$avail_disk" ] || [ "$avail_disk" -lt "$MIN_DISK_GB" ]; then
        echo -e "${RED}✗ Disk available (${avail_disk:-unknown}GB) is below the safe threshold (${MIN_DISK_GB}GB).${NC}"
        exit 1
    fi
}

echo -e "${YELLOW}Checking SSH connection to $SERVER_USER@$SERVER_IP...${NC}"
if ! $SSH "echo ok" >/dev/null 2>&1; then
    echo -e "${RED}✗ Could not connect. Check SERVER_IP/SERVER_USER/SSH_KEY in $CONFIG_FILE.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Connected${NC}"

echo ""
echo -e "${YELLOW}Checking $DEPLOY_PATH on the server...${NC}"
if ! $SSH "test -d '$DEPLOY_PATH/.git'"; then
    echo -e "${YELLOW}⚠ Not found — this looks like a first deploy.${NC}"
    : "${GIT_REPO:?Cannot clone: GIT_REPO is empty and no local origin remote was found. Set GIT_REPO in $CONFIG_FILE.}"
    echo -e "${YELLOW}Cloning $GIT_REPO into $DEPLOY_PATH...${NC}"
    $SSH "mkdir -p '$(dirname "$DEPLOY_PATH")' && git clone --branch '$GIT_BRANCH' '$GIT_REPO' '$DEPLOY_PATH'"
    echo -e "${GREEN}✓ Cloned${NC}"
else
    echo -e "${GREEN}✓ Repo exists${NC}"
fi

echo ""
echo -e "${YELLOW}Checking remote .env...${NC}"
if ! $SSH "test -f '$DEPLOY_PATH/.env'"; then
    echo -e "${RED}✗ $DEPLOY_PATH/.env not found on the server.${NC}"
    echo "SSH in, copy .env.example to .env inside $DEPLOY_PATH, fill in real values"
    echo "(including DATABASE_URL for RDS), then re-run this script."
    exit 1
fi
echo -e "${GREEN}✓ .env exists${NC}"

echo ""
echo -e "${YELLOW}Pulling latest code ($GIT_BRANCH)...${NC}"
OLD_HEAD="$($SSH "cd '$DEPLOY_PATH' && git rev-parse HEAD" 2>/dev/null || true)"
$SSH "cd '$DEPLOY_PATH' && git fetch origin && git checkout '$GIT_BRANCH' && git pull origin '$GIT_BRANCH'"
NEW_HEAD="$($SSH "cd '$DEPLOY_PATH' && git rev-parse HEAD" 2>/dev/null || true)"

DC="docker compose"

# Only build the app image(s) whose own files (or a shared dependency)
# actually changed — Dockerfile.api/client/admin COPY just their own
# apps/<app>/ + libs/, so an unrelated app's change doesn't invalidate
# their build cache anyway, but skipping the build call entirely for
# untouched services saves even the no-op "check every layer" pass.
BUILD_TARGETS="api client admin migrate"
if [ -n "$OLD_HEAD" ] && [ "$OLD_HEAD" != "$NEW_HEAD" ]; then
    CHANGED="$($SSH "cd '$DEPLOY_PATH' && git diff --name-only '$OLD_HEAD' '$NEW_HEAD'" 2>/dev/null || true)"
    if [ -n "$CHANGED" ]; then
        if echo "$CHANGED" | grep -qE '^(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|nx\.json|tsconfig(\.base)?\.json|libs/|scripts/|prisma/schema\.prisma|prisma\.config\.ts)'; then
            BUILD_TARGETS="api client admin migrate"
        else
            BUILD_TARGETS=""
            echo "$CHANGED" | grep -q '^apps/api/'                 && BUILD_TARGETS="$BUILD_TARGETS api"
            echo "$CHANGED" | grep -q '^apps/client/'               && BUILD_TARGETS="$BUILD_TARGETS client"
            echo "$CHANGED" | grep -q '^apps/admin/'                && BUILD_TARGETS="$BUILD_TARGETS admin"
            echo "$CHANGED" | grep -q '^prisma/migrations/'          && BUILD_TARGETS="$BUILD_TARGETS migrate"
            echo "$CHANGED" | grep -q '^docker/Dockerfile\.api$'    && BUILD_TARGETS="$BUILD_TARGETS api"
            echo "$CHANGED" | grep -q '^docker/Dockerfile\.client$' && BUILD_TARGETS="$BUILD_TARGETS client"
            echo "$CHANGED" | grep -q '^docker/Dockerfile\.admin$'  && BUILD_TARGETS="$BUILD_TARGETS admin"
            echo "$CHANGED" | grep -q '^docker/Dockerfile\.migrate$' && BUILD_TARGETS="$BUILD_TARGETS migrate"
            BUILD_TARGETS="$(echo "$BUILD_TARGETS" | tr ' ' '\n' | sort -u | tr '\n' ' ' | sed 's/^ *//;s/ *$//')"
        fi
    else
        BUILD_TARGETS=""
    fi
fi

echo ""
if [ -z "$BUILD_TARGETS" ]; then
    echo -e "${YELLOW}No app-relevant files changed since last deploy — skipping build.${NC}"
else
    echo -e "${YELLOW}Building: $BUILD_TARGETS${NC}"

    # One image at a time — a 2GB instance can't absorb several
    # webpack/`next build` runs at once. Deploying each service right after
    # its own build (rather than building everything first) also means the
    # live site never goes down for the full build duration.
    for TARGET in $BUILD_TARGETS; do
        echo ""
        echo -e "${YELLOW}--- $TARGET ---${NC}"
        check_resources
        $SSH "cd '$DEPLOY_PATH' && $DC build $TARGET"

        if [ "$TARGET" = "migrate" ]; then
            echo -e "${YELLOW}Running pending database migrations (against RDS)...${NC}"
            check_resources
            $SSH "cd '$DEPLOY_PATH' && $DC run --rm migrate" || echo -e "${YELLOW}⚠ Migration step failed or had nothing to apply — check logs above.${NC}"
        else
            $SSH "cd '$DEPLOY_PATH' && $DC up -d $TARGET"
        fi
    done
fi

echo ""
echo -e "${YELLOW}Starting remaining services (redis, mongodb, anything not rebuilt above)...${NC}"
$SSH "cd '$DEPLOY_PATH' && $DC up -d"

echo ""
echo -e "${YELLOW}Waiting for services to be ready...${NC}"
sleep 10

echo ""
echo -e "${YELLOW}Service status:${NC}"
$SSH "cd '$DEPLOY_PATH' && $DC ps"

echo ""
echo -e "${GREEN}=============================="
echo -e "✓ Deploy complete!"
echo -e "==============================${NC}"
remote_env() {
    $SSH "cd '$DEPLOY_PATH' && grep -m1 \"^$1=\" .env | cut -d= -f2" 2>/dev/null || true
}
CLIENT_PORT_REMOTE="$(remote_env CLIENT_PORT)"; CLIENT_PORT_REMOTE="${CLIENT_PORT_REMOTE:-3010}"
ADMIN_PORT_REMOTE="$(remote_env ADMIN_PORT)"; ADMIN_PORT_REMOTE="${ADMIN_PORT_REMOTE:-3011}"
API_PORT_REMOTE="$(remote_env API_PORT)"; API_PORT_REMOTE="${API_PORT_REMOTE:-3012}"

echo ""
echo "127.0.0.1-only ports for this stack:"
echo "  - client (storefront): 127.0.0.1:$CLIENT_PORT_REMOTE"
echo "  - admin:               127.0.0.1:$ADMIN_PORT_REMOTE"
echo "  - api:                 127.0.0.1:$API_PORT_REMOTE"
echo ""
echo "If the host nginx site isn't set up yet, see scripts/nginx-ezihubb.conf"
echo "for the one-time steps (Cloudflare DNS records, Origin Certificate, install)."
echo ""
echo "Useful commands (run on the server, from $DEPLOY_PATH):"
echo "  - View logs:  $DC logs -f"
echo "  - Stop:       $DC stop"
echo "  - Restart:    $DC restart"
