#!/usr/bin/env bash
# Generates fixtures/db/empty.sqlite and fixtures/db/seeded.sqlite
# from the migration SQL. These are audit artifacts; Rust tests use in-memory DBs.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FIXTURES_DB="$REPO_ROOT/fixtures/db"
MIGRATION="$REPO_ROOT/src-tauri/migrations/V1__init.sql"
SEED_SQL="$FIXTURES_DB/seed.sql"

command -v sqlite3 >/dev/null 2>&1 || { echo "ERROR: sqlite3 not found. Install: apt-get install sqlite3"; exit 1; }

# empty.sqlite — migrations only, no data
rm -f "$FIXTURES_DB/empty.sqlite"
sqlite3 "$FIXTURES_DB/empty.sqlite" < "$MIGRATION"
echo "Created: fixtures/db/empty.sqlite"

# seeded.sqlite — migrations + seed data
rm -f "$FIXTURES_DB/seeded.sqlite"
sqlite3 "$FIXTURES_DB/seeded.sqlite" < "$MIGRATION"
sqlite3 "$FIXTURES_DB/seeded.sqlite" < "$SEED_SQL"
echo "Created: fixtures/db/seeded.sqlite"

echo "Done. Verify with: sqlite3 fixtures/db/seeded.sqlite .tables"
