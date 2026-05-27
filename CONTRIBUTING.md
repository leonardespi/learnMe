# Contributing to learnMe

---

## Tech stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri 2 (Rust + WebView) |
| Frontend | React 18 + TypeScript strict |
| Styling | Tailwind CSS |
| State / routing | Zustand + React Router |
| Build | Vite 5 |
| Backend | Rust (Tauri commands) |
| Database | SQLite via `rusqlite` |
| Spaced repetition | FSRS v5 (`fsrs` crate) |
| Schema validation | Zod (TS) + `serde` + `jsonschema` (Rust) |
| Unit tests | Vitest (TS) + `cargo test` with `insta` snapshots (Rust) |
| E2E tests | Playwright (frontend) + `tauri-driver` (native) |

---

## Prerequisites

**Linux:**
```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
```
Fedora: `sudo dnf install -y webkit2gtk4.1-devel libappindicator-gtk3-devel librsvg2-devel patchelf`  
Arch: `sudo pacman -S webkit2gtk-4.1 libappindicator-gtk3 librsvg patchelf`

**macOS:** Xcode Command Line Tools — `xcode-select --install`

**All platforms:**
- Node.js ≥ 20 (`nvm` recommended)
- Rust stable (`rustup` recommended)

---

## Build from source

```bash
git clone https://github.com/leonardespi/learnMe.git
cd learnMe
npm install
npm run tauri:build      # produces release binary in src-tauri/target/release/
```

The first Rust compile takes 3–8 minutes. Subsequent builds use the incremental cache and are much faster.

**Or use the automated installer** (installs Node.js and Rust in user space, builds, and registers the `learnme` command):
```bash
bash install.sh
```

---

## Development

```bash
npm run tauri:dev    # full app with hot-reload
npm run dev          # frontend only → http://localhost:1420
```

---

## Running tests

```bash
npm run test         # Vitest unit tests
npm run test:watch   # watch mode
npm run test:e2e     # Playwright E2E (Vite dev server)
cargo test           # Rust unit tests
npm run coverage     # TypeScript coverage report
cargo tarpaulin      # Rust coverage report
./scripts/ci.sh      # full CI suite — run before opening a PR
```

TypeScript must pass `tsc --noEmit` with zero errors.  
Rust must pass `cargo clippy -- -D warnings` with zero warnings.

---

## Code conventions

**TypeScript**
- Strict mode — no `any` without `// any-justified: <reason>`
- No `@ts-ignore` without an explanation comment
- Absolute imports from `@/`

**Rust**
- `#![deny(warnings)]` at crate root
- Errors via `thiserror`; `anyhow` only in `main.rs`
- `unsafe` requires `// SAFETY: <invariant>`

**Naming**
- React components: `PascalCase.tsx`
- Hooks and utilities: `camelCase.ts`
- Rust modules: `snake_case`
- Runtime IDs: UUIDv7

**Comments:** only when the WHY is non-obvious. No docstrings that restate what the code does.

**No network calls** in `src/` or `src-tauri/src/`.

**Module boundaries:** files outside `src-tauri/src/methods/anki/` and `src/features/methods/anki/` must not import from those paths. `core/` knows only the `StudyMethod` trait.

---

## Pull request guidelines

- One logical change per PR.
- `./scripts/ci.sh` must pass locally before opening.
- Describe **what** changed and **why** — not how.
- Keep diffs small. Prefer focused PRs over large ones.

---

## Reporting bugs

Open a GitHub issue with:
1. Steps to reproduce
2. Expected vs actual behaviour
3. OS, distribution, learnMe version

---

## License

By submitting a pull request you agree your contribution is licensed under the MIT License.
