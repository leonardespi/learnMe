# Plan de pruebas — Fase 6: Estadísticas

## Alcance

Cubre: backend Rust `stats(study_id)` (retention rolling 30d, by_state, heatmap 365d, forecast 7d) + query auxiliar `review_log::list_by_deck` + vista React `<StatsView />` con recharts + comando Tauri `get_stats`.

No cubre: edición de parámetros FSRS, exportación de estadísticas, comparación entre decks, estadísticas por etiqueta.

Nota de implementación: `list_by_deck` tiene sus propias pruebas unitarias aisladas. La implementación de `stats::compute` se construye sobre `list_by_deck` verificado; esto preserva el aislamiento de capas dentro de la fase.

Nota sobre `phase4_unit.rs`: la autorización de limpieza de imports huérfanos emitida en el turno de cierre de Fase 5 expiró (CLAUDE.md §1.1: aplica solo durante la respuesta actual). Se requiere re-autorización explícita para limpiar dichos imports.

---

## Unit tests — Rust

### `review_log::list_by_deck`

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 1 | Deck con 2 cartas, 3 reviews cada una (6 total) | `Ok(vec.len() == 6)`, ordenado por `reviewed_at desc` | happy path |
| 2 | Deck con cartas pero 0 reviews | `Ok(vec![])` | edge case |
| 3 | Dos decks A y B con reviews; llamada `list_by_deck(deck_a)` | solo devuelve logs de deck A (aislamiento relacional) | isolation |
| 4 | Reviews de múltiples cartas del mismo deck | todos los logs incluidos, sin duplicados | happy path |

### `stats::compute`

Firma: `compute(conn: &Connection, deck_id: &str, today: NaiveDate) -> Result<DeckStats, RepoError>`

`DeckStats`:
```rust
pub struct DeckStats {
    pub retention: Option<f64>,   // null si 0 reviews en ventana 30d
    pub by_state: StateCount,
    pub heatmap: Vec<u32>,        // 365 entradas; heatmap[0] = hoy-364d, heatmap[364] = hoy
    pub forecast: Vec<u32>,       // 7 entradas; forecast[0] = hoy, forecast[6] = hoy+6
}

pub struct StateCount {
    pub new: u32,
    pub learning: u32,
    pub review: u32,
    pub relearning: u32,
}
```

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 1 | Deck con N cartas new, 0 reviews | `retention == None`, `heatmap == [0; 365]`, `forecast == [0; 7]`, `by_state.new == N` | empty deck |
| 2 | 100 reviews en últimos 30d: 80 con grade≥2, 20 con grade=1 | `retention == Some(v)` con `(v - 0.80).abs() < 0.01` | PRD test #2 |
| 3 | 5 reviews en `today - 10` días | `heatmap[354] == 5` (índice `364 - 10`) | PRD test #3 |
| 4 | 3 cartas con `due == tomorrow` | `forecast[1] == 3` | forecast |
| 5 | Cards: 2 new, 1 learning, 3 review, 1 relearning | `by_state == { new:2, learning:1, review:3, relearning:1 }` | by_state |
| 6 | Review con `reviewed_at = today - 366 días` | `heatmap` todos 0 (fuera de ventana de 365d) | boundary |
| 7 | Review con `reviewed_at = today - 31 días` (fuera de rolling 30d) | no cuenta en `retention` | boundary |

---

## Unit tests — TypeScript (Vitest + Testing Library)

### `<StatsView />`

Props que recibe: `{ stats: DeckStats | null }` donde `DeckStats` es el tipo TypeScript equivalente.

| # | Input (prop `stats`) | Output esperado | Tipo |
|---|----------------------|-----------------|------|
| 1 | `null` | `data-testid="stats-loading"` o "stats-empty" visible; ningún gráfico renderizado | empty state |
| 2 | `{ retention: 0.80, ... }` | texto `"80%"` en `data-testid="retention-value"` | happy path |
| 3 | `{ heatmap: [5, 0, ...365 ints], ... }` | `data-testid="heatmap-chart"` presente; `svg` descendiente existe | heatmap render |
| 4 | `{ forecast: [2, 5, 1, 0, 0, 0, 3], ... }` | `data-testid="forecast-chart"` presente | forecast render |
| 5 | `{ byState: { new:10, learning:3, review:7, relearning:1 }, ... }` | `data-testid="by-state-new"` contiene texto `"10"` | by_state render |

