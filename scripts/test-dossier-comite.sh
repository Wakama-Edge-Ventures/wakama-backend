#!/usr/bin/env bash
# Validation sécurité GET /v1/farmers/:id/dossier-comite - P0 Wakama backend
# Usage: bash scripts/test-dossier-comite.sh [BASE_URL]
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

check_field() {
  local label="$1" value="$2"
  if [ -n "$value" ] && [ "$value" != "null" ] && [ "$value" != "None" ]; then
    green "$label → présent ($value)"
    PASS=$((PASS+1))
  else
    red "$label → absent ou null"
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

curl -s -X POST "$BASE/v1/auth/register" \
  -H 'Content-Type: application/json' \
  -d '{"email":"superadmin@test.wakama","password":"Wakama@2026","role":"SUPERADMIN","firstName":"Super","lastName":"Admin","phone":"+22600000001"}' > /dev/null
SA=$(curl -sf -X POST "$BASE/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"superadmin@test.wakama","password":"Wakama@2026"}')
SA_TOKEN=$(echo "$SA" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
echo "  SUPERADMIN token ok"
echo ""

# ─── Résolution des farmer IDs ────────────────────────────────────────────────
echo "=== Résolution des farmer IDs ==="

BAOBAB_FARMER=$(curl -sf "$BASE/v1/farmers" \
  -H "Authorization: Bearer $BAOBAB_TOKEN" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data'][0]['id'])")
echo "  BAOBAB farmer ID: $BAOBAB_FARMER"

REMUCI_FARMER=$(curl -sf "$BASE/v1/farmers" \
  -H "Authorization: Bearer $REMUCI_TOKEN" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data'][0]['id'])")
echo "  REMUCI farmer ID: $REMUCI_FARMER"

FAKE_FARMER_ID="00000000-0000-0000-0000-000000000000"
echo ""

# ─── Cas d'erreur d'authentification ─────────────────────────────────────────
echo "=== Sécurité Bearer ==="

STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "$BASE/v1/farmers/$BAOBAB_FARMER/dossier-comite")
check_status "sans Bearer → 401"                                "401" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer INVALID_TOKEN" \
  "$BASE/v1/farmers/$BAOBAB_FARMER/dossier-comite")
check_status "Bearer invalide → 401"                            "401" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer " \
  "$BASE/v1/farmers/$BAOBAB_FARMER/dossier-comite")
check_status "Bearer vide → 401"                                "401" "$STATUS"
echo ""

# ─── Cas farmer inexistant ────────────────────────────────────────────────────
echo "=== Farmer inexistant ==="

STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $BAOBAB_TOKEN" \
  "$BASE/v1/farmers/$FAKE_FARMER_ID/dossier-comite")
check_status "farmer inexistant (BAOBAB token) → 404"           "404" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $SA_TOKEN" \
  "$BASE/v1/farmers/$FAKE_FARMER_ID/dossier-comite")
check_status "farmer inexistant (SUPERADMIN token) → 404"       "404" "$STATUS"
echo ""

# ─── Isolation tenant (cross-tenant refusé) ───────────────────────────────────
echo "=== Isolation tenant ==="

STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $REMUCI_TOKEN" \
  "$BASE/v1/farmers/$BAOBAB_FARMER/dossier-comite")
check_status "REMUCI token sur farmer BAOBAB → 403"             "403" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $BAOBAB_TOKEN" \
  "$BASE/v1/farmers/$REMUCI_FARMER/dossier-comite")
check_status "BAOBAB token sur farmer REMUCI → 403"             "403" "$STATUS"
echo ""

# ─── Accès tenant correct ─────────────────────────────────────────────────────
echo "=== Accès tenant valide ==="

STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $BAOBAB_TOKEN" \
  "$BASE/v1/farmers/$BAOBAB_FARMER/dossier-comite")
check_status "BAOBAB token sur son farmer → 200"                "200" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $REMUCI_TOKEN" \
  "$BASE/v1/farmers/$REMUCI_FARMER/dossier-comite")
check_status "REMUCI token sur son farmer → 200"                "200" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $SA_TOKEN" \
  "$BASE/v1/farmers/$BAOBAB_FARMER/dossier-comite")
check_status "SUPERADMIN sur farmer BAOBAB → 200"               "200" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $SA_TOKEN" \
  "$BASE/v1/farmers/$REMUCI_FARMER/dossier-comite")
check_status "SUPERADMIN sur farmer REMUCI → 200"               "200" "$STATUS"
echo ""

# ─── Validation structure JSON ────────────────────────────────────────────────
echo "=== Structure JSON du dossier (farmer BAOBAB) ==="

DOSSIER=$(curl -sf \
  -H "Authorization: Bearer $BAOBAB_TOKEN" \
  "$BASE/v1/farmers/$BAOBAB_FARMER/dossier-comite")

DOSSIER_ID=$(echo "$DOSSIER" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('dossierId',''))")
check_field "dossierId"                                         "$DOSSIER_ID"

MODEL_VERSION=$(echo "$DOSSIER" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('modelVersion',''))")
check_field "modelVersion"                                      "$MODEL_VERSION"

COMPLIANCE=$(echo "$DOSSIER" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('complianceNotice',''))")
check_field "complianceNotice"                                  "$COMPLIANCE"

FARMER_ID=$(echo "$DOSSIER" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['farmer']['id'])")
check_field "farmer.id"                                         "$FARMER_ID"

KYC_STATUS=$(echo "$DOSSIER" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['kyc']['status'])")
check_field "kyc.status"                                        "$KYC_STATUS"

PARCEL_COUNT=$(echo "$DOSSIER" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['agronomicMonitoring']['parcelCount'])")
check_field "agronomicMonitoring.parcelCount"                   "$PARCEL_COUNT"

SCORE=$(echo "$DOSSIER" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['score']['score'])")
check_field "score.score"                                       "$SCORE"

SCORE_MAX=$(echo "$DOSSIER" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['score']['scoreMax'])")
check_field "score.scoreMax"                                    "$SCORE_MAX"

RISK_LEVEL=$(echo "$DOSSIER" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['score']['riskLevel'])")
check_field "score.riskLevel"                                   "$RISK_LEVEL"

READINESS=$(echo "$DOSSIER" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['committeeReadiness']['status'])")
check_field "committeeReadiness.status"                         "$READINESS"

AUDIT_VERSION=$(echo "$DOSSIER" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['audit']['version'])")
check_field "audit.version"                                     "$AUDIT_VERSION"

AUDIT_ROLE=$(echo "$DOSSIER" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['audit']['generatedByRole'])")
check_field "audit.generatedByRole"                             "$AUDIT_ROLE"
echo ""

# ─── Audit trail : institutionId dans la réponse BAOBAB ───────────────────────
echo "=== Audit trail institutionId ==="

AUDIT_INST=$(echo "$DOSSIER" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['audit'].get('institutionId',''))")
check_field "audit.institutionId (BAOBAB token)"                "$AUDIT_INST"

DOSSIER_SA=$(curl -sf \
  -H "Authorization: Bearer $SA_TOKEN" \
  "$BASE/v1/farmers/$BAOBAB_FARMER/dossier-comite")
COOP_INST=$(echo "$DOSSIER_SA" | python3 -c "import sys,json; d=json.load(sys.stdin); coop=d.get('cooperative'); print(coop['institutionId'] if coop and coop.get('institutionId') else '')")
check_field "cooperative.institutionId dans réponse SUPERADMIN" "$COOP_INST"
echo ""

# ─── Note READONLY ────────────────────────────────────────────────────────────
echo "=== Note politique READONLY ==="
echo "  READONLY institutionnel : accès lecture AUTORISÉ sur cet endpoint GET."
echo "  Un test spécifique nécessite un compte READONLY dans le seed (non créé ici)."
echo "  Comportement attendu : 200 avec périmètre institution, identique à INSTITUTION_ADMIN."
echo ""

# ─── Résultat ─────────────────────────────────────────────────────────────────
echo "=== Résultat : $PASS PASS / $FAIL FAIL ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
