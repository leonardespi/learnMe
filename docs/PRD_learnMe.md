# PRD — learnMe (v0.1)

> Documento de requisitos de producto orientado a ser ejecutado de manera autónoma por un agente Claude (`CLAUDE.md`-compatible) bajo una metodología **test-first con fixtures**.

---

## 0. Resumen ejecutivo

**learnMe** es una aplicación de escritorio multiplataforma (Linux y macOS en esta iteración), **100% local**, para estudio mediante métodos de aprendizaje pluggables. La primera fase implementa el método **Anki con repetición espaciada FSRS**. La arquitectura está diseñada para que métodos futuros (Leitner, Pomodoro+, Feynman, cloze libre, etc.) se enchufen sin reescribir el núcleo.

**Principios no negociables:**

1. **Privacidad absoluta**: ningún dato sale de la máquina. No telemetría, no analytics remotos, no llamadas de red salvo descarga de dependencias en build-time.
2. **Test-first con fixtures**: cada fase comienza con la entrega de un plan de pruebas (inputs/outputs esperados). El código se escribe contra esas pruebas.
3. **Inmutabilidad de pruebas**: el agente **no puede modificar pruebas** salvo orden explícita del usuario. Si una prueba bloquea progreso, se marca `cannot test` y se reporta al usuario.
4. **Modularidad de métodos de estudio**: Anki es la primera implementación de una interfaz `StudyMethod` genérica.

---

## 1. Stack tecnológico

| Capa | Decisión | Justificación |
|---|---|---|
| Shell desktop | **Tauri 2.x** | Binario nativo ligero (~10MB vs ~150MB Electron), seguridad por defecto, soporte Linux+macOS+iOS+Android desde el mismo código (mobile como fase futura sin re-escritura). |
| Frontend | **React 18 + TypeScript (strict)** | Ecosistema, tipado fuerte exigido por el método test-first. |
| Bundler | **Vite** | Compatible con Tauri por defecto, HMR rápido. |
| Estado | **Zustand** + **TanStack Query** | Zustand para UI state, TanStack Query para el ciclo de vida de datos desde el backend Tauri. |
| Estilos | **Tailwind CSS 4** + **CSS variables** para tema | Variables CSS facilitan el switch claro/oscuro sin recompilar. |
| Backend (proceso Tauri) | **Rust** | Único proceso nativo. Maneja DB, FS y la lógica de FSRS. |
| Persistencia | **SQLite embebido** vía `rusqlite` con `bundled` feature | No requiere SQLite del sistema. Migraciones con `refinery`. |
| Algoritmo SRS | **FSRS v5** vía crate `rs-fsrs` (oficial Open Spaced Repetition) | Estándar actual de Anki, mantenido por la comunidad de OSR. |
| Validación de schema | **Zod** (TS) + **serde + jsonschema** (Rust) | Misma fuente de verdad: JSON Schema generado desde Zod, consumido por Rust para validar imports. |
| Testing unitario TS | **Vitest** | Rápido, compatible Vite, watch mode confiable. |
| Testing unitario Rust | `cargo test` + **`insta`** para snapshots | Snapshots para outputs de FSRS y exports. |
| Testing E2E | **Playwright** apuntando a Tauri WebDriver (`tauri-driver`) | E2E real sobre el binario empacado. |
| Mobile responsive | Tailwind breakpoints + layout pruebas con Playwright viewports | Aunque no se distribuye mobile en v0.1, el layout es responsive desde el día 1. |

**Por qué no Electron**: peso, superficie de ataque mayor, y Tauri ya cubre las necesidades.
**Por qué no Flutter**: ecosistema Rust + JS Schema sharing es más limpio, y FSRS tiene crate oficial en Rust.

---

## 2. Modelo de dominio

### 2.1 Entidades núcleo

```
Category (1) ───< (N) Study
Study (abstracta) ──┬── AnkiDeck (v0.1)
                    └── <métodos futuros>
AnkiDeck (1) ───< (N) Card
Card (1) ───< (N) ReviewLog
```

### 2.2 `Study` como abstracción

```ts
interface Study {
  id: string;             // UUIDv7
  categoryId: string;
  method: 'anki' | string;  // discriminador
  name: string;
  createdAt: string;      // ISO 8601 UTC
  updatedAt: string;
}
```

Cada método extiende `Study` con su propio payload. Anki añade `AnkiDeck extends Study` con cartas y configuración FSRS.

### 2.3 Carta Anki

```ts
interface Card {
  id: string;             // UUIDv7
  deckId: string;
  front: string;          // markdown
  back: string;           // markdown
  tags: string[];
  // Estado FSRS
  stability: number;
  difficulty: number;
  due: string;            // ISO 8601
  lastReview: string | null;
  state: 'new' | 'learning' | 'review' | 'relearning';
  reps: number;
  lapses: number;
}
```

### 2.4 Formato `.json` de import

```json
{
  "schemaVersion": "1.0.0",
  "method": "anki",
  "name": "Spanish A2 Vocabulary",
  "tags": ["language", "spanish"],
  "cards": [
    { "front": "casa", "back": "house", "tags": ["noun"] },
    { "front": "correr", "back": "to run", "tags": ["verb"] }
  ]
}
```

**Re-import**: si se importa un archivo con `name` y `method` iguales a un deck existente, las cartas con `front`+`back` ya presentes se ignoran (dedupe), y las nuevas se agregan preservando el estado FSRS de las existentes.

### 2.5 Formato de export de sesión (`.learnme`)

Archivo de **texto plano JSON (UTF-8)** con extensión `.learnme`. Diseño relacional completo en memoria: NO es un zip ni contiene binarios SQLite; es un grafo textual que permite `git diff` efectivo.

