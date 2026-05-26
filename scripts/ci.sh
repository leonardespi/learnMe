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
echo "--- Tests E2E (Playwright) ---"
npm run test:e2e

echo ""
echo "=== CI completado sin errores ==="
