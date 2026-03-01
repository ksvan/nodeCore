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
  sub: "manual-core-api-check",
  scope: "api:write api:read",
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

if [[ -z "$AUTH_TOKEN" ]]; then
  AUTH_TOKEN="$(generate_dev_jwt "$JWT_SECRET")"
  echo "Using generated dev JWT (JWT_SECRET=${JWT_SECRET})."
else
  echo "Using CORE_API_AUTH_TOKEN from environment."
fi

unique_suffix="$(date +%s)"
effective_from="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
policy_id_for_pricing="$(uuid)"

product_code="MANUAL-PROD-${unique_suffix}"
component_code="MANUAL-COMP-${unique_suffix}"
program_code="MANUAL-PROGRAM-${unique_suffix}"
pricing_program_file="/tmp/core-api-manual-pricing-${unique_suffix}.py"

cat > "$pricing_program_file" <<'PY'
#!/usr/bin/env python3
import json
import sys

request = json.loads(sys.stdin.read() or "{}")
request_id = request.get("requestId")
currency = (request.get("currency") or "SEK")
result_version = request.get("pricingProgramVersionId") or "manual"

risks = request.get("risks") if isinstance(request.get("risks"), list) else []
coverages = request.get("coverages") if isinstance(request.get("coverages"), list) else []

premium = 100.0 + (25.0 * len(risks)) + (10.0 * len(coverages))

response = {
  "schemaVersion": "v1",
  "requestId": request_id,
  "resultVersion": str(result_version),
  "totals": {
    "totalPremium": f"{premium:.2f}",
    "currency": currency
  },
  "breakdown": [
    {
      "coverageCode": "TOTAL",
      "riskKey": None,
      "amount": f"{premium:.2f}",
      "currency": currency,
      "details": {"engine": "manual-training-script"}
    }
  ],
  "errors": []
}

sys.stdout.write(json.dumps(response))
PY
chmod +x "$pricing_program_file"
trap 'rm -f "$pricing_program_file"' EXIT

printf "Core API manual check script\n"
printf "Base URL: %s\n" "$BASE_URL"

call_api "GET" "/health" ""

call_api "POST" "/v1/product-management/products" "$(cat <<JSON
{
  "productCode": "${product_code}",
  "name": "Manual Product ${unique_suffix}",
  "description": "Created by util/core-api-manual-check.sh"
}
JSON
)"
product_id="$(extract_field "$LAST_BODY" '.id')"
require_nonempty "$product_id" "product_id"

call_api "GET" "/v1/product-management/products" ""
call_api "GET" "/v1/product-management/products/${product_id}" ""

call_api "PATCH" "/v1/product-management/products/${product_id}" "$(cat <<JSON
{
  "name": "Manual Product ${unique_suffix} Updated",
  "description": "Updated by manual check script"
}
JSON
)"

call_api "POST" "/v1/product-management/components" "$(cat <<JSON
{
  "componentCode": "${component_code}",
  "type": "COVERAGE",
  "name": "Manual Coverage ${unique_suffix}",
  "description": "Coverage component created by script"
}
JSON
)"
component_id="$(extract_field "$LAST_BODY" '.id')"
require_nonempty "$component_id" "component_id"

call_api "GET" "/v1/product-management/components" ""
call_api "GET" "/v1/product-management/components?type=COVERAGE" ""
call_api "GET" "/v1/product-management/components/${component_id}" ""

call_api "POST" "/v1/product-management/components/${component_id}/versions" "$(cat <<JSON
{
  "schema": {
    "type": "object",
    "properties": {
      "limit": { "type": "number" }
    }
  },
  "metadata": {
    "source": "manual-check-script"
  },
  "status": "ACTIVE"
}
JSON
)"
component_version_id="$(extract_field "$LAST_BODY" '.id')"
component_version_number="$(extract_field "$LAST_BODY" '.version')"
require_nonempty "$component_version_id" "component_version_id"
require_nonempty "$component_version_number" "component_version_number"

call_api "GET" "/v1/product-management/components/${component_id}/versions" ""
call_api "GET" "/v1/product-management/components/${component_id}/versions/${component_version_number}" ""

