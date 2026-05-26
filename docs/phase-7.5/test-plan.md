# Plan de pruebas — Fase 7.5: Refinamiento UI/UX (Minimalismo Funcional) y Amortización de Deuda

## Alcance

Cubre tres entregables paralelos: (1) actualización de tokens CSS al sistema de Minimalismo Funcional + tipografía híbrida, (2) nueva Paleta de Comandos global (⌘K / Ctrl+K) con ciclo de vida completo en frontend, y (3) aislamiento de la trampa de test `simulateError` bajo `#[cfg(test)]` en Rust + limpieza de imports huérfanos en `phase7_unit.rs`. No cubre lógica FSRS, persistencia, export/import, ni nuevas rutas de navegación fuera de la paleta.

Los 6 snapshots visuales existentes (4 de Fase 4 + 2 de Fase 6) se pondrán en **rojo** como efecto directo del cambio de tokens. Su re-baselining requiere aprobación humana explícita — no es un fallo del agente sino el criterio de salida estético.

---

## Unit tests — TypeScript (Vitest)

### `appStore` — extensión para paleta de comandos

| # | Input / Acción | Output esperado | Tipo |
|---|----------------|-----------------|------|
| 1 | Leer estado inicial del store recién creado | `commandPaletteOpen === false` | happy path |
| 2 | Llamar `openCommandPalette()` desde estado `commandPaletteOpen=false` | `commandPaletteOpen === true` | happy path |
| 3 | Llamar `closeCommandPalette()` desde estado `commandPaletteOpen=true` | `commandPaletteOpen === false` | happy path |
| 4 | Llamar `openCommandPalette()` dos veces seguidas | `commandPaletteOpen === true` (idempotente) | edge case |
| 5 | Llamar `closeCommandPalette()` desde estado ya `false` | `commandPaletteOpen === false` (no lanza error) | edge case |

### `CommandPalette` — rendering condicional

| # | Input / Estado del store | Output esperado | Tipo |
|---|--------------------------|-----------------|------|
| 6 | `commandPaletteOpen=false` | `data-testid="command-palette"` ausente del DOM (o `aria-hidden=true`) | happy path |
| 7 | `commandPaletteOpen=true` | `data-testid="command-palette"` visible en el DOM | happy path |
| 8 | `commandPaletteOpen=true` → render | `data-testid="command-palette-input"` es `document.activeElement` | happy path |

### `CommandPalette` — captura de teclado global

| # | Input / Evento | Output esperado | Tipo |
|---|----------------|-----------------|------|
| 9 | `keydown { ctrlKey: true, key: 'k' }` sobre `document`, paleta cerrada | `commandPaletteOpen` pasa a `true` | happy path |
| 10 | `keydown { metaKey: true, key: 'k' }` sobre `document`, paleta cerrada | `commandPaletteOpen` pasa a `true` (soporte ⌘K macOS) | happy path |
| 11 | `keydown { key: 'Escape' }` sobre `document`, paleta abierta | `commandPaletteOpen` pasa a `false` | happy path |
| 12 | `keydown { ctrlKey: true, key: 'k' }` con paleta ya abierta | `commandPaletteOpen` permanece `true` (no cierra) | edge case |
| 13 | `keydown { key: 'k' }` sin Ctrl/Meta, paleta cerrada | `commandPaletteOpen` permanece `false` (no abre con tecla sola) | error path |

### `CommandPalette` — filtrado tipográfico de ítems

Los tests usan un listado de 3 estudios inyectado vía props o mock: `"Spanish A2"`, `"Japanese N5"`, `"English Idioms"`.

| # | Input (valor del input de búsqueda) | Output esperado | Tipo |
|---|--------------------------------------|-----------------|------|
| 14 | `""` (vacío) | Los 3 ítems renderizados con `data-testid="palette-item"` | happy path |
| 15 | `"span"` | 1 ítem: `"Spanish A2"`. Los otros 2 ausentes del DOM | happy path |
| 16 | `"JAPANESE"` (mayúsculas) | 1 ítem: `"Japanese N5"` (búsqueda case-insensitive) | happy path |
| 17 | `"zzz"` (sin coincidencias) | 0 ítems con `data-testid="palette-item"`. Estado vacío visible: `data-testid="palette-empty"` | error path |
| 18 | `"a"` (letra presente en los 3 nombres) | 3 ítems renderizados (`Spanish A2`, `Japanese N5`, `English Idioms` todos contienen "a") | edge case |

