# Plan de pruebas — Fase 5: UI — Sesión de repaso

## Alcance

Cubre la pantalla completa de sesión de repaso Anki: visualización de carta (front/reveal/back), botones de grading (Again/Hard/Good/Easy → FSRS 1-4), atajos de teclado (Espacio=reveal, 1-4=grade), indicador de progreso (X/Y), y mensaje de sesión completa. **No cubre** estadísticas (Fase 6), export/import sesión (Fase 7), imágenes/audio en cartas (fuera de alcance v0.1), ni modificaciones al algoritmo FSRS. Los comandos Tauri `next_card` y `record_review` ya existen (Fase 2) y **no se modifican**.

---

## Unit tests

### `features/methods/anki/hooks/useReviewSession`

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 1 | mount con `deckId="d1"`, mock `next_card` retorna `CardA` | `{ currentCard: CardA, phase: 'front', progress: { done: 0, total: 1 } }` en primer render | happy path |
| 2 | estado inicial = `phase:'front'`, llamar `reveal()` | `phase` cambia a `'back'`, sin llamadas a `record_review` | state transition |
| 3 | `phase:'back'`, llamar `grade(3)`, mock `next_card` retorna `CardB` | `record_review` llamado con `{ cardId: CardA.id, grade: 3 }`, `currentCard === CardB`, `phase === 'front'`, `progress.done === 1` | grade avanza |
| 4 | `phase:'back'`, llamar `grade(1)`, mock `next_card` retorna `null` | `phase === 'complete'`, `currentCard === null` | fin de sesión |
| 5 | `phase:'front'`, llamar `grade(3)` | `record_review` NO llamado, `phase` sigue `'front'` | guard pre-reveal |
| 6 | mount con `deckId="d2"`, mock `next_card` retorna `null` inmediatamente | `phase === 'complete'` en primer render | deck sin pendientes |
| 7 | mount, `next_card` retorna 3 cartas en secuencia, graduar todas | `progress.done` va de 0→1→2→3, `progress.total === 3` al inicio | progreso incremental |

### `features/methods/anki/ReviewCard`

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 8 | `<ReviewCard card={CardA} phase="front" onReveal={fn} onGrade={fn} />` | `CardA.front` visible; `CardA.back` NO visible (hidden/absent); 0 botones de grading | render front |
| 9 | `<ReviewCard card={CardA} phase="back" onReveal={fn} onGrade={fn} />` | `CardA.front` visible; `CardA.back` visible; 4 botones: "Again", "Hard", "Good", "Easy" | render back |
| 10 | `phase="front"`, click botón "Show Answer" / área de reveal | `onReveal()` llamado exactamente 1 vez | interacción reveal |
| 11 | `phase="back"`, click "Again" | `onGrade(1)` llamado | grade Again |
| 12 | `phase="back"`, click "Hard" | `onGrade(2)` llamado | grade Hard |
| 13 | `phase="back"`, click "Good" | `onGrade(3)` llamado | grade Good |
| 14 | `phase="back"`, click "Easy" | `onGrade(4)` llamado | grade Easy |

### `features/methods/anki/ReviewSession` — atajos de teclado

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 15 | `phase='front'`, keydown `Space` | `reveal()` disparado (fase cambia a `'back'`) | shortcut reveal |
| 16 | `phase='back'`, keydown `'1'` | `grade(1)` disparado | shortcut Again |
| 17 | `phase='back'`, keydown `'2'` | `grade(2)` disparado | shortcut Hard |
| 18 | `phase='back'`, keydown `'3'` | `grade(3)` disparado | shortcut Good |
| 19 | `phase='back'`, keydown `'4'` | `grade(4)` disparado | shortcut Easy |
| 20 | `phase='front'`, keydown `'1'` | `grade` NO disparado, fase sigue `'front'` | guard tecla antes de reveal |
| 21 | `phase='complete'`, keydown `Space` o `'3'` | ninguna acción disparada | guard en sesión completa |

---

## Integration tests

### Escenario: Sesión completa 3 cartas (mock backend en memoria)

- **Setup**: DB in-memory Vitest con hook `useReviewSession`; mock de `invoke`:
  - `next_card` retorna `Card1` → `Card2` → `Card3` → `null` en llamadas sucesivas
  - `record_review` retorna `RecordReviewResult` válido cada vez
