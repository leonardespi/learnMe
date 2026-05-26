# Plan de pruebas — Fase 8.A.1: Endpoints Rust CRUD + Markdown + UI CRUD Controls

## Alcance

Cierra los tres bloques pendientes de la Fase 8.A no cubiertos por 8.A.2:

1. **Rust**: implementar `repo::card::update` + `commands::card::cmd_card_update` + tauri command `card_update`. Añadir tests unitarios a comandos existentes sin cobertura (`cmd_card_delete`, `cmd_study_delete`, `cmd_study_update`). Cobertura >85% líneas en `src-tauri/src/repo/**` y `src-tauri/src/commands/**`.
2. **Frontend — Markdown**: integrar `react-markdown` en `ReviewCard` para renderizar `front` y `back` con soporte de bold, italic, listas, inline code. Sin LaTeX ni imágenes (fuera de alcance v0.1).
3. **Frontend — CRUD UI**: controles de edición y borrado en `CategoriesView` (renombrar/borrar categoría), `StudiesView`/`CategoryStudiesView` (renombrar/borrar deck), `StudyDetail` (editar/borrar carta con panel in-situ).

Esta fase NO cubre: tauri-driver E2E (8.B), distribución, dark-mode state-badge hardcoded (deuda anotada en 8.A.2).

---

## Unit tests — Rust

### `repo::card::update`

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 1 | id existente, `front="casa"`, `back="house"`, `tags=["noun"]` | `Ok(Card)` con campos actualizados | happy path |
| 2 | id inexistente | `Err(RepoError::NotFound)` | error path |
| 3 | id existente, `front=""` | `Err(RepoError::Validation(EmptyFront))` | validación |
| 4 | id existente, `back=""` | `Err(RepoError::Validation(EmptyBack))` | validación |
| 5 | id existente, `front="  "` (whitespace) | `Err(RepoError::Validation(EmptyFront))` | validación |
| 6 | id existente, `back="  "` (whitespace) | `Err(RepoError::Validation(EmptyBack))` | validación |
| 7 | id existente, tags actualizados de `["a"]` a `["b","c"]` | `Ok(Card { tags: ["b","c"] })` | happy path |

### `commands::card::cmd_card_update`

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 1 | id existente, front/back válidos | `Ok(Card)` serializable a JSON | happy path |
| 2 | id inexistente | `Err` con mensaje no vacío | error path |
| 3 | front vacío | `Err` con mensaje no vacío | validación |

### `commands::card::cmd_card_delete` (tests faltantes)

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 1 | carta existente sin review_logs | `Ok(())`, `SELECT COUNT(*) FROM cards WHERE id=?` == 0 | happy path |
| 2 | carta existente con 3 review_logs | `Ok(())`, review_logs también eliminados | cascade |
| 3 | id inexistente | `Err` con mensaje no vacío | error path |

### `commands::study::cmd_study_delete` (tests faltantes)

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 1 | study con 5 cartas y 10 review_logs | `Ok(())`, cartas eliminadas, logs eliminados, categoría intacta | cascade |
| 2 | study inexistente | `Err` con mensaje no vacío | error path |
| 3 | study sin cartas | `Ok(())` | happy path |

### `commands::study::cmd_study_update` (tests faltantes)

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 1 | id existente, `name="Nuevo nombre"` | `Ok(Study { name: "Nuevo nombre" })` | happy path |
| 2 | id inexistente | `Err` con mensaje no vacío | error path |
| 3 | `name=""` | `Err` con mensaje no vacío | validación |

---

## Unit tests — TypeScript (Vitest)

### `ReviewCard` — renderizado Markdown

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 1 | `card.front = "**negrita**"`, `phase="front"` | DOM contiene `<strong>negrita</strong>` | markdown bold |
| 2 | `card.back = "*cursiva*"`, `phase="back"` | DOM contiene `<em>cursiva</em>` | markdown italic |
| 3 | `card.front = "\`código\`"` | DOM contiene `<code>código</code>` | inline code |
| 4 | `card.front = "texto plano"` | texto plano renderizado sin etiquetas extra | plain text |
| 5 | `card.front = "- item1\n- item2"` | DOM contiene `<li>item1</li>` y `<li>item2</li>` | lista |