#### Envelope (raíz del objeto)

| Campo | Tipo | Descripción |
|---|---|---|
| `version` | `u32` / `number` | Versión de schema. Fase 7 fija en `1`. |
| `generatedAt` | string ISO 8601 UTC | Marca de tiempo de exportación. |
| `appVersion` | string semver | Versión de la app de origen (ej. `"0.1.0"`). |
| `checksum` | string hex | SHA-256 de la cadena canónica (ver §2.5.1). |
| `data` | object | Payload relacional (ver §2.5.2). |

#### 2.5.1 Algoritmo de checksum

SHA-256 aplicado sobre los bytes UTF-8 de un JSON canónico que contiene **exclusivamente** las claves `appVersion`, `data`, `generatedAt`, `version` (orden alfabético estricto). Al importar, Rust recalcula el hash independientemente; discrepancia → `Err(ImportError::ChecksumMismatch)` sin tocar la DB.

#### 2.5.2 Payload (`data`)

Cuatro arreglos relacionales:

**`categories`**: `id` (UUID), `name` (non-empty), `color` (`#RRGGBB` | null).

**`studies`**: `id` (UUID), `categoryId` (FK → categories), `name` (non-empty), `method` (`"anki"`).

**`cards`**: `id`, `studyId` (FK → studies), `front`, `back`, `tags[]`, `state` (`new|learning|review|relearning`), `stability` (f64), `difficulty` (f64), `elapsedDays` (u32), `scheduledDays` (u32), `reps` (u32), `lapses` (u32), `due` (ISO 8601), `lastReviewed` (ISO 8601 | null).

**`reviewLogs`**: `id`, `cardId` (FK → cards), `grade` (1-4), `rating` (número equivalente), `stability` (f64), `difficulty` (f64), `elapsedDays` (u32), `scheduledDays` (u32), `reviewState` (i32), `reviewedAt` (ISO 8601).

#### 2.5.3 Políticas de compatibilidad

- **Backward** (`version ≤ 1`): migraciones en memoria antes de persistir.
- **Forward** (`version > 1`): `Err(ImportError::UnsupportedVersion)` inmediato.

#### 2.5.4 Resolución de conflictos

- **Idempotencia UUID**: categorías/estudios con mismo `id` y mismo `name` → omitidos. Mismo `id` pero nombre diferente → mantiene registro local.
- **Deduplicación semántica de cartas**: coincidencia exacta `front`+`back` (post-trim) dentro del mismo estudio → se preserva el estado FSRS cronológicamente más avanzado (mayor `reps` + `lastReviewed` más reciente). Los `reviewLogs` faltantes del archivo se insertan de forma acumulativa.
- **Pre-flight validation**: transacción SQLite atómica; si cualquier FK está rota (carta sin estudio, log sin carta), `ROLLBACK` total → `Err(ImportError::OrphanEntity)`.

---

## 3. Arquitectura modular de métodos de estudio

### 3.1 Trait `StudyMethod` (Rust)

```rust
pub trait StudyMethod {
    fn id() -> &'static str;
    fn validate_import(payload: &serde_json::Value) -> Result<(), ImportError>;
    fn create_study(&self, payload: serde_json::Value) -> Result<StudyId, StudyError>;
    fn next_item(&self, study_id: StudyId) -> Result<Option<StudyItem>, StudyError>;
    fn record_review(&self, item_id: ItemId, grade: Grade) -> Result<(), StudyError>;
    fn stats(&self, study_id: StudyId) -> Result<StudyStats, StudyError>;
    fn export(&self, study_id: StudyId) -> Result<serde_json::Value, StudyError>;
}
```

Anki implementa este trait. Cualquier método futuro lo implementa también. El frontend usa un registry: `methods.register('anki', AnkiUIBundle)` para mapear `method` → componentes React (tarjeta de estudio, vista de stats, formulario de creación).

### 3.2 Reglas de aislamiento

- Ningún archivo en `src-tauri/src/methods/anki/**` puede ser importado fuera de `methods/anki/` ni desde otros métodos.
- El núcleo (`core/`) sólo conoce el trait, no implementaciones concretas.
- Pruebas de cada método viven en su carpeta y se ejecutan aisladamente.

---

Sí, totalmente. Es un excelente ojo de control de calidad. Si mantienes la sección 4 con los valores antiguos, el PRD entrará en una **contradicción de contrato interno**. Los tokens de color, las especificaciones tipográficas y la descripción de las pantallas deben actualizarse globalmente para reflejar el enfoque de **Minimalismo Funcional** de la Fase 7.5.

Aquí tienes la versión completamente rediseñada y corregida de la **Sección 4** para que la reemplaces de forma íntegra en tu `PRD_learnMe.md`:

---

## 4. UI y diseño (Enfoque: Minimalismo Funcional)

El sistema visual abandona las abstracciones web tradicionales ("carditis", sombras pesadas, contenedores flotantes) y adopta la fidelidad estética de una aplicación de productividad local-first nativa. La interfaz se aplana para potenciar el estado de flujo cognitivo del usuario.

### 4.1 Tipografía Híbrida e Intencional
Se implementa un sistema tipográfico dual estricto para separar el contenido semántico de los metadatos analíticos y de control:
* **Cuerpo e Interfaz Primaria (Sans-Serif):** Geist Sans o Inter. Se configura con un `tracking-tight` leve en títulos para asegurar una estructura sólida y moderna.
* **Datos, Estados y Atajos (Monospace):** JetBrains Mono o SF Mono. Utilizada exclusivamente en tamaños reducidos (`text-xs`, `text-[11px]`) para contadores de tarjetas (ej. `12 new`), estados FSRS, etiquetas temporales (`ms`, `days`) y keybindings (ej. `⌘K`).

