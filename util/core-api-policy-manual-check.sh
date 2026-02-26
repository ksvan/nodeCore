#!/usr/bin/env bash

set -u
set -o pipefail

BASE_URL="${CORE_API_BASE_URL:-http://127.0.0.1:4000}"
AUTH_TOKEN="${CORE_API_AUTH_TOKEN:-}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

require_cmd curl
require_cmd jq
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

call_api() {
  local method="$1"
  local path="$2"
  local data="${3:-}"
  local url="${BASE_URL}${path}"

  local headers=("-H" "Accept: application/json")
  if [[ -n "$AUTH_TOKEN" ]]; then
    headers+=("-H" "Authorization: Bearer ${AUTH_TOKEN}")
  fi

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

iso_from_offset_days() {
  local days="$1"
  python3 - "$days" <<'PY'
from datetime import datetime, timezone, timedelta
import sys

days = int(sys.argv[1])
print((datetime.now(timezone.utc) + timedelta(days=days)).strftime('%Y-%m-%dT%H:%M:%SZ'))
PY
}

unique_suffix="$(date +%s)"
product_code="POLICY-PROD-${unique_suffix}"
component_code="POLICY-COMP-${unique_suffix}"
program_code="POLICY-PROGRAM-${unique_suffix}"
policy_number="POL-${unique_suffix}"
pricing_program_file="/tmp/core-api-policy-pricing-${unique_suffix}.py"

term_start="$(iso_from_offset_days 0)"
term_end="$(iso_from_offset_days 365)"
endorsement_effective_from="$(iso_from_offset_days 30)"
snapshot_as_of_initial="$(iso_from_offset_days 1)"
snapshot_as_of_endorsement="$(iso_from_offset_days 45)"

cat > "$pricing_program_file" <<'PY'
#!/usr/bin/env python3
import json
import sys

request = json.loads(sys.stdin.read() or "{}")
rating_input = request.get("ratingInput", {})
exposures = rating_input.get("exposures", []) if isinstance(rating_input, dict) else []
coverages = rating_input.get("coverages", []) if isinstance(rating_input, dict) else []
currency = request.get("currency", "SEK")

base = 75.0
base += 10.0 * len(exposures)
base += 5.0 * len(coverages)

response = {
  "requestId": request.get("requestId"),
  "success": True,
  "totalPremium": round(base, 2),
  "currency": currency,
  "breakdown": {
    "base": 75.0,
    "exposureCount": float(len(exposures)),
    "coverageCount": float(len(coverages))
  },
  "details": {
    "engine": "policy-manual-check-script"
  }
}

sys.stdout.write(json.dumps(response))
PY
chmod +x "$pricing_program_file"
trap 'rm -f "$pricing_program_file"' EXIT

printf "Core API policy-domain manual check script\n"
printf "Base URL: %s\n" "$BASE_URL"

call_api "GET" "/health"

# --- Minimal product/pricing setup so policy/rating endpoints can run ---
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
  }
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

call_api "POST" "/v1/product-management/product-versions/${product_version_id}/activate"

# --- Policy domain endpoints ---
call_api "POST" "/v1/policies/drafts" "$(cat <<JSON
{
  "policyNumber": "${policy_number}",
  "productVersionId": "${product_version_id}",
  "effectiveFrom": "${term_start}",
  "effectiveTo": "${term_end}"
}
JSON
)"
policy_id="$(extract_field "$LAST_BODY" '.policyId')"
nb_tx_id="$(extract_field "$LAST_BODY" '.transactionId')"
require_nonempty "$policy_id" "policy_id"
require_nonempty "$nb_tx_id" "new_business_transaction_id"

call_api "PUT" "/v1/policy-transactions/${nb_tx_id}/exposures" "$(cat <<JSON
{
  "exposures": [
    {
      "exposureKey": "vehicle-1",
      "data": {
        "vin": "VIN-${unique_suffix}",
        "year": 2024
      }
    }
  ]
}
JSON
)"

call_api "PUT" "/v1/policy-transactions/${nb_tx_id}/coverages" "$(cat <<JSON
{
  "coverages": [
    {
      "coverageKey": "liability",
      "data": {
        "limit": 100000
      }
    }
  ]
}
JSON
)"

call_api "POST" "/v1/policy-transactions/${nb_tx_id}/rate"
call_api "POST" "/v1/policy-transactions/${nb_tx_id}/issue"

call_api "GET" "/v1/policies/${policy_id}/snapshot?asOfDate=${snapshot_as_of_initial}"

call_api "POST" "/v1/policies/${policy_id}/transactions/endorsement" "$(cat <<JSON
{
  "productVersionId": "${product_version_id}",
  "effectiveFrom": "${endorsement_effective_from}"
}
JSON
)"
endorsement_tx_id="$(extract_field "$LAST_BODY" '.transactionId')"
require_nonempty "$endorsement_tx_id" "endorsement_transaction_id"

call_api "PUT" "/v1/policy-transactions/${endorsement_tx_id}/exposures" "$(cat <<JSON
{
  "exposures": [
    {
      "exposureKey": "vehicle-1",
      "data": {
        "vin": "VIN-${unique_suffix}",
        "year": 2025,
        "updated": true
      }
    },
    {
      "exposureKey": "driver-1",
      "data": {
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
      "coverageKey": "liability",
      "data": {
        "limit": 200000
      }
    },
    {
      "coverageKey": "collision",
      "data": {
        "deductible": 1000
      }
    }
  ]
}
JSON
)"

call_api "POST" "/v1/policy-transactions/${endorsement_tx_id}/rate"
call_api "POST" "/v1/policy-transactions/${endorsement_tx_id}/issue"

call_api "GET" "/v1/policies/${policy_id}/snapshot?asOfDate=${snapshot_as_of_endorsement}"

echo ""
echo "Policy-domain manual API check flow completed."
