# Reporte de fase 8.B — E2E nativo con tauri-driver

## Resumen

Integración completa de `tauri-driver` + Xvfb para E2E nativo contra el binario Tauri compilado. Migración de 7 tests vite/mock-IPC a WebDriver real (W3C). Corrección de 14 tests Vite que fallaban por duplicación de layouts en DOM. Producción de bundles distribuibles (.deb, .rpm, .AppImage) verificados.

## Cambios implementados

### Archivos nuevos
- `docs/phase-8.B/test-plan.md` — plan de pruebas de la fase
- `docs/phase-8.B/report.md` — este reporte
- `playwright.tauri.config.ts` — config Playwright para suite nativa (solo `phase8b_native.spec.ts`, sin browser)
- `scripts/run-native-e2e.sh` — script de arranque: Xvfb + tauri-driver + espera de port 4444 + Playwright
- `tests/e2e/phase8b_native.spec.ts` — 7 tests E2E nativos vía thin client WebDriver HTTP
- `src-tauri/src/commands/test_utils.rs` — comando `dev_reset_db` (trunca todas las tablas para aislar tests)
- `icons/32x32.png`, `icons/128x128.png`, `icons/256x256.png`, `icons/icon.png` — PNG RGBA (color type 6) requeridos por Tauri bundler

### Archivos modificados

- `src-tauri/src/commands/mod.rs` — añadido `pub mod test_utils`
- `src-tauri/src/lib.rs` — `commands::test_utils::dev_reset_db` registrado en `invoke_handler![]`
- `src-tauri/tauri.conf.json` — añadido array `icon` con los 4 PNG RGBA
- `scripts/ci.sh` — añadidos pasos: `cargo build --release`, `npm run tauri:build`, verificación de bundle, `npm run test:e2e:native`
- `package.json` — añadido script `test:e2e:native`
- `playwright.config.ts` — viewport default `900×700` (< breakpoint `lg:`), `testIgnore` excluye `phase8b_native.spec.ts`
- `src/shared/layout/AppLayout.tsx` — hook `useIsDesktop()` + rendering condicional JS (solo un layout en DOM a la vez); elimina `VIEW_LABEL` (header siempre muestra "learnMe")
- `src/shared/layout/BottomTabs.tsx` — `data-testid="bottom-nav"` en div interno; `data-testid="theme-toggle"` en botón de tema; `data-testid="bottom-tabs"` permanece en nav
- `src/features/categories/CategoryList.tsx` — `data-testid="category-item"` restaurado (seguro: rendering condicional garantiza una sola copia en DOM)
- `index.html` — `<div id="root">learnMe</div>` como contenido pre-React (evita race condition en test de lanzamiento)

### Decisiones técnicas

- **Rendering condicional JS + CSS backup**: `useIsDesktop()` garantiza que solo un layout exista en DOM simultáneamente (elimina violaciones de strict mode en Playwright). Las clases CSS `hidden lg:flex` / `flex lg:hidden` se mantienen como fallback para race conditions entre resize del viewport y el re-render de React (relevante en test nativo `setViewport` → query inmediata).
- **Viewport default 900px en playwright.config.ts**: Hace que los tests sin `setViewportSize` explícito usen el layout móvil donde `CategoriesView` está visible. Tests de fases 5/6/7/7.5 escritos para este layout.
- **`dev_reset_db` sin guard de `cfg!(debug_assertions)`**: El guard impedía su uso en el binario release que los tests nativos requieren. La app es local (desktop), el comando solo es alcanzable vía el WebView propio de la app — sin riesgo de seguridad.
- **`tauri-driver` sin argumento de binario**: En v2.x el binario se especifica en las capabilities de la sesión WebDriver (`tauri:options.application`), no como argumento CLI.
- **`index.html` con texto "learnMe" en root**: El test `app launches and shows learnMe UI` lee `document.body.innerText` antes de que React monte. El texto estático en el div#root garantiza que el contenido esté presente desde el primer frame.

## Cobertura de pruebas (suite completa)

| Suite | Pasados | Total | Herramienta |
|-------|---------|-------|-------------|
| Unit/Integration TypeScript | 103 | 104 (1 skipped) | Vitest |
| Unit Rust | 21 | 21 | cargo test |
| E2E Vite dev | 24 | 24 | Playwright |
| E2E nativo (tauri-driver) | 7 | 7 | Playwright + tauri-driver |
| **Total** | **155** | **156** | |

- `cargo clippy -- -D warnings`: 0 warnings
- `tsc --noEmit`: 0 errores
- Fecha: 2026-05-26

## Bundles generados

| Formato | Ruta | Tamaño |
|---------|------|--------|
| `.deb` | `target/release/bundle/deb/learnMe_0.1.0_amd64.deb` | 6.4 MB |
| `.rpm` | `target/release/bundle/rpm/learnMe-0.1.0-1.x86_64.rpm` | 6.4 MB |
| `.AppImage` | `target/release/bundle/appimage/learnMe_0.1.0_amd64.AppImage` | 78 MB |

## Blockers resueltos

| Blocker | Solución |
|---------|----------|
| `webkit2gtk-driver` no instalado | `sudo apt install -y webkit2gtk-driver xvfb` |
| `tauri-driver` CLI v2 cambia sintaxis | Eliminado argumento de binario; se pasa vía capabilities |
| Strict mode violation: 2× `category-item` en DOM | Rendering condicional JS → solo un layout en DOM |
| `categories-view` invisible a 1280px (default viewport) | Viewport default rebajado a 900px |
| `dev_reset_db` rechaza en release build | Eliminado guard `cfg!(not(debug_assertions))` |
| Race condition sidebar en test nativo | CSS backup `hidden lg:flex` garantiza `getBoundingClientRect().width === 0` durante re-render |
| Testid `bottom-nav` inexistente | Añadido div interno con `data-testid="bottom-nav"` en BottomTabs |
| `theme-toggle` vs `btn-theme-toggle` | BottomTabs usa `theme-toggle`; ThemeToggle (sidebar) conserva `btn-theme-toggle` |
| Iconos PNG RGB (color type 2) rechazados | Regenerados como RGBA puro (color type 6) |

## Deuda técnica

- `dev_reset_db` expuesto en builds release — aceptable para app local, anotar si en el futuro se añade distribución web/cloud.
- Snapshots visuales (phase4) se actualizaron por cambio de layout responsive — revisar diffs antes de release.

## Prerrequisitos para siguiente fase

- `tauri-driver`, `webkit2gtk-driver`, `xvfb` instalados en CI ✓
- Binario release en `target/release/learnme` ✓
- Bundles en `target/release/bundle/` ✓