### 4.2 Tokens de tema refinados

```css
:root[data-theme="light"] {
  --bg: #FAFAF9;          /* Hueso mineral unificado */
  --surface: #F5F5F4;     /* Gris tenue para Sidebar y barras */
  --text: #1C1C1A;        /* Negro de alto contraste */
  --text-muted: #787876;  /* Gris neutro para subtítulos y atajos */
  --accent: #EA580C;      /* Naranja sutil para enfoque y acciones */
  --border: #E6E6E5;      /* Líneas estructurales milimétricas de 1px */
}

:root[data-theme="dark"] {
  --bg: #0B0B0D;          /* Gris profundo unificado */
  --surface: #141416;     /* Superficie sutil para Sidebar */
  --text: #ECEDEE;        /* Blanco tiza suave */
  --text-muted: #909094;  /* Gris atenuado para metadatos */
  --accent: #8B5CF6;      /* Morado eléctrico */
  --border: #222225;      /* Líneas estructurales oscuras de 1px */
}

```

### 4.3 Pantallas e Interacciones Críticas (v0.1 - CRUD Completo)

1.  **Home / Today (Centro de Control):** Título plano con tipografía Sans-Serif pesada. Listado de mazos en filas horizontales limpias divididas por bordes de 1px. Indicadores de estado compactos a la derecha (`new` en azul, `due` en esmeralda).
    * *Gestión (CRUD):* Cada fila de mazo expone un punto de interacción discreto (atenuado en reposo) que despliega un menú contextual para **Editar nombre** o **Eliminar mazo**. Al eliminar un mazo, se ejecuta una cascada atómica que purga sus cartas y logs asociados.
    * *Categorías:* La cabecera de cada sección de categoría permite invocar un flujo tipográfico en el lienzo principal para **Renombrar categoría**, **Cambiar token de color** o **Eliminar categoría** (con confirmación si contiene mazos activos).
2.  **Detalle de estudio (deck):** Lista tabular exhaustiva de todas las cartas indexadas en el mazo.
    * *Gestión (CRUD de tarjetas):* Cada fila de la tabla de cartas cuenta con dos acciones explícitas: **Editar tarjeta** (abre un panel plano in-situ para modificar las cadenas de texto del anverso y reverso) y **Eliminar tarjeta** (remueve permanentemente la carta y su historial de la base de datos local).
3.  **Sesión de Repaso (Modo Zen + Renderizado de Contenido):** Al iniciar el repaso, la barra lateral colapsa automáticamente. La tarjeta pierde bordes; el texto flota sobre el lienzo.
    * *Parser de Markdown Plano:* Los textos del anverso (`front`) y reverso (`back`) no se inyectan como texto crudo. El componente procesa sintaxis Markdown estándar para estilizar **negritas** (`**texto**`), *cursivas* (`*texto*`), listas con viñetas y bloques de código monospaciados inline (`` `código` ``), potenciando la legibilidad técnica del material de estudio. LaTeX y archivos multimedia quedan estrictamente fuera de alcance.
    * *Calificación:* Botones neutros en `--surface` que revelan su color semántico por interacción o mediante los keybindings del teclado (`1`, `2`, `3`, `4`). Físicas de resorte ultra cortas (`120ms - 150ms`).
4.  **Estadísticas Avanzadas:** Gráficas de Recharts estilizadas sin líneas de cuadrícula de fondo (`CartesianGrid`). Heatmap de consistencia compacto (`w-3 h-3 gap-[2px] rounded-[2px]`) donde los días inactivos igualan el color de fondo (`--bg`).
5.  **Settings / Paleta de Comandos Global (⌘K):** Interfaz flotante de búsqueda predictiva para navegar instantáneamente entre mazos, invocar la creación de un nuevo mazo (`⌘N`) o saltar a la configuración de exportación/importación del formato `.learnme`.

### 4.4 Adaptabilidad, Ajuste de Ventana y Layout Móvil

* **Estrategia Responsiva Local-First:** El sistema debe ser completamente funcional tanto en monitores de escritorio como en ventanas compactas o pantallas móviles emuladas bajo Tauri.
* **Comportamiento de Disposición (<768px):** Cuando el ancho del viewport disminuye por debajo del breakpoint `md (768px)`, la barra lateral izquierda (`aside`) se oculta por completo de forma automática a través de CSS reactivo.
* **Barra de Pestañas Inferior (Bottom Tab Bar):** En viewports reducidos (optimizando para el estándar de pruebas de `375×667`), la navegación se transfiere a un menú inferior flotante o plano adherido a la base de la pantalla. Este componente expone tres pestañas tipográficas minimalistas basadas en tokens mono (Hoy, Mazos, Settings), permitiendo la operabilidad táctil completa sin pérdida de área útil para la visualización de las tarjetas FSRS.

## 5. Metodología de desarrollo (lectura obligatoria para el agente)

### 5.1 Ciclo de cada fase

```
1. ENTRY GATE
   ├─ Agente lee la fase en este PRD
   ├─ Agente presenta el plan de pruebas (este documento detalla qué incluir)
   └─ Usuario aprueba el plan
2. FIXTURES & TESTS
   ├─ Agente crea fixtures (datos de entrada) y pruebas (con outputs esperados)
   ├─ Las pruebas DEBEN fallar inicialmente (rojo)
   └─ Usuario aprueba pruebas y fixtures
3. IMPLEMENTACIÓN
   ├─ Agente escribe código hasta que las pruebas pasen (verde)
   ├─ Agente NO modifica pruebas
   ├─ Si una prueba parece incorrecta, se marca `cannot test` con comentario `// CANNOT TEST: <razón>` y skip explícito (`it.skip` / `#[ignore]`)
   └─ Cobertura mínima por fase: 80% líneas, 75% ramas en código nuevo
