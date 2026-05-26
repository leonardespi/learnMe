#!/usr/bin/env bash
set -euo pipefail

echo "=== Cobertura learnMe ==="
echo ""

echo "--- Cobertura TypeScript ---"
npm run coverage

echo ""
echo "--- Cobertura Rust (cargo tarpaulin) ---"
cargo tarpaulin --manifest-path src-tauri/Cargo.toml --out Xml --output-dir coverage/rust/

echo ""
echo "=== Reportes generados en coverage/ ==="
