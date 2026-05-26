# Plan de pruebas — Fase 4: UI: Tema, Categorías y Estudios

## Alcance

Cubre la capa de presentación completa para categorías y estudios: layout responsivo (sidebar/bottom-tabs), tema claro/oscuro persistido en DB, CRUD de categorías y estudios, y vista de detalle de estudio con acciones de importar y agregar carta.

Amortiza deuda técnica comprometida en fase 3:
- `repo::study::update` + wrapper Tauri `study_update`
- `repo::card::delete` + wrapper Tauri `card_delete`
- Wrappers Tauri para `category_update`, `category_delete`, `study_delete`
- Wrappers Tauri para `settings_get`, `settings_set`

**Contrato relacional respetado**: el schema usa `FOREIGN KEY … REFERENCES` sin `ON DELETE CASCADE` y `PRAGMA foreign_keys = ON`. Por tanto, todos los comandos de borrado que tengan hijos referenciales operan a nivel de aplicación, eliminando primero los hijos en el orden correcto (review_logs → cards → study; review_logs → card para borrado unitario), nunca dependiendo de cascade de base de datos.

**No cubre**: sesión de repaso (fase 5), estadísticas (fase 6), métodos distintos de Anki.

---

## Rust unit tests — nuevos comandos y repo functions

### `repo::study::update` + `commands::study::cmd_study_update`

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 1 | `id=<existente>, name="Deck Editado"` | `Ok(Study { name: "Deck Editado", … })` | happy path |
| 2 | `id=<existente>, name=""` | `Err(RepoError::Validation(ValidationError::EmptyName))` | error: nombre vacío |
| 3 | `id=<inexistente>, name="X"` | `Err(RepoError::NotFound)` | error: no existe |

### `repo::card::delete` + `commands::card::cmd_card_delete`

Nota: como `review_logs.card_id` tiene FK RESTRICT, el comando elimina primero los review_logs del card y luego el card (capa de aplicación, no CASCADE de DB).

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 4 | `id=<card sin review_logs>` | `Ok(())` y card no aparece en `list_by_deck` | happy path sin historial |
| 5 | `id=<card con 2 review_logs>` | `Ok(())`, card ausente en list, review_logs del card ausentes en DB | happy path con historial (app-layer ordering) |
| 6 | `id=<inexistente>` | `Err(RepoError::NotFound)` | error: no existe |

### `commands::category::cmd_category_update`

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 7 | `id=<existente>, name="Idiomas Edit", color=None` | `Ok(Category { name: "Idiomas Edit", … })` | happy path |
| 8 | `id=<existente>, name=""` | `Err(RepoError::Validation(ValidationError::EmptyName))` | error: nombre vacío |
| 9 | `id=<inexistente>, name="X"` | `Err(RepoError::NotFound)` | error: no existe |

### `commands::category::cmd_category_delete`

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 10 | `id=<categoría sin estudios>` | `Ok(())` y `category_repo::list` no contiene ese id | happy path |
| 11 | `id=<categoría con estudio activo>` | `Err(RepoError::ForeignKeyViolation)` — FK RESTRICT; la UI debe borrar estudios primero | error: FK RESTRICT respetado |
| 12 | `id=<inexistente>` | `Err(RepoError::NotFound)` | error: no existe |

### `commands::study::cmd_study_delete`

Nota: FK RESTRICT en `cards.deck_id`. El comando elimina en orden: review_logs de todas las cartas del deck → todas las cartas del deck → study (capa de aplicación).

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 13 | `id=<study con 3 cartas y review_logs>` | `Ok(())`, `card_repo::list_by_deck` = `[]`, study ausente en list | happy path: app-layer ordering |
| 14 | `id=<study sin cartas>` | `Ok(())` | happy path: vacío |
| 15 | `id=<inexistente>` | `Err(RepoError::NotFound)` | error: no existe |

### `commands::settings::cmd_settings_get` / `cmd_settings_set`

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 16 | `get("theme")` en DB sin esa key | `Ok(None)` | ausente |
| 17 | `set("theme", "dark")` → `get("theme")` | `Ok(Some("dark"))` | happy path |
| 18 | `set("theme", "dark")` → `set("theme", "light")` → `get("theme")` | `Ok(Some("light"))` | upsert |
| 19 | `set("", "dark")` | `Err(RepoError::Validation(ValidationError::EmptyName))` | key vacía |

