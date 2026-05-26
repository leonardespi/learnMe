# Plan de pruebas — Fase 3: Importación / exportación de decks Anki (`.json`)

## Alcance

Cubre: JSON Schema `schemas/anki-deck.v1.json` (generado desde Zod), comando `import_anki_deck(category_id, file_path)` con dedupe por `front+back`, comando `export_anki_deck(deck_id)` que devuelve payload JSON válido contra el schema, y comando `add_card(deck_id, front, back, tags)` para inserción manual.

No cubre: UI de importación (Fase 4), sesión de repaso post-import (Fase 5), formato `.learnme` (Fase 7), imágenes/audio en cartas (fuera de alcance v0.1).

**Decisión arquitectónica confirmada:** dirección Zod → JSON Schema (`zod-to-json-schema`). El archivo `schemas/anki-deck.v1.json` se genera una vez y se versiona; un script puede regenerarlo si el Zod schema cambia.

**Firma de `import_anki_deck`:** `(category_id: String, file_path: String) → ImportResult { inserted: u32, skipped: u32 }`. La dedupe aplica dentro del mismo (category_id, name, method). Re-import en categoría diferente crea estudio nuevo.

---

## Unit tests — Rust

### `methods::anki::import::validate_schema`

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 1 | JSON de `fixtures/decks/spanish-a2-valid.json` | `Ok(())` | happy path |
| 2 | JSON de `fixtures/decks/missing-method.json` (sin campo `method`) | `Err(ImportError::SchemaError { pointer: "/method" })` | error path |
| 3 | JSON de `fixtures/decks/missing-schema-version.json` (sin `schemaVersion`) | `Err(ImportError::SchemaError { pointer: "/schemaVersion" })` | error path |
| 4 | JSON de `fixtures/decks/missing-cards.json` (sin campo `cards`) | `Err(ImportError::SchemaError { pointer: "/cards" })` | error path |
| 5 | `serde_json::Value::Null` | `Err(ImportError::SchemaError { .. })` | error path |
| 6 | JSON de `fixtures/decks/unicode-edge.json` | `Ok(())` | edge case |

### `methods::anki::import::parse_file`

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 7 | Path válido a `spanish-a2-valid.json` | `Ok(serde_json::Value)` | happy path |
| 8 | Path inexistente (`/tmp/nonexistent.json`) | `Err(ImportError::IoError { .. })` | error path |
| 9 | Path a `fixtures/decks/binary.bin` (bytes no UTF-8) | `Err(ImportError::ParseError { .. })` con mensaje no vacío | error path |
| 10 | JSON válido pero sin estructura de deck (`fixtures/decks/missing-cards.json`) | `Ok(Value)` (parse OK; schema falla en test 4) | separación parse/validate |

### `methods::anki::import::compute_new_cards`

Función pura: dado `existing: HashSet<(String, String)>` (front+back pares) y `incoming: Vec<CardPayload>`, devuelve `(to_insert: Vec<CardPayload>, skipped: usize)`.

| # | Input `existing` | Input `incoming` | Output esperado | Tipo |
|---|-----------------|-----------------|-----------------|------|
| 11 | `{}` (vacío) | 50 cartas únicas | `(50 cartas, 0)` | happy path |
| 12 | 50 pares idénticos a incoming | 50 cartas | `(vec![], 50)` | dedupe total |
| 13 | 50 pares existentes | 60 cartas (50 = existing + 10 nuevas) | `(10 cartas, 50)` | dedupe parcial |
| 14 | 0 existentes | 0 cartas | `(vec![], 0)` | deck vacío |

### `methods::anki::export::build_export_payload`

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 15 | Deck con 5 cartas (estados mixtos: new/learning/review) | `serde_json::Value` con `schemaVersion="1.0.0"`, `method="anki"`, `cards.len()==5`, snapshot `insta` | happy path |
| 16 | Mismo payload de #15 | `validate_schema(payload) == Ok(())` (output propio es schema-válido) | invariante |
| 17 | Deck sin cartas (0 cards) | `serde_json::Value` con `cards: []`, schema válido | edge case |

