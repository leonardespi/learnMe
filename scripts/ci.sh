#!/usr/bin/env bash
set -euo pipefail

echo "=== learnMe CI ==="
echo ""

echo "--- npm install ---"
npm ci

echo ""
echo "--- Type check (TypeScript) ---"
npm run typecheck

echo ""
echo "--- Lint (ESLint) ---"
npm run lint

echo ""
echo "--- cargo fmt check ---"
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check

echo ""
echo "--- cargo check ---"
cargo check --manifest-path src-tauri/Cargo.toml

echo ""
echo "--- cargo clippy ---"
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings

echo ""
echo "--- Tests TypeScript (Vitest) ---"
npm run test

echo ""
echo "--- Tests Rust (cargo test) ---"
npm run test:rust

echo ""
echo "--- Tests E2E (Playwright — Vite dev) ---"
npm run test:e2e

echo ""
echo "--- cargo build --release ---"
cargo build --release --manifest-path src-tauri/Cargo.toml

echo ""
echo "--- Tauri bundle (producción) ---"
npm run tauri:build

echo ""
echo "--- Verificar bundles generados ---"
ls target/release/bundle/deb/*.deb 2>/dev/null || ls target/release/bundle/appimage/*.AppImage 2>/dev/null || {
  echo "ERROR: No bundle found in target/release/bundle/"; exit 1
}

echo ""
echo "--- Tests E2E nativos (tauri-driver) — requiere tauri-driver + Xvfb ---"
if command -v tauri-driver &>/dev/null && command -v Xvfb &>/dev/null; then
  npm run test:e2e:native
else
  echo "SKIP: tauri-driver o Xvfb no disponibles. Instalar: cargo install tauri-driver && sudo apt install xvfb webkit2gtk-driver"
  exit 1
fi

echo ""
echo "=== CI completado sin errores ==="
