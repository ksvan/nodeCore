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

unique_suffix="$(date +%s)"
effective_from="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

product_code="MANUAL-PROD-${unique_suffix}"
component_code="MANUAL-COMP-${unique_suffix}"
program_code="MANUAL-PROGRAM-${unique_suffix}"
pricing_program_file="/tmp/core-api-manual-pricing-${unique_suffix}.py"

cat > "$pricing_program_file" <<'PY'
#!/usr/bin/env python3
import json
import sys

request = json.loads(sys.stdin.read() or "{}")
rating_input = request.get("ratingInput", {})
policy = rating_input.get("policy", {}) if isinstance(rating_input, dict) else {}
requested_currency = request.get("currency", "SEK")
base_rate = policy.get("baseRate", 100)
driver_age = policy.get("driverAge", 35)

try:
  base_rate_num = float(base_rate)
except Exception:
  base_rate_num = 100.0

try:
  driver_age_num = int(driver_age)
except Exception:
  driver_age_num = 35

age_factor = 1.2 if driver_age_num < 25 else 1.0
total = round(base_rate_num * age_factor, 2)

response = {
  "requestId": request.get("requestId"),
  "success": True,
  "totalPremium": total,
  "currency": requested_currency,
  "breakdown": {
    "base": base_rate_num,
    "ageFactor": age_factor
  },
  "details": {
    "engine": "manual-training-script"
  }
}

sys.stdout.write(json.dumps(response))
PY
chmod +x "$pricing_program_file"
trap 'rm -f "$pricing_program_file"' EXIT

printf "Core API manual check script\n"
printf "Base URL: %s\n" "$BASE_URL"

call_api "GET" "/health"

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

call_api "GET" "/v1/product-management/products"
call_api "GET" "/v1/product-management/products/${product_id}"

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

call_api "GET" "/v1/product-management/components?type=COVERAGE"

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

call_api "GET" "/v1/product-management/components/${component_id}/versions/${component_version_number}"

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
  }
}
JSON
)"
pricing_program_version_id="$(extract_field "$LAST_BODY" '.id')"
require_nonempty "$pricing_program_version_id" "pricing_program_version_id"

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

call_api "POST" "/v1/product-management/product-versions/${product_version_id}/components" "$(cat <<JSON
{
  "componentVersionId": "${component_version_id}",
  "configOverrides": {
    "selected": true
  }
}
JSON
)"

call_api "DELETE" "/v1/product-management/product-versions/${product_version_id}/components/${component_version_id}"

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

call_api "POST" "/v1/product-management/product-versions/${product_version_id}/activate"
snapshot_id="$(extract_field "$LAST_BODY" '.snapshot.id')"
require_nonempty "$snapshot_id" "snapshot_id"

call_api "POST" "/v1/pricing/calculate" "$(cat <<JSON
{
  "productVersionId": "${product_version_id}",
  "currency": "USD",
  "ratingInput": {
    "policy": {
      "baseRate": 120,
      "driverAge": 22
    },
    "exposures": [],
    "coverages": [],
    "context": {
      "source": "manual-check-script"
    }
  }
}
JSON
)"

call_api "POST" "/v1/pricing/calculate" "$(cat <<JSON
{
  "resolvedSnapshotId": "${snapshot_id}",
  "currency": "EUR",
  "ratingInput": {
    "policy": {
      "baseRate": 85,
      "driverAge": 41
    },
    "exposures": [],
    "coverages": [],
    "context": {
      "source": "manual-check-script"
    }
  }
}
JSON
)"

call_api "POST" "/v1/product-management/product-versions/${product_version_id}/retire"

call_api "DELETE" "/v1/product-management/products/${product_id}"

echo ""
echo "Manual API check flow completed."
