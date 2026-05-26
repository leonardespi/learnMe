# Plan de pruebas — Fase 8.A.2: Refinamiento Frontend (UI/UX)

## Alcance

Refactor visual puro: migración de inline `style={}` a clases Tailwind CSS v4 siguiendo el sistema de diseño "Minimalismo Funcional". No se introduce lógica nueva, no se modifican tipos, store ni IPC. El contrato observable por los tests (data-testid, comportamiento de clics, navegación) no cambia.

Esta fase NO cubre: 8.A.1 (endpoints Rust CRUD), 8.B (tauri-driver E2E), ni Markdown rendering (esos son sub-tareas separadas).

## Unit tests

### Regresión de suite existente (Vitest)

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 1 | `npm run test` tras refactor | 0 failing, 0 errores de tipos | regresión |
| 2 | `npm run typecheck` tras refactor | 0 errores TypeScript strict | compilación |
| 3 | `npm run lint` tras refactor | 0 warnings ESLint | estilo |

### `ThemeToggle` — render y click
| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 1 | Render con `data-theme="light"` | `data-testid="btn-theme-toggle"` presente en DOM | happy path |
| 2 | Click en toggle | `document.documentElement.dataset.theme` cambia | comportamiento |

### `CommandPalette` — filtrado y navegación
| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 1 | `open=true`, query vacío | todos los `data-testid="palette-item"` visibles | happy path |
| 2 | query `"rust"` | solo items cuyo name incluye "rust" | filtrado |
| 3 | click overlay | `data-testid="command-palette"` desaparece | cierre |

### `CategoryList` — estados
| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 1 | `categories=[]` | `data-testid="category-empty-state"` visible | empty state |
| 2 | `categories=[{id,name}]` | N × `data-testid="category-item"` | happy path |
| 3 | click en item | `onSelect(id)` llamado | interacción |

### `StudyDetail` — render de cartas
| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 1 | `cards=[]` | `data-testid="card-empty-state"` visible | empty state |
| 2 | `cards=[…]` | N × `data-testid="card-item"` | happy path |
| 3 | click `btn-import` | `onImport()` llamado | interacción |

### `ReviewCard` — fases
| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 1 | `phase="front"` | `data-testid="card-front"` visible, `card-back` ausente | front phase |
| 2 | `phase="back"` | `data-testid="card-back"` y `grade-buttons` visibles | back phase |
| 3 | click grade button grade=3 | `onGrade(3)` llamado | grading |

### `ReviewSession` — teclado
| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 1 | keydown `Space` en phase=front | `reveal()` llamado | keyboard |
| 2 | keydown `3` en phase=back | `grade(3)` llamado | keyboard |
| 3 | phase=complete | `data-testid="session-complete"` visible | complete |

## Integration tests

### Escenario: navegación completa categories → study → review
- **Setup**: mock IPC retorna 1 categoría, 1 study, 2 cartas
- **Acción**: render `AppLayout`, click categoría → click study → click "Iniciar repaso"
- **Assert**: `data-testid="review-session"` visible; `data-testid="sidebar"` display=none (zen mode ≥ 0px width)

### Escenario: command palette abre y cierra
- **Setup**: render `AppLayout`
- **Acción**: `Ctrl+K` → escribir query → `Escape`
- **Assert**: palette aparece con items filtrados, desaparece tras Escape

## E2E tests (no aplica en esta fase)

E2E nativo con tauri-driver se aborda en Fase 8.B. Esta fase solo valida la suite Vitest existente.

## Fixtures requeridas

Ninguna nueva. Las fixtures existentes en `fixtures/` cubren los tests de regresión.

## Snapshots

No se introducen snapshots visuales en esta fase (requeriría Playwright visual, que es Fase 8.B).

## Pruebas marcadas `cannot test` (al iniciar la fase)

- ninguna

## Criterios de salida de esta fase

- [ ] `npm run test` → 0 failing (regresión completa)
- [ ] `npm run typecheck` → 0 errores
- [ ] `npm run lint` → 0 warnings
- [ ] Todos los `data-testid` originales preservados en el DOM
- [ ] Suite completa (`./scripts/ci.sh`) verde
- [ ] Inspección manual: sidebar responsive oculta en <768px, visible en ≥768px
- [ ] Inspección manual: zen mode colapsa sidebar en review-session
- [ ] Inspección manual: grade buttons muestran borde inferior semántico en hover/active
