# Plan de pruebas — Fase 1: Persistencia y schema

## Alcance

Cubre: migraciones SQLite, repositorios Rust (`Category`, `Study`, `Card`, `ReviewLog`, `Settings`), **handlers de comandos Tauri** (`category_create`, `category_list`, `study_create`, `study_list_by_category`, `card_bulk_insert`, `card_list_by_deck`), y tipos de dominio TypeScript.

No cubre: lógica FSRS (Fase 2), import/export de decks (Fase 3), UI e `invoke` desde el frontend (Fase 4).

**Diseño de testabilidad de comandos**: los handlers Tauri serán funciones internas (`cmd_*`) que aceptan `&Connection` directamente. El wrapper `#[tauri::command]` es una capa delgada que extrae la conexión de `tauri::State` y delega. Los tests llaman a `cmd_*` directamente — sin runtime Tauri, sin mock de State.

**Comportamiento FK definido**: `PRAGMA foreign_keys = ON` activado en toda conexión. Delete de entidad padre con hijos vinculados → `Err(RepoError::ForeignKeyViolation)`. No hay cascada automática en esta fase.

---

## Unit tests — Rust

### `migration::apply`

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 1 | DB en memoria, aplicar migraciones 1 vez | `Ok(())`, tablas `categories`, `studies`, `cards`, `review_logs`, `settings` existen | happy path |
| 2 | DB en memoria, aplicar migraciones 2 veces seguidas | `Ok(())` en ambas, schema idéntico tras segunda aplicación | idempotencia |

### `category_repo::create`

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 3 | `CreateCategory { name: "Idiomas" }` | `Ok(Category)` donde `category.name == "Idiomas"` y `category.id` es UUIDv7 válido | happy path |
| 4 | `CreateCategory { name: "" }` | `Err(RepoError::Validation(ValidationError::EmptyName))` | error path |
| 5 | `CreateCategory { name: "   " }` (solo espacios) | `Err(RepoError::Validation(ValidationError::EmptyName))` | error path |

### `category_repo::list`

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 6 | DB vacía | `Ok(vec![])` | edge case |
| 7 | DB con 3 categorías insertadas en orden A→B→C | `Ok(vec)` donde `vec.len() == 3` y orden es C→B→A (`created_at DESC`) | happy path |

### `category_repo::get_by_id`

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 8 | `id` de categoría existente | `Ok(Category)` con campos correctos | happy path |
| 9 | `id` UUIDv7 que no existe | `Err(RepoError::NotFound)` | error path |

### `category_repo::update`

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 10 | `id` existente, `UpdateCategory { name: "Languages" }` | `Ok(Category)` donde `name == "Languages"` y `updated_at > created_at` | happy path |
| 11 | `id` inexistente, `UpdateCategory { name: "X" }` | `Err(RepoError::NotFound)` | error path |
| 12 | `id` existente, `UpdateCategory { name: "" }` | `Err(RepoError::Validation(ValidationError::EmptyName))` | error path |

### `category_repo::delete`

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 13 | `id` existente sin estudios vinculados | `Ok(())` y `category_repo::get_by_id` posterior devuelve `Err(NotFound)` | happy path |
| 14 | `id` inexistente | `Err(RepoError::NotFound)` | error path |
| 15 | `id` de categoría que tiene 1 estudio vinculado | `Err(RepoError::ForeignKeyViolation)` y categoría permanece en DB | FK RESTRICT |

### `study_repo::create`

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 16 | `CreateStudy { category_id: <existente>, method: "anki", name: "Spanish A2", payload: {} }` | `Ok(Study)` con `study.name == "Spanish A2"` y `study.method == "anki"` | happy path |
| 17 | `CreateStudy { category_id: <UUID inexistente>, method: "anki", name: "X", payload: {} }` | `Err(RepoError::ForeignKeyViolation)` | error path |
| 18 | `CreateStudy { category_id: <existente>, method: "anki", name: "", payload: {} }` | `Err(RepoError::Validation(ValidationError::EmptyName))` | error path |

### `study_repo::list_by_category`

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 19 | `category_id` con 2 estudios | `Ok(vec)` donde `vec.len() == 2` | happy path |
| 20 | `category_id` con 0 estudios (categoría existe) | `Ok(vec![])` | edge case |