call_api "POST" "/v1/product-management/pricing-programs" "$(cat <<JSON
{
  "programCode": "${program_code}",
  "name": "Manual Pricing Program ${unique_suffix}",
  "description": "Program created by manual check script"
}
JSON
)"
pricing_program_id="$(extract_field "$LAST_BODY" '.id')"
require_nonempty "$pricing_program_id" "pricing_program_id"

call_api "GET" "/v1/product-management/pricing-programs" ""
call_api "GET" "/v1/product-management/pricing-programs/${pricing_program_id}" ""

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
    "source": "manual-check-script"
  },
  "status": "ACTIVE"
}
JSON
)"
pricing_program_version_id="$(extract_field "$LAST_BODY" '.id')"
require_nonempty "$pricing_program_version_id" "pricing_program_version_id"

call_api "GET" "/v1/product-management/pricing-programs/${pricing_program_id}/versions" ""

call_api "POST" "/v1/product-management/products/${product_id}/versions" "$(cat <<JSON
{
  "effectiveFrom": "${effective_from}",
  "policySchema": {
    "type": "object",
    "properties": {
      "insuredName": { "type": "string" }
    }
  },
  "exposureSchemas": {
    "driver": {
      "type": "object",
      "properties": {
        "age": { "type": "number" }
      }
    }
  },
  "pricingInputSchema": {
    "type": "object"
  },
  "defaultCurrency": "SEK",
  "allowedCurrencies": ["SEK", "USD", "EUR"],
  "pricingProgramVersionId": "${pricing_program_version_id}"
}
JSON
)"
product_version_id="$(extract_field "$LAST_BODY" '.id')"
require_nonempty "$product_version_id" "product_version_id"

call_api "GET" "/v1/product-management/products/${product_id}/versions" ""
call_api "GET" "/v1/product-management/product-versions/${product_version_id}" ""

call_api "POST" "/v1/product-management/product-versions/${product_version_id}/components" "$(cat <<JSON
{
  "componentVersionId": "${component_version_id}",
  "configOverrides": {
    "selected": true
  }
}
JSON
)"

call_api "GET" "/v1/product-management/product-versions/${product_version_id}/components" ""

call_api "DELETE" "/v1/product-management/product-versions/${product_version_id}/components/${component_version_id}" ""

call_api "POST" "/v1/product-management/product-versions/${product_version_id}/components" "$(cat <<JSON
{
  "componentVersionId": "${component_version_id}",
  "configOverrides": {
    "selected": true,
    "readded": true
  }
}
JSON
)"

call_api "POST" "/v1/product-management/product-versions/${product_version_id}/activate" ""
snapshot_id="$(extract_field "$LAST_BODY" '.snapshot.id')"
require_nonempty "$snapshot_id" "snapshot_id"

call_api "GET" "/v1/product-management/product-versions/${product_version_id}/snapshot" ""

call_api "POST" "/v1/pricing/calculate" "$(cat <<JSON
{
  "requestId": "$(uuid)",
  "productVersionId": "${product_version_id}",
  "effectiveAt": "${effective_from}",
  "transactionType": "NEW_BUSINESS",
  "policy": {
    "policyId": "${policy_id_for_pricing}",
    "policyNumber": "POL-${unique_suffix}",
    "termStart": "${effective_from}",
    "termEnd": "$(date -u -v+365d +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || node -e 'console.log(new Date(Date.now()+365*24*60*60*1000).toISOString())')"
  },
  "risks": [
    {
      "riskKey": "vehicle-1",
      "riskType": "VEHICLE",
      "attributes": {
        "year": 2024
      }
    }
  ],
  "coverages": [
    {
      "coverageCode": "LIABILITY",
      "appliesToRiskKey": "vehicle-1",
      "attributes": {
        "limit": 100000
      },
      "terms": []
    }
  ],
  "currency": "USD"
}
JSON
)"

call_api "POST" "/v1/product-management/product-versions/${product_version_id}/retire" ""

call_api "DELETE" "/v1/product-management/products/${product_id}" ""

echo ""
echo "Manual API check flow completed."
