# Plan de pruebas — Fase 2: FSRS y motor de repaso

## Alcance

Cubre: prerequisitos de entry (`study::get_by_id`, `study::delete`), repo `card::update_fsrs`,
wrapper puro `methods::anki::fsrs::apply_review`, comandos `cmd_record_review` / `cmd_next_card` /
`cmd_forecast`, tipos TypeScript nuevos.

No cubre: UI, import/export, day-tracking de cartas nuevas (postergado a Fase 5),
E2E de wrappers Tauri async (Fase 4).

---

## Unit tests

### `repo::study::get_by_id`

Firma: `get_by_id(conn: &Connection, id: &str) -> Result<Study, RepoError>`

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 1 | `id` de study existente (creado en setup) | `Ok(Study { id == creado, name == "Deck", ... })` | happy path |
| 2 | `"00000000-0000-0000-0000-000000000000"` | `Err(RepoError::NotFound)` | not found |

---

### `repo::study::delete`

Firma: `delete(conn: &Connection, id: &str) -> Result<(), RepoError>`

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 3 | `id` de study sin cartas | `Ok(())` | happy path |
| 4 | `"00000000-0000-0000-0000-000000000000"` | `Err(RepoError::NotFound)` | not found |
| 5 | `id` de study con ≥1 carta en deck | `Err(RepoError::ForeignKeyViolation)` | FK RESTRICT |

---

### `repo::card::update_fsrs`

Firma: `update_fsrs(conn: &Connection, card_id: &str, update: CardFsrsUpdate) -> Result<Card, RepoError>`

`CardFsrsUpdate { stability: f64, difficulty: f64, due: String, last_review: String, state: String, reps: i64, lapses: i64, scheduled_days: i64 }`

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 6 | `card_id` existente + `CardFsrsUpdate { state:"learning", stability:3.1262, reps:1, lapses:0, ... }` | `Ok(Card { state:"learning", stability:3.1262, reps:1, lapses:0, ... })` | happy path |
| 7 | `"00000000-0000-0000-0000-000000000000"` + update válido | `Err(RepoError::NotFound)` | not found |

---

### `methods::anki::fsrs::apply_review`

Firma: `apply_review(card: &Card, grade: u8, now: DateTime<Utc>) -> Result<CardFsrsUpdate, RepoError>`

Delegación a `FSRS::default().next(rs_card, now, rating)`. `enable_fuzz: false` → output determinista para `now` fijo.

Carta base new: `Card { state:"new", stability:0.0, difficulty:0.0, reps:0, lapses:0, due:NOW, last_review:NOW }` donde `NOW = 2026-01-01T00:00:00Z`.

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 8 | carta_new + grade=3 (Good) + now=NOW | `CardFsrsUpdate { state:"learning", reps:1, lapses:0, stability≈3.1262, due == NOW+10min }` | new→learning |
| 9 | carta_new + grade=1 (Again) + now=NOW | `CardFsrsUpdate { state:"learning", reps:1, lapses:0, stability≈0.4072, due == NOW+1min }` | new+Again: no lapses |
| 10 | carta_review `{ stability:10.0, difficulty:5.0, reps:3, lapses:0, last_review:NOW-10days }` + grade=1 + now=NOW | `CardFsrsUpdate { state:"relearning", lapses:1 }` | review+Again→relearning |
| 11 | carta_new + grade=4 (Easy) + now=NOW | `CardFsrsUpdate { state:"review", scheduled_days≥14 }` | new+Easy→review directo |
| 12 | carta_new + grade=0 | `Err(RepoError::Validation(ValidationError::InvalidGrade))` | grade inválido bajo |
| 13 | carta_new + grade=5 | `Err(RepoError::Validation(ValidationError::InvalidGrade))` | grade inválido alto |
| 14 | misma carta_new + grade=3 + now=NOW (llamada 3 veces independientes) | outputs idénticos en las 3 llamadas — `insta::assert_debug_snapshot!` del `CardFsrsUpdate` | determinismo snapshot |

Nota test #14: la snapshot se crea en el primer run verde y se commitea. Nombre de snapshot: `apply_review_new_good_determinism`.

---

### `commands::review::cmd_record_review`