4. EXIT GATE
   ├─ Suite completa de pruebas ejecutada (no sólo la de la fase)
   ├─ Reporte de fase generado (formato en §5.3)
   └─ Usuario aprueba para pasar a la siguiente fase
```

### 5.2 Plan de pruebas — formato requerido

Antes de tocar código de producción en una fase, el agente entrega un archivo `phase-N/test-plan.md`:

```markdown
# Plan de pruebas — Fase N: <nombre>

## Unit tests
### `<modulo>::<función>`
| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 1 | `{...}` | `Ok(...)` | happy path |
| 2 | `{...}` | `Err(InvalidSchema)` | error path |
| ... | | | |

## Integration tests
### `<flujo>`
- Setup: <fixture>
- Acción: <pasos>
- Assert: <outputs observables>

## E2E (si aplica)
- Escenario: <gherkin-like>
- Viewport(s): mobile (375x667), desktop (1280x800)

## Fixtures
- `fixtures/<name>.json` — descripción

## Pruebas marcadas `cannot test` (a revisar por usuario)
- ninguna inicialmente
```

### 5.3 Reporte de fase — formato requerido

Al cerrar la fase, el agente genera `phase-N/report.md`:

```markdown
# Reporte de fase N — <nombre>

## Cambios implementados
- <lista granular: archivos, módulos, decisiones>

## Cobertura de pruebas (suite completa)
- Líneas: X% (delta vs fase anterior: +Y%)
- Ramas: X%
- Tests totales: N (pasados: N, skipped/cannot-test: M, fallidos: 0)

## Pruebas marcadas `cannot test`
| Prueba | Razón | Acción sugerida al usuario |
|--------|-------|----------------------------|
| ... | ... | ... |

## Riesgos detectados
- <riesgo + mitigación propuesta>

## Blockers
- <ninguno | descripción y propuesta>

