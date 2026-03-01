#!/usr/bin/env bash

set -u
set -o pipefail

BASE_URL="${CORE_API_BASE_URL:-http://127.0.0.1:4000}"
WS_URL="${CORE_API_WS_BUSINESS_URL:-}"
AUTH_TOKEN="${CORE_API_AUTH_TOKEN:-}"
JWT_SECRET="${JWT_SECRET:-unsafe-dev-secret}"

# Optional comma-separated filters
BUSINESS_EVENT_TYPES="${BUSINESS_EVENT_TYPES:-}"
BUSINESS_ENTITY_TYPES="${BUSINESS_ENTITY_TYPES:-}"
BUSINESS_ENTITY_IDS="${BUSINESS_ENTITY_IDS:-}"
BUSINESS_SINCE_OCCURRED_AT="${BUSINESS_SINCE_OCCURRED_AT:-}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

require_cmd node

generate_dev_jwt() {
  local secret="$1"
  node - "$secret" <<'NODE'
const crypto = require("node:crypto");
const secret = process.argv[2] ?? "unsafe-dev-secret";
const now = Math.floor(Date.now() / 1000);
const header = { alg: "HS256", typ: "JWT" };
const payload = {
  sub: "manual-business-events-listener",
  scope: "events:read",
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

if [[ -z "$WS_URL" ]]; then
  if [[ "$BASE_URL" == https://* ]]; then
    WS_URL="wss://${BASE_URL#https://}/ws/business-events"
  elif [[ "$BASE_URL" == http://* ]]; then
    WS_URL="ws://${BASE_URL#http://}/ws/business-events"
  else
    echo "Invalid CORE_API_BASE_URL: $BASE_URL"
    echo "Use http://... or https://..., or set CORE_API_WS_BUSINESS_URL directly."
    exit 1
  fi
fi

if [[ -z "$AUTH_TOKEN" ]]; then
  AUTH_TOKEN="$(generate_dev_jwt "$JWT_SECRET")"
  echo "Using generated dev JWT (JWT_SECRET=${JWT_SECRET})."
else
  echo "Using CORE_API_AUTH_TOKEN from environment."
fi

echo "Core API Business Events WebSocket listener"
echo "Connecting to: $WS_URL"
if [[ -n "$BUSINESS_EVENT_TYPES$BUSINESS_ENTITY_TYPES$BUSINESS_ENTITY_IDS$BUSINESS_SINCE_OCCURRED_AT" ]]; then
  echo "Applying subscription filters."
fi
echo "Press Ctrl+C to stop."
echo ""

node - "$WS_URL" "$AUTH_TOKEN" "$BUSINESS_EVENT_TYPES" "$BUSINESS_ENTITY_TYPES" "$BUSINESS_ENTITY_IDS" "$BUSINESS_SINCE_OCCURRED_AT" <<'NODE'
const wsUrl = process.argv[2];
const authToken = process.argv[3];
const eventTypesCsv = process.argv[4] || "";
const entityTypesCsv = process.argv[5] || "";
const entityIdsCsv = process.argv[6] || "";
const sinceOccurredAt = process.argv[7] || "";

if (!wsUrl || !authToken) {
  console.error("Missing WebSocket URL or auth token");
  process.exit(1);
}

const parseCsv = (value) => value.split(",").map((v) => v.trim()).filter(Boolean);

const filters = {};
const eventTypes = parseCsv(eventTypesCsv);
const entityTypes = parseCsv(entityTypesCsv);
const entityIds = parseCsv(entityIdsCsv);

if (eventTypes.length) filters.eventTypes = eventTypes;
if (entityTypes.length) filters.entityTypes = entityTypes;
if (entityIds.length) filters.entityIds = entityIds;
if (sinceOccurredAt) filters.sinceOccurredAt = sinceOccurredAt;

const ws = new WebSocket(wsUrl, {
  headers: {
    Authorization: `Bearer ${authToken}`,
  },
});

const asString = (data) => {
  if (typeof data === "string") return data;
  if (Buffer.isBuffer(data)) return data.toString("utf8");
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf8");
  return String(data);
};

ws.addEventListener("open", () => {
  console.log(`[${new Date().toISOString()}] connected`);

  if (Object.keys(filters).length > 0) {
    ws.send(
      JSON.stringify({
        type: "subscribe",
        filters,
      }),
    );
  }
});

ws.addEventListener("message", (event) => {
  const raw = asString(event.data);
  const ts = new Date().toISOString();

  try {
    const parsed = JSON.parse(raw);
    console.log(`[${ts}] event:`);
    console.log(JSON.stringify(parsed, null, 2));
  } catch {
    console.log(`[${ts}] event:`);
    console.log(raw);
  }

  console.log("");
});

ws.addEventListener("close", (event) => {
  console.log(
    `[${new Date().toISOString()}] disconnected (code=${event.code}, reason=${event.reason || "none"})`,
  );
  process.exit(0);
});

ws.addEventListener("error", () => {
  console.error(`[${new Date().toISOString()}] websocket error`);
});
NODE
