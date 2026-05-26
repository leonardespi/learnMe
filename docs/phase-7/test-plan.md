# Plan de pruebas — Fase 7: Export/Import de sesión completa (`.learnme`)

## Alcance

Cubre la serialización/deserialización del estado completo de learnMe en un archivo JSON con extensión `.learnme`, incluyendo checksum SHA-256, resolución de conflictos en import-merge, modo replace, validación de integridad referencial y UI en Settings.

**NO cubre**: sincronización en tiempo real, migración de versiones `> 1` (solo se rechaza), mobile, ni métodos distintos de Anki.

**Nota técnica de mapeo**: El struct `ReviewLog` en DB almacena `prev_stability`, `prev_difficulty`, `prev_due` (valores pre-review). El formato `.learnme` (PRD §2.5.2) define campos `stability`, `difficulty`, `elapsedDays`, `scheduledDays`, `reviewState`. Se exportarán los campos de DB disponibles; `elapsedDays` y `scheduledDays` se computarán en export desde `due`/`lastReviewed`. En import, solo se restauran los campos presentes en DB — los campos extras del spec se ignoran sin error. Esta decisión se documenta en `report.md`.

---

## Unit tests — Rust

### `session::checksum::compute`

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 1 | Envelope `{version:1, generatedAt:"2026-01-01T00:00:00Z", appVersion:"0.1.0", data:{categories:[], studies:[], cards:[], reviewLogs:[]}}` | `Ok(String)` de 64 chars hex | happy path |
| 2 | Mismo envelope dos veces | mismo hash (determinismo) | determinismo |
| 3 | Envelope con claves en orden distinto al canónico (appVersion, data, generatedAt, version) | mismo hash que orden canónico | canonicidad |
| 4 | Envelope con campo extra `"extra":"x"` | hash distinto al envelope sin campo extra | sensibilidad |

### `session::export::build_learnme`

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 5 | DB con 1 categoría, 1 estudio, 2 cartas, 0 reviewLogs | `Ok(LearnmeFile)` con `version==1`, `data.categories.len()==1`, `data.cards.len()==2` | happy path |
| 6 | DB vacía | `Ok(LearnmeFile)` con todos los arrays vacíos, checksum válido | edge — DB vacía |
| 7 | Resultado de export → `verify_checksum` sobre él | `Ok(())` | checksum autoconsistente |

### `session::import::verify_checksum`

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 8 | `LearnmeFile` válido con checksum correcto | `Ok(())` | happy path |
| 9 | `LearnmeFile` con `checksum` alterado en 1 char | `Err(ImportError::ChecksumMismatch)` | error path |
| 10 | `LearnmeFile` con `checksum: ""` | `Err(ImportError::ChecksumMismatch)` | error path |

### `session::import::validate_version`

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 11 | `version: 1` | `Ok(())` | happy path |
| 12 | `version: 0` | `Ok(())` (backward compat ≤ 1) | backward compat |
| 13 | `version: 2` | `Err(ImportError::UnsupportedVersion { found: 2, max: 1 })` | future version |
| 14 | `version: 99` | `Err(ImportError::UnsupportedVersion { found: 99, max: 1 })` | future version |

### `session::import::validate_fk_integrity`

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 15 | `data` con card cuyo `studyId` no existe en `data.studies` | `Err(ImportError::OrphanEntity { entity: "card", id: "<id>", missing_ref: "<studyId>" })` | FK rota |
| 16 | `data` con reviewLog cuyo `cardId` no existe en `data.cards` | `Err(ImportError::OrphanEntity { entity: "reviewLog", id: "<id>", missing_ref: "<cardId>" })` | FK rota |
| 17 | `data` con study cuyo `categoryId` no existe en `data.categories` | `Err(ImportError::OrphanEntity { entity: "study", id: "<id>", missing_ref: "<categoryId>" })` | FK rota |
| 18 | `data` perfectamente referenciado | `Ok(())` | happy path |

### `session::import::resolve_conflict`

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 19 | `existing: Card {reps:5, lastReviewed:"2026-01-10"}`, `incoming: Card {reps:3, lastReviewed:"2026-01-08"}` mismo `front`+`back` | retorna `existing` (más avanzado) | merge — existing gana |
| 20 | `existing: Card {reps:2, lastReviewed:"2026-01-05"}`, `incoming: Card {reps:4, lastReviewed:"2026-01-09"}` mismo `front`+`back` | retorna `incoming` (más avanzado) | merge — incoming gana |
| 21 | `existing: Card {reps:3, lastReviewed:null}`, `incoming: Card {reps:3, lastReviewed:"2026-01-09"}` | retorna `incoming` (mismos reps, incoming tiene fecha) | merge — tiebreak por fecha |

---

## Unit tests — TypeScript