### `card_repo::bulk_insert`

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 21 | 100 cartas válidas para `deck_id` existente | `Ok(100)` y `card_repo::list_by_deck` posterior devuelve vec de 100 | happy path |
| 22 | 0 cartas | `Ok(0)` | edge case |
| 23 | Vec con 1 carta donde `front == ""` | `Err(RepoError::Validation(ValidationError::EmptyFront))` y 0 cartas insertadas (rollback) | error path |
| 24 | Vec con 1 carta donde `front == "   "` (solo espacios) | `Err(RepoError::Validation(ValidationError::EmptyFront))` y 0 cartas insertadas | error path |
| 25 | Vec con 1 carta donde `back == ""` | `Err(RepoError::Validation(ValidationError::EmptyBack))` y 0 cartas insertadas | error path |
| 26 | Vec con 1 carta donde `back == "   "` (solo espacios) | `Err(RepoError::Validation(ValidationError::EmptyBack))` y 0 cartas insertadas | error path |
| 27 | `deck_id` inexistente, 1 carta válida | `Err(RepoError::ForeignKeyViolation)` | error path |

### `card_repo::list_by_deck`

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 28 | `deck_id` con 5 cartas | `Ok(vec)` donde `vec.len() == 5`, cada card tiene `state == "new"`, `reps == 0`, `lapses == 0` | happy path |
| 29 | `deck_id` sin cartas (deck existe) | `Ok(vec![])` | edge case |

### `review_log_repo::insert`

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 30 | `CreateReviewLog { card_id: <existente>, grade: 3, reviewed_at: "2026-05-24T12:00:00Z", prev_stability: 0.0, prev_difficulty: 0.0, prev_due: "2026-05-24T12:00:00Z" }` | `Ok(ReviewLog)` con `id` UUIDv7 válido | happy path |
| 31 | `CreateReviewLog { card_id: <UUID inexistente>, ... }` | `Err(RepoError::ForeignKeyViolation)` | error path |

### `settings_repo::set` y `settings_repo::get`

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 32 | `set("theme", "dark")` → `get("theme")` | `set` devuelve `Ok(())`, `get` devuelve `Ok(Some("dark"))` | happy path |
| 33 | `get("clave_inexistente")` | `Ok(None)` | edge case |
| 34 | `set("theme", "dark")` → `set("theme", "light")` → `get("theme")` | `get` devuelve `Ok(Some("light"))` (upsert) | upsert |

---

## Unit tests — comandos Tauri (capa `cmd_*`)

Los tests llaman a funciones internas `cmd_<nombre>(&conn, payload)` sin runtime Tauri.

### `commands::category`

| # | Función | Input | Output esperado | Tipo |
|---|---------|-------|-----------------|------|
| 35 | `cmd_category_create` | `CreateCategoryPayload { name: "Test" }` | `Ok(Category)` donde `name == "Test"` y resultado es JSON-serializable (sin panic en `serde_json::to_value`) | happy path |
| 36 | `cmd_category_create` | `CreateCategoryPayload { name: "" }` | `Err(e)` donde `e.to_string()` es non-empty | error path |
| 37 | `cmd_category_list` | DB con 2 categorías | `Ok(Vec<Category>)` donde `len == 2` y es JSON-serializable | happy path |

### `commands::study`

| # | Función | Input | Output esperado | Tipo |
|---|---------|-------|-----------------|------|
| 38 | `cmd_study_create` | `CreateStudyPayload { category_id: <existente>, method: "anki", name: "Deck", payload: serde_json::json!({}) }` | `Ok(Study)` JSON-serializable | happy path |
| 39 | `cmd_study_create` | `CreateStudyPayload { category_id: <UUID inexistente>, ... }` | `Err(e)` donde `e.to_string()` es non-empty | error path |
| 40 | `cmd_study_list_by_category` | `category_id` con 1 estudio | `Ok(Vec<Study>)` donde `len == 1` | happy path |

### `commands::card`

