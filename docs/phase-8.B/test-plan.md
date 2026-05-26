# Plan de pruebas — Fase 8.B: Integración nativa con tauri-driver y distribución

## Contexto y baseline

Estado actual previo a esta fase:

| Suite | Resultado |
|-------|-----------|
| `cargo test` | 21/21 ✅ |
| `npm run test` (Vitest) | 103/104 ✅ (1 skip previo) |
| `npm run test:e2e` (Playwright vs Vite dev) | 10/24 ✅ — 14 fallan (UI no conectada o IPC mock incompleto) |

Raíz del problema E2E: `playwright.config.ts` apunta a `localhost:1420` (Vite + `mock-ipc.ts`). Comandos IPC reales (create_category, etc.) no atraviesan el backend Rust. La Fase 8.B liquida esta brecha migrando toda la suite E2E al binario Tauri real.

---

## Bloque A — Infraestructura tauri-driver

### A.1 Instalación y herramientas

| # | Check | Comando | Esperado |
|---|-------|---------|----------|
| 1 | `tauri-driver` disponible | `cargo install tauri-driver && tauri-driver --version` | instala sin error |
| 2 | `Xvfb` disponible (Linux) | `Xvfb :99 -screen 0 1280x800x24 &` | proceso arranca sin error |
| 3 | `DISPLAY=:99` propagado a tests | variable env en `playwright.tauri.config.ts` | chromium lanza sin GPU error |

### A.2 Configuración playwright

Nuevo archivo `playwright.tauri.config.ts` (coexiste con el original durante la transición):

- `webServer.command` → compila el binario y lanza `tauri-driver`
- `use.connectOptions` → apunta al endpoint WebDriver de `tauri-driver`
- `timeout` → 60 000ms (binario tarda más en arrancar que Vite)
- Debe pasar variable `DISPLAY=:99` en Linux headless

### A.3 Binario compilado con soporte WebDriver

| # | Check | Esperado |
|---|-------|----------|
| 1 | Feature `automation` en tauri.conf.json o Cargo.toml bajo `[profile.test]` | `tauri-driver` puede conectarse |
| 2 | `npm run tauri:build` completa sin error | binario presente en `src-tauri/target/release/learnme` |

---

## Bloque B — Migración de suite E2E existente (mock-ipc → binario real)

Los 6 archivos de specs existentes se migran para correr contra el binario real. El helper `mock-ipc.ts` queda activo solo para Vitest (no se elimina; solo se desactiva en el nuevo config).

### B.1 `window.spec.ts` (1 test — actualmente ✅)

| # | Test | Setup | Acción | Assert |
|---|------|-------|--------|--------|
| 1 | App abre y muestra UI | binario recién lanzado | `page.goto('/')` | `body` contiene `"learnMe"` |

### B.2 `phase4_categories.spec.ts` (9 tests — 1 falla actualmente)

Cada test recibe DB limpia (via hook `beforeEach` que llama al comando Tauri `dev_reset_db` disponible solo en builds de test).

| # | Test | Setup | Acción | Assert |
|---|------|-------|--------|--------|
| 1 | Crear categoría aparece en lista | DB vacía | click btn-new-category → fill → save | `[data-testid="category-item"]` con nombre visible |
| 2 | Importar deck muestra cartas | categoría creada | trigger import con fixture real | cartas visibles en StudyDetail |
| 3 | Layout mobile (375×667) | viewport reducido | `page.setViewportSize` | bottom-tabs visible, sidebar oculto |
| 4 | Layout desktop (1280×800) | viewport normal | default | sidebar visible, no bottom-tabs |
| 5 | Tema oscuro persiste tras reload | — | toggle dark → reload | `data-theme="dark"` en `<html>` |
| 6-9 | Snapshots visuales (light + dark, home + categories) | — | screenshot | diff < 1% vs baseline regenerado |

### B.3 `phase5_review.spec.ts` (migración)

| # | Test | Setup | Acción | Assert |
|---|------|-------|--------|--------|
| 1 | Sesión completa 10 cartas (grades 1-4) | deck seeded con 10 cartas new | grading loop | estados en DB cambian (query via cmd Tauri `list_cards`) |
| 2 | Atajos de teclado 1/2/3/4 | carta visible | `page.keyboard.press('3')` | grade = Good registrado |
| 3 | Espacio revela reverso | cara frontal visible | `Space` | reverso visible |
| 4 | Salir y volver a sesión | 5 cards graded, 5 pendientes | navegar fuera + volver | continúa desde carta 6 |

### B.4 `phase6_stats.spec.ts` (migración)

| # | Test | Setup | Acción | Assert |
|---|------|-------|--------|--------|
| 1 | Stats con 0 reviews | deck vacío | navegar a stats | mensaje "sin datos" o gráfico vacío visible |
| 2 | Stats renderizan en light y dark | deck con reviews | toggle tema | gráficos visibles en ambos |
| 3 | Heatmap presente | deck con 1+ review | — | al menos 1 celda activa en heatmap |

### B.5 `phase7_session.spec.ts` (migración)