Firma: `cmd_record_review(conn: &Connection, card_id: &str, grade: u8, now: DateTime<Utc>) -> Result<RecordReviewResult, RepoError>`

`RecordReviewResult { card: Card, review_log: ReviewLog }`

Efecto: llama `apply_review`, actualiza card vía `card::update_fsrs`, inserta review_log vía `review_log::insert`.

Setup helper: `make_new_card(conn)` → crea categoría + study + 1 carta, devuelve `card.id`.

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 15 | `card_id` new + grade=3 + now=NOW | `Ok(RecordReviewResult { card.state=="learning", card.reps==1, review_log.card_id==card_id, review_log.grade==3 })` | happy path |
| 16 | `card_id` new + grade=1 + now=NOW | `Ok(RecordReviewResult { card.state=="learning", card.lapses==0 })` | Again en carta new: sin lapses |
| 17 | `"00000000..."` + grade=3 + now=NOW | `Err(RepoError::NotFound)` | carta no existe |
| 18 | `card_id` new + grade=0 + now=NOW | `Err(RepoError::Validation(ValidationError::InvalidGrade))` | grade=0 inválido |
| 19 | `card_id` new + grade=5 + now=NOW | `Err(RepoError::Validation(ValidationError::InvalidGrade))` | grade=5 inválido |

---

### `commands::deck::cmd_next_card`

Firma: `cmd_next_card(conn: &Connection, deck_id: &str, new_limit: u32) -> Result<Option<Card>, RepoError>`

Prioridad de selección: `state='learning' AND due<=now` → `state='review' AND due<=now` → `state='new'` (si `new_limit>0`).
`new_limit=0` excluye cartas new de la candidatura.

Setup: todos los decks creados con `make_deck(conn)` → categoría + study, devuelve `(study_id, conn)`.

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 20 | deck vacío (sin cartas), new_limit=10 | `Ok(None)` | deck vacío |
| 21 | deck con 1 carta new, new_limit=1 | `Ok(Some(card))` donde `card.state=="new"` | retorna new |
| 22 | deck con 1 carta overdue (`state:'review', due:NOW-1day`) + 1 new, new_limit=1 | resultado`.state == "review"` (overdue antes que new) | prioridad due>new |
| 23 | deck con 2 cartas new, new_limit=0 | `Ok(None)` (new excluidas) | cap new=0 |
| 24 | deck con 1 learning overdue + 1 review overdue + 1 new, new_limit=1 | resultado`.state == "learning"` (learning > review > new) | prioridad completa |

Nota tests #22 y #24: para crear cartas en estado `review` o `learning`, se insertan directamente vía `card::update_fsrs` con state/due deseados (sin pasar por record_review, para no depender de lógica FSRS en el setup del test).

---

### `commands::deck::cmd_forecast`

Firma: `cmd_forecast(conn: &Connection, deck_id: &str, days: u32) -> Result<Vec<u32>, RepoError>`

Devuelve `days` enteros: `result[0]` = cartas due hoy (`due <= now + 1 day`), `result[i]` = cartas due en `now + i días`.
Solo considera cartas con `state IN ('review', 'learning', 'relearning')` (cartas new no tienen due relevante para forecast).

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 25 | deck vacío, days=7 | `Ok([0, 0, 0, 0, 0, 0, 0])` (len==7) | deck vacío |
| 26 | deck con 3 cartas due=NOW (overdue) + 2 cartas due=NOW+3days, days=7 | `Ok([3, 0, 0, 2, 0, 0, 0])` | distribución correcta |

---

## Integration tests

### Escenario I-1: Ciclo completo de repaso

- **Setup**: DB vacía → categoría "Math" → study "Algebra" → `bulk_insert` 3 cartas (front:"Q1/Q2/Q3", todas new)
- **Acción**:
  1. `cmd_next_card(deck_id, 3)` → debe devolver alguna carta (call la `card_1`)
  2. `cmd_record_review(card_1.id, 3, NOW)` → obtener `result`
  3. `cmd_next_card(deck_id, 2)` → obtener `card_2` (distinta a card_1 si card_1.due > NOW)
