#!/usr/bin/env bash

set -u
set -o pipefail

BASE_URL="${CORE_API_BASE_URL:-http://127.0.0.1:4000}"
WS_URL="${CORE_API_WS_URL:-}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

require_cmd node

if [[ -z "$WS_URL" ]]; then
  if [[ "$BASE_URL" == https://* ]]; then
    WS_URL="wss://${BASE_URL#https://}/ws/events"
  elif [[ "$BASE_URL" == http://* ]]; then
    WS_URL="ws://${BASE_URL#http://}/ws/events"
  else
    echo "Invalid CORE_API_BASE_URL: $BASE_URL"
    echo "Use http://... or https://..., or set CORE_API_WS_URL directly."
    exit 1
  fi
fi

echo "Core API WebSocket event listener"
echo "Connecting to: $WS_URL"
echo "Press Ctrl+C to stop."
echo ""

node - "$WS_URL" <<'NODE'
const wsUrl = process.argv[2];

if (!wsUrl) {
  console.error("Missing WebSocket URL");
  process.exit(1);
}

const ws = new WebSocket(wsUrl);

const asString = (data) => {
  if (typeof data === "string") return data;
  if (Buffer.isBuffer(data)) return data.toString("utf8");
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf8");
  return String(data);
};

ws.addEventListener("open", () => {
  console.log(`[${new Date().toISOString()}] connected`);
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
  console.log(`[${new Date().toISOString()}] disconnected (code=${event.code}, reason=${event.reason || "none"})`);
  process.exit(0);
});

ws.addEventListener("error", () => {
  console.error(`[${new Date().toISOString()}] websocket error`);
});
NODE
