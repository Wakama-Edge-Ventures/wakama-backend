#!/usr/bin/env bash
# Validation du bloc tenant-aware GET - P0 Wakama backend
# Usage: bash scripts/test-tenant-aware-get.sh [BASE_URL]
# Default BASE_URL: http://localhost:4000

set -euo pipefail

BASE="${1:-http://localhost:4000}"
PASS=0
FAIL=0

green() { echo -e "\033[32m[PASS]\033[0m $1"; }
red()   { echo -e "\033[31m[FAIL]\033[0m $1"; }

check_status() {
  local label="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    green "$label → HTTP $actual"
    PASS=$((PASS+1))
  else
    red "$label → attendu $expected, recu $actual"
    FAIL=$((FAIL+1))
  fi
}

check_count() {
  local label="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    green "$label → $actual"
    PASS=$((PASS+1))
  else
    red "$label → attendu $expected, recu $actual"
    FAIL=$((FAIL+1))
  fi
}

echo "=== Authentification ==="

REMUCI=$(curl -sf -X POST "$BASE/v1/auth/institution-login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@remuci.ci","password":"Wakama@2026"}')
REMUCI_TOKEN=$(echo "$REMUCI" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
REMUCI_INST=$(echo "$REMUCI" | python3 -c "import sys,json; print(json.load(sys.stdin)['institutionId'])")
echo "  REMUCI token ok, institutionId=$REMUCI_INST"

BAOBAB=$(curl -sf -X POST "$BASE/v1/auth/institution-login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@baobab-ci.com","password":"Wakama@2026"}')
BAOBAB_TOKEN=$(echo "$BAOBAB" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
BAOBAB_INST=$(echo "$BAOBAB" | python3 -c "import sys,json; print(json.load(sys.stdin)['institutionId'])")
echo "  BAOBAB token ok, institutionId=$BAOBAB_INST"

# SUPERADMIN: upsert via register (409 si existe déjà = ok)
curl -s -X POST "$BASE/v1/auth/register" \
  -H 'Content-Type: application/json' \
  -d '{"email":"superadmin@test.wakama","password":"Wakama@2026","role":"SUPERADMIN","firstName":"Super","lastName":"Admin","phone":"+22600000001"}' > /dev/null
SA=$(curl -sf -X POST "$BASE/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"superadmin@test.wakama","password":"Wakama@2026"}')
SA_TOKEN=$(echo "$SA" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
echo "  SUPERADMIN token ok"
echo ""

# ─── GET /v1/farmers ──────────────────────────────────────────────────────────
echo "=== GET /v1/farmers ==="

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/v1/farmers" -H "Authorization: Bearer INVALID")
check_status "mauvais Bearer → 401"       "401" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/v1/farmers" -H "Authorization: Bearer ")
check_status "Bearer vide → 401"          "401" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/v1/farmers")
check_status "sans Bearer → 200"          "200" "$STATUS"

TOTAL=$(curl -sf "$BASE/v1/farmers" | python3 -c "import sys,json; print(json.load(sys.stdin)['total'])")
check_count  "sans Bearer total (tous)"   "63"  "$TOTAL"

TOTAL=$(curl -sf "$BASE/v1/farmers" -H "Authorization: Bearer $REMUCI_TOKEN" | python3 -c "import sys,json; print(json.load(sys.stdin)['total'])")
check_count  "REMUCI total"               "3"   "$TOTAL"

TOTAL=$(curl -sf "$BASE/v1/farmers" -H "Authorization: Bearer $BAOBAB_TOKEN" | python3 -c "import sys,json; print(json.load(sys.stdin)['total'])")
check_count  "BAOBAB total"               "47"  "$TOTAL"

TOTAL=$(curl -sf "$BASE/v1/farmers" -H "Authorization: Bearer $SA_TOKEN" | python3 -c "import sys,json; print(json.load(sys.stdin)['total'])")
check_count  "SUPERADMIN total (tous)"    "63"  "$TOTAL"
echo ""

# ─── GET /v1/cooperatives ─────────────────────────────────────────────────────
echo "=== GET /v1/cooperatives ==="

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/v1/cooperatives" -H "Authorization: Bearer INVALID")
check_status "mauvais Bearer → 401"       "401" "$STATUS"

TOTAL=$(curl -sf "$BASE/v1/cooperatives" | python3 -c "import sys,json; print(json.load(sys.stdin)['total'])")
check_count  "sans Bearer total (tous)"   "2"   "$TOTAL"

TOTAL=$(curl -sf "$BASE/v1/cooperatives" -H "Authorization: Bearer $REMUCI_TOKEN" | python3 -c "import sys,json; print(json.load(sys.stdin)['total'])")
check_count  "REMUCI total"               "1"   "$TOTAL"

TOTAL=$(curl -sf "$BASE/v1/cooperatives" -H "Authorization: Bearer $BAOBAB_TOKEN" | python3 -c "import sys,json; print(json.load(sys.stdin)['total'])")
check_count  "BAOBAB total"               "1"   "$TOTAL"

TOTAL=$(curl -sf "$BASE/v1/cooperatives" -H "Authorization: Bearer $SA_TOKEN" | python3 -c "import sys,json; print(json.load(sys.stdin)['total'])")
check_count  "SUPERADMIN total (tous)"    "2"   "$TOTAL"
echo ""

# ─── GET /v1/credit-requests ──────────────────────────────────────────────────
echo "=== GET /v1/credit-requests ==="

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/v1/credit-requests" -H "Authorization: Bearer INVALID")
check_status "mauvais Bearer → 401"       "401" "$STATUS"

COUNT=$(curl -sf "$BASE/v1/credit-requests" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
check_count  "sans Bearer count (tous)"   "4"   "$COUNT"

COUNT=$(curl -sf "$BASE/v1/credit-requests" -H "Authorization: Bearer $REMUCI_TOKEN" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
check_count  "REMUCI count"               "0"   "$COUNT"

COUNT=$(curl -sf "$BASE/v1/credit-requests" -H "Authorization: Bearer $BAOBAB_TOKEN" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
check_count  "BAOBAB count"               "4"   "$COUNT"

COUNT=$(curl -sf "$BASE/v1/credit-requests" -H "Authorization: Bearer $SA_TOKEN" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
check_count  "SUPERADMIN count (tous)"    "4"   "$COUNT"
echo ""

# ─── Résultat ─────────────────────────────────────────────────────────────────
echo "=== Résultat : $PASS PASS / $FAIL FAIL ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