| # | Test | Setup | Acción | Assert |
|---|------|-------|--------|--------|
| 1 | Exportar sesión crea archivo `.learnme` | DB seeded | click "Exportar sesión" → seleccionar path | archivo existe en disco |
| 2 | Importar `.learnme` restaura datos | DB vacía | click "Importar sesión" con fixture `valid-session.learnme` | categorías/cartas aparecen |
| 3 | Import con checksum corrupto muestra error | — | importar `corrupted-checksum.learnme` | toast/mensaje de error visible |

### B.6 `phase7_5_commandpalette.spec.ts` (migración)

| # | Test | Setup | Acción | Assert |
|---|------|-------|--------|--------|
| 1 | ⌘K / Ctrl+K abre paleta | home page | `Ctrl+K` | modal de paleta visible |
| 2 | Filtro tipográfico navega a mazo | deck existente | escribir nombre del mazo | ítem del mazo en resultados |
| 3 | ESC cierra paleta | paleta abierta | `Escape` | modal oculto |

---

## Bloque C — Nueva prueba E2E nativa (black-box end-to-end)

**Archivo**: `tests/e2e/phase8b_native.spec.ts`

Este test corre exclusivamente en modo tauri-driver (no en Vite dev) y valida que el binario real lee y escribe disco correctamente.

| # | Test | Setup | Acción | Assert |
|---|------|-------|--------|--------|
| 1 | Import real desde disco → DB escrita | DB vacía | importar `spanish-a2-valid.json` (50 cartas) vía UI | query Tauri `list_cards` devuelve 50 cartas |
| 2 | Grading actualiza DB de producción | card importada | grade 1 carta con grade `Good` | `state == 'learning'`, `reps == 1` en DB |
| 3 | Export escribe archivo en disco real | DB seeded | exportar sesión a `tmp/test-export.learnme` | archivo presente con checksum válido (verificado via `session_export` cmd) |
| 4 | Roundtrip DB: export → DB vacía → import | DB seeded, 10 cartas | export → reset DB → import | lista de cartas idéntica, estados FSRS preservados |
| 5 | 0 llamadas de red durante sesión | network interceptor Playwright | sesión completa de repaso | `page.on('request')` no registra requests a hosts externos |

---

## Bloque D — Calidad de producción Rust

| # | Check | Comando | Esperado |
|---|-------|---------|----------|
| 1 | Clippy sin warnings | `cargo clippy -- -D warnings` | 0 warnings / 0 errors |
| 2 | Compilación release | `cargo build --release` | éxito |
| 3 | Sin warnings del compilador | `cargo build --release 2>&1 \| grep warning` | 0 líneas |
| 4 | `#[cfg(test)]` no contamina release | revisar `simulateError` y flags de test | ausentes en binario release |

---

## Bloque E — Empaquetado nativo

| # | Check | Comando | Esperado |
|---|-------|---------|----------|
| 1 | Bundle Linux `.deb` | `npm run tauri:build` | `target/release/bundle/deb/*.deb` existe |
| 2 | Bundle Linux `.AppImage` | ídem | `target/release/bundle/appimage/*.AppImage` existe |
| 3 | Tamaño binario razonable | `ls -lh target/release/learnme` | < 50MB |
| 4 | Verificación `.deb` instalable | `dpkg -I *.deb` | metadata válida |

---

## Bloque F — Criterios globales de v0.1 (verificación final)

| # | Criterio | Método de verificación |
|---|----------|------------------------|
| 1 | Import 500+ cartas < 3s | E2E con `spanish-a2-valid.json` (extendido) + `page.waitForSelector` con timer |
| 2 | Sesión usable con solo teclado | E2E test atajos 1/2/3/4 + Espacio |
| 3 | Tema claro/oscuro alterna sin reinicio | E2E toggle + verificar `data-theme` |
| 4 | Layout responsive 375×667 | E2E viewport test |
| 5 | Export → Import 1:1 | E2E roundtrip (Bloque C #4) |
| 6 | Cero llamadas de red | E2E network interceptor (Bloque C #5) |

---

## Fixtures

Los fixtures existentes son suficientes. No se crean nuevos:

- `fixtures/decks/spanish-a2-valid.json` — import test
- `fixtures/session/valid-session.learnme` — import session test
- `fixtures/session/corrupted-checksum.learnme` — error test

Se añade:
- `fixtures/session/spanish-a2-extended.learnme` — roundtrip con 500 cartas (generado en setup E2E)

---

## Pruebas marcadas `cannot test` (inicialmente)

| Prueba | Razón |
|--------|-------|
| Verificación tcpdump real | `tcpdump` requiere root; se usa interceptor de red de Playwright como alternativa aceptable |
| Binario macOS `.dmg` | Máquina de desarrollo es Linux; se omite en esta iteración |
| Firma de binarios | Requiere certificado de distribución; fuera de alcance v0.1 local |

---

## Orden de entrega

1. Infraestructura (Bloque A) — sin tocar specs existentes
2. Compilar binario release con feature `automation`
3. Bloque C (nueva prueba nativa) — verde primero en tauri-driver config
4. Migración specs existentes (Bloque B) — uno a uno
5. Bloque D (Rust quality)
6. Bloque E (bundles)
7. Bloque F (criterios globales)
