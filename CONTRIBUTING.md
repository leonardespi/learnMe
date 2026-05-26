# Contributing to learnMe

## Prerequisites

- Node.js ≥ 18
- Rust ≥ 1.78 (`rustup` recommended)
- System dependencies for Tauri:
  - Ubuntu/Debian: `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`
  - Arch: `webkit2gtk-4.1 libappindicator-gtk3`

## Setup

```bash
git clone https://github.com/leonardespi/learnMe.git
cd learnMe
npm install
```

## Development

```bash
npm run tauri:dev    # full app with hot-reload
npm run dev          # frontend only → http://localhost:1420
```

## Running tests

```bash
npm run test         # Vitest unit tests
cargo test           # Rust unit tests
npm run test:e2e     # Playwright E2E (Vite dev server)
./scripts/ci.sh      # full CI suite — run before opening a PR
```

TypeScript must pass `tsc --noEmit` with zero errors. Rust must pass `cargo clippy -- -D warnings` with zero warnings.

## Code conventions

- **TypeScript**: strict mode, no `any` without `// any-justified: <reason>`, imports from `@/`
- **Rust**: `#![deny(warnings)]`, errors via `thiserror` / `anyhow` (only in `main.rs`), `unsafe` requires `// SAFETY: <invariant>`
- **Components**: `PascalCase.tsx` — hooks/utils: `camelCase.ts` — Rust modules: `snake_case`
- **Comments**: only when the WHY is non-obvious. No docstrings that restate what the code does.
- **No network calls** in `src/` or `src-tauri/src/`.

## Pull request guidelines

- One logical change per PR.
- The CI suite (`./scripts/ci.sh`) must pass locally before opening the PR.
- Describe **what** changed and **why** — not how.
- Keep diffs small. Prefer multiple focused PRs over one large one.

## Reporting bugs

Open a GitHub issue. Include:
1. Steps to reproduce
2. Expected vs actual behaviour
3. OS, distribution, learnMe version

## License

By submitting a pull request you agree that your contribution is licensed under the MIT License.