---

## Integration tests — Rust

### Escenario: pipeline completo stats con historial real

- **Setup**: DB nueva; deck con 50 cartas; insertar 100 `review_logs` desde `fixtures/reviews/stats-history.json` (80 grade≥2 en últimos 28d, 20 grade=1 en últimos 28d)
- **Acción**: `stats::compute(conn, deck_id, today)`
- **Assert**:
  - `retention ≈ 0.80 ± 0.01`
  - `heatmap.iter().sum::<u32>() == 100` (total de reviews == suma del heatmap)
  - `forecast.iter().all(|&v| v <= 50)` (no puede haber más cartas por día que el total del deck)

### Escenario: ventana de 30 días es precisa

- **Setup**: DB con 10 reviews exactamente en `today - 30d` (en el límite) y 10 en `today - 31d` (fuera)
- **Acción**: `stats::compute(conn, deck_id, today)`
- **Assert**: `retention.unwrap()` calculado sobre exactamente 10 reviews (las de `today - 30d`); las de `today - 31d` no cuentan

---

## E2E tests — Playwright

### Escenario: navegación y render de stats

- **Viewport**: desktop (1280×800)
- **Pasos**:
  1. Importar `fixtures/decks/spanish-a2-valid.json` vía mock
  2. Navegar al deck → click `data-testid="btn-view-stats"`
  3. Esperar `data-testid="stats-view"`
- **Assert**: `data-testid="stats-view"` visible; al menos un elemento `svg` en el DOM

### Escenario: tema claro/oscuro en stats view

- **Viewport**: desktop (1280×800)
- **Pasos**:
  1. Navegar a stats view (mock data pre-cargada)
  2. Tomar snapshot visual (tema claro) → `phase6-stats-light.png`
  3. Click toggle tema → esperar `data-theme="dark"`
  4. Tomar snapshot visual (tema oscuro) → `phase6-stats-dark.png`
- **Assert**:
  - `svg` presente en ambos temas (DOM assertion automatizada)
  - Snapshots visuales guardados para revisión humana (exit gate del PRD)

### Escenario: responsive stats en mobile

- **Viewport**: mobile (375×667)
- **Pasos**: navegar a stats view
- **Assert**: `data-testid="stats-view"` visible; sin overflow horizontal (`scrollWidth <= clientWidth`)

---

## Fixtures requeridas

- `fixtures/reviews/stats-history.json` — 100 objetos `ReviewLog` con `reviewed_at` distribuido en los últimos 45 días; exactamente 80 con `grade >= 2`, 20 con `grade == 1`; referenciado por integration test Rust y como fuente de verdad para snapshot
- `fixtures/stats/stats-snapshot.json` — `DeckStats` pre-computado (valores derivados de `stats-history.json`); usado por handler `get_stats` en `mock-ipc.ts` para E2E (evita dependencia del cálculo en runtime del mock con su `due = +1 día` plano)

---

## Snapshots (aprobación humana requerida)

- `tests/e2e/snapshots/phase6-stats-light.png` — stats view en tema claro
- `tests/e2e/snapshots/phase6-stats-dark.png` — stats view en tema oscuro

El exit gate del PRD ("gráficos renderizan en light y dark") se satisface con: (a) DOM assertion automatizada sobre `svg` + (b) aprobación visual humana de los snapshots. CI falla si `svg` ausente; la aprobación visual es gate manual adicional.

---

## Pruebas marcadas `cannot test` (al iniciar la fase)

- ninguna

---

## Criterios de salida de esta fase

- [ ] 11 unit tests Rust pasan (`list_by_deck`: 4, `stats::compute`: 7)
- [ ] 5 unit tests TypeScript `<StatsView />` pasan
- [ ] 2 integration tests Rust pasan
- [ ] 3 E2E Playwright pasan (incluye DOM assertion sobre `svg`)
- [ ] Snapshots `phase6-stats-light.png` y `phase6-stats-dark.png` aprobados por usuario
- [ ] Cobertura ≥ 80% líneas / 75% ramas en `src-tauri/src/stats/**` y `src/features/stats/**`
- [ ] Suite completa (`./scripts/ci.sh`) verde — 0 fallos
