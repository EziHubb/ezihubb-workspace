#!/bin/bash

# EziHubb — Deploy to AWS EC2 (pulls pre-built images from GHCR, falls back
# to building directly on the instance)
#
# Runs from your local machine: SSHes into the EC2 instance, pulls the
# latest code, and for each Docker image whose own files (or a shared
# dependency) changed, first tries a plain `docker pull` (the image GitHub
# Actions CI already built for this exact commit — .github/workflows/
# docker-publish.yml, tagged by git SHA and pushed to GHCR), re-tagged
# locally to the name docker-compose.yml expects, and only falls back to
# building directly on the instance if that pull fails (CI hasn't built
# this commit yet, is down, or DOCKER_IMAGE_BASE is unset/disabled). Then
# it runs pending Prisma migrations against RDS and restarts the stack
# (docker-compose.yml: redis, mongodb, api, client, admin — Postgres runs
# on RDS, not a container).
#
# Config (server IP/user, SSH key path, deploy path) lives in
# scripts/.deploy-config — gitignored, never commit real values.
# DOCKER_IMAGE_BASE can also be set there — defaults to the GHCR path CI
# pushes to; set it to an empty string to disable pulling entirely (a
# kill switch that forces every deploy through the local-build path).
# GHCR_USERNAME/GHCR_TOKEN (optional) — a classic PAT with `read:packages`
# scope, so the instance can pull private GHCR images. Without them, pulls
# are attempted unauthenticated (only succeeds if the packages are public)
# and fall back to a local build exactly as before.

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
# `-` (not `:-`) so an explicit DOCKER_IMAGE_BASE="" in .deploy-config is
# preserved as empty (pull disabled, kill switch) — only *unset* gets the
# default. Must match docker-publish.yml's lowercased-owner GHCR path.
DOCKER_IMAGE_BASE="${DOCKER_IMAGE_BASE-ghcr.io/ezihubb/ezihubb}"
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
# (per .claude/specs/30_aws_deploy.spec.md §5)
MIN_RAM_MB=800
MIN_DISK_GB=3

# Refuse to start if a docker compose build is already running — ours or,
# on a shared box, another project's. Two concurrent builds is exactly what
# exhausts RAM/swap and can take the whole server down (this happened once
# already on this project: an ad-hoc `docker compose up -d --build` ran all
# 3 app builds in parallel instead of one at a time).
if $SSH "pgrep -f '[d]ocker compose build' >/dev/null" 2>/dev/null; then
    echo -e "${RED}✗ A docker compose build is already running on $SERVER_IP. Refusing to start a second one.${NC}"
    exit 1
fi

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

# How many past builds to keep per image (as timestamped tags), so old
# layers aren't kept forever on the instance's small disk.
KEEP_BUILDS=2

# Snapshot the freshly-built/pulled image under a timestamped tag, then drop
# older timestamped tags for the same image beyond $KEEP_BUILDS. Untagged
# (dangling) layers left behind are cleaned up too.
prune_old_builds() {
    local image="ezihubb-workspace-$1"
    local ts
    ts="$(date +%Y%m%d%H%M%S)"
    $SSH "docker tag '${image}:latest' '${image}:${ts}' 2>/dev/null || true"
    $SSH "docker images '${image}' --format '{{.Tag}}' | grep -E '^[0-9]{14}\$' | sort -r | tail -n +$((KEEP_BUILDS + 1)) | xargs -r -I{} docker rmi '${image}:{}' 2>/dev/null || true"
    $SSH "docker image prune -f >/dev/null 2>&1 || true"
}

echo -e "${YELLOW}Checking SSH connection to $SERVER_USER@$SERVER_IP...${NC}"
if ! $SSH "echo ok" >/dev/null 2>&1; then
    echo -e "${RED}✗ Could not connect. Check SERVER_IP/SERVER_USER/SSH_KEY in $CONFIG_FILE.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Connected${NC}"

if [ -n "$GHCR_USERNAME" ] && [ -n "$GHCR_TOKEN" ]; then
    echo ""
    echo -e "${YELLOW}Logging in to ghcr.io on the server...${NC}"
    # Piped through SSH's stdin (not a CLI arg) so the token never appears
    # in `ps` output on either end; --password-stdin keeps docker from
    # writing it to shell history on the remote side either.
    if printf '%s' "$GHCR_TOKEN" | $SSH "docker login ghcr.io -u '$GHCR_USERNAME' --password-stdin" >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Logged in${NC}"
    else
        echo -e "${YELLOW}⚠ ghcr.io login failed — pulls below will be unauthenticated (only works for public packages)${NC}"
    fi
fi

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

# Tag by git SHA, not `:latest` — guarantees a pulled image matches the
# exact commit just checked out above, rather than racing a `:latest` that
# CI may not have finished pushing yet for this push.
IMAGE_TAG="${NEW_HEAD:-latest}"

DC="docker compose"