### `schemas/learnme.ts` — `LearnmeFileSchema` (Zod)

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 22 | `fixtures/session/valid-session.learnme` parseado como JSON | `LearnmeFileSchema.safeParse(data).success === true` | happy path |
| 23 | Objeto sin campo `checksum` | `success === false`, error en path `["checksum"]` | validación |
| 24 | `version: "1"` (string en vez de number) | `success === false` | tipo incorrecto |
| 25 | `data.cards[0]` sin campo `studyId` | `success === false`, error en path `["data","cards",0,"studyId"]` | campo FK requerido |
| 26 | `data.cards[0].state: "archived"` (no en enum) | `success === false` | enum inválido |

### `features/settings/SettingsView.tsx` — render

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 27 | Render sin props | botón con `data-testid="btn-export-session"` visible | render |
| 28 | Render sin props | botón con `data-testid="btn-import-session"` visible | render |
| 29 | Estado `exportStatus: 'success'` | elemento con `data-testid="export-status"` contiene texto `"Exportado"` | feedback |
| 30 | Estado `exportStatus: 'error'` | elemento con `data-testid="export-status"` contiene texto `"Error"` | feedback |

---

## Integration tests — Rust

### Escenario 1: Roundtrip export → import en DB vacía

- **Setup**: DB con 2 categorías, 3 estudios, 50 cartas (mixed FSRS states), 120 reviewLogs. Fixture: `fixtures/session/seeded-for-export.json` (instrucciones de seed, no el .learnme)
- **Acción**: `session_export` → string JSON → `session_import(mode=merge)` en DB vacía nueva
- **Assert**: counts iguales (2 categorías, 3 estudios, 50 cartas, 120 reviewLogs); para muestra de 5 cartas, todos los campos FSRS (`stability`, `difficulty`, `due`, `state`, `reps`, `lapses`) idénticos

### Escenario 2: Export determinista

- **Setup**: DB seeded (igual que escenario 1)
- **Acción**: `session_export` dos veces consecutivas sin cambios en DB
- **Assert**: ambos `checksum` son idénticos; `data` serializado idéntico (excepto `generatedAt`)

### Escenario 3: Import merge — UUID idempotencia

- **Setup**: DB destino ya tiene categoría `id="cat-001"`, `name="Idiomas"`. Import archivo con misma categoría `id="cat-001"`, `name="Idiomas"`
- **Acción**: `session_import(mode=merge)`
- **Assert**: `category_list` devuelve exactamente 1 categoría con `name="Idiomas"` (no duplica)

### Escenario 4: Import merge — mismo UUID distinto nombre

- **Setup**: DB destino tiene categoría `id="cat-001"`, `name="Idiomas"`. Import tiene `id="cat-001"`, `name="Languages"`
- **Acción**: `session_import(mode=merge)`
- **Assert**: DB conserva `name="Idiomas"` (local prevalece)

### Escenario 5: Import merge — conflicto de cartas (semántico)

- **Setup**: DB tiene carta `{front:"casa", back:"house", reps:5, lastReviewed:"2026-01-10T00:00:00Z", stability:15.0}`. Archivo tiene misma carta `{front:"casa", back:"house", reps:2, lastReviewed:"2026-01-05T00:00:00Z", stability:5.0}`
- **Acción**: `session_import(mode=merge)`
- **Assert**: carta en DB conserva `reps:5`, `stability:15.0` (existing más avanzado)

### Escenario 6: Checksum corrupto — DB no modificada

- **Setup**: DB con 1 categoría. Import `fixtures/session/corrupted-checksum.learnme`
- **Acción**: `session_import(mode=merge)`
- **Assert**: `Err(ImportError::ChecksumMismatch)`; `category_list` sigue devolviendo solo 1 categoría (rollback)

### Escenario 7: UnsupportedVersion

- **Setup**: import `fixtures/session/unsupported-version.learnme` (`version: 2`)
- **Acción**: `session_import(mode=merge)`
- **Assert**: `Err(ImportError::UnsupportedVersion { found: 2, max: 1 })`; DB sin cambios

### Escenario 8: OrphanEntity — carta sin estudio

- **Setup**: import `fixtures/session/orphan-card.learnme` (carta con `studyId` que no existe en `data.studies`)
- **Acción**: `session_import(mode=merge)`
- **Assert**: `Err(ImportError::OrphanEntity { entity: "card", ... })`; rollback total (0 categorías insertadas aunque el file tenga categorías válidas)

### Escenario 9: OrphanEntity — reviewLog sin carta

- **Setup**: import `fixtures/session/orphan-reviewlog.learnme`
- **Acción**: `session_import(mode=merge)`
- **Assert**: `Err(ImportError::OrphanEntity { entity: "reviewLog", ... })`; rollback total

### Escenario 10: Import modo `replace`

- **Setup**: DB con 3 categorías propias. Import `fixtures/session/valid-session.learnme` (1 categoría, 2 cartas)
- **Acción**: `session_import(mode=replace)`
- **Assert**: `category_list` devuelve exactamente 1 categoría (las 3 originales eliminadas); `card_list` devuelve 2 cartas