---

## TypeScript unit tests (Vitest + Testing Library) — `tests/unit/`

### `<CategoryList />` — `CategoryList.test.tsx`

| # | Input (props) | Output esperado | Tipo |
|---|--------------|-----------------|------|
| 20 | `categories=[]` | elemento con `data-testid="category-empty-state"` presente | empty state |
| 21 | `categories=[{id:"1",name:"A",…},{id:"2",name:"B",…},{id:"3",name:"C",…}]` | 3 elementos con `data-testid="category-item"` | lista llena |
| 22 | click en ítem con `id="1"` | llama `onSelect("1")` | interacción callback |

### `useTheme` hook — `useTheme.test.ts`

| # | Acción | Output esperado | Tipo |
|---|--------|-----------------|------|
| 23 | `renderHook(() => useTheme())` sin `data-theme` previo | `theme === "light"` y `document.documentElement.dataset.theme === "light"` | default |
| 24 | `act(() => setTheme("dark"))` | `document.documentElement.dataset.theme === "dark"` | light→dark |
| 25 | `act(() => setTheme("light"))` tras dark | `document.documentElement.dataset.theme === "light"` | dark→light |

### `<ThemeToggle />` — `ThemeToggle.test.tsx`

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 26 | render con estado inicial `"light"` | botón con `aria-label` conteniendo `"dark"` (next state) | accesibilidad |
| 27 | click en botón | `document.documentElement.dataset.theme === "dark"` | toggle |

### `<StudyDetail />` — `StudyDetail.test.tsx`

| # | Input (props) | Output esperado | Tipo |
|---|--------------|-----------------|------|
| 28 | `cards=[]` | elemento con `data-testid="card-empty-state"` | empty state |
| 29 | `cards=[{id:"c1",front:"casa",back:"house",…}]` | elemento `data-testid="card-item"` con texto `"casa"` | lista con cartas |
| 30 | render (cualquier props) | botón con texto `"Importar"` visible | botón importar |
| 31 | render (cualquier props) | botón con texto `"Agregar carta"` visible | botón agregar |

---

## Integration tests (Rust) — `src-tauri/tests/phase4_integration.rs`

### Escenario: CRUD completo de categoría

- **Setup**: `new_test_db()`
- **Acción**: create("Idiomas") → update("Idiomas Edit") → list → delete → list
- **Assert**: list tras create = 1 ítem con `name="Idiomas"`; list tras update = 1 ítem con `name="Idiomas Edit"`; list tras delete = 0 ítems

### Escenario: `study_update` persiste nombre

- **Setup**: DB con 1 categoría + 1 study `name="Original"`
- **Acción**: `cmd_study_update(id, "Actualizado")`
- **Assert**: `study_repo::get_by_id` retorna `name="Actualizado"`

### Escenario: `study_delete` con cartas y review_logs (app-layer ordering)

- **Setup**: DB con 1 categoría, 1 study, 3 cartas, 2 review_logs en la carta 1
- **Acción**: `cmd_study_delete(study_id)`
- **Assert**: `Ok(())`, `card_repo::list_by_deck(study_id)` = `[]`, `review_log_repo::list_by_card(card1_id)` = `[]`

### Escenario: `card_delete` respeta review_logs (app-layer ordering)

- **Setup**: DB con 1 card + 3 review_logs ligados a esa card
- **Acción**: `cmd_card_delete(card_id)`
- **Assert**: `Ok(())`, card ausente, `review_log_repo::list_by_card(card_id)` = `[]`

### Escenario: Persistencia de tema

- **Setup**: `new_test_db()`
- **Acción**: `cmd_settings_set("theme", "dark")` → `cmd_settings_get("theme")`
- **Assert**: `Some("dark")`

---

## E2E tests (Playwright) — `tests/e2e/phase4_categories.spec.ts`

### Estrategia de file dialog en Tauri 2.x