### `CategoriesView` — CRUD controls

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 1 | 1 categoría en lista | `data-testid="btn-rename-category"` visible (o activa en hover) | render |
| 2 | click `btn-rename-category` | input inline con valor actual visible | rename flow |
| 3 | submit rename con nuevo nombre | mock `invoke('category_update', {...})` llamado | mutación |
| 4 | click `btn-delete-category` | mock `invoke('category_delete', {...})` llamado | delete |
| 5 | `categories=[]` | `data-testid="category-empty-state"` visible (regresión) | empty state |

### `StudyDetail` — editar carta in-situ

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 1 | 1 carta en lista | `data-testid="btn-edit-card"` visible por carta | render |
| 2 | click `btn-edit-card` | panel inline con inputs front/back pre-cargados | edit panel |
| 3 | modificar front y guardar | mock `invoke('card_update', {...})` llamado con nuevo front | mutación |
| 4 | click `btn-delete-card` | mock `invoke('card_delete', { id })` llamado | delete |
| 5 | cards=[] → `data-testid="card-empty-state"` visible (regresión) | no regresión | regresión |

### `StudiesView` — CRUD deck (CategoryStudiesView)

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 1 | 1 study en lista | `data-testid="btn-delete-deck"` visible por deck | render |
| 2 | click `btn-delete-deck` | mock `invoke('study_delete', { id })` llamado | delete |
| 3 | click `btn-rename-deck` | input inline con nombre actual | rename flow |
| 4 | submit rename | mock `invoke('study_update', { id, name })` llamado | mutación |

---

## Integration tests — Rust

### Escenario: cascade delete de study purga cartas y logs

- **Setup**: categoría → study → 3 cartas → 2 review_logs por carta (total 6 logs)
- **Acción**: `cmd_study_delete(conn, study_id)`
- **Assert**: `SELECT COUNT(*) FROM cards WHERE deck_id = study_id` == 0; `SELECT COUNT(*) FROM review_logs WHERE card_id IN (...)` == 0; `SELECT COUNT(*) FROM categories` == 1 (categoría intacta)

### Escenario: cascade delete de card purga sus logs

- **Setup**: study → 1 carta → 3 review_logs
- **Acción**: `cmd_card_delete(conn, card_id)`
- **Assert**: `SELECT COUNT(*) FROM cards WHERE id = card_id` == 0; `SELECT COUNT(*) FROM review_logs` == 0; study intacto

### Escenario: category_delete con studies falla (FK enforcement)

- **Setup**: categoría → 1 study
- **Acción**: `cmd_category_delete(conn, category_id)` (directo sin borrar study antes)
- **Assert**: `Err(...)` y categoría permanece en DB

---

## E2E tests

No aplica en esta fase. E2E nativo con tauri-driver se aborda en 8.B.

---

## Fixtures requeridas

- Ninguna nueva. Tests Rust usan `new_test_db()` (in-memory). Tests TS usan mocks de `@tauri-apps/api/core`.

---

## Snapshots

No se introducen snapshots visuales (pertenecen a 8.B).

---

## Pruebas marcadas `cannot test` (al iniciar la fase)

- ninguna prevista

---

## Criterios de salida de esta fase

- [ ] `cargo test` → 0 failing, 0 ignored (salvo pre-existentes marcados con `#[ignore]`)
- [ ] Cobertura Rust ≥85% líneas en `src-tauri/src/repo/**` y `src-tauri/src/commands/**`
- [ ] `npm run test` → 0 failing, regresión completa (≥85 tests)
- [ ] `npm run typecheck` → 0 errores TypeScript strict
- [ ] `npm run lint` → 0 warnings ESLint
- [ ] `react-markdown` en `package.json` dependencies
- [ ] `card_update` tauri command registrado en `lib.rs`
- [ ] Suite completa (`./scripts/ci.sh`) verde
