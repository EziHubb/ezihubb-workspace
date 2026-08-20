#!/bin/bash

# EziHubb — Deploy to AWS EC2 (pulls pre-built images from GHCR, falls back
# to building directly on the instance)
#
# Runs from your local machine: SSHes into the EC2 instance, pulls the
# latest code, and for each Docker image whose own files (or a shared
# dependency) changed, tries up to 3 tiers before building anything locally:
#   1. `docker pull` the image tagged with this exact commit's SHA (CI —
#      .github/workflows/docker-publish.yml — already built it if this
#      target's own files changed in the latest push).
#   2. If that tag doesn't exist (this target's own files DIDN'T change in
#      the latest push, so CI skipped it, but an earlier commit still swept
#      it into this run via a shared-file change), pull GHCR's `:latest`
#      instead — CI already built+tagged it for whatever commit last
#      actually touched it, so this is exactly as correct as a local
#      rebuild, just without the wasted RAM/CPU/time on a 2GB instance.
#   3. Only if both pulls fail does it build directly on the instance (CI
#      hasn't built this commit yet, is down, or DOCKER_IMAGE_BASE is
#      unset/disabled).
# Whichever tier succeeds, the image gets re-tagged locally to the name
# docker-compose.yml expects. Then it runs pending Prisma migrations
# against RDS and restarts the stack (docker-compose.yml: redis, mongodb,
# api, client, admin — Postgres runs on RDS, not a container).
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
# older timestamped tags for the same image beyond $KEEP_BUILDS. Runs for all
# targets in a single SSH round-trip (called once at the end, not per-target)
# — the dangling-layer sweep (`docker image prune -f`) is one shared pass too.
snapshot_and_prune_builds() {
    local ts cmd image
    ts="$(date +%Y%m%d%H%M%S)"
    cmd=""
    for image in "$@"; do
        image="ezihubb-workspace-${image}"
        cmd="$cmd docker tag '${image}:latest' '${image}:${ts}' 2>/dev/null || true;"
        cmd="$cmd docker images '${image}' --format '{{.Tag}}' | grep -E '^[0-9]{14}\$' | sort -r | tail -n +$((KEEP_BUILDS + 1)) | xargs -r -I{} docker rmi '${image}:{}' 2>/dev/null || true;"
    done
    cmd="$cmd docker image prune -f >/dev/null 2>&1 || true"
    $SSH "$cmd"
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
# Which of those targets' OWN app files changed in the single most recent
# commit (not the whole OLD_HEAD..NEW_HEAD catch-up range) — mirrors exactly
# what docker-publish.yml's path-filter saw for the latest push, and is the
# safety gate for the `:latest` pull-fallback below (Phase 1b): if a target
# is only in BUILD_TARGETS because an EARLIER commit touched a shared file
# (docker/Dockerfile, package.json, ...) while that target's own code hasn't
# changed since, CI already rebuilt+tagged it — GHCR's `:latest` for it is
# safe to reuse instead of a wasteful local rebuild. If the target's own
# files DID change in the latest commit, `:latest` might not reflect that
# yet (CI still running, or genuinely failed), so it's excluded here and
# must go through a real local build if the exact-SHA pull also fails.
OWN_FILES_CHANGED=""
LATEST_COMMIT_CHANGED="$($SSH "cd '$DEPLOY_PATH' && git diff --name-only 'HEAD~1' 'HEAD' 2>/dev/null" || true)"
if [ -n "$LATEST_COMMIT_CHANGED" ]; then
    echo "$LATEST_COMMIT_CHANGED" | grep -q '^apps/api/'         && OWN_FILES_CHANGED="$OWN_FILES_CHANGED api"
    echo "$LATEST_COMMIT_CHANGED" | grep -q '^apps/client/'       && OWN_FILES_CHANGED="$OWN_FILES_CHANGED client"
    echo "$LATEST_COMMIT_CHANGED" | grep -q '^apps/admin/'        && OWN_FILES_CHANGED="$OWN_FILES_CHANGED admin"
    echo "$LATEST_COMMIT_CHANGED" | grep -q '^prisma/migrations/' && OWN_FILES_CHANGED="$OWN_FILES_CHANGED migrate"
fi
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
    check_resources

    # Tracks whether any target actually fell back to a local build this
    # run, so the one-time builder-cache wipe below only runs when needed.
    LOCAL_BUILD_USED=false

    # ── Phase 1: pull every target from GHCR in parallel ───────────────────
    # A `docker pull` is network I/O, not CPU/RAM — unlike a local build, there's
    # no reason to serialize these. Each pull runs as a background SSH command;
    # output is captured per-target and printed after `wait` so the log still
    # reads top-to-bottom instead of interleaving 4 pulls' output at once.
    declare -A PULLED_OK
    if [ -n "$DOCKER_IMAGE_BASE" ]; then
        echo ""
        echo -e "${YELLOW}Pulling pre-built images from GHCR (in parallel)...${NC}"
        PULL_TMPDIR="$(mktemp -d)"
        declare -A PULL_PID
        for TARGET in $BUILD_TARGETS; do
            REMOTE_IMAGE="${DOCKER_IMAGE_BASE}-${TARGET}:${IMAGE_TAG}"
            LOCAL_IMAGE="ezihubb-workspace-${TARGET}:latest"
            # `docker rmi "$REMOTE_IMAGE"` after tagging — once aliased to
            # $LOCAL_IMAGE, the original ghcr.io/...:<sha> reference serves
            # no further purpose, but nothing was ever dropping it: every
            # past pull's SHA tag was accumulating on disk forever (found 5
            # distinct ghcr.io/ezihubb/ezihubb-api:<sha> tags still present
            # after only 5 deploys — the actual cause of disk filling back
            # up to 93% despite KEEP_BUILDS capping the *local* timestamped
            # tags correctly). Safe to remove immediately: it shares layers
            # with $LOCAL_IMAGE (already tagged), so `rmi` here only drops
            # the tag pointer, not any layer $LOCAL_IMAGE still needs.
            ( $SSH "docker pull '$REMOTE_IMAGE' && docker tag '$REMOTE_IMAGE' '$LOCAL_IMAGE' && docker rmi '$REMOTE_IMAGE'" \
                > "$PULL_TMPDIR/$TARGET.log" 2>&1 ) &
            PULL_PID[$TARGET]=$!
        done
        for TARGET in $BUILD_TARGETS; do
            echo ""
            echo -e "${YELLOW}--- $TARGET (pull @ ${IMAGE_TAG:0:7}) ---${NC}"
            cat "$PULL_TMPDIR/$TARGET.log"
            if wait "${PULL_PID[$TARGET]}"; then
                PULLED_OK[$TARGET]=true
                echo -e "${GREEN}✓ Pulled ${DOCKER_IMAGE_BASE}-${TARGET}:${IMAGE_TAG}, tagged as ezihubb-workspace-${TARGET}:latest${NC}"
            else
                PULLED_OK[$TARGET]=false
                echo -e "${YELLOW}⚠ No image for this exact commit yet${NC}"
            fi
        done
        rm -rf "$PULL_TMPDIR"

        # ── Phase 1b: fall back to GHCR's `:latest` for targets that are only
        # in BUILD_TARGETS because an earlier commit touched a shared file —
        # CI already rebuilt+tagged them (both `:latest` and their own SHA)
        # for whatever commit actually changed them, so pulling `:latest` is
        # exactly as correct as a fresh local build and far cheaper. This is
        # what closes the gap from the incident where a client-only fix
        # commit swept admin/api/migrate into BUILD_TARGETS (an earlier,
        # already-deployed-but-not-yet-picked-up commit had touched
        # docker/Dockerfile) and, because no image existed tagged with the
        # NEW commit's SHA for those untouched apps, all three rebuilt from
        # scratch locally instead of reusing the perfectly good images CI
        # had already built for them. Targets whose OWN files changed in the
        # latest commit are deliberately excluded (see OWN_FILES_CHANGED
        # above) — `:latest` might not reflect that change yet, so those
        # must go through a real local build below if their exact-SHA pull
        # also failed.
        FALLBACK_TARGETS=""
        for TARGET in $BUILD_TARGETS; do
            if [ "${PULLED_OK[$TARGET]}" != true ] && ! echo " $OWN_FILES_CHANGED " | grep -q " $TARGET "; then
                FALLBACK_TARGETS="$FALLBACK_TARGETS $TARGET"
            fi
        done
        if [ -n "$FALLBACK_TARGETS" ]; then
            echo ""
            echo -e "${YELLOW}Trying :latest from GHCR for:$FALLBACK_TARGETS (own files unchanged since CI last built them — reusing instead of rebuilding)...${NC}"
            PULL_TMPDIR="$(mktemp -d)"
            declare -A LATEST_PID
            for TARGET in $FALLBACK_TARGETS; do
                REMOTE_IMAGE="${DOCKER_IMAGE_BASE}-${TARGET}:latest"
                LOCAL_IMAGE="ezihubb-workspace-${TARGET}:latest"
                ( $SSH "docker pull '$REMOTE_IMAGE' && docker tag '$REMOTE_IMAGE' '$LOCAL_IMAGE'" \
                    > "$PULL_TMPDIR/$TARGET.log" 2>&1 ) &
                LATEST_PID[$TARGET]=$!
            done
            for TARGET in $FALLBACK_TARGETS; do
                echo ""
                echo -e "${YELLOW}--- $TARGET (pull :latest) ---${NC}"
                cat "$PULL_TMPDIR/$TARGET.log"
                if wait "${LATEST_PID[$TARGET]}"; then
                    PULLED_OK[$TARGET]=true
                    echo -e "${GREEN}✓ Pulled ${DOCKER_IMAGE_BASE}-${TARGET}:latest — no local build needed${NC}"
                else
                    echo -e "${YELLOW}⚠ :latest pull also failed — falling back to local build${NC}"
                fi
            done
            rm -rf "$PULL_TMPDIR"
        fi
    fi

    # ── Phase 2: local build fallback — still one at a time ────────────────
    # Only reached for a target GHCR didn't have yet (or DOCKER_IMAGE_BASE
    # disabled). Kept strictly sequential: a 2GB instance can't absorb several
    # webpack/`next build` runs concurrently.
    #
    # BUILD_VERSION mirrors scripts/compute-version.sh's semantic version
    # (X.Y.Z from Conventional Commits) rather than the raw SHA — computed
    # on the server itself (same repo, same history) so it's identical to
    # whatever CI would/did tag this commit as. Falls back to the SHA if the
    # script can't run for some reason (e.g. an old checkout predating it).
    BUILD_VERSION="$($SSH "cd '$DEPLOY_PATH' && bash scripts/compute-version.sh" 2>/dev/null || true)"
    BUILD_VERSION="${BUILD_VERSION:-$NEW_HEAD}"
    for TARGET in $BUILD_TARGETS; do
        if [ "${PULLED_OK[$TARGET]:-false}" != true ]; then
            echo ""
            echo -e "${YELLOW}--- $TARGET (local build) ---${NC}"
            check_resources
            $SSH "cd '$DEPLOY_PATH' && BUILD_VERSION='$BUILD_VERSION' $DC build $TARGET"
            LOCAL_BUILD_USED=true
        fi
    done

    # ── Phase 3: migrations before any app restarts ─────────────────────────
    if echo "$BUILD_TARGETS" | grep -qw migrate; then
        echo ""
        echo -e "${YELLOW}Running pending database migrations (against RDS)...${NC}"
        # Aborts the deploy on failure, on purpose.
        #
        # This used to end in `|| echo "⚠ Migration step failed or had nothing
        # to apply"`, which swallowed the exit code: a migration that failed
        # printed a warning and the deploy carried straight on to restart the
        # apps. New code then ran against a schema that had not been migrated,
        # and the run still ended with "✓ Deploy complete!".
        #
        # The old message also conflated two very different outcomes — a real
        # failure and "nothing to apply" — so even a human reading the log
        # could not tell which had happened. `prisma migrate deploy` exits 0
        # when there is nothing pending, so a non-zero code here always means
        # a genuine failure.
        if ! $SSH "cd '$DEPLOY_PATH' && $DC run --rm migrate"; then
            echo -e "${RED}✗ Migration failed — aborting before any app restarts.${NC}"
            echo -e "${YELLOW}  The running containers are untouched and still serving the previous release.${NC}"
            echo -e "${YELLOW}  Fix the migration, then re-run this script.${NC}"
            exit 1
        fi
        echo -e "${GREEN}✓ Migrations applied${NC}"
    fi

    # ── Phase 4: restart every changed app service in one compose call ─────
    # Previously one `up -d` per target — each call re-evaluates the whole
    # dependency graph and re-waits on redis/mongodb's health check even
    # though they were already healthy from the call before. Batching this
    # into a single call removes that repeated wait entirely.
    APP_TARGETS="$(echo "$BUILD_TARGETS" | tr ' ' '\n' | grep -vx 'migrate' | tr '\n' ' ')"
    if [ -n "$(echo "$APP_TARGETS" | tr -d '[:space:]')" ]; then
        echo ""
        echo -e "${YELLOW}Restarting: $APP_TARGETS${NC}"
        $SSH "cd '$DEPLOY_PATH' && $DC up -d $APP_TARGETS"
    fi

    # ── Phase 5: one combined snapshot+prune pass instead of one per target ─
    echo ""
    echo -e "${YELLOW}Tagging builds + pruning old images...${NC}"
    # shellcheck disable=SC2086
    snapshot_and_prune_builds $BUILD_TARGETS

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