| # | Función | Input | Output esperado | Tipo |
|---|---------|-------|-----------------|------|
| 41 | `cmd_card_bulk_insert` | `deck_id` existente + 5 cartas válidas de `fixtures/cards/seed-100.json` (primeras 5) | `Ok(5)` | happy path |
| 42 | `cmd_card_list_by_deck` | `deck_id` con 5 cartas insertadas | `Ok(Vec<Card>)` donde `len == 5` y es JSON-serializable | happy path |

---

## Integration tests — Rust

### Escenario: Ciclo CRUD completo de categoría

- **Setup**: DB en memoria con migraciones aplicadas
- **Acción**: `create("Math")` → `create("Science")` → `create("History")` → `list` → `update(id_math, "Mathematics")` → `get_by_id(id_math)` → `delete(id_history)` → `list`
- **Assert**: primera `list` devuelve 3 ítems; `get_by_id` tras update devuelve `name == "Mathematics"`; segunda `list` devuelve 2; `get_by_id(id_history)` devuelve `Err(NotFound)`

### Escenario: FK RESTRICT category→study

- **Setup**: DB en memoria, crear categoría "Languages"
- **Acción**: crear estudio bajo "Languages"; intentar `category_repo::delete("Languages")`; intentar `study_create` con UUID aleatorio como `category_id`
- **Assert**: delete categoría con estudio devuelve `Err(ForeignKeyViolation)`; categoría sigue existiendo; `study_create` con FK inválido devuelve `Err(ForeignKeyViolation)`

### Escenario: Bulk insert 100 cartas y recuperación

- **Setup**: DB en memoria, crear categoría → crear estudio (deck), cargar `fixtures/cards/seed-100.json`
- **Acción**: `card_bulk_insert(deck_id, cartas_del_fixture)`
- **Assert**: `Ok(100)`, `card_list_by_deck` devuelve 100, primera carta tiene `front == "palabra_0"`, `state == "new"`, `reps == 0`, `lapses == 0`

---

## Unit tests — TypeScript (Vitest)

### `types/domain` — compilación y forma

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 43 | `import { Category, Study, Card, ReviewLog } from '@/types/domain'` | Compila sin error TS; objeto construido con `{ id: "", name: "", createdAt: "", updatedAt: "" }` satisface tipo `Category` | smoke + shape |

---

## Fixtures requeridas

- `fixtures/cards/seed-100.json` — array de 100 objetos `{ front: "palabra_N", back: "word_N", tags: [] }` para tests #21 y escenario bulk insert
- `fixtures/db/seed.sql` — SQL con INSERT de 2 categorías, 1 estudio, 5 cartas; usado por helper de integración
- `fixtures/db/empty.sqlite` — SQLite con migraciones aplicadas, sin datos (generado por `scripts/gen-fixtures.sh`)
- `fixtures/db/seeded.sqlite` — SQLite con migraciones + datos de `seed.sql` (generado por `scripts/gen-fixtures.sh`)

> Los archivos `.sqlite` se generan ejecutando `scripts/gen-fixtures.sh` (script nuevo en esta fase). Los tests Rust usan DB en memoria para aislamiento; los `.sqlite` sirven como artefactos de referencia verificables (se puede hacer `sqlite3 fixtures/db/seeded.sqlite .schema` para auditoría) y como base para tests de integración futura que requieran estado en filesystem.

---

## Snapshots

No aplica en Fase 1 (snapshots FSRS con `insta` comienzan en Fase 2).

---

## Pruebas marcadas `cannot test` (al iniciar la fase)

- ninguna

---

## Criterios de salida de esta fase

- [ ] 43 tests pasan (34 unitarios Rust repos + 8 unitarios Rust commands + 3 integración Rust + 1 unitario TS — menos cualquier `cannot test` justificado)
- [ ] `PRAGMA foreign_keys = ON` activo en toda conexión de producción y tests
- [ ] 0 tests fallando
- [ ] Cobertura ≥ 80% líneas / 75% ramas en `src-tauri/src/repo/**`, `src-tauri/src/commands/**`, `src-tauri/src/core/**`
- [ ] Sin warnings de Clippy (`cargo clippy -- -D warnings`)
- [ ] Sin warnings de TypeScript (`npm run typecheck`)
- [ ] `fixtures/db/empty.sqlite` y `fixtures/db/seeded.sqlite` generados y committeados
- [ ] Suite completa (`./scripts/ci.sh`) verde
