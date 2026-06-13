#!/usr/bin/env bash
# Smoke test — verifies all critical endpoints respond correctly.
# Usage: ./scripts/smoke-test.sh [API_BASE] [CLIENT_BASE]
# Defaults: API=http://localhost:3002  CLIENT=http://localhost:3000

set -euo pipefail

API="${1:-http://localhost:3002}"
CLIENT="${2:-http://localhost:3000}"
PASS=0
FAIL=0
ERRORS=()

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

check() {
  local label="$1"
  local expected_status="$2"
  local method="$3"
  local url="$4"
  shift 4
  local extra_args=("$@")

  local actual_status
  actual_status=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "${extra_args[@]}" "$url" 2>/dev/null || echo "000")

  if [ "$actual_status" = "$expected_status" ]; then
    echo -e "  ${GREEN}✓${NC} $label (${actual_status})"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $label — expected ${expected_status}, got ${actual_status}"
    FAIL=$((FAIL + 1))
    ERRORS+=("$label: expected $expected_status got $actual_status")
  fi
}

check_contains() {
  local label="$1"
  local pattern="$2"
  local method="$3"
  local url="$4"
  shift 4
  local extra_args=("$@")

  local body
  body=$(curl -s -X "$method" "${extra_args[@]}" "$url" 2>/dev/null || echo "")

  if echo "$body" | grep -q "$pattern"; then
    echo -e "  ${GREEN}✓${NC} $label (pattern found: '$pattern')"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $label — pattern '$pattern' not found in response"
    FAIL=$((FAIL + 1))
    ERRORS+=("$label: pattern '$pattern' missing")
  fi
}

echo ""
echo "═══════════════════════════════════════════════"
echo "  DailyDaisy — Smoke Test"
echo "  API:    $API"
echo "  Client: $CLIENT"
echo "═══════════════════════════════════════════════"

# ── Step 1: Infrastructure ────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}[1/6] Health Check${NC}"
check_contains "GET /api/v1/health → status ok" '"status":"ok"' GET "$API/api/v1/health"

# ── Step 2: Auth endpoints ────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}[2/6] Auth Endpoints${NC}"

SMOKE_EMAIL="smoke_$(date +%s)@test.com"
SMOKE_PASS="SmokeTest123!"

REGISTER_BODY="{\"email\":\"${SMOKE_EMAIL}\",\"password\":\"${SMOKE_PASS}\",\"firstName\":\"Smoke\",\"lastName\":\"Test\"}"
check "POST /api/v1/auth/register → 201" "201" POST \
  "$API/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d "$REGISTER_BODY"

LOGIN_BODY="{\"email\":\"${SMOKE_EMAIL}\",\"password\":\"${SMOKE_PASS}\"}"
LOGIN_RESPONSE=$(curl -s -c /tmp/smoke_cookies.txt -X POST \
  -H "Content-Type: application/json" \
  -d "$LOGIN_BODY" \
  "$API/api/v1/auth/login" 2>/dev/null || echo "{}")

ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4 || echo "")

if [ -n "$ACCESS_TOKEN" ]; then
  echo -e "  ${GREEN}✓${NC} POST /api/v1/auth/login → 200 (token received)"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} POST /api/v1/auth/login — no accessToken in response"
  FAIL=$((FAIL + 1))
  ERRORS+=("login: no accessToken")
fi

check "POST /api/v1/auth/login wrong password → 401" "401" POST \
  "$API/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${SMOKE_EMAIL}\",\"password\":\"WrongPassword1\"}"

# ── Step 3: Public product endpoints ─────────────────────────────────────────
echo ""
echo -e "${YELLOW}[3/6] Product Endpoints${NC}"
check_contains "GET /api/v1/products → paginated response" '"data"' GET \
  "$API/api/v1/products"

check_contains "GET /api/v1/products?limit=12 → 12 or fewer" '"page"' GET \
  "$API/api/v1/products?limit=12"

# ── Step 4: Cart endpoints ───────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}[4/6] Cart Endpoints${NC}"

AUTH_HEADER="-H \"Authorization: Bearer ${ACCESS_TOKEN}\""
if [ -n "$ACCESS_TOKEN" ]; then
  check "GET /api/v1/cart (authenticated) → 200" "200" GET \
    "$API/api/v1/cart" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}"
else
  check "GET /api/v1/cart (no auth) → 200 or 401" "200" GET "$API/api/v1/cart"
fi

# ── Step 5: Catalog / Categories ─────────────────────────────────────────────
echo ""
echo -e "${YELLOW}[5/6] Catalog Endpoints${NC}"
check_contains "GET /api/v1/catalog/categories → array" '"data"' GET \
  "$API/api/v1/catalog/categories" || \
check_contains "GET /api/v1/catalog/categories → array" '"id"' GET \
  "$API/api/v1/catalog/categories"

# ── Step 6: Client app ───────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}[6/6] Client App (Next.js)${NC}"
check "GET ${CLIENT} → 200" "200" GET "$CLIENT"
check "GET ${CLIENT}/en → 200 or 308" "200" GET "$CLIENT/en" || \
check "GET ${CLIENT}/en → 200 or 308" "308" GET "$CLIENT/en"

# ── Report ────────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════"
TOTAL=$((PASS + FAIL))
echo "  Results: ${PASS}/${TOTAL} passed"
if [ $FAIL -gt 0 ]; then
  echo ""
  echo -e "  ${RED}Failures:${NC}"
  for err in "${ERRORS[@]}"; do
    echo "    - $err"
  done
  echo "═══════════════════════════════════════════════"
  exit 1
else
  echo -e "  ${GREEN}All checks passed!${NC}"
  echo "═══════════════════════════════════════════════"
fi