# Only build the app image(s) whose own files (or a shared dependency)
# actually changed — each builder-<app> stage in docker/Dockerfile COPYs
# just its own apps/<app>/ + libs/, so an unrelated app's change doesn't
# invalidate their build cache anyway, but skipping the build call entirely
# for untouched services saves even the no-op "check every layer" pass.
BUILD_TARGETS="migrate api client admin"
if [ -n "$OLD_HEAD" ] && [ "$OLD_HEAD" != "$NEW_HEAD" ]; then
    CHANGED="$($SSH "cd '$DEPLOY_PATH' && git diff --name-only '$OLD_HEAD' '$NEW_HEAD'" 2>/dev/null || true)"
    if [ -n "$CHANGED" ]; then
        # Only the 3 scripts actually COPYed into docker/Dockerfile's base
        # stage matter here — deploy.sh itself, smoke-test.sh, etc. never
        # run inside the image, so editing them shouldn't force a rebuild.
        if echo "$CHANGED" | grep -qE '^(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|nx\.json|tsconfig(\.base)?\.json|libs/|scripts/(patch-next-build\.cjs|prisma-generate-if-present\.cjs|postbuild\.mjs)|prisma/schema\.prisma|prisma\.config\.ts|docker/Dockerfile$|\.npmrc$)'; then
            BUILD_TARGETS="migrate api client admin"
        else
            BUILD_TARGETS=""
            echo "$CHANGED" | grep -q '^apps/api/'        && BUILD_TARGETS="$BUILD_TARGETS api"
            echo "$CHANGED" | grep -q '^apps/client/'      && BUILD_TARGETS="$BUILD_TARGETS client"
            echo "$CHANGED" | grep -q '^apps/admin/'       && BUILD_TARGETS="$BUILD_TARGETS admin"
            echo "$CHANGED" | grep -q '^prisma/migrations/' && BUILD_TARGETS="$BUILD_TARGETS migrate"
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

    # Tracks whether any target actually fell back to a local build this
    # run, so the one-time builder-cache wipe below only runs when needed.
    LOCAL_BUILD_USED=false

    # One image at a time — a 2GB instance can't absorb several
    # webpack/`next build` runs at once. Deploying each service right after
    # its own build (rather than building everything first) also means the
    # live site never goes down for the full build duration.
    for TARGET in $BUILD_TARGETS; do
        echo ""
        echo -e "${YELLOW}--- $TARGET ---${NC}"
        check_resources

        # Pull-then-build-fallback: a plain `docker pull` + `docker tag`
        # (not `docker compose pull`) so the pulled image lands under the
        # exact same local name Compose would auto-generate for a build
        # (`ezihubb-workspace-<target>:latest`) — this way an untouched
        # service (not in $BUILD_TARGETS this run) is never affected by
        # which path a *different* service took, and docker-compose.yml
        # itself needs no `image:`/env-var changes at all.
        PULLED=false
        if [ -n "$DOCKER_IMAGE_BASE" ]; then
            REMOTE_IMAGE="${DOCKER_IMAGE_BASE}-${TARGET}:${IMAGE_TAG}"
            LOCAL_IMAGE="ezihubb-workspace-${TARGET}:latest"
            echo -e "${YELLOW}Trying GHCR pull: ${REMOTE_IMAGE}${NC}"
            if $SSH "docker pull '$REMOTE_IMAGE' && docker tag '$REMOTE_IMAGE' '$LOCAL_IMAGE'"; then
                PULLED=true
                echo -e "${GREEN}✓ Pulled $REMOTE_IMAGE, tagged as $LOCAL_IMAGE${NC}"
            else
                echo -e "${YELLOW}⚠ Pull failed (tag not pushed for this commit yet, or network error) — falling back to local build${NC}"
            fi
        fi

        if [ "$PULLED" = false ]; then
            $SSH "cd '$DEPLOY_PATH' && $DC build $TARGET"
            LOCAL_BUILD_USED=true
        fi
        prune_old_builds "$TARGET"

        if [ "$TARGET" = "migrate" ]; then
            echo -e "${YELLOW}Running pending database migrations (against RDS)...${NC}"
            $SSH "cd '$DEPLOY_PATH' && $DC run --rm migrate" || echo -e "${YELLOW}⚠ Migration step failed or had nothing to apply — check logs above.${NC}"
        else
            $SSH "cd '$DEPLOY_PATH' && $DC up -d $TARGET"
        fi
    done

    # CI (docker-publish.yml) is now the source of truth for build caching
    # (its own type=gha cache scopes) — a local build here only ever
    # happens as a fallback (e.g. migrate, when CI skipped it for having no
    # migration changes). So there's no reason to keep BuildKit's local
    # cache mounts (pnpm-store, nx-cache) around between deploys: wipe them
    # completely rather than capping/tuning a size limit, which once grew
    # unbounded and filled the disk to 0 bytes free.
    if [ "$LOCAL_BUILD_USED" = true ]; then
        echo ""
        echo -e "${YELLOW}Clearing local BuildKit cache (only used as a pull-fallback)...${NC}"
        $SSH "docker builder prune -af >/dev/null 2>&1 || true"
    fi
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
