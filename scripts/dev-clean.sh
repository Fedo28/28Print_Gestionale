#!/bin/zsh

set -euo pipefail

PORT="${1:-3000}"
BIND_HOST="${BIND_HOST:-0.0.0.0}"

PIDS="$(lsof -ti tcp:${PORT} || true)"

if [[ -n "${PIDS}" ]]; then
  echo "Stopping processes on port ${PORT}: ${PIDS}"
  kill ${=PIDS} || true
  sleep 1
fi

echo "Cleaning .next cache"
rm -rf .next

echo "Starting Next.js on ${BIND_HOST}:${PORT}"
exec npx next dev --hostname "${BIND_HOST}" --port "${PORT}"