- **Assert**:
  - `result.card.state == "learning"`, `result.card.reps == 1`, `result.card.lapses == 0`
  - `result.review_log.card_id == card_1.id`, `result.review_log.grade == 3`
  - `card_2.id != card_1.id` (se sirve siguiente carta en cola)

### Escenario I-2: Prioridad de selección en deck mixto

- **Setup**: DB vacía → categoría → study → 4 cartas (c1, c2, c3, c4 new)
- **Transiciones via `card::update_fsrs` directamente** (sin record_review, para controlar estado):
  - c1: `state="review", due=NOW-2days` (vencida hace 2 días)
  - c2: `state="learning", due=NOW-1hour` (vencida hace 1 hora → máxima prioridad)
  - c3: `state="new"`
  - c4: `state="review", due=NOW+5days` (no vencida)
- **Acción**: `cmd_next_card(deck_id, 1)` → `first`
- **Assert**: `first.id == c2.id` (learning overdue tiene prioridad sobre review overdue y new)

---

## E2E tests

Ninguno en Fase 2. Los 3 wrappers Tauri async nuevos (`record_review`, `next_card`, `forecast`) se cubren en Fase 4 vía `tauri-driver`.

---

## Fixtures requeridas

- `fixtures/cards/100-cards-mixed-states.json` — 100 cartas con estados mixtos (`new`/`learning`/`review`/`relearning`) y fechas `due` relativas a `2026-01-01T00:00:00Z`. Usadas en tests de integración de carga.
- `fixtures/reviews/sequence-a.json` — secuencia de grades `[3, 3, 3, 1, 3, 4]` para test de determinismo extendido (opcional, referenciada en snapshot test si se amplía).

---

## Snapshots requeridas

- `src-tauri/src/methods/anki/snapshots/apply_review_new_good_determinism.snap` — output de `apply_review` para carta new + grade 3 + `now=2026-01-01T00:00:00Z`. Creado automáticamente por `insta` en primer run, commiteable.

---

## Pruebas marcadas `cannot test` (al iniciar la fase)

- `commands/review.rs` — `record_review` async Tauri wrapper: requiere `tauri::State<AppState>` con runtime. Misma limitación que Phase 1.
- `commands/deck.rs` — `next_card`, `forecast` async wrappers: ídem.

---

## Nuevos archivos de producción esperados

| Archivo | Propósito |
|---------|-----------|
| `src-tauri/src/methods/mod.rs` | Módulo methods |
| `src-tauri/src/methods/anki/mod.rs` | Módulo anki |
| `src-tauri/src/methods/anki/fsrs.rs` | Wrapper `apply_review` + `CardFsrsUpdate` |
| `src-tauri/src/commands/review.rs` | `cmd_record_review` + Tauri wrapper |
| `src-tauri/src/commands/deck.rs` | `cmd_next_card` + `cmd_forecast` + wrappers |

Archivos modificados: `repo/study.rs` (add `get_by_id`, `delete`), `repo/card.rs` (add `update_fsrs`), `core/error.rs` (add `InvalidGrade` a `ValidationError`), `Cargo.toml` (add `rs-fsrs`, `insta`), `lib.rs` (register commands), `commands/mod.rs` (add submodules).

## Tipos TypeScript nuevos (`src/types/domain.ts`)

- `RecordReviewResult { card: Card; reviewLog: ReviewLog }` — resultado de `record_review`

### `domain.ts` TS test (módulo)

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 27 | `await import('@/types/domain')` | módulo resuelve y exporta `RecordReviewResult` como tipo (verificado vía `satisfies`) | módulo resolve |

---

## Criterios de salida de esta fase

- [ ] 26 tests unitarios Rust pasan (tests #1–26)
- [ ] 2 tests de integración Rust pasan (I-1, I-2)
- [ ] 1 test TypeScript pasa (test #27)
- [ ] Snapshot `apply_review_new_good_determinism` creada y estable
- [ ] Cobertura ≥80% líneas / ≥75% ramas en paths nuevos Phase 2 (`methods/**`, `commands/review.rs`, `commands/deck.rs`, incrementales en `repo/study.rs`, `repo/card.rs`)
- [ ] Suite completa (`./scripts/ci.sh`) verde
- [ ] `cargo +nightly llvm-cov --branch` ejecutado, números documentados en `report.md`