`tauri-plugin-dialog` invoca diálogos nativos del SO no controlables por Playwright. Para hacer el flujo de importación testeable se usará un `<input type="file" data-testid="file-input-hidden" style="display:none">` en el componente de importación, accesible vía `page.setInputFiles('input[data-testid="file-input-hidden"]', fixturePath)`. El botón "Importar .json" visible llama al input oculto via `.click()` en producción, pero en E2E Playwright puede invocar el input directamente. Esta estrategia evita el runtime de `tauri::test::mock_app` para el happy-path básico.

### Escenario: Crear categoría y verificar en lista

- **Viewport(s)**: desktop (1280×800)
- **Pasos**:
  1. App abre en pantalla principal
  2. Click en botón `data-testid="btn-new-category"`
  3. Escribe `"Idiomas"` en `data-testid="input-category-name"`
  4. Click en `data-testid="btn-save-category"`
- **Assert**: elemento con `data-testid="category-item"` y texto `"Idiomas"` visible en lista

### Escenario: Importar deck y ver cartas (con input oculto)

- **Viewport(s)**: desktop (1280×800)
- **Pasos**:
  1. Crear categoría `"Test"`
  2. Navegar a estudio `"Spanish A2"` (previamente creado en setup del test)
  3. `page.setInputFiles('input[data-testid="file-input-hidden"]', 'fixtures/decks/spanish-a2-valid.json')`
  4. Click en `data-testid="btn-confirm-import"`
- **Assert**: al menos 1 elemento `data-testid="card-item"` visible en study detail

### Escenario: Layout responsivo — bottom-tabs en mobile

- **Viewport(s)**: mobile (375×667)
- **Pasos**: app abre
- **Assert**: `data-testid="bottom-tabs"` visible (`toBeVisible()`); `data-testid="sidebar"` no visible (`not.toBeVisible()`)

### Escenario: Layout responsivo — sidebar en desktop

- **Viewport(s)**: desktop (1280×800)
- **Pasos**: app abre
- **Assert**: `data-testid="sidebar"` visible; `data-testid="bottom-tabs"` no visible

### Escenario: Toggle de tema persiste al recargar

- **Viewport(s)**: desktop (1280×800)
- **Pasos**:
  1. Click en `data-testid="btn-theme-toggle"` (light → dark)
  2. `await page.reload()`
- **Assert**: `document.documentElement.dataset.theme === "dark"` tras recarga

### Escenario: Snapshots visuales (requieren revisión humana en exit gate)

- **Viewport(s)**: desktop (1280×800), mobile (375×667)
- **Capturas**:
  - `snapshot-home-light.png` — pantalla principal en tema claro
  - `snapshot-home-dark.png` — pantalla principal en tema oscuro
  - `snapshot-categories-light.png` — lista de categorías (light, ≥1 categoría)
  - `snapshot-study-detail-light.png` — detalle de estudio con cartas visibles
- **Tolerancia pixel**: 0.1 (10% diferencia de píxeles permitida)

---

## Fixtures requeridas

- `fixtures/decks/spanish-a2-valid.json` — ya existe (50 cartas); usado en E2E de importación
- No se requieren fixtures nuevas para unit tests (mocks en memoria)

---

## Snapshots insta (Rust)

No aplican snapshots `insta` en fase 4.

---

## Pruebas marcadas `cannot test` (al iniciar la fase)

- ninguna

---

## Criterios de salida de esta fase

- [ ] 19 tests unitarios Rust (nuevas repo functions + wrappers) pasan
- [ ] 5 tests de integración Rust pasan
- [ ] 12 tests unitarios TS (Vitest + Testing Library) pasan
- [ ] 5 tests E2E Playwright funcionales pasan
- [ ] 4 snapshots visuales generados y aprobados por usuario (revisión humana)
- [ ] Cobertura ≥ 80% líneas / 75% ramas en paths nuevos:
  - `src-tauri/src/repo/study.rs` (función `update` nueva)
  - `src-tauri/src/repo/card.rs` (función `delete` nueva)
  - `src-tauri/src/commands/settings.rs` (nuevo)
  - `src-tauri/src/commands/category.rs` (funciones nuevas)
  - `src-tauri/src/commands/study.rs` (funciones nuevas)
  - `src/features/categories/**`
  - `src/features/studies/**`
  - `src/shared/theme/**`
- [ ] Suite completa (`./scripts/ci.sh`) verde
