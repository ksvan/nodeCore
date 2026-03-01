#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

export PATH="$(npm config get prefix)/bin:$PATH"

# Demo defaults; callers can override before invoking the script.
export CORE_API_BASE_URL="${CORE_API_BASE_URL:-http://localhost:4000}"
export NEXT_PUBLIC_CORE_WS_URL="${NEXT_PUBLIC_CORE_WS_URL:-ws://localhost:4000/ws/events}"
export NEXT_PUBLIC_CORE_BUSINESS_WS_URL="${NEXT_PUBLIC_CORE_BUSINESS_WS_URL:-ws://localhost:4000/ws/business-events}"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm not found in PATH. Run: export PATH=\"\$(npm config get prefix)/bin:\$PATH\""
  exit 1
fi

echo "Starting core-api on ${CORE_API_BASE_URL} ..."
pnpm --filter @nodecore/core-api dev &
CORE_API_PID=$!

echo "Starting channel-ui on http://localhost:3000 ..."
pnpm --filter @nodecore/channel-ui dev &
CHANNEL_UI_PID=$!

cleanup() {
  echo "\nStopping demo services..."
  kill "$CORE_API_PID" "$CHANNEL_UI_PID" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

wait "$CORE_API_PID" "$CHANNEL_UI_PID"
