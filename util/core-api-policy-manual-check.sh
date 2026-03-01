#!/usr/bin/env bash

set -u
set -o pipefail

BASE_URL="${CORE_API_BASE_URL:-http://127.0.0.1:4000}"
AUTH_TOKEN="${CORE_API_AUTH_TOKEN:-}"
JWT_SECRET="${JWT_SECRET:-unsafe-dev-secret}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

require_cmd curl
require_cmd jq
require_cmd node
require_cmd python3

LAST_STATUS=""
LAST_BODY=""

print_body() {
  local body="$1"
  if [[ -z "$body" ]]; then
    echo "(empty)"
    return
  fi

  if echo "$body" | jq . >/dev/null 2>&1; then
    echo "$body" | jq .
  else
    echo "$body"
  fi
}

generate_dev_jwt() {
  local secret="$1"
  node - "$secret" <<'NODE'
const crypto = require("node:crypto");
const secret = process.argv[2] ?? "unsafe-dev-secret";
const now = Math.floor(Date.now() / 1000);
const header = { alg: "HS256", typ: "JWT" };
const payload = {
  sub: "manual-policy-check",
  scope: "policy:write policy:read",
  iat: now,
  exp: now + 3600,
};

const base64url = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
const encodedHeader = base64url(header);
const encodedPayload = base64url(payload);
const data = `${encodedHeader}.${encodedPayload}`;
const signature = crypto.createHmac("sha256", secret).update(data).digest("base64url");
process.stdout.write(`${data}.${signature}`);
NODE
}

call_api() {
  local method="$1"
  local path="$2"
  local data="$3"
  shift 3

  local url="${BASE_URL}${path}"
  local headers=("-H" "Accept: application/json")

  if [[ -n "$AUTH_TOKEN" ]]; then
    headers+=("-H" "Authorization: Bearer ${AUTH_TOKEN}")
  fi

  for header in "$@"; do
    headers+=("-H" "$header")
  done

  local response
  if [[ -n "$data" ]]; then
    response=$(curl -sS -X "$method" "$url" "${headers[@]}" -H "Content-Type: application/json" --data "$data" -w $'\nHTTP_STATUS:%{http_code}')
  else
    response=$(curl -sS -X "$method" "$url" "${headers[@]}" -w $'\nHTTP_STATUS:%{http_code}')
  fi

  LAST_STATUS="${response##*HTTP_STATUS:}"
  LAST_BODY="${response%$'\n'HTTP_STATUS:*}"

  echo ""
  echo "================================================================"
  echo "${method} ${path}"
  echo "Status: ${LAST_STATUS}"
  echo "Response:"
  print_body "$LAST_BODY"
}

extract_field() {
  local json="$1"
  local field="$2"
  echo "$json" | jq -r "${field} // empty"
}

require_nonempty() {
  local value="$1"
  local label="$2"
  if [[ -z "$value" ]]; then
    echo "Could not extract ${label} from previous API response."
    exit 1
  fi
}

uuid() {
  node -e 'console.log(require("node:crypto").randomUUID())'
}

iso_from_offset_days() {
  local days="$1"
  python3 - "$days" <<'PY'
from datetime import datetime, timezone, timedelta
import sys

days = int(sys.argv[1])
print((datetime.now(timezone.utc) + timedelta(days=days)).strftime('%Y-%m-%dT%H:%M:%SZ'))
PY
}

if [[ -z "$AUTH_TOKEN" ]]; then
  AUTH_TOKEN="$(generate_dev_jwt "$JWT_SECRET")"
  echo "Using generated dev JWT (JWT_SECRET=${JWT_SECRET})."
else
  echo "Using CORE_API_AUTH_TOKEN from environment."
fi

unique_suffix="$(date +%s)"
product_code="POLICY-PROD-${unique_suffix}"
component_code="POLICY-COMP-${unique_suffix}"
program_code="POLICY-PROGRAM-${unique_suffix}"
policy_number="POL-${unique_suffix}"
pricing_program_file="/tmp/core-api-policy-pricing-${unique_suffix}.py"

term_start="$(iso_from_offset_days 0)"
term_end="$(iso_from_offset_days 365)"
endorsement_effective_at="$(iso_from_offset_days 30)"
snapshot_as_of_initial="$(iso_from_offset_days 1)"
snapshot_as_of_endorsement="$(iso_from_offset_days 45)"

create_policy_idempotency="policy-create-${unique_suffix}"
new_business_idempotency="policy-nb-${unique_suffix}"
new_business_commit_idempotency="policy-nb-commit-${unique_suffix}"
endorsement_idempotency="policy-endorsement-${unique_suffix}"
endorsement_commit_idempotency="policy-endorsement-commit-${unique_suffix}"

cat > "$pricing_program_file" <<'PY'
#!/usr/bin/env python3
import json
import sys

request = json.loads(sys.stdin.read() or "{}")
risks = request.get("risks") if isinstance(request.get("risks"), list) else []
coverages = request.get("coverages") if isinstance(request.get("coverages"), list) else []
currency = request.get("currency") or "SEK"
request_id = request.get("requestId")
result_version = request.get("pricingProgramVersionId") or "manual"

