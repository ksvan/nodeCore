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
  sub: "manual-billing-check",
  scope: "billing:write billing:read",
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
  local headers=("-H" "Accept: application/json" "-H" "Authorization: Bearer ${AUTH_TOKEN}")

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
  node - "$days" <<'NODE'
const days = Number(process.argv[2] ?? 0);
const dt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
process.stdout.write(dt.toISOString());
NODE
}

if [[ -z "$AUTH_TOKEN" ]]; then
  AUTH_TOKEN="$(generate_dev_jwt "$JWT_SECRET")"
  echo "Using generated dev JWT (JWT_SECRET=${JWT_SECRET})."
else
  echo "Using CORE_API_AUTH_TOKEN from environment."
fi

unique_suffix="$(date +%s)"
party_id="$(uuid)"
due_date="$(iso_from_offset_days 14)"

invoice_idempotency_a="billing-invoice-a-${unique_suffix}"
invoice_idempotency_b="billing-invoice-b-${unique_suffix}"
payment_idempotency="billing-payment-${unique_suffix}"
allocation_idempotency="billing-allocation-${unique_suffix}"

echo "Core API billing+invoicing manual check script"
echo "Base URL: $BASE_URL"

call_api "GET" "/health" ""

call_api "POST" "/v1/billing/accounts" "$(cat <<JSON
{
  "partyId": "${party_id}"
}
JSON
)"
account_id="$(extract_field "$LAST_BODY" '.id')"
require_nonempty "$account_id" "account_id"

call_api "GET" "/v1/billing/accounts" ""
call_api "GET" "/v1/billing/accounts?query=${party_id}" ""
call_api "GET" "/v1/billing/accounts/${account_id}" ""

call_api "POST" "/v1/billing/accounts/${account_id}/invoices" "$(cat <<JSON
{
  "dueDate": "${due_date}",
  "currency": "SEK",
  "lines": [
    {
      "description": "Base premium",
      "quantity": "1.00",
      "unitAmount": "125.50"
    }
  ]
}
JSON
)" "Idempotency-Key: ${invoice_idempotency_a}"
invoice_id_a="$(extract_field "$LAST_BODY" '.id')"
invoice_total_a="$(extract_field "$LAST_BODY" '.invoiceTotal')"
require_nonempty "$invoice_id_a" "invoice_id_a"
require_nonempty "$invoice_total_a" "invoice_total_a"

call_api "POST" "/v1/billing/accounts/${account_id}/invoices" "$(cat <<JSON
{
  "dueDate": "${due_date}",
  "currency": "SEK",
  "lines": [
    {
      "description": "Fee",
      "quantity": "1.00",
      "unitAmount": "90.00"
    }
  ]
}
JSON
)" "Idempotency-Key: ${invoice_idempotency_b}"
invoice_id_b="$(extract_field "$LAST_BODY" '.id')"
invoice_total_b="$(extract_field "$LAST_BODY" '.invoiceTotal')"
require_nonempty "$invoice_id_b" "invoice_id_b"
require_nonempty "$invoice_total_b" "invoice_total_b"

call_api "GET" "/v1/billing/accounts/${account_id}/invoices" ""
call_api "GET" "/v1/billing/invoices/${invoice_id_a}" ""

call_api "POST" "/v1/billing/payments" "$(cat <<JSON
{
  "accountId": "${account_id}",
  "amount": "200.00",
  "currency": "SEK",
  "providerRef": "manual-payment-${unique_suffix}"
}
JSON
)" "Idempotency-Key: ${payment_idempotency}"
payment_id="$(extract_field "$LAST_BODY" '.id')"
require_nonempty "$payment_id" "payment_id"

call_api "GET" "/v1/billing/accounts/${account_id}/payments" ""
call_api "GET" "/v1/billing/payments/${payment_id}" ""

call_api "POST" "/v1/billing/payments/${payment_id}/allocate" "$(cat <<JSON
{
  "allocations": [
    {
      "invoiceId": "${invoice_id_a}",
      "amount": "125.50"
    },
    {
      "invoiceId": "${invoice_id_b}",
      "amount": "74.50"
    }
  ]
}
JSON
)" "Idempotency-Key: ${allocation_idempotency}"

call_api "GET" "/v1/billing/invoices/${invoice_id_a}" ""
call_api "GET" "/v1/billing/invoices/${invoice_id_b}" ""
call_api "GET" "/v1/billing/payments/${payment_id}" ""
call_api "GET" "/v1/billing/accounts/${account_id}" ""

echo ""
echo "Billing and invoicing manual API check flow completed."