### Escenario 11: Roundtrip grande (performance)

- **Setup**: DB con 500 cartas, 2000 reviewLogs (generadas vía helper de test)
- **Acción**: `session_export` → `session_import(mode=merge)` en DB vacía; medir duración
- **Assert**: counts idénticos; duración total < 10s en CI; snapshot `insta` de los primeros 5 cards ordenados por id

---

## E2E tests

### Escenario E2E-1: Exportar sesión desde Settings

- **Viewport(s)**: desktop (1280×800)
- **Pasos**:
  1. Abrir app
  2. Navegar a Settings (botón `data-testid="btn-settings"` en Sidebar/BottomTabs)
  3. Click `data-testid="btn-export-session"`
  4. Interceptar diálogo de archivo (Playwright mock de `dialog::save`)
  5. Verificar que se llama el comando Tauri `session_export` (via mock-ipc)
  6. `data-testid="export-status"` muestra feedback de éxito
- **Assert**: `export-status` contiene "Exportado" o equivalente en < 3s

### Escenario E2E-2: Importar sesión desde Settings

- **Viewport(s)**: desktop (1280×800)
- **Pasos**:
  1. Abrir app
  2. Navegar a Settings
  3. Click `data-testid="btn-import-session"`
  4. Interceptar diálogo de archivo (Playwright mock con `fixtures/session/valid-session.learnme`)
  5. Verificar llamada a `session_import` en mock-ipc
  6. `data-testid="import-status"` muestra feedback de éxito
- **Assert**: `import-status` contiene "Importado" o equivalente

### Escenario E2E-3: Import con checksum corrupto — feedback de error

- **Viewport(s)**: desktop (1280×800)
- **Pasos**:
  1. Navegar a Settings
  2. Importar `fixtures/session/corrupted-checksum.learnme` via mock-ipc que simula `Err(ChecksumMismatch)`
  3. `data-testid="import-status"` muestra feedback de error
- **Assert**: `import-status` contiene "Error" o "checksum"

---

## Fixtures requeridas

- `fixtures/session/valid-session.learnme` — archivo `.learnme` mínimo válido (1 categoría, 1 estudio, 2 cartas `state:new`, 0 reviewLogs, checksum correcto, `version:1`, `appVersion:"0.1.0"`)
- `fixtures/session/corrupted-checksum.learnme` — estructura válida pero `checksum` alterado (último char cambiado)
- `fixtures/session/unsupported-version.learnme` — `version: 2`, checksum válido para ese contenido
- `fixtures/session/orphan-card.learnme` — 1 categoría, 1 estudio, 1 carta cuyo `studyId` apunta a id inexistente, checksum válido
- `fixtures/session/orphan-reviewlog.learnme` — 1 categoría, 1 estudio, 1 carta, 1 reviewLog cuyo `cardId` apunta a id inexistente, checksum válido
- `fixtures/session/merge-conflict.learnme` — carta `{front:"casa", back:"house", reps:2, lastReviewed:"2026-01-05T00:00:00Z", stability:5.0}` para probar conflicto con DB

---

## Snapshots

- `src-tauri/src/session/snapshots/roundtrip_large__first5.snap` — primeros 5 cards (por id) del roundtrip grande (test #11), capturado con `insta`

---

## Pruebas marcadas `cannot test` (al iniciar la fase)

- ninguna

---

## Consideraciones de diseño para la fase

1. **Nuevo módulo `session`** en `src-tauri/src/session/mod.rs` con submódulos `export`, `import`, `checksum`.
2. **Nuevos comandos Tauri**: `session_export(dest_path: String)` y `session_import(src_path: String, mode: String)` donde `mode` es `"merge"` o `"replace"`.
3. **Nuevo schema TS**: `src/schemas/learnme.ts` con `LearnmeFileSchema` Zod.
4. **Nuevo componente**: `src/features/settings/SettingsView.tsx` + `SettingsPage.tsx` con TanStack Query.
5. **Navegación**: añadir vista `settings` al `appStore.ts` + routing en `AppLayout.tsx`.
6. **Mock-ipc**: casos `session_export` y `session_import` (retornan dato desde fixture para E2E).

---

## Criterios de salida de esta fase

- [ ] 21 tests unitarios Rust pasan (tests #1–#21)
- [ ] 5 tests unitarios TS pasan (tests #22–#26) [schema Zod]
- [ ] 4 tests unitarios TS pasan (tests #27–#30) [SettingsView render]
- [ ] 11 tests de integración Rust pasan (escenarios 1–11)
- [ ] 3 tests E2E pasan (E2E-1, E2E-2, E2E-3)
- [ ] Cobertura ≥ 80% líneas / 75% ramas en `src-tauri/src/session/**` y `src/features/settings/**`
- [ ] Suite completa (`./scripts/ci.sh`) verde