### `CommandPalette` — navegación y cierre

| # | Input / Acción | Output esperado | Tipo |
|---|----------------|-----------------|------|
| 19 | Click en ítem `"Spanish A2"` (studyId=`"study-1"`, categoryId=`"cat-1"`) | `navigateToStudyDetail("study-1", "cat-1")` llamado; `commandPaletteOpen` pasa a `false` | happy path |
| 20 | Click en overlay exterior al modal (fuera del panel de búsqueda) | `commandPaletteOpen` pasa a `false` sin llamar navigate | happy path |

---

## Unit tests — Rust (`cargo test`)

### `commands::session::session_import_cmd` — aislamiento de `simulateError`

> Contexto: la trampa de test `simulateError` sólo existe en el mock TS (`mock-ipc.ts`). El comando Rust actual **no** tiene este parámetro. El entregable de Fase 7.5 es confirmar (y blindar con compilación condicional) que el binario de producción nunca lo exponga.

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 21 | `#[cfg(test)]` unit: llamar la variante de test de `session_import_cmd` con `simulate_error: Some("ChecksumMismatch")`, DB vacía, `src_path` a fixture válida | `Err("ChecksumMismatch")` sin tocar la DB | happy path (rama test) |
| 22 | `#[cfg(test)]` unit: llamar la variante de test de `session_import_cmd` con `simulate_error: None`, fixture `valid-session.learnme` | `Ok(())` y 1 categoría en DB | happy path (rama test) |

> **Nota de implementación**: la variante de test puede ser una función Rust separada (`session_import_cmd_test`) llamada desde `#[cfg(test)]`, o un parámetro `Option<String>` compilado condicionalmente. El agente elige la estrategia; el contrato del test es el descrito.

### `phase7_unit.rs` — limpieza de warnings de imports huérfanos

| # | Acción | Output esperado | Tipo |
|---|--------|-----------------|------|
| 23 | `cargo test --test phase7_unit 2>&1` tras eliminar imports no usados (`ImportMode`, `LearnmeFile`) | Salida estándar de error sin líneas `warning: unused import` | happy path |

---

## Integration tests

### Escenario A: Tokens CSS aplicados correctamente (light mode)

- **Setup**: App renderizada en modo `data-theme="light"` vía Playwright.
- **Acción**: `page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim())`.
- **Assert**: valor === `"#FAFAF9"`. Repetir para `--surface` (`#F5F5F4`), `--accent` (`#EA580C`), `--border` (`#E6E6E5`).

### Escenario B: Tokens CSS aplicados correctamente (dark mode)

- **Setup**: App renderizada, toggle a `data-theme="dark"`.
- **Acción**: misma lectura de variables CSS.
- **Assert**: `--bg === "#0B0B0D"`, `--surface === "#141416"`, `--accent === "#8B5CF6"`, `--border === "#222225"`.

### Escenario C: Variable `--accent-hover` eliminada

- **Setup**: App en cualquier tema.
- **Acción**: `getComputedStyle(document.documentElement).getPropertyValue('--accent-hover')`.
- **Assert**: valor vacío (`""`). No existe en el nuevo sistema.

---

## E2E tests (Playwright contra `npm run dev`)

### Escenario E2E-1: Abrir y cerrar paleta con teclado

- **Viewport**: desktop (1280×800).
- **Pasos**:
  1. `page.goto('/')`.
  2. `page.keyboard.press('Control+k')`.
  3. `await expect(page.getByTestId('command-palette')).toBeVisible()`.
  4. `page.keyboard.press('Escape')`.
  5. `await expect(page.getByTestId('command-palette')).not.toBeVisible()`.
- **Assert**: paleta aparece y desaparece correctamente.

### Escenario E2E-2: Filtrado en tiempo real