### `commands::cards::cmd_add_card`

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 18 | `{ deck_id: <existente>, front: "casa", back: "house", tags: [] }` | `Ok(Card { state: "new", reps: 0, lapses: 0, stability: 0.0, difficulty: 0.0 })` | happy path |
| 19 | `{ deck_id: <existente>, front: "", back: "house", tags: [] }` | `Err(ValidationError::EmptyField { field: "front" })` | error path |
| 20 | `{ deck_id: <existente>, front: "casa", back: "", tags: [] }` | `Err(ValidationError::EmptyField { field: "back" })` | error path |
| 21 | `{ deck_id: <inexistente>, front: "casa", back: "house", tags: [] }` | `Err(RepoError::NotFound)` o `Err(RepoError::ForeignKeyViolation)` | error path |
| 22 | `{ deck_id: <existente>, front: "correr", back: "to run", tags: ["verb", "ar"] }` | `Ok(Card { tags: ["verb", "ar"] })` | happy path con tags |
| 23 | `{ deck_id: <existente>, front: " ", back: "house", tags: [] }` | `Err(ValidationError::EmptyField { field: "front" })` (whitespace-only) | edge case |

---

## Unit tests — TypeScript (Vitest)

### `schemas/anki-deck.ts` — Zod schema `AnkiDeckSchema`

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 24 | Objeto completo válido con 2 cartas | `parse()` sin error, objeto tipado | happy path |
| 25 | Objeto sin campo `method` | `ZodError` con `issues[0].path == ["method"]` | error path |
| 26 | Objeto sin campo `schemaVersion` | `ZodError` con path `["schemaVersion"]` | error path |
| 27 | `cards` como string en vez de array | `ZodError` con path `["cards"]` | error path |
| 28 | Carta sin campo `front` | `ZodError` con path `["cards", 0, "front"]` | error path |
| 29 | Carta sin campo `back` | `ZodError` con path `["cards", 0, "back"]` | error path |
| 30 | Carta sin campo `tags` | `parse()` sin error, `tags` defaultea a `[]` | edge case / default |

### `schemas/anki-deck.ts` — generación JSON Schema

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 31 | `zodToJsonSchema(AnkiDeckSchema)` | Objeto JSON válido con `$schema`, `properties.method`, `properties.cards` presentes | smoke test |
| 32 | Output de #31 == `JSON.parse(fs.readFileSync('schemas/anki-deck.v1.json'))` | `true` (schema en disco = schema generado) | sync check |

---

## Integration tests — Rust

### Escenario: Import completo en DB vacía

- **Setup**: DB con 1 categoría (`id = "cat-1"`, `name = "Idiomas"`); sin estudios ni cartas.
- **Acción**: `cmd_import_anki_deck("cat-1", "fixtures/decks/spanish-a2-valid.json")`
- **Assert**:
  - `result == ImportResult { inserted: 50, skipped: 0 }`
  - `study_repo::list_by_category("cat-1").len() == 1`
  - `card_repo::list_by_deck(deck_id).len() == 50`
  - Todas las cartas tienen `state = "new"`, `reps = 0`, `lapses = 0`

### Escenario: Re-import total dedupe

- **Setup**: DB con deck importado de `spanish-a2-valid.json` (50 cartas). Aplicar 1 review a 5 cartas (modificar FSRS state en DB).
- **Acción**: `cmd_import_anki_deck("cat-1", "fixtures/decks/spanish-a2-valid.json")` (mismo archivo)
- **Assert**:
  - `result == ImportResult { inserted: 0, skipped: 50 }`
  - Conteo de cartas sigue siendo 50
  - Las 5 cartas con FSRS modificado mantienen `state`, `stability`, `difficulty` sin cambio

### Escenario: Re-import parcial (50 + 10 nuevas)

- **Setup**: DB con deck de 50 cartas (`spanish-a2-valid.json`).
- **Acción**: `cmd_import_anki_deck("cat-1", "fixtures/decks/spanish-a2-extended.json")` (60 cartas: 50 iguales + 10 nuevas)
- **Assert**:
  - `result == ImportResult { inserted: 10, skipped: 50 }`
  - `card_repo::list_by_deck(deck_id).len() == 60`
  - Las 10 nuevas tienen `state = "new"`

### Escenario: Export → Import roundtrip (snapshot)

