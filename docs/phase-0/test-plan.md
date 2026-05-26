# Plan de pruebas — Fase 0: Bootstrap y andamiaje

## Alcance

Cubre únicamente la estructura del proyecto, configuración de herramientas y scripts de CI.
NO contiene lógica de dominio, repositorios, ni UI real.
El único comportamiento verificable es: el proyecto compila, los módulos se resuelven, y la ventana Tauri abre mostrando "learnMe".

## Unit tests

### `app::exports` (TypeScript / Vitest)

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 1 | `import { app } from '@/app'` | módulo resuelve, `app` no es `undefined` | happy path |

> Verifica que `tsconfig` strict + path alias `@/` funcionen correctamente.

### `smoke` (Rust / cargo test)

| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 1 | `smoke()` invocado | `assert!(true)` pasa, test verde | smoke (permitido explícitamente en Fase 0 por PRD §6) |

## Integration tests

### Escenario: scripts CI completos

- **Setup**: proyecto recién clonado (sin `node_modules`, sin `target/`)
- **Acción**: ejecutar `./scripts/ci.sh`
- **Assert**: exit code 0; output incluye confirmación de lint, type-check, `cargo check`, tests TS, tests Rust

## E2E tests

### Escenario: ventana principal visible

- **Viewport(s)**: desktop (1280×800)
- **Pasos**:
  1. `tauri-driver` inicia el binario compilado
  2. Playwright conecta vía WebDriver
  3. Espera a que la ventana cargue (selector `body` visible)
  4. Lee el texto del documento
- **Assert**: página contiene el texto `"learnMe"`

> **Nota**: E2E requiere `npm run tauri build` previo o modo `tauri dev` con driver.
> Si el entorno no soporta display (headless Linux sin Xvfb), este test se marcará
> `cannot test` con justificación y se reportará al usuario.

## Fixtures requeridas

Ninguna en Fase 0 — no hay datos de dominio.

## Snapshots (si aplica)

Ninguno en Fase 0.

## Pruebas marcadas `cannot test` (al iniciar la fase)

- ninguna (candidata condicional: E2E si no hay display disponible)

## Criterios de salida de esta fase

- [ ] 1 test TS pasa (`app` exporta correctamente)
- [ ] 1 test Rust pasa (`smoke`)
- [ ] 1 test E2E pasa (ventana con "learnMe") — o marcado `cannot test` con justificación documentada
- [ ] `./scripts/ci.sh` exit 0 (lint + type-check + cargo check + tests)
- [ ] Cobertura: N/A para fase 0 (no hay código de dominio nuevo)
- [ ] Suite completa verde
