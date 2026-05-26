# Reporte de fase 7.5 — Refinamiento UI/UX (Minimalismo Funcional) y Amortización de Deuda

## Resumen

Se entregó el sistema de diseño unificado (tokens CSS light/dark, tipografía híbrida), la Paleta de Comandos (⌘K/Ctrl+K) con filtrado case-insensitive y navegación directa, el Modo Zen (sidebar colapsa durante sesión de repaso), y los Rust helpers `study_list_all` + `simulate_import_error`. El rediseño del heatmap (CSS grid) y los botones de ReviewCard (bottom border semántico) también se entregaron. Sin pendientes funcionales; 1 test marcado `cannot test` por datos de fixture incorrectos.

## Cambios implementados

### Archivos nuevos
- `src/features/command-palette/CommandPalette.tsx` — componente overlay ⌘K: filtrado, navegación, teclado global, backdrop close
- `docs/phase-7.5/test-plan.md` — plan de pruebas (Paso 2)
- `docs/phase-7.5/report.md` — este archivo

### Archivos modificados
- `src/styles/globals.css` — tokens `--bg`, `--surface`, `--text`, `--text-muted`, `--accent`, `--border`, `--font-mono` en `:root` y `[data-theme="dark"]`; eliminado `--accent-hover`
- `src/store/appStore.ts` — añadido `commandPaletteOpen: boolean`, `openCommandPalette`, `closeCommandPalette`
- `src/api/mock-ipc.ts` — case `study_list_all`; inicialización `__MOCK_SEED_STUDY__` para E2E
- `src/shared/layout/AppLayout.tsx` — `useQuery` para `study_list_all`; Modo Zen (wrapper div ancho animado); `<CommandPalette studies={allStudies} />`
- `src/features/stats/StatsView.tsx` — heatmap reemplazado por CSS grid 52×7 celdas 12px; eliminada variable `heatmapData` (TS unused); `var(--font-mono)` en ejes del gráfico
- `src/features/methods/anki/ReviewCard.tsx` — botones grado con `borderBottom: '2px solid <color-semántico>'`, `borderRadius: 0`; botón Revelar con `--surface` + `1px solid var(--border)`
- `src-tauri/src/repo/study.rs` — `pub fn list_all(conn) -> Result<Vec<Study>, RepoError>`
- `src-tauri/src/commands/study.rs` — `#[tauri::command] pub async fn study_list_all(...)`
- `src-tauri/src/lib.rs` — registro de `study_list_all` en `invoke_handler!`
- `src-tauri/src/commands/session.rs` — `pub fn simulate_import_error(...)` sin `#[cfg(test)]` (necesario para binarios de integración)
- `src/features/studies/StudiesView.tsx` — `data-testid="study-detail"` en root div (necesario para E2E-3)
- `vite.config.ts` — añadidos `CommandPalette.tsx` y `appStore.ts` a `coverage.include`
- `tests/unit/CommandPalette.test.tsx` *(autorizado)* — eliminados imports `vi`, `act` no usados; corregido cast `as Record<string, unknown>` → `as unknown as Record<string, unknown>`
- `tests/unit/appStore.commandPalette.test.ts` *(autorizado)* — mismo fix de cast
- `src-tauri/tests/phase7_unit.rs` *(autorizado)* — eliminados imports `ImportError` no usados (2 ocurrencias) que generaban warnings

### Decisiones técnicas tomadas (no triviales)

- **`simulate_import_error` sin `#[cfg(test)]`**: los binarios de integración en `tests/` compilan la crate de biblioteca sin `cfg(test)`, por lo que un símbolo gateado con ese atributo resulta en `unresolved import`. Se expone como `pub` con doc-comment explicando que no es un comando Tauri y no se registra en `invoke_handler`. Las funciones `pub` en Rust no generan `dead_code` warning.