- **Setup**: DB con deck de 10 cartas con FSRS states variados (new/learning/review), cargadas desde `fixtures/db/seeded.sqlite`.
- **Acción**: `cmd_export_anki_deck(deck_id)` → `payload`; `cmd_import_anki_deck("cat-2", payload_path)` (exportar a archivo temp, reimportar como nuevo deck)
- **Assert**:
  - Snapshot `insta` de `payload` (campos card: front, back, tags, stability, difficulty, state)
  - `validate_schema(payload) == Ok(())`
  - Nuevo deck tiene mismas cartas (front+back idénticos), estado FSRS idéntico al exportado

### Escenario: Performance — 10k cartas

- **Setup**: DB vacía, categoría "bench".
- **Acción**: `cmd_import_anki_deck("bench-cat", "fixtures/decks/10k-cards.json")`; medir duración con `std::time::Instant`.
- **Assert**: `duration < 5_000ms` (5 segundos en hardware de referencia)
- **Nota**: marcada como `#[ignore]` por defecto (benchmark, no corre en CI normal). Se ejecuta manualmente con `cargo test -- --ignored`.

---

## E2E tests

No aplica en esta fase. Sin UI de importación (Fase 4).

---

## Fixtures requeridas

- `fixtures/decks/spanish-a2-valid.json` — 50 cartas válidas (schemaVersion 1.0.0, method anki, name "Spanish A2 Vocabulary"). Cartas con front/back/tags variados, incluyendo algunos con tags vacíos.
- `fixtures/decks/spanish-a2-extended.json` — 60 cartas: las mismas 50 de `valid` + 10 nuevas (front/back diferentes). Mismo `name` y `method`.
- `fixtures/decks/missing-method.json` — JSON válido, igual que `valid` pero sin campo `method`.
- `fixtures/decks/missing-schema-version.json` — JSON válido, sin campo `schemaVersion`.
- `fixtures/decks/missing-cards.json` — JSON válido, sin campo `cards`.
- `fixtures/decks/binary.bin` — archivo binario (e.g. 16 bytes aleatorios) para test de ParseError.
- `fixtures/decks/unicode-edge.json` — 5 cartas con unicode (japonés, árabe, emoji en tags), markdown básico en front/back.
- `fixtures/decks/10k-cards.json` — 10,000 cartas generadas programáticamente (`front: "word-N"`, `back: "def-N"`). Generado por script, no hand-crafted.

---

## Snapshots (insta)

- `phase3_export_payload_10cards.snap` — snapshot del JSON producido por `cmd_export_anki_deck` con 10 cartas de estados mixtos. Captura: `schemaVersion`, `method`, `name`, y por cada carta: `front`, `back`, `tags`, `stability`, `difficulty`, `state`.
- `phase3_export_roundtrip.snap` — snapshot de las cartas del deck importado tras el roundtrip (campos FSRS).

---

## Pruebas marcadas `cannot test` (al iniciar la fase)

- Test #35 (performance 10k): se ejecuta con `#[ignore]`; no es un `cannot test` real, es un benchmark opt-in.
- Los wrappers Tauri async de `import_anki_deck`, `export_anki_deck`, `add_card` (sin AppState): igual que en fases anteriores, solo testables en E2E Fase 4.

---

## Criterios de salida de esta fase

- [ ] 23 tests unitarios Rust pasan (tests #1–#23)
- [ ] 9 tests unitarios TS pasan (tests #24–#32)
- [ ] 4 tests de integración pasan (import completo, dedupe total, dedupe parcial, roundtrip)
- [ ] 2 snapshots `insta` estables
- [ ] Test de performance (#35) pasa manualmente con `cargo test -- --ignored` (< 5s)
- [ ] `validate_schema` verifica que el output de `cmd_export_anki_deck` es schema-válido (test #16)
- [ ] Cobertura ≥ 80% líneas / ≥ 75% ramas en `src-tauri/src/methods/anki/import.rs`, `export.rs`, `src-tauri/src/commands/cards.rs`
- [ ] Suite completa (`./scripts/ci.sh`) verde
- [ ] `schemas/anki-deck.v1.json` generado y versionado; test #32 confirma sincronía con Zod schema