- **Acción**: montar hook → `reveal()` → `grade(3)` × 3 veces
- **Assert**:
  - `record_review` llamado exactamente 3 veces con `grade=3`
  - `next_card` llamado exactamente 4 veces
  - `phase === 'complete'` al final
  - `progress.done === 3` al final

### Escenario: Interrupción y reanudación de sesión

- **Setup**: mock con 5 cartas; graduar 2 (`grade(3)` × 2)
- **Acción**: desmontar el hook (navegar fuera); remontar con mismo `deckId`
- **Assert**:
  - `next_card` llamado de nuevo al remontar
  - `progress.done === 0` (nueva sesión, conteo reinicia)
  - mock retorna `Card3` como primera carta (las 2 gradeadas tienen `due` futuro en mock)

---

## E2E tests

### Escenario: Sesión completa de 10 cartas con teclado

- **Viewport(s)**: desktop (1280×800)
- **Pasos**:
  1. Importar `fixtures/decks/review-session-10.json` (10 cartas nuevas) vía UI
  2. Navegar a detalle del estudio importado
  3. Click "Iniciar repaso" (o equivalente)
  4. Para cada carta: verificar que front visible y back oculto → pulsar `Space` → verificar back visible y 4 botones → pulsar `3` (Good)
  5. Repetir 10 veces
  6. Verificar pantalla "sesión completa"
- **Assert**:
  - `[data-testid="session-complete"]` visible al final
  - `progress-indicator` muestra `10/10` al terminar (o `0` cartas restantes)
  - Via `invoke('card_list_by_deck', { deckId })`: 0 cartas con `state === 'new'`

### Escenario: Atajos de teclado

- **Viewport(s)**: desktop (1280×800)
- **Pasos**:
  1. Iniciar sesión con deck de al menos 1 carta
  2. Verificar `phase='front'`; pulsar `Space`
  3. Verificar `phase='back'`; pulsar `3`
  4. Verificar que se avanza (siguiente carta o complete)
- **Assert**:
  - Tras `Space`: back text visible, botones de grading presentes
  - Tras `3`: `next_card` invocado (nueva carta o complete)

### Escenario: Salir a mitad y volver

- **Viewport(s)**: desktop (1280×800)
- **Pasos**:
  1. Iniciar sesión con deck de 5 cartas nuevas
  2. Graduar 2 cartas (Good)
  3. Navegar a "Categorías" (sin terminar sesión)
  4. Volver al detalle del mismo estudio
  5. Iniciar repaso de nuevo
- **Assert**:
  - Segunda sesión inicia correctamente (no crash)
  - Progress total ≤ 3 (las 2 gradeadas están en `due` futuro, no vuelven a aparecer)
  - Estado DB: 2 cartas en `state='learning'`, resto `state='new'`

### Escenario: Deck sin cartas pendientes

- **Viewport(s)**: desktop (1280×800)
- **Pasos**:
  1. Crear deck vacío o con todas las cartas en `due` futuro
  2. Click "Iniciar repaso"
- **Assert**:
  - `[data-testid="session-complete"]` visible inmediatamente (o botón "Iniciar repaso" deshabilitado con texto "Sin cartas pendientes")

---

## Fixtures requeridas

- `fixtures/decks/review-session-10.json` — deck Anki con 10 cartas nuevas (front/back en inglés/español), usado en E2E sesión completa y salir/volver
- `fixtures/decks/review-session-5.json` — deck Anki con 5 cartas nuevas, usado en E2E salir/volver

---

## Snapshots (si aplica)

- Ningún snapshot visual nuevo en esta fase (Fase 4 cubre layout base). Los E2E validan comportamiento funcional, no apariencia.

---

## Pruebas marcadas `cannot test` (al iniciar la fase)

- ninguna

---

## Criterios de salida de esta fase

- [ ] 21 unit tests pasan (tests #1–#21)
- [ ] 2 integration tests pasan
- [ ] 4 E2E tests pasan
- [ ] Cobertura ≥ 80% líneas / 75% ramas en `src/features/methods/anki/**` y `src/store/appStore.ts` (si se amplía)
- [ ] Suite completa (`./scripts/ci.sh`) verde
- [ ] Usuario confirma UX en sesión real con deck de prueba (criterio PRD §6 Fase 5 exit gate)
