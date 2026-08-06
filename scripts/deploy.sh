#!/bin/bash

# EziHubb Workspace — Deploy to server
#
# Runs from your local machine: SSHes into the server using the config below,
# pulls the latest code, rebuilds the Docker images, runs pending Prisma
# migrations, and restarts the stack (docker-compose.yml: postgres, redis,
# api, client, admin — published to 127.0.0.1 only).
#
# This server hosts other projects too, so there's no nginx container here.
# The host's own nginx reverse-proxies ezihubb.com/admin.ezihubb.com/
# api.ezihubb.com to the loopback ports below — see scripts/nginx-ezihubb.conf
# for that one-time host-level setup (not something this script touches).
#
# Config (server IP/user, SSH key path, deploy path, branch) lives in
# scripts/.deploy-config — gitignored, never commit real values.
#
# Safety: this server is shared with other projects (silver14, ces_production)
# that build independently. Running two docker-compose builds at once has
# already exhausted RAM/swap and taken the whole server down once — every
# build step below checks available RAM/disk first and refuses to start if
# another build is already running anywhere on the box.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/.deploy-config"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🚀 EziHubb — Deploy to Server"
echo "=============================="
echo ""

if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}✗ Missing $CONFIG_FILE${NC}"
    echo "Create it with SERVER_IP, SERVER_USER, SSH_KEY, DEPLOY_PATH, GIT_BRANCH."
    exit 1
fi
# shellcheck source=/dev/null
source "$CONFIG_FILE"

: "${SERVER_IP:?SERVER_IP not set in $CONFIG_FILE}"
: "${SERVER_USER:?SERVER_USER not set in $CONFIG_FILE}"
: "${SSH_KEY:?SSH_KEY not set in $CONFIG_FILE}"
: "${DEPLOY_PATH:?DEPLOY_PATH not set in $CONFIG_FILE}"
GIT_BRANCH="${GIT_BRANCH:-main}"
# Fall back to this local checkout's own remote if GIT_REPO isn't set —
# only used the first time, to clone DEPLOY_PATH on the server.
if [ -z "$GIT_REPO" ]; then
    GIT_REPO="$(git -C "$SCRIPT_DIR/.." remote get-url origin 2>/dev/null || true)"
fi

if [ ! -f "$SSH_KEY" ]; then
    echo -e "${RED}✗ SSH key not found: $SSH_KEY${NC}"
    exit 1
fi
chmod 600 "$SSH_KEY" 2>/dev/null || true

SSH="ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new $SERVER_USER@$SERVER_IP"

# Safe minimums before touching the Docker builder at all. Below either of
# these, a build's own transient memory/CPU spike (webpack, next build,
# native module compilation) can push the whole shared box into swap
# thrashing and OOM-kill unrelated processes — including other projects'.
MIN_RAM_MB=800
MIN_DISK_GB=3

# Checks RAM/disk on the server right now and aborts the whole script if
# either is below the safe threshold. Called before every build/migrate
# step, not just once at the start — resources can drop mid-deploy too.
check_resources() {
    local avail_ram avail_disk
    avail_ram="$($SSH "free -m | awk '/^Mem:/{print \$7}'" 2>/dev/null)"
    avail_disk="$($SSH "df --output=avail -BG / | tail -1 | tr -dc '0-9'" 2>/dev/null)"
    echo "  RAM available: ${avail_ram:-?}MB | Disk available: ${avail_disk:-?}GB"
    if [ -z "$avail_ram" ] || [ "$avail_ram" -lt "$MIN_RAM_MB" ]; then
        echo -e "${RED}✗ RAM available (${avail_ram:-unknown}MB) is below the safe threshold (${MIN_RAM_MB}MB).${NC}"
        echo "Refusing to build — this is exactly what crashed the shared server before."
        exit 1
    fi
    if [ -z "$avail_disk" ] || [ "$avail_disk" -lt "$MIN_DISK_GB" ]; then
        echo -e "${RED}✗ Disk available (${avail_disk:-unknown}GB) is below the safe threshold (${MIN_DISK_GB}GB).${NC}"
        exit 1
    fi
}