base = 75.0
base += 10.0 * len(risks)
base += 5.0 * len(coverages)

response = {
  "schemaVersion": "v1",
  "requestId": request_id,
  "resultVersion": str(result_version),
  "totals": {
    "totalPremium": f"{round(base, 2):.2f}",
    "currency": currency
  },
  "breakdown": [
    {
      "coverageCode": "TOTAL",
      "riskKey": None,
      "amount": f"{round(base, 2):.2f}",
      "currency": currency,
      "details": {
        "engine": "policy-manual-check-script"
      }
    }
  ],
  "errors": []
}

sys.stdout.write(json.dumps(response))
PY
chmod +x "$pricing_program_file"
trap 'rm -f "$pricing_program_file"' EXIT

printf "Core API policy-domain manual check script\n"
printf "Base URL: %s\n" "$BASE_URL"

call_api "GET" "/health" ""

# --- Minimal product/pricing setup so policy endpoints can run ---
call_api "POST" "/v1/product-management/products" "$(cat <<JSON
{
  "productCode": "${product_code}",
  "name": "Policy Product ${unique_suffix}",
  "description": "Created by core-api-policy-manual-check.sh"
}
JSON
)"
product_id="$(extract_field "$LAST_BODY" '.id')"
require_nonempty "$product_id" "product_id"

call_api "POST" "/v1/product-management/components" "$(cat <<JSON
{
  "componentCode": "${component_code}",
  "type": "COVERAGE",
  "name": "Policy Coverage ${unique_suffix}",
  "description": "Coverage for policy manual checks"
}
JSON
)"
component_id="$(extract_field "$LAST_BODY" '.id')"
require_nonempty "$component_id" "component_id"

call_api "POST" "/v1/product-management/components/${component_id}/versions" "$(cat <<JSON
{
  "schema": {
    "type": "object"
  },
  "metadata": {
    "source": "policy-manual-check"
  },
  "status": "ACTIVE"
}
JSON
)"
component_version_id="$(extract_field "$LAST_BODY" '.id')"
require_nonempty "$component_version_id" "component_version_id"

call_api "POST" "/v1/product-management/pricing-programs" "$(cat <<JSON
{
  "programCode": "${program_code}",
  "name": "Policy Pricing Program ${unique_suffix}",
  "description": "Program for policy manual checks"
}
JSON
)"
pricing_program_id="$(extract_field "$LAST_BODY" '.id')"
require_nonempty "$pricing_program_id" "pricing_program_id"

call_api "POST" "/v1/product-management/pricing-programs/${pricing_program_id}/versions" "$(cat <<JSON
{
  "fileRef": "${pricing_program_file}",
  "inputSchema": {
    "type": "object"
  },
  "outputSchema": {
    "type": "object"
  },
  "metadata": {
    "source": "policy-manual-check"
  },
  "status": "ACTIVE"
}
JSON
)"
pricing_program_version_id="$(extract_field "$LAST_BODY" '.id')"
require_nonempty "$pricing_program_version_id" "pricing_program_version_id"

call_api "POST" "/v1/product-management/products/${product_id}/versions" "$(cat <<JSON
{
  "effectiveFrom": "${term_start}",
  "effectiveTo": "${term_end}",
  "policySchema": {
    "type": "object"
  },
  "exposureSchemas": {
    "vehicle": {
      "type": "object"
    }
  },
  "pricingInputSchema": {
    "type": "object"
  },
  "defaultCurrency": "SEK",
  "allowedCurrencies": ["SEK", "USD"],
  "pricingProgramVersionId": "${pricing_program_version_id}"
}
JSON
)"
product_version_id="$(extract_field "$LAST_BODY" '.id')"
require_nonempty "$product_version_id" "product_version_id"

call_api "POST" "/v1/product-management/product-versions/${product_version_id}/components" "$(cat <<JSON
{
  "componentVersionId": "${component_version_id}",
  "configOverrides": {
    "selected": true
  }
}
JSON
)"

call_api "POST" "/v1/product-management/product-versions/${product_version_id}/activate" ""

# --- Policy domain endpoints ---
call_api "POST" "/v1/policies" "$(cat <<JSON
{
  "policyNumber": "${policy_number}",
  "productId": "${product_id}",
  "productVersionId": "${product_version_id}",
  "termStart": "${term_start}",
  "termEnd": "${term_end}"
}
JSON
)" "Idempotency-Key: ${create_policy_idempotency}"
policy_id="$(extract_field "$LAST_BODY" '.id')"
require_nonempty "$policy_id" "policy_id"

call_api "GET" "/v1/policies" ""
call_api "GET" "/v1/policies?query=${policy_number}" ""
call_api "GET" "/v1/policies/${policy_id}" ""