- **`useAppStore.getState()` en handlers del CommandPalette**: los handlers `onClick` e `onKeyDown` acceden al store directamente vía `getState()` en lugar de hooks, evitando referencias en el closure de `useEffect` y pasando el test `phase7_5-12` (Ctrl+K no cierra la paleta cuando ya está abierta).

- **Stale dev server causó fallos E2E**: `playwright.config.ts` tiene `reuseExistingServer: !process.env.CI`. Un servidor de puerto 1420 anterior (con código pre-fase-7.5) fue reutilizado en la primera ejecución de ci.sh, causando fallos espurios en tests de phase4. Se mató el proceso; segunda ejecución: 24/24 E2E verde.

## Cobertura de pruebas (suite completa)

- **Líneas**: 93.33%  (umbral: 80% ✓)
- **Ramas**: 90.9% (umbral: 75% ✓)
- **Tests totales TS**: 85
  - Pasados: 84
  - Skipped (`cannot test`): 1
  - Fallidos: **0**
- **Tests Rust**: 174 pasados, 2 ignorados (`#[ignore]` pre-existentes de fases anteriores), 0 fallidos
- **Tests E2E**: 24 pasados, 0 fallidos
- Comando ejecutado: `./scripts/ci.sh`
- Fecha y hora: 2026-05-25T22:33 UTC

## Pruebas marcadas `cannot test`

| Prueba (archivo:línea) | Razón | Acción sugerida al usuario |
|------------------------|-------|----------------------------|
| `tests/unit/CommandPalette.test.tsx:143` (`phase7_5-18`) | El fixture `MOCK_STUDIES` incluye `"English Idioms"` que no contiene la letra 'a'. El expected del test es 3, pero el resultado correcto es 2 (`"Spanish A2"`, `"Japanese N5"`). La implementación es correcta; el dato del test es incorrecto. | Cambiar el fixture o el expected: p.ej. renombrar `"English Idioms"` → `"English Grammar"` y actualizar expected a 3, o cambiar expected a 2. Requiere `autorizo modificar pruebas: tests/unit/CommandPalette.test.tsx`. |

## Riesgos detectados durante la fase

| Riesgo | Probabilidad | Impacto | Mitigación propuesta |
|--------|--------------|---------|----------------------|
| Stale dev server en CI local invalida E2E | Media | Medio | Añadir `pkill -f "vite"` al inicio de `ci.sh` o setear `CI=1` en el entorno local | 
| `simulate_import_error` expuesto como `pub` sin `cfg(test)` | Baja | Bajo | Función no registrada en IPC; doc-comment explica el contrato. Revisar en siguiente auditoría de seguridad. |
| Warning pre-existente en `phase7_integration.rs:137` (`cat_id` unused) | — | Bajo | Pertenece a `tests/` (inmutable sin autorización). Sugerir al usuario `autorizo modificar pruebas: src-tauri/tests/phase7_integration.rs` para aplicar `_cat_id`. |

## Blockers

- Ninguno. CI completado sin errores.

## Deuda técnica acumulada

- `src-tauri/tests/phase7_integration.rs:137` — warning `unused variable: cat_id`. Fuera de alcance de esta fase (tests inmutables). Trivial de corregir con autorización.
- 6 snapshots visuales (`snapshot-home-light.png`, `snapshot-home-dark.png`, `snapshot-categories-light.png`, `snapshot-study-detail-light.png`, + 2 nuevas de fase 7.5) requieren re-baseline manual (`npx playwright test --update-snapshots`) y aprobación visual humana. Las snapshots actuales corresponden al diseño pre-fase-7.5.

## Próxima fase: pre-requisitos

- [ ] Re-baseline de snapshots visuales: ejecutar `npx playwright test --update-snapshots` y revisar las diferencias visualmente antes de aprobar.
- [ ] Decidir corrección de `phase7_5-18` (ver sección "Pruebas marcadas cannot test").
- [ ] Aprobar tag de git: `phase-7.5-complete`.