# Refuses to proceed if ANY docker-compose/docker compose build is already
# running on the server — ours or another project's. Two concurrent builds
# is exactly what exhausted RAM/swap and took the whole server down before.
check_no_concurrent_build() {
    if $SSH "pgrep -f 'docker-compose build|docker compose build' >/dev/null 2>&1"; then
        echo -e "${RED}✗ Another docker-compose build is already running on the server (ours or another project's).${NC}"
        echo "Refusing to start a second one — wait for it to finish, then re-run this script."
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
    echo "SSH in, copy .env.example to .env inside $DEPLOY_PATH, fill in real values, then re-run this script."
    exit 1
fi
echo -e "${GREEN}✓ .env exists${NC}"

echo ""
echo -e "${YELLOW}Pulling latest code ($GIT_BRANCH)...${NC}"
OLD_HEAD="$($SSH "cd '$DEPLOY_PATH' && git rev-parse HEAD" 2>/dev/null || true)"
$SSH "cd '$DEPLOY_PATH' && git fetch origin && git checkout '$GIT_BRANCH' && git pull origin '$GIT_BRANCH'"
NEW_HEAD="$($SSH "cd '$DEPLOY_PATH' && git rev-parse HEAD" 2>/dev/null || true)"

# This server's Docker (20.10) predates the `docker compose` (v2) plugin —
# only the standalone `docker-compose` (v1) binary is installed. Detect
# whichever works so this script isn't tied to one server's Docker version.
DC="$($SSH "command -v docker-compose >/dev/null 2>&1 && echo 'docker-compose' || echo 'docker compose'" 2>/dev/null)"
DC="${DC:-docker compose}"
echo "(using '$DC' on the server)"

# Only build the app image(s) whose own files (or a shared dependency)
# actually changed — Dockerfile.api/client/admin now COPY just their own
# apps/<app>/ + libs/, so an unrelated app's change no longer invalidates
# their build cache anyway, but skipping the build call entirely for
# untouched services saves even the no-op "check every layer" pass.
BUILD_TARGETS="api client admin migrate"
if [ -n "$OLD_HEAD" ] && [ "$OLD_HEAD" != "$NEW_HEAD" ]; then
    CHANGED="$($SSH "cd '$DEPLOY_PATH' && git diff --name-only '$OLD_HEAD' '$NEW_HEAD'" 2>/dev/null || true)"
    if [ -n "$CHANGED" ]; then
        # Any of these touch every image (shared deps, root Nx config, base
        # Dockerfile layers) — rebuild everything to be safe.
        if echo "$CHANGED" | grep -qE '^(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|nx\.json|tsconfig(\.base)?\.json|libs/|scripts/|prisma/schema\.prisma|prisma\.config\.ts)'; then
            BUILD_TARGETS="api client admin migrate"
        else
            BUILD_TARGETS=""
            echo "$CHANGED" | grep -q '^apps/api/'                        && BUILD_TARGETS="$BUILD_TARGETS api"
            echo "$CHANGED" | grep -q '^apps/client/'                     && BUILD_TARGETS="$BUILD_TARGETS client"
            echo "$CHANGED" | grep -q '^apps/admin/'                      && BUILD_TARGETS="$BUILD_TARGETS admin"
            echo "$CHANGED" | grep -q '^prisma/migrations/'                && BUILD_TARGETS="$BUILD_TARGETS migrate"
            echo "$CHANGED" | grep -q '^docker/Dockerfile\.api$'          && BUILD_TARGETS="$BUILD_TARGETS api"
            echo "$CHANGED" | grep -q '^docker/Dockerfile\.client$'       && BUILD_TARGETS="$BUILD_TARGETS client"
            echo "$CHANGED" | grep -q '^docker/Dockerfile\.admin$'        && BUILD_TARGETS="$BUILD_TARGETS admin"
            echo "$CHANGED" | grep -q '^docker/Dockerfile\.migrate$'      && BUILD_TARGETS="$BUILD_TARGETS migrate"
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
    check_no_concurrent_build

    # One image at a time, never in parallel — a shared box with only a few
    # GB of RAM can't absorb several webpack/native-module builds running
    # concurrently (this is what crashed it before). Deploying each service
    # right after its own build (rather than building everything first, then
    # restarting everything) also means the live site never goes down for
    # the full build duration — only for the brief container swap per service.
    for TARGET in $BUILD_TARGETS; do
        echo ""
        echo -e "${YELLOW}--- $TARGET ---${NC}"
        check_resources
        $SSH "cd '$DEPLOY_PATH' && $DC build $TARGET"

        if [ "$TARGET" = "migrate" ]; then
            echo -e "${YELLOW}Running pending database migrations...${NC}"
            check_resources
            $SSH "cd '$DEPLOY_PATH' && $DC run --rm migrate" || echo -e "${YELLOW}⚠ Migration step failed or had nothing to apply — check logs above.${NC}"
        else
            $SSH "cd '$DEPLOY_PATH' && $DC up -d $TARGET"
        fi
    done
fi

echo ""
echo -e "${YELLOW}Starting remaining services (postgres, redis, anything not rebuilt above)...${NC}"
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
echo "This server hosts other projects — 127.0.0.1-only ports for this stack:"
echo "  - client (storefront): 127.0.0.1:$CLIENT_PORT_REMOTE"
echo "  - admin:               127.0.0.1:$ADMIN_PORT_REMOTE"
echo "  - api:                 127.0.0.1:$API_PORT_REMOTE"
echo ""
echo "If the host nginx site isn't set up yet, see scripts/nginx-ezihubb.conf"
echo "for the one-time steps (DNS records, install the site, certbot)."
echo ""
echo "Useful commands (run on the server, from $DEPLOY_PATH):"
echo "  - View logs:  $DC logs -f"
echo "  - Stop:       $DC stop"
echo "  - Restart:    $DC restart"