call_api "POST" "/v1/policies/${policy_id}/transactions/new-business" "$(cat <<JSON
{
  "effectiveAt": "${term_start}"
}
JSON
)" "Idempotency-Key: ${new_business_idempotency}"
new_business_tx_id="$(extract_field "$LAST_BODY" '.id')"
require_nonempty "$new_business_tx_id" "new_business_tx_id"

call_api "GET" "/v1/policies/${policy_id}/transactions" ""
call_api "GET" "/v1/policy-transactions/${new_business_tx_id}" ""

call_api "PUT" "/v1/policy-transactions/${new_business_tx_id}/risks" "$(cat <<JSON
{
  "risks": [
    {
      "riskType": "VEHICLE",
      "riskKey": "vehicle-1",
      "attributes": {
        "vin": "VIN-${unique_suffix}",
        "year": 2024
      }
    }
  ]
}
JSON
)"

call_api "PUT" "/v1/policy-transactions/${new_business_tx_id}/coverages" "$(cat <<JSON
{
  "coverages": [
    {
      "coverageCode": "LIABILITY",
      "appliesToRiskKey": "vehicle-1",
      "attributes": {
        "limit": 100000
      }
    }
  ]
}
JSON
)"

call_api "PUT" "/v1/policy-transactions/${new_business_tx_id}/coverage-terms" "$(cat <<JSON
{
  "terms": [
    {
      "coverageCode": "LIABILITY",
      "appliesToRiskKey": "vehicle-1",
      "termCode": "DEDUCTIBLE",
      "valueType": "MONEY",
      "moneyAmount": "1000.00",
      "moneyCurrency": "SEK"
    }
  ]
}
JSON
)"

call_api "POST" "/v1/policy-transactions/${new_business_tx_id}/validate" ""
call_api "POST" "/v1/policy-transactions/${new_business_tx_id}/rate" "$(cat <<JSON
{
  "requestId": "$(uuid)",
  "currency": "SEK"
}
JSON
)"
call_api "POST" "/v1/policy-transactions/${new_business_tx_id}/commit" "{}" "Idempotency-Key: ${new_business_commit_idempotency}"

call_api "GET" "/v1/policies/${policy_id}/snapshot?asOf=${snapshot_as_of_initial}" ""

call_api "POST" "/v1/policies/${policy_id}/transactions/endorsement" "$(cat <<JSON
{
  "effectiveAt": "${endorsement_effective_at}"
}
JSON
)" "Idempotency-Key: ${endorsement_idempotency}"
endorsement_tx_id="$(extract_field "$LAST_BODY" '.id')"
require_nonempty "$endorsement_tx_id" "endorsement_tx_id"

call_api "PUT" "/v1/policy-transactions/${endorsement_tx_id}/risks" "$(cat <<JSON
{
  "risks": [
    {
      "riskType": "VEHICLE",
      "riskKey": "vehicle-1",
      "attributes": {
        "vin": "VIN-${unique_suffix}",
        "year": 2025,
        "updated": true
      }
    },
    {
      "riskType": "PERSON",
      "riskKey": "driver-1",
      "attributes": {
        "age": 31,
        "licensedYears": 12
      }
    }
  ]
}
JSON
)"

call_api "PUT" "/v1/policy-transactions/${endorsement_tx_id}/coverages" "$(cat <<JSON
{
  "coverages": [
    {
      "coverageCode": "LIABILITY",
      "appliesToRiskKey": "vehicle-1",
      "attributes": {
        "limit": 200000
      }
    },
    {
      "coverageCode": "DRIVER_ACCIDENT",
      "appliesToRiskKey": "driver-1",
      "attributes": {
        "limit": 50000
      }
    }
  ]
}
JSON
)"

call_api "PUT" "/v1/policy-transactions/${endorsement_tx_id}/coverage-terms" "$(cat <<JSON
{
  "terms": [
    {
      "coverageCode": "LIABILITY",
      "appliesToRiskKey": "vehicle-1",
      "termCode": "DEDUCTIBLE",
      "valueType": "MONEY",
      "moneyAmount": "750.00",
      "moneyCurrency": "SEK"
    },
    {
      "coverageCode": "DRIVER_ACCIDENT",
      "appliesToRiskKey": "driver-1",
      "termCode": "MAX_EVENTS",
      "valueType": "NUMBER",
      "numberValue": "2"
    }
  ]
}
JSON
)"

call_api "POST" "/v1/policy-transactions/${endorsement_tx_id}/validate" ""
call_api "POST" "/v1/policy-transactions/${endorsement_tx_id}/rate" "$(cat <<JSON
{
  "requestId": "$(uuid)",
  "currency": "SEK"
}
JSON
)"
call_api "POST" "/v1/policy-transactions/${endorsement_tx_id}/commit" "{}" "Idempotency-Key: ${endorsement_commit_idempotency}"

call_api "GET" "/v1/policies/${policy_id}/snapshot?asOf=${snapshot_as_of_endorsement}" ""
call_api "GET" "/v1/policies/${policy_id}/snapshot?asOf=${snapshot_as_of_endorsement}&includeFinancials=true" ""

echo ""
echo "Policy-domain manual API check flow completed."