- **Setup**: al menos un estudio creado previamente vía mock-ipc (usar `page.addInitScript` para seed).
- **Pasos**:
  1. Abrir paleta con `Control+k`.
  2. `page.getByTestId('command-palette-input').fill('zzz')`.
  3. `await expect(page.getByTestId('palette-empty')).toBeVisible()`.
- **Assert**: estado vacío visible cuando no hay coincidencias.

### Escenario E2E-3: Navegación desde paleta

- **Setup**: estudio "Spanish A2" en mock-ipc state.
- **Pasos**:
  1. Abrir paleta.
  2. Escribir `"Spanish"`.
  3. Click en el ítem `"Spanish A2"` (`data-testid="palette-item"`).
  4. `await expect(page.getByTestId('study-detail')).toBeVisible()`.
  5. `await expect(page.getByTestId('command-palette')).not.toBeVisible()`.
- **Assert**: navegación correcta y paleta cerrada.

### Escenario E2E-4: Cierre por click fuera del panel

- **Pasos**:
  1. Abrir paleta.
  2. Click en las coordenadas `(10, 10)` (esquina superior izquierda, fuera del panel).
  3. `await expect(page.getByTestId('command-palette')).not.toBeVisible()`.
- **Assert**: overlay actúa como backdrop de cierre.

### Escenario E2E-5 a E2E-10: Re-baselining de snapshots visuales

Los siguientes snapshots quedarán en **rojo** tras la actualización de tokens. Se ejecutan como parte de la suite existente (`phase4_categories.spec.ts` y `phase6_stats.spec.ts`) y fallarán con `toMatchSnapshot()`. El criterio de salida requiere **aprobación humana** y regeneración con `npx playwright test --update-snapshots`:

| # | Snapshot existente | Causa del rojo |
|---|--------------------|----------------|
| E2E-5 | `phase4_categories.spec.ts-snapshots/snapshot-home-light-linux.png` | `--bg`, `--surface`, `--accent` cambiados |
| E2E-6 | `phase4_categories.spec.ts-snapshots/snapshot-home-dark-linux.png` | `--bg`, `--surface`, `--accent` cambiados |
| E2E-7 | `phase4_categories.spec.ts-snapshots/snapshot-categories-light-linux.png` | `--bg`, `--border`, `--surface` cambiados |
| E2E-8 | `phase4_categories.spec.ts-snapshots/snapshot-study-detail-light-linux.png` | tokens + tipografía |
| E2E-9 | `tests/e2e/snapshots/phase6-stats-light.png` | tokens + remoción de `CartesianGrid` |
| E2E-10 | `tests/e2e/snapshots/phase6-stats-dark.png` | tokens + remoción de `CartesianGrid` |

---

## Fixtures requeridas

No se requieren fixtures nuevas. Las existentes son suficientes:
- `fixtures/session/valid-session.learnme` — ya existe, usada en E2E-3.
- `fixtures/session/corrupted-checksum.learnme` — ya existe, no usada en nuevas pruebas (la cobertura de import error sigue en fase 7).

---

## Pruebas marcadas `cannot test` (al iniciar la fase)

- ninguna

---

## Criterios de salida de esta fase

- [ ] 23 tests unitarios nuevos (TS: 20 + Rust: 3) pasan en verde.
- [ ] 188 tests heredados (sin los 6 snapshots de re-baselining) siguen en verde.
- [ ] 4 tests E2E nuevos (E2E-1 a E2E-4) pasan en verde.
- [ ] 6 snapshots visuales (E2E-5 a E2E-10) regenerados y aprobados por el usuario.
- [ ] `cargo test --test phase7_unit 2>&1 | grep "warning: unused import"` → sin resultados.
- [ ] `cargo build --release` exitoso (binario sin `simulateError` en firma pública del comando).
- [ ] Cobertura ≥ 80% líneas / 75% ramas en código nuevo: `src/features/command-palette/**`, extensión de `src/store/appStore.ts`.
- [ ] Suite completa (`./scripts/ci.sh`) verde con exit 0 (excluye los 6 snapshots hasta aprobación humana).
