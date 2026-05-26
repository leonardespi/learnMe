#!/usr/bin/env bash
# Run Phase 8.B native E2E tests against the compiled Tauri binary via tauri-driver.
# Requires: cargo install tauri-driver, sudo apt install webkit2gtk-driver xvfb

set -euo pipefail

BINARY="${LEARNME_BINARY:-./target/release/learnme}"
DISPLAY_NUM="${DISPLAY_NUM:-99}"

# Verify prerequisites
for cmd in tauri-driver WebKitWebDriver Xvfb; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "ERROR: $cmd not found. Run: sudo apt install webkit2gtk-driver xvfb && cargo install tauri-driver"
    exit 1
  fi
done

if [[ ! -f "$BINARY" ]]; then
  echo "ERROR: Binary not found at $BINARY. Run: npm run tauri:build"
  exit 1
fi

# Start virtual display
Xvfb ":$DISPLAY_NUM" -screen 0 1280x800x24 &
XVFB_PID=$!
export DISPLAY=":$DISPLAY_NUM"

cleanup() {
  kill "$XVFB_PID" 2>/dev/null || true
  kill "$DRIVER_PID" 2>/dev/null || true
}
trap cleanup EXIT

# Start tauri-driver (binary specified in session capabilities, not CLI)
tauri-driver &
DRIVER_PID=$!

# Wait for driver to be ready
for i in {1..15}; do
  if curl -sf http://localhost:4444/status >/dev/null 2>&1; then
    break
  fi
  sleep 1
  if [[ $i -eq 15 ]]; then
    echo "ERROR: tauri-driver did not start within 15s"
    exit 1
  fi
done

echo "tauri-driver ready. Running native E2E tests..."
npx playwright test --config playwright.tauri.config.ts "$@"