## Próxima fase: pre-requisitos
- <qué necesita el agente del usuario antes de continuar>
```

### 5.4 Reglas duras para el agente

- **Prohibido** modificar archivos en `**/*.test.ts`, `**/*.spec.ts`, `**/tests/**`, `**/fixtures/**` después de la aprobación del plan, salvo orden explícita con la frase **"autorizo modificar pruebas: <ruta>"**.
- **Prohibido** añadir `expect(true).toBe(true)` o equivalentes para forzar verde.
- **Prohibido** llamadas de red en código de producción que no sean opt-in y explícitas.
- **Obligatorio** ejecutar `npm test` y `cargo test` antes de cerrar fase.

---

## 6. Fases del proyecto

### Fase 0 — Bootstrap y andamiaje

**Objetivo**: estructura del proyecto, CI local, scripts de test, sin lógica de dominio.

**Entry Gate**:
- Usuario aprueba este PRD.
- Tauri 2 + Rust toolchain disponibles en la máquina.

**Entregables**:
- Estructura monorepo: `src/` (React), `src-tauri/` (Rust), `tests/`, `fixtures/`, `docs/`.
- `package.json`, `Cargo.toml`, `tauri.conf.json`, `vite.config.ts`, `tailwind.config.ts`, `tsconfig.json` (strict).
- Scripts: `test`, `test:e2e`, `test:rust`, `test:all`, `coverage`.
- GitHub Actions opcional / script local `./scripts/ci.sh` que corre lint + types + tests.
- Hello world Tauri que abre ventana y muestra "learnMe".

**Plan de pruebas mínimo**:
- 1 test TS: `import { app } from '@/app'` compila y exporta.
- 1 test Rust: `#[test] fn smoke() { assert!(true); }` (sí, en esta fase smoke está permitido).
- 1 E2E: app abre, título visible.

**Exit Gate**:
- `test:all` pasa.
- Reporte fase 0 generado.

---

### Fase 1 — Persistencia y schema

**Objetivo**: SQLite + migraciones + repositorios para `Category`, `Study`, `Card`, `ReviewLog`. Sin UI.

**Entry Gate**: Fase 0 aprobada.

**Entregables**:
- Migraciones (`migrations/0001_init.sql`) con tablas:
  - `categories(id, name, color, created_at, updated_at)`
  - `studies(id, category_id, method, name, payload_json, created_at, updated_at)`
  - `cards(id, deck_id, front, back, tags_json, stability, difficulty, due, last_review, state, reps, lapses)`
  - `review_logs(id, card_id, grade, reviewed_at, prev_stability, prev_difficulty, prev_due)`
  - `settings(key, value)`
- Repositorios Rust con API tipada.
- Comandos Tauri expuestos: `category_create`, `category_list`, `study_create`, etc.

**Plan de pruebas (debe presentar el agente antes de codear)**:

Ejemplo de la tabla que se espera:

| # | Función | Input | Output esperado |
|---|---------|-------|-----------------|
| 1 | `category_repo.create` | `{name: "Idiomas"}` | `Ok(Category { id: <uuid>, name: "Idiomas", ... })` |
| 2 | `category_repo.create` | `{name: ""}` | `Err(ValidationError::EmptyName)` |
| 3 | `category_repo.list` | (DB con 3 categorías) | `Ok(vec.len() == 3)` ordenado por `created_at desc` |
| 4 | `study_repo.create` | `{category_id: <existente>, method:"anki", name:"X"}` | `Ok(Study {...})` |
| 5 | `study_repo.create` | `{category_id: <inexistente>, ...}` | `Err(ForeignKeyViolation)` |
| 6 | `card_repo.bulk_insert` | 100 cartas | `Ok(100)` y consulta posterior devuelve 100 |
| 7 | Migración idempotente | aplicar 2 veces | sin error, schema igual |

**Fixtures**: `fixtures/db/empty.sqlite`, `fixtures/db/seeded.sqlite`.

**Exit Gate**: cobertura ≥80% en `src-tauri/src/repo/**`, suite completa verde.

---

### Fase 2 — Algoritmo FSRS y motor de repaso (sin UI)

**Objetivo**: integrar `rs-fsrs`, exponer `next_card(deck_id)` y `record_review(card_id, grade)`.

**Entry Gate**: Fase 1 aprobada.

**Entregables**:
- Wrapper sobre `rs-fsrs` con parámetros default (retention objetivo 0.9).
- Lógica de selección de "carta siguiente" (prioridad: learning → due reviews → new, con cap configurable de cartas nuevas/día).
- Persistencia de cada review en `review_logs`.

**Plan de pruebas**:

| # | Escenario | Input | Output esperado |
|---|-----------|-------|-----------------|
| 1 | Carta nueva, grade `Good` | `Card { state:new, ... }` + grade 3 | `state == learning`, `due` futuro, `reps == 1` |
| 2 | Carta `Again` | review repetido con grade 1 | `lapses += 1`, `state == relearning` |
| 3 | Determinismo | mismo seed, mismas reviews | misma trayectoria de `due` (snapshot con `insta`) |
| 4 | `next_card` con 0 due, 0 new | deck vacío de pendientes | `Ok(None)` |
| 5 | `next_card` mezcla | 2 due + 3 new, cap=2 new | devuelve due antes que new, total ≤ cap |
| 6 | Forecast | calcular cartas due próximos 7 días | array de 7 enteros |

**Fixtures**: `fixtures/cards/100-cards-mixed-states.json`, `fixtures/reviews/sequence-a.json`.

**Exit Gate**: snapshots de FSRS estables, cobertura ≥80%.

---

### Fase 3 — Importación / exportación de decks Anki (`.json`)

**Entry Gate**: Fase 2 aprobada.

**Entregables**:
- JSON Schema oficial (`schemas/anki-deck.v1.json`) compartido entre TS (Zod) y Rust (serde + jsonschema).
- Comando `import_anki_deck(path)` con dedupe en re-import.
- Comando `export_anki_deck(deck_id)`.
- Comando "add card manually" para crecer un deck a mano.

**Plan de pruebas**:

| # | Caso | Input | Output esperado |
|---|------|-------|-----------------|
| 1 | Import válido | `fixtures/decks/spanish-a2-valid.json` | `Ok({ inserted: 50, skipped: 0 })` |
| 2 | Schema inválido (sin `method`) | `fixtures/decks/missing-method.json` | `Err(SchemaError)` con path JSON Pointer |
| 3 | Re-import con duplicados | mismo archivo dos veces | 2ª: `{ inserted: 0, skipped: 50 }`; estado FSRS preservado |
| 4 | Re-import con nuevas + repetidas | archivo con 60 cartas (50 viejas + 10 nuevas) | `{ inserted: 10, skipped: 50 }` |
| 5 | Export → Import roundtrip | exportar deck → importar como nuevo | mismas cartas, estado FSRS idéntico (snapshot) |
| 6 | Add manual | front/back válidos | carta agregada, `state == new` |
| 7 | Add manual | front vacío | `Err(ValidationError)` |
| 8 | Archivo no JSON | binario | `Err(ParseError)` con mensaje claro |
| 9 | JSON gigante (10k cartas) | benchmark | import < 5s en hardware de referencia |

**Fixtures**: carpeta `fixtures/decks/` con casos válidos, malformados, edge cases (unicode, markdown con imágenes referenciadas que aún no se soportan → warning).

**Exit Gate**: roundtrip determinista, suite completa verde.

---

### Fase 4 — UI: tema, categorías y estudios (sin sesión de repaso aún)

**Entry Gate**: Fase 3 aprobada.

**Entregables**:
- Layout base con bottom-tabs (mobile) / sidebar (desktop).
- Toggle de tema claro/oscuro con persistencia en `settings`.
- CRUD Categorías.
- Vista de detalle de estudio: listar cartas, botón "Importar `.json`", botón "Agregar carta manual".

**Plan de pruebas**:

- **Unit (Vitest + Testing Library)**:
  - Render de `<CategoryList />` con prop vacía → empty state.
  - Render con 3 categorías → 3 ítems.
  - Toggle de tema cambia `data-theme` en `<html>`.
- **E2E (Playwright)**:
  - Crear categoría desde UI → aparece en lista.
  - Importar deck desde diálogo → cartas visibles.
  - Layout responsive: viewport 375x667 muestra bottom-tabs, 1280x800 muestra sidebar.
  - Snapshot visual de pantallas clave (light + dark) — comparación con tolerancia.

**Exit Gate**: tests visuales aprobados por usuario (revisión humana de snapshots).

---

### Fase 5 — UI: sesión de repaso

**Entry Gate**: Fase 4 aprobada.

**Entregables**:
- Pantalla de carta con animación de reveal.
- Botones `Again` / `Hard` / `Good` / `Easy` mapeados a grades FSRS 1/2/3/4.
- Atajos de teclado (1-4, espacio para reveal).
- Indicador de progreso (X/Y cartas en sesión).
- Mensaje "sesión completa" cuando no quedan cartas.

**Plan de pruebas**:

- **E2E**:
  - Sesión completa de 10 cartas: cada grade actualiza estado en DB (verificación vía comando Tauri post-test).
  - Atajos de teclado funcionan.
  - Salir a mitad de sesión y volver: continúa donde quedó.
- **Unit**: hook `useReviewSession` con mock del backend devuelve secuencia correcta.

**Exit Gate**: usuario confirma UX en sesión real con un deck de prueba.

---

### Fase 6 — Estadísticas

**Entry Gate**: Fase 5 aprobada.

**Entregables**:
- Comando `stats(study_id)` que devuelve: retention rolling 30 días, cartas por estado, heatmap (365 días), forecast 7 días.
- Vista de stats con gráficos (recharts).

**Plan de pruebas**:

| # | Input | Output esperado |
|---|-------|-----------------|
| 1 | Deck con 0 reviews | `{ retention: null, heatmap: [0...], forecast: [...] }` |
| 2 | Deck con 100 reviews (80 success) | `retention ≈ 0.80 ± 0.01` |
| 3 | Heatmap | suma de bucket día == reviews ese día |

**Exit Gate**: gráficos renderizan en light y dark.

---

### Fase 7 — Export/Import de sesión completa (`.learnme`)

**Entry Gate**: Fase 6 aprobada.

**Entregables**:
- Schema Zod + serde para el formato `.learnme` (versionado, con checksum SHA-256).
- Comando Tauri `session_export(path)` → produce archivo `.learnme` JSON determinista.
- Comando Tauri `session_import(path)` → importación merge con resolución de conflictos.
- Variante `session_import` modo `replace` (vacía DB destino antes de importar).
- UI en Settings: botones "Exportar sesión" / "Importar sesión" con feedback de progreso.
- Errores controlados: `ChecksumMismatch`, `UnsupportedVersion`, `OrphanEntity`, `ValidationError`.

**Especificación del formato**: ver §2.5 (Envelope, checksum, payload, compatibilidad, conflictos).

**Plan de pruebas (referencia — agente presenta el test-plan.md completo antes de codear)**:

| # | Caso | Esperado |
|---|------|----------|
| 1 | Export → import en DB vacía (merge) | DB idéntica al origen |
| 2 | Export determinista | exportar dos veces consecutivas → mismo `checksum` |
| 3 | Import en DB con datos existentes (merge) | UUID idempotence + dedup semántico aplicados |
| 4 | Import merge con cartas en conflicto | progreso más avanzado preservado por regla `reps`+`lastReviewed` |
| 5 | `.learnme` con checksum corrupto | `Err(ChecksumMismatch)` sin modificar DB |
| 6 | `version > 1` (futuro) | `Err(UnsupportedVersion)` |
| 7 | FK rota en payload (carta sin estudio) | `Err(OrphanEntity)`, rollback total |
| 8 | Import modo `replace` | DB destino vacía post-import, luego restaurada |
| 9 | reviewLogs huérfanos (cardId ausente) | `Err(OrphanEntity)` |
| 10 | Roundtrip con 500 cartas + 2000 review_logs | datos FSRS idénticos post-ciclo |

**Exit Gate**: roundtrip en Linux verificado por usuario; snapshot visual de UI de exportación/importación aprobado.

---

## 6.7.5. Fase 7.5: Refinamiento UI/UX (Minimalismo Funcional) y Amortización de Deuda

### Alcance Funcional e Interfaz Inmersiva
Esta fase intermedia detiene el avance hacia el empaquetado final para unificar el sistema de diseño visual bajo el principio de *Minimalismo Funcional*, optimizar la velocidad de interacción del usuario (UX de alta productividad) y liquidar vulnerabilidades de prueba expuestas en el backend.

#### A. Sistema de Diseño y Tokens de Color Refinados
Se abandona el uso de componentes genéricos web flotantes ("carditis") en favor de una estructura plana infinita basada en un lienzo unificado, líneas divisorias de 1px (`border-[#E6E6E5]` o equivalente oscuro) y espaciado en blanco generoso.
* **Modo Claro (Light):** Fondo principal (`--bg`) fijado en `#FAFAF9` (Hueso mineral); superficies secundarias (`--surface`) en `#F5F5F4` (Gris tenue).
* **Modo Oscuro (Dark):** Fondo principal (`--bg`) fijado en `#0B0B0D` (Gris profundo); superficies secundarias (`--surface`) en `#141416` (Superficie sutil).
* **Tipografía Híbrida:** * *Interfaz y cuerpo:* Geist Sans o Inter con tracking ajustado (`tracking-tight`) en títulos.
    * *Metadatos, contadores FSRS y atajos:* JetBrains Mono o SF Mono en tamaños reducidos (`text-xs`, `text-[11px]`).

#### B. UX de Alta Productividad y Modo Zen
* **Paleta de Comandos Flotante (⌘K / Ctrl+K):** Implementación de una interfaz central flotante y tipográfica pura. Al invocarse, abre un input reactivo controlado que modifica el estado global de navegación (`appStore.ts`) para saltar entre mazos, invocar configuraciones o disparar importaciones sin usar el ratón.
* **Sesión de Repaso:** Al iniciar el repaso, la barra lateral se contrae automáticamente de forma armónica hacia la izquierda. Las tarjetas de estudio flotan directamente sobre el lienzo sin bordes ni sombras pesadas. Las transiciones entre estados FSRS y volteo de tarjetas se ejecutan mediante físicas de resorte ultra cortas limitadas estrictamente entre `120ms` y `150ms`.
* **Rediseño de Analíticas (Recharts):** Remoción absoluta de las líneas de cuadrícula de fondo (`CartesianGrid`). El Heatmap de consistencia pasará a usar celdas compactas (`w-3 h-3 gap-[2px] rounded-[2px]`) donde los días sin actividad adoptan el color exacto del fondo (`--bg`), eliminando bloques vacíos marcados.

### Alcance Técnico y Amortización de Deuda (Backend Rust)
1.  **Aislamiento de la Trampa de Pruebas E2E:** Se modificará el comando Tauri `session_import_cmd` para encapsular el parámetro `simulateError` de manera exclusiva bajo compilación condicional de pruebas (`#[cfg(test)]`). El binario compilado para producción final quedará completamente limpio de este flag de fallo forzado.
2.  **Saneamiento de la Especificación del Checksum:** Se oficializa la enmienda estructural del algoritmo de integridad del formato `.learnme`. El cálculo canónico del hash SHA-256 en Rust y Zod excluye de forma deliberada el campo `generatedAt` para neutralizar la variabilidad temporal y garantizar el determinismo estricto de la suite de pruebas.

### Impacto en la Suite de Pruebas y Estrategia de Control
* **Fallo Controlado de la Línea Base Estética:** Debido al cambio de tokens globales de color, fuentes y diseño de bordes, los 6 snapshots visuales existentes (`4` de Fase 4 y `2` de Fase 6) se pondrán inmediatamente en **ROJO**. El criterio de salida exige la aprobación humana manual para realizar el *re-baselining* de las imágenes testigo.
* **Nuevas Pruebas Unitarias (Frontend):** Se añadirán aserciones en Vitest para validar el ciclo de vida del modal ⌘K, la captura correcta del foco del teclado y el filtrado tipográfico de elementos de la tienda.

### Criterios de Salida de la Fase 7.5
- [ ] 100% de la suite de pruebas heredada (188 tests funcionales) pasa en verde tras la refactorización de estilos.
- [ ] Pruebas unitarias para la Paleta de Comandos (⌘K) en verde con cobertura superior al piso reglamentario (80% líneas / 75% ramas).
- [ ] Compilador de Rust libre de warnings de importaciones huérfanas en `phase7_unit.rs`.
- [ ] Binario de producción compilado exitosamente sin la exposición del parámetro `simulateError`.
- [ ] Aprobación humana y regeneración de los 6 snapshots visuales bajo la nueva identidad estética del sistema.

---

## 6.8. Fase 8: Estabilización del PRD, Cierre de Brechas de Ciclo y Distribución Nativa

Esta fase de cierre se divide en dos bloques secuenciales e innegociables para liquidar la deuda técnica acumulada, satisfacer los criterios globales de aceptación de la v0.1 y generar los distribuibles de producción.

### 6.8.A. Fase 8.A: Estabilización y Cierre de Brechas del PRD

#### 1. Implementación de Endpoints y Persistencia en Rust (Capa de Datos)
Se implementarán y blindarán mediante pruebas unitarias aisladas en `src-tauri/src/repo/` los comandos IPC de mutación destructiva y actualización faltantes bajo transacciones seguras de SQLite:
* `update_category(id: Uuid, name: String, color: Option<String>) -> Result<()>`
* `delete_category(id: Uuid) -> Result<()>` (Aplica `ON DELETE CASCADE` o validación de mazo huérfano).
* `delete_deck(id: Uuid) -> Result<()>` (Purga en cascada nativa en SQLite de cartas y logs de repaso).
* `update_card(id: Uuid, front: String, back: String, tags: Vec<String>) -> Result<()>`
* `delete_card(id: Uuid) -> Result<()>` (Remueve la entidad y sus `review_logs` vinculados de forma atómica).

#### 2. Refinamiento en Frontend (TypeScript y Estilos)
* **Integración de Markdown:** Substitución del renderizado crudo en `ReviewCard.tsx` por un parser/compilador de Markdown plano (`react-markdown` o equivalente optimizado) que soporte negritas, cursivas, listas y bloques mono.
* **Layout Responsivo Nivel Componente:** Maquetación e inyección de la barra inferior de pestañas (`Bottom Tab Bar`) controlada por media queries de Tailwind CSS, garantizando el renderizado sin desbordamientos en viewports reducidos.
* **Controles de Interfaz CRUD:** Inclusión de botones y acciones tipográficas estilizadas bajo el minimalismo funcional en `Home / Today`, `StudiesView` y la tabla de administración de cartas para disparar las ediciones y borrados.

#### 3. Criterios de Salida de la Fase 8.A
- [ ] Comandos de Rust compiling y verificados con cobertura unitaria aislada >85%.
- [ ] Pruebas unitarias en Vitest validando que el parser de Markdown convierte correctamente etiquetas elementales a HTML.
- [ ] Suite completa de integración relacional verificando que el borrado de un mazo limpia el 100% de sus registros históricos en las tablas dependientes.

### 6.8.B. Fase 8.B: Integración Nativa con tauri-driver y Distribución

#### 1. Amortización del Riesgo Persistente de la Fase 0
Se integra formalmente `tauri-driver` y la configuración de visualización virtual (`Xvfb` en entornos Linux del CI). La suite de pruebas E2E de Playwright abandona de manera definitiva el servidor de desarrollo aislado de Vite (`localhost:1420` con `mock-ipc.ts`) y pasa a **ejecutarse directamente contra el binario Tauri real compilado en Rust**.
* Se añade una prueba E2E de fin a fin que llama a los comandos nativos reales, lee archivos físicos del disco del sistema operativo y valida los cambios directamente sobre el archivo de base de datos de producción. La brecha de simulación e IPC mocking queda liquidada al 100%.

#### 2. Compilación Final y Optimización de Producción
* Saneamiento final de advertencias del compilador de Rust (*rustc*) y desinfección estática mediante `cargo clippy`.
* Ejecución de los empaquetadores nativos de Tauri para consolidar los instaladores estables distribuidos (ej. `.deb`/`.AppImage` para Linux, `.dmg` para macOS).

#### 3. Criterios de Salida de la Fase 8.B y Cierre Global de v0.1
- [ ] 100% de las pruebas automatizadas (Unitarias, Integración y E2E nativas) pasan en verde con **CERO fallos y CERO advertencias de linter/compilación**.
- [ ] Verificación automatizada en Playwright del Layout responsivo en el viewport estricto de `375×667`.
- [ ] Pruebas de caja negra con `tcpdump` certifican que la aplicación genera 0 llamadas de red durante procesos de estudio o importación.
- [ ] Binarios compilados listos para distribución local-first empaquetados en la carpeta `target/release/bundle/`.

---

## 7. Estructura de carpetas

```
learnme/
├── CLAUDE.md                    # instrucciones operativas para el agente
├── PRD.md                       # este documento
├── package.json
├── Cargo.toml
├── tauri.conf.json
├── src/                         # React
│   ├── app/
│   ├── features/
│   │   ├── categories/
│   │   ├── studies/
│   │   └── methods/
│   │       └── anki/            # UI específica de Anki
│   ├── shared/
│   └── styles/
├── src-tauri/
│   ├── src/
│   │   ├── core/                # trait StudyMethod, errores, tipos
│   │   ├── repo/                # repositorios SQLite
│   │   ├── methods/
│   │   │   └── anki/            # implementación Anki + FSRS
│   │   ├── commands/            # handlers Tauri
│   │   └── main.rs
│   └── migrations/
├── schemas/                     # JSON Schemas compartidos
├── fixtures/
│   ├── db/
│   ├── decks/
│   ├── cards/
│   └── reviews/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/
│   ├── phase-0/
│   ├── phase-1/
│   └── ...                      # test-plan.md + report.md por fase
└── scripts/
    ├── ci.sh
    └── coverage.sh
```

---

## 8. CLAUDE.md (resumen operativo que se entregará junto al PRD)

El archivo `CLAUDE.md` en la raíz del repo debe contener, como mínimo:

```markdown
# Instrucciones del agente para learnMe

## Reglas inviolables
1. No modificar archivos en `tests/`, `**/*.test.ts`, `**/*.spec.ts`, `fixtures/`
   salvo orden explícita: "autorizo modificar pruebas: <ruta>".
2. No introducir llamadas de red en código de producción.
3. Antes de codear una fase, presentar `docs/phase-N/test-plan.md` y esperar aprobación.
4. Al cerrar una fase, ejecutar `./scripts/ci.sh` (suite completa) y generar
   `docs/phase-N/report.md`.
5. Pruebas no implementables: marcar con `// CANNOT TEST: <razón>` y `it.skip` / `#[ignore]`.
   Listarlas en el reporte de fase. NUNCA borrarlas.

## Comandos
- `npm run test`         — Vitest unit
- `npm run test:e2e`     — Playwright
- `cargo test`           — Rust
- `./scripts/ci.sh`      — todo + cobertura
- `npm run tauri dev`    — desarrollo

## Flujo por fase
1. Lee `PRD.md` la sección de la fase actual.
2. Escribe `docs/phase-N/test-plan.md`.
3. Espera "OK plan fase N".
4. Crea fixtures y pruebas (rojo).
5. Espera "OK pruebas fase N".
6. Implementa hasta verde.
7. Ejecuta `./scripts/ci.sh`.
8. Escribe `docs/phase-N/report.md`.
9. Espera "OK fase N" antes de continuar.
```

---

## 9. Riesgos identificados

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| FSRS crate cambia API | Media | Alto | Pin de versión, wrapper interno aísla la dependencia |
| Determinismo del `.learnme` zip | Alta | Medio | Forzar mtime fijo, orden de archivos canónico, sin compresión variable |
| E2E flaky en Tauri | Alta | Medio | Usar `tauri-driver`, retry con `Playwright`, evitar timeouts arbitrarios |
| Cobertura no representa calidad | Media | Medio | El umbral es piso, no techo; el plan de pruebas se aprueba por contenido, no por %  |
| Re-import dedupe basado en `front+back` colisiona con cartas legítimamente parecidas | Baja | Bajo | Documentar regla; permitir override manual al usuario en UI futura |

---

## 10. Fuera de alcance v0.1

- Sincronización en tiempo real entre dispositivos.
- Versiones Windows, iOS, Android (la arquitectura las permite, no se distribuyen).
- Métodos de estudio distintos de Anki.
- Imágenes/audio embebidos en cartas (sólo texto + markdown plano).
- LaTeX rendering (markdown plano por ahora).
- Cuentas de usuario, multi-perfil.

---

## 11. Criterios de aceptación globales de v0.1

- [ ] Usuario importa un `.json` de 500+ cartas en <3s en hardware moderno.
- [ ] Sesión de repaso usable con sólo teclado.
- [ ] Tema claro/oscuro alternables sin reinicio, persistencia entre sesiones.
- [ ] Layout responsive en viewport 375×667.
- [ ] Export → Import en otra máquina restaura la sesión 1:1 (hash de DB tras roundtrip idéntico).
- [ ] Cero llamadas de red observables con `tcpdump` durante una sesión completa.
- [ ] Suite completa de pruebas: 0 fallos, `cannot test` revisadas y aprobadas.
- [ ] Cobertura global ≥ 80% líneas, ≥ 75% ramas.
- [ ] Binarios firmados para Linux y macOS.

---

*Fin del PRD v0.1*
