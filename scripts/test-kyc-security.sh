#!/usr/bin/env bash
# Validation sécurité uploads KYC - P0 Wakama backend
# Usage: bash scripts/test-kyc-security.sh [BASE_URL]
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

# ─── Fichier test minimal ──────────────────────────────────────────────────────
TEST_FILE=$(mktemp /tmp/test-kyc-XXXXXX.jpg)
python3 -c "import sys; sys.stdout.buffer.write(b'A' * 200)" > "$TEST_FILE"
trap 'rm -f "$TEST_FILE"' EXIT

echo "=== Authentification ==="

REMUCI=$(curl -sf -X POST "$BASE/v1/auth/institution-login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@remuci.ci","password":"Wakama@2026"}')
REMUCI_TOKEN=$(echo "$REMUCI" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
echo "  REMUCI token ok"

BAOBAB=$(curl -sf -X POST "$BASE/v1/auth/institution-login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@baobab-ci.com","password":"Wakama@2026"}')
BAOBAB_TOKEN=$(echo "$BAOBAB" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
echo "  BAOBAB token ok"

curl -s -X POST "$BASE/v1/auth/register" \
  -H 'Content-Type: application/json' \
  -d '{"email":"superadmin@test.wakama","password":"Wakama@2026","role":"SUPERADMIN","firstName":"Super","lastName":"Admin","phone":"+22600000001"}' > /dev/null
SA=$(curl -sf -X POST "$BASE/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"superadmin@test.wakama","password":"Wakama@2026"}')
SA_TOKEN=$(echo "$SA" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
echo "  SUPERADMIN token ok"
echo ""

# ─── IDs farmers par tenant ───────────────────────────────────────────────────
echo "=== Résolution des farmer IDs ==="

BAOBAB_FARMER=$(curl -sf "$BASE/v1/farmers" \
  -H "Authorization: Bearer $BAOBAB_TOKEN" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data'][0]['id'])")
echo "  BAOBAB farmer ID: $BAOBAB_FARMER"

REMUCI_FARMER=$(curl -sf "$BASE/v1/farmers" \
  -H "Authorization: Bearer $REMUCI_TOKEN" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data'][0]['id'])")
echo "  REMUCI farmer ID: $REMUCI_FARMER"
echo ""

# ─── POST /v1/upload/farmer/:farmerId/document ────────────────────────────────
echo "=== POST /v1/upload/farmer/:farmerId/document ==="

STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -F "file=@$TEST_FILE;type=image/jpeg" \
  "$BASE/v1/upload/farmer/$BAOBAB_FARMER/document?type=cni")
check_status "sans Bearer → 401"                   "401" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer INVALID_TOKEN" \
  -F "file=@$TEST_FILE;type=image/jpeg" \
  "$BASE/v1/upload/farmer/$BAOBAB_FARMER/document?type=cni")
check_status "mauvais Bearer → 401"                "401" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $REMUCI_TOKEN" \
  -F "file=@$TEST_FILE;type=image/jpeg" \
  "$BASE/v1/upload/farmer/$BAOBAB_FARMER/document?type=cni")
check_status "REMUCI token sur farmer BAOBAB → 403" "403" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $BAOBAB_TOKEN" \
  -F "file=@$TEST_FILE;type=image/jpeg" \
  "$BASE/v1/upload/farmer/$BAOBAB_FARMER/document?type=cni")
check_status "BAOBAB token sur farmer BAOBAB → 200" "200" "$STATUS"

# Récupérer l'URL du document uploadé
UPLOAD_RESP=$(curl -sf \
  -H "Authorization: Bearer $BAOBAB_TOKEN" \
  -F "file=@$TEST_FILE;type=image/jpeg" \
  "$BASE/v1/upload/farmer/$BAOBAB_FARMER/document?type=cni")
DOC_URL=$(echo "$UPLOAD_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['url'])")
echo "  Document URL: $DOC_URL"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $BAOBAB_TOKEN" \
  -F "file=@$TEST_FILE;type=image/jpeg" \
  "$BASE/v1/upload/farmer/$BAOBAB_FARMER/document?type=invalid")
check_status "type invalide → 400"                 "400" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $SA_TOKEN" \
  -F "file=@$TEST_FILE;type=image/jpeg" \
  "$BASE/v1/upload/farmer/$BAOBAB_FARMER/document?type=attestation")
check_status "SUPERADMIN sur n'importe quel farmer → 200" "200" "$STATUS"
echo ""

# ─── GET /uploads/farmers/:id/cni.* (URL statique protégée) ──────────────────
echo "=== GET $DOC_URL (URL statique - doit être protégée) ==="

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$DOC_URL")
check_status "sans Bearer → 401"                   "401" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer INVALID_TOKEN" \
  "$BASE$DOC_URL")
check_status "mauvais Bearer → 401"                "401" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $REMUCI_TOKEN" \
  "$BASE$DOC_URL")
check_status "REMUCI token sur CNI BAOBAB → 403"   "403" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $BAOBAB_TOKEN" \
  "$BASE$DOC_URL")
check_status "BAOBAB token sur son CNI → 200"      "200" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $SA_TOKEN" \
  "$BASE$DOC_URL")
check_status "SUPERADMIN → 200"                    "200" "$STATUS"
echo ""

# ─── GET /v1/upload/farmer/:farmerId/document (endpoint protégé) ──────────────
echo "=== GET /v1/upload/farmer/:farmerId/document (endpoint protégé) ==="

STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "$BASE/v1/upload/farmer/$BAOBAB_FARMER/document?type=cni")
check_status "sans Bearer → 401"                   "401" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer INVALID_TOKEN" \
  "$BASE/v1/upload/farmer/$BAOBAB_FARMER/document?type=cni")
check_status "mauvais Bearer → 401"                "401" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $REMUCI_TOKEN" \
  "$BASE/v1/upload/farmer/$BAOBAB_FARMER/document?type=cni")
check_status "REMUCI token sur CNI BAOBAB → 403"   "403" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $BAOBAB_TOKEN" \
  "$BASE/v1/upload/farmer/$BAOBAB_FARMER/document?type=cni")
check_status "BAOBAB token sur son CNI → 200"      "200" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $SA_TOKEN" \
  "$BASE/v1/upload/farmer/$BAOBAB_FARMER/document?type=cni")
check_status "SUPERADMIN → 200"                    "200" "$STATUS"

# Farmer REMUCI n'a aucun document uploadé dans ce test
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $REMUCI_TOKEN" \
  "$BASE/v1/upload/farmer/$REMUCI_FARMER/document?type=cni")
check_status "REMUCI farmer sans document (cni) → 404" "404" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $REMUCI_TOKEN" \
  "$BASE/v1/upload/farmer/$REMUCI_FARMER/document?type=attestation")
check_status "REMUCI farmer sans document (attestation) → 404" "404" "$STATUS"
echo ""

# ─── Photos profil restent publiques ──────────────────────────────────────────
echo "=== Photo profil (doit rester publique) ==="
echo "  (Test indicatif — 404 si aucune photo uploadée pour ce farmer)"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "$BASE/uploads/farmers/$BAOBAB_FARMER/photo.jpg")
# 200 si photo existe, 404 si non — les deux sont OK (pas 401/403)
if [ "$STATUS" = "200" ] || [ "$STATUS" = "404" ]; then
  green "photo.jpg sans Bearer → HTTP $STATUS (accès public OK)"
  PASS=$((PASS+1))
else
  red "photo.jpg sans Bearer → attendu 200 ou 404, recu $STATUS"
  FAIL=$((FAIL+1))
fi

echo ""

# ─── Résultat ─────────────────────────────────────────────────────────────────
echo "=== Résultat : $PASS PASS / $FAIL FAIL ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
