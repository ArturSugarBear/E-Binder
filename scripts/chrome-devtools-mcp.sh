#!/usr/bin/env bash
# chrome-devtools-mcp.sh — run Chrome DevTools MCP against a headless Chromium.
#
# chrome-devtools-mcp cannot reliably launch Chromium itself in this container,
# so this wrapper starts Playwright's Chromium with a CDP port and attaches the
# MCP server to it. If a Chrome instance is already listening on CDP_PORT, it
# reuses that instance instead of starting another one.
set -euo pipefail

PORT="${CDP_PORT:-9333}"
BASE="http://127.0.0.1:${PORT}"
TMP_ROOT="${TMPDIR:-/tmp}/opencode"
PROFILE_DIR=""
CHROME_PID=""

mkdir -p "$TMP_ROOT"

cleanup() {
  if [ -n "$CHROME_PID" ]; then
    kill "$CHROME_PID" 2>/dev/null || true
  fi
  if [ -n "$PROFILE_DIR" ]; then
    rm -rf "$PROFILE_DIR" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

if ! curl -fsS "${BASE}/json/version" >/dev/null 2>&1; then
  CHROME="${CHROME_PATH:-}"
  if [ -z "$CHROME" ]; then
    CHROME="$(
      node -e "process.stdout.write(require('playwright').chromium.executablePath())" \
        2>/dev/null || true
    )"
  fi
  if [ -z "$CHROME" ] || [ ! -x "$CHROME" ]; then
    echo "Chrome executable not found. Set CHROME_PATH." >&2
    exit 1
  fi

  PROFILE_DIR="$(mktemp -d "${TMP_ROOT}/chrome-devtools-XXXXXX")"
  "$CHROME" \
    --headless \
    --no-sandbox \
    --disable-dev-shm-usage \
    --use-angle=swiftshader-webgl \
    --enable-unsafe-swiftshader \
    --remote-debugging-port="${PORT}" \
    --user-data-dir="${PROFILE_DIR}" \
    about:blank >"${TMP_ROOT}/chrome-devtools.log" 2>&1 &
  CHROME_PID=$!

  for _ in $(seq 1 60); do
    if curl -fsS "${BASE}/json/version" >/dev/null 2>&1; then
      break
    fi
    sleep 0.5
  done

  if ! curl -fsS "${BASE}/json/version" >/dev/null 2>&1; then
    echo "Chrome DevTools endpoint did not start on ${BASE}." >&2
    exit 1
  fi
fi

npx -y chrome-devtools-mcp@latest --browserUrl "${BASE}" "$@"
