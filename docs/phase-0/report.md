# Reporte de fase 0 — Bootstrap y andamiaje

## Resumen

Bootstrap completo: monorepo Tauri 2 + React 18 + TypeScript strict + Rust funcional. Los 3 tests del plan de pruebas pasan (TS unit, Rust smoke, E2E Playwright). CI local (`./scripts/ci.sh`) verde con exit 0.

## Cambios implementados

### Archivos nuevos

**Configuración / infraestructura:**
- `package.json` — dependencias npm, scripts `test`, `test:e2e`, `test:rust`, `test:all`, `coverage`, `lint`, `typecheck`
- `tsconfig.json` — TypeScript strict, path alias `@/→src/`, tipos node + vitest/globals
- `vite.config.ts` — Vite 5 + React + Tailwind 4, puerto 1420, alias `@/`, config Vitest con cobertura v8
- `Cargo.toml` — workspace Rust, resolver 2
- `rust-toolchain.toml` — fija proyecto a `stable` (1.95.0)
- `index.html` — entry point HTML para Vite
- `playwright.config.ts` — Playwright E2E, webServer apunta a `http://localhost:1420`
- `eslint.config.js` — ESLint 9 flat config con typescript-eslint
- `.prettierrc` — formato: no semis, single quotes, trailing comma es5
- `.gitignore`
- `scripts/ci.sh` — lint + typecheck + cargo fmt + cargo check + clippy + vitest + cargo test + playwright
- `scripts/coverage.sh` — vitest coverage + cargo tarpaulin

**src-tauri (Rust):**
- `src-tauri/Cargo.toml` — crate `learnme`, deps: tauri 2, serde, serde_json
- `src-tauri/build.rs` — tauri_build::build()
- `src-tauri/tauri.conf.json` — ventana "learnMe" 1200×800, devUrl localhost:1420
- `src-tauri/capabilities/default.json` — capability vacía (sin permisos en fase 0)
- `src-tauri/src/main.rs` — entry point binario
- `src-tauri/src/lib.rs` — función `run()` + módulo `tests::smoke`
- `src-tauri/icons/icon.png`, `icon-32x32.png`, `icon-128x128.png`, `icon-256x256.png` — placeholders RGBA

**Frontend (React):**
- `src/app/index.ts` — exporta `app = { name: 'learnMe', version: '0.1.0' }` (hace pasar el test TS unit)
- `src/main.tsx` — entry React con StrictMode
- `src/App.tsx` — componente raíz con `<h1>learnMe</h1>` (hace pasar el test E2E)
- `src/styles/globals.css` — Tailwind 4 import + CSS variables de tema claro/oscuro (PRD §4.1)

**Estructura vacía (PRD §7):**
- `src/features/categories/`, `src/features/studies/`, `src/features/methods/anki/`, `src/shared/`
- `src-tauri/src/core/`, `src-tauri/src/repo/`, `src-tauri/src/methods/anki/`, `src-tauri/src/commands/`, `src-tauri/migrations/`
- `fixtures/db/`, `fixtures/decks/`, `fixtures/cards/`, `fixtures/reviews/`
- `schemas/`, `tests/unit/`, `tests/e2e/`, `tests/integration/`

**Documentación:**
- `docs/phase-0/test-plan.md`

### Decisiones técnicas tomadas (no triviales)

- **`rust-toolchain.toml` con `channel = "stable"`**: el sistema tenía `1.75-x86_64-unknown-linux-gnu` como default. Tauri 2 requiere ≥ 1.77 (por `edition2024` en dependencias transitivas). Solución project-level sin alterar el default global del usuario.
- **`@types/node` + `types: ["node", "vitest/globals"]` en tsconfig**: `playwright.config.ts` y `vite.config.ts` usan globals de Node.js (`process`, `__dirname`, `path`). Sin esta adición TypeScript strict falla. Alternativa descartada: reescribir configs con `import.meta.url` (más frágil en la interacción Vite/CJS).
- **`jsdom` como devDependency explícita**: Vitest 2.x no incluye jsdom; es peer dependency que debe instalarse manualmente. Versión: `^29.1.1`.
- **Puerto Vite fijo en 1420**: alineado con `devUrl` de `tauri.conf.json`. Playwright webServer apunta a ese puerto. Evita desincronía entre Tauri dev server y tests E2E.
- **E2E contra Vite dev server (no tauri-driver)**: para Phase 0, Playwright valida el contenido web en headless sin necesitar el binario Tauri compilado. Cumple el requisito del plan ("ventana con learnMe visible"). En fases E2E avanzadas (Fase 4+) se migrará a `tauri-driver` para testing del binario real.
- **Iconos PNG RGBA placeholder**: `tauri::generate_context!()` requiere `src-tauri/icons/icon.png` en RGBA. Se generaron con Python desde bytes — sin dependencia de imagemagick ni assets externos.

## Cobertura de pruebas (suite completa)

- **Líneas**: N/A — fase 0 no tiene código de dominio; umbral 80% aplica desde Fase 1
- **Ramas**: N/A
- **Tests totales**: 3
  - Pasados: 3
    - `tests/unit/app.test.ts::app exports app object` (Vitest)
    - `src-tauri::tests::smoke` (cargo test)
    - `tests/e2e/window.spec.ts::app window shows learnMe` (Playwright)
  - Skipped (`cannot test`): 0
  - Fallidos: **0**
- Comando ejecutado: `./scripts/ci.sh`
- Fecha y hora: 2026-05-24T12:03:54Z

## Pruebas marcadas `cannot test`

Ninguna.

## Riesgos detectados durante la fase

| Riesgo | Probabilidad | Impacto | Mitigación propuesta |
|--------|--------------|---------|----------------------|
| `glob@10.5.0` deprecation warning en npm audit | Baja | Bajo | Dep transitiva; sin CVE activo. Revisar al actualizar deps en fase 8 |
| 6 vulnerabilidades "moderate" en npm audit | Baja | Bajo | Todas en devDeps o transitivas; sin impacto en producción local-first. Revisar en fase 8 antes de release |
| E2E en Fase 4+ requerirá `tauri-driver` + display | Alta | Medio | Documentado; en Fase 4 evaluar Xvfb o headless Tauri |
| Iconos placeholder | Baja | Bajo | Reemplazar con assets reales antes de Fase 8 (empaquetado) |

## Blockers

Ninguno activo. Resueltos durante la fase:
- Rust default toolchain 1.75 → resuelto con `rust-toolchain.toml`
- Sistema sin `libwebkit2gtk-4.1-dev` → instalado por el usuario
- `jsdom` faltante → agregado a devDependencies
- `@types/node` faltante → agregado a devDependencies

## Deuda técnica acumulada

- `src-tauri/icons/` contiene placeholders; reemplazar con assets finales en Fase 8.
- E2E usa Vite dev server, no `tauri-driver`; migrar en Fase 4 cuando haya UI real.

## Próxima fase: pre-requisitos

- [x] Fase 0 completa y `./scripts/ci.sh` verde
- [ ] Para Fase 1: no se requiere acción adicional del usuario — el scaffolding está listo
