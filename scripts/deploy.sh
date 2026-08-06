#!/bin/bash

# EziHubb — Deploy to AWS EC2 (pull-only, no building on the server)
#
# Runs from your local machine: SSHes into the EC2 instance, pulls the
# latest prebuilt images from GitHub Container Registry (built by
# .github/workflows/docker-publish.yml on every push to main), runs pending
# Prisma migrations against RDS, and restarts the stack (docker-compose.yml:
# redis, mongodb, api, client, admin).
#
# This never runs a build on the instance itself — a free-tier t2/t3.micro
# (1GB RAM) instance can't reliably survive `next build`, which needs 2-4GB.
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

if [ ! -f "$SSH_KEY" ]; then
    echo -e "${RED}✗ SSH key not found: $SSH_KEY${NC}"
    exit 1
fi
chmod 600 "$SSH_KEY" 2>/dev/null || true

SSH="ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new $SERVER_USER@$SERVER_IP"
COMPOSE="docker compose"

echo -e "${YELLOW}Checking SSH connection to $SERVER_USER@$SERVER_IP...${NC}"
if ! $SSH "echo ok" >/dev/null 2>&1; then
    echo -e "${RED}✗ Could not connect. Check SERVER_IP/SERVER_USER/SSH_KEY in $CONFIG_FILE.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Connected${NC}"

echo ""
echo -e "${YELLOW}Checking $DEPLOY_PATH/.env on the server...${NC}"
if ! $SSH "test -f '$DEPLOY_PATH/.env'"; then
    echo -e "${RED}✗ $DEPLOY_PATH/.env not found.${NC}"
    echo "SSH in, copy .env.example to .env inside $DEPLOY_PATH, fill in real values"
    echo "(including DATABASE_URL for RDS and DOCKER_IMAGE_BASE), then re-run this script."
    exit 1
fi
echo -e "${GREEN}✓ .env exists${NC}"

echo ""
echo -e "${YELLOW}Pulling latest images from GHCR...${NC}"
$SSH "cd '$DEPLOY_PATH' && $COMPOSE pull"
echo -e "${GREEN}✓ Pulled${NC}"

echo ""
echo -e "${YELLOW}Running pending database migrations (against RDS)...${NC}"
$SSH "cd '$DEPLOY_PATH' && $COMPOSE run --rm migrate" || echo -e "${YELLOW}⚠ Migration step failed or had nothing to apply — check logs above.${NC}"

echo ""
echo -e "${YELLOW}Restarting services...${NC}"
$SSH "cd '$DEPLOY_PATH' && $COMPOSE up -d"

echo ""
echo -e "${YELLOW}Waiting for services to be ready...${NC}"
sleep 8

echo ""
echo -e "${YELLOW}Service status:${NC}"
$SSH "cd '$DEPLOY_PATH' && $COMPOSE ps"

echo ""
echo -e "${GREEN}=============================="
echo -e "✓ Deploy complete!"
echo -e "==============================${NC}"
echo ""
echo "Useful commands (run on the server, from $DEPLOY_PATH):"
echo "  - View logs:  $COMPOSE logs -f"
echo "  - Stop:       $COMPOSE stop"
echo "  - Restart:    $COMPOSE restart"
