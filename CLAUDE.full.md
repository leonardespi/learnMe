# CLAUDE.md — Instrucciones operativas del agente para learnMe

> Este archivo gobierna cómo un agente Claude debe trabajar en este repositorio.
> El documento de producto vive en `PRD.md`. **Este archivo no reemplaza al PRD**, lo opera.
> Si hay conflicto entre ambos, gana el PRD; reporta la discrepancia al usuario antes de actuar.

---

## 0. Identidad del proyecto

- **Nombre**: learnMe
- **Tipo**: app desktop multiplataforma (Linux + macOS en v0.1), local-first.
- **Stack**: Tauri 2 + React 18 + TypeScript (strict) + Rust + SQLite + FSRS.
- **Metodología**: **test-first con fixtures**, fases con entry/exit gates.

---

## 1. Reglas inviolables

Las siguientes reglas **no admiten excepción** salvo orden explícita y literal del usuario.

### 1.1 Inmutabilidad de pruebas
- **Prohibido** crear, modificar o eliminar archivos en:
  - `tests/**`
  - `**/*.test.ts`, `**/*.test.tsx`
  - `**/*.spec.ts`, `**/*.spec.tsx`
  - `**/tests.rs`, `**/*_test.rs`, módulos `#[cfg(test)]` ya existentes
  - `fixtures/**`
  - `schemas/**` (una vez aprobado el schema de una fase)
- **Única excepción**: el usuario emite la frase literal:
  > `autorizo modificar pruebas: <ruta exacta o glob>`
- Esta autorización aplica **solo a la ruta indicada** y **solo durante la respuesta actual**. No es transitiva ni persistente.

### 1.2 Pruebas no implementables
- Si una prueba es genuinamente incorrecta o requiere capacidad que no existe aún:
  - **NO la elimines**.
  - **NO la "arregles"**.
  - Márcala con skip explícito y comentario:
    ```ts
    // CANNOT TEST: <razón concreta y verificable>
    it.skip('...', () => { /* ... */ });
    ```
    ```rust
    // CANNOT TEST: <razón concreta y verificable>
    #[ignore]
    #[test]
    fn ... () { /* ... */ }
    ```
  - Repórtala en el `report.md` de la fase bajo "Pruebas marcadas `cannot test`".

### 1.3 Privacidad y red
- **Prohibido** introducir llamadas de red en código de producción (`src/`, `src-tauri/src/`).
- Excepciones permitidas: descarga de dependencias en build-time (`cargo`, `npm`), update checker **explícitamente opt-in y deshabilitado por defecto**.
- Prohibido cualquier SDK de analytics, telemetría, crash reporting remoto, A/B testing.

### 1.4 Trampas de pruebas
- **Prohibido** todo lo siguiente:
  - `expect(true).toBe(true)` o equivalentes triviales.
  - Comentar/eliminar asserts para forzar verde.
  - Cambiar el `expected` para que coincida con un `actual` incorrecto.
  - Usar `try/catch` que silencie fallos esperados.
  - Aumentar timeouts para esconder race conditions.
  - Hacer mocks tan amplios que la prueba no pruebe nada real.

### 1.5 Alcance
- **Prohibido** implementar funcionalidad fuera del alcance de la fase actual.
- **Prohibido** refactorizar código fuera de la fase actual "de paso", salvo si una prueba lo exige.
- Si detectas mejoras necesarias en código de otra fase, anótalas en el `report.md` bajo "Riesgos detectados" o "Deuda técnica".

### 1.6 Modularidad de métodos de estudio
- Ningún archivo fuera de `src-tauri/src/methods/anki/` ni `src/features/methods/anki/` puede importar de esos paths.
- El núcleo (`core/`) solo conoce el trait `StudyMethod`, nunca implementaciones concretas.
- Antes de introducir un acoplamiento entre Anki y otro módulo, **pregunta al usuario**.

---

## 2. Flujo obligatorio por fase

Cada fase del PRD se ejecuta en **4 pasos secuenciales con gate humano entre cada uno**.

```
┌─────────────────────────────────────────────────────────────┐
│ PASO 1: ENTRY                                               │
│  - Lee la fase actual en PRD.md                             │
│  - Confirma al usuario qué fase vas a abordar               │
│  - Identifica dependencias con fases previas                │
│  - GATE: usuario responde "OK entry fase N"                 │
├─────────────────────────────────────────────────────────────┤
│ PASO 2: PLAN DE PRUEBAS                                     │
│  - Escribe docs/phase-N/test-plan.md (formato §3)           │
│  - NO crees archivos de prueba aún                          │
│  - NO toques código de producción                           │
│  - GATE: usuario responde "OK plan fase N"                  │
├─────────────────────────────────────────────────────────────┤
│ PASO 3: FIXTURES + PRUEBAS (ROJO)                           │
│  - Crea fixtures en fixtures/                               │
│  - Escribe las pruebas (deben FALLAR — confírmalo)          │
│  - NO toques código de producción todavía                   │
│  - GATE: usuario responde "OK pruebas fase N"               │
├─────────────────────────────────────────────────────────────┤
│ PASO 4: IMPLEMENTACIÓN (VERDE)                              │
│  - Escribe código hasta que las pruebas pasen               │
│  - Ejecuta ./scripts/ci.sh (suite COMPLETA, no solo fase N) │
│  - Genera docs/phase-N/report.md (formato §4)               │
│  - GATE: usuario responde "OK fase N"                       │
└─────────────────────────────────────────────────────────────┘
```

**Reglas del flujo**:
- No saltes pasos. No combines pasos en una sola respuesta.
- Si el usuario te pide saltar un paso, recuérdale este flujo y pide confirmación explícita.
- Entre pasos, **espera la respuesta del usuario**. No asumas aprobación implícita.

---

## 3. Formato del plan de pruebas (`docs/phase-N/test-plan.md`)

```markdown
# Plan de pruebas — Fase N: <nombre>

## Alcance
<2-4 líneas explicando qué cubre esta fase y qué NO cubre>

## Unit tests

### `<módulo>::<función>`
| # | Input | Output esperado | Tipo |
|---|-------|-----------------|------|
| 1 | `{...}` | `Ok(...)` | happy path |
| 2 | `{...}` | `Err(<variante>)` | error path |

### `<otro módulo>::<otra función>`
| # | Input | Output esperado | Tipo |
| ... |

## Integration tests

### Escenario: <nombre>
- **Setup**: <fixtures cargadas, estado inicial>
- **Acción**: <pasos concretos>
- **Assert**: <observables verificables>

## E2E tests (si aplica)

### Escenario: <nombre>
- **Viewport(s)**: mobile (375×667), desktop (1280×800)
- **Pasos**: <gherkin-like>
- **Assert**: <selector + estado esperado>

## Fixtures requeridas
- `fixtures/<path>` — <descripción del contenido y propósito>

## Snapshots (si aplica)
- <archivo + qué captura>

## Pruebas marcadas `cannot test` (al iniciar la fase)
- ninguna

## Criterios de salida de esta fase
- [ ] N tests unitarios pasan
- [ ] N tests de integración pasan
- [ ] Cobertura ≥ 80% líneas / 75% ramas en `<paths nuevos>`
- [ ] Suite completa (`./scripts/ci.sh`) verde
```

**Reglas del plan**:
- Cada fila de la tabla representa una prueba concreta, no una categoría.
- Inputs y outputs son **literales**, no descripciones. Si es muy largo, refiere al fixture: `fixtures/decks/spanish-a2-valid.json`.
- Si una entrada del PRD no genera al menos una prueba, justifícalo en "Alcance".

---

## 4. Formato del reporte de fase (`docs/phase-N/report.md`)

```markdown
# Reporte de fase N — <nombre>

## Resumen
<2-4 líneas: qué se entregó, qué quedó pendiente>

## Cambios implementados
### Archivos nuevos
- `path/al/archivo.rs` — <propósito>
### Archivos modificados
- `path/al/archivo.ts` — <qué cambió y por qué>
### Decisiones técnicas tomadas (no triviales)
- <decisión + razón + alternativa descartada>

## Cobertura de pruebas (suite completa)
- **Líneas**: X.X% (delta vs fase anterior: ±Y.Y%)
- **Ramas**: X.X%
- **Tests totales**: N
  - Pasados: N
  - Skipped (`cannot test`): M
  - Fallidos: **0** (si no es 0, la fase NO está cerrada)
- Comando ejecutado: `./scripts/ci.sh`
- Fecha y hora: <ISO 8601>

## Pruebas marcadas `cannot test`
| Prueba (archivo:línea) | Razón | Acción sugerida al usuario |
|------------------------|-------|----------------------------|
| ... | ... | ... |

## Riesgos detectados durante la fase
| Riesgo | Probabilidad | Impacto | Mitigación propuesta |
|--------|--------------|---------|----------------------|
| ... | ... | ... | ... |

## Blockers
- <ninguno | descripción + qué necesitas del usuario>

## Deuda técnica acumulada
- <ítem + ubicación + propuesta>

## Próxima fase: pre-requisitos
- [ ] <qué necesitas del usuario antes de empezar la fase N+1>
```

---

## 5. Comandos del proyecto

```bash
# Desarrollo
npm run tauri:dev            # app en modo dev
npm run dev                  # solo frontend

# Testing
npm run test                 # Vitest unit (TS)
npm run test:watch           # Vitest watch mode
npm run test:e2e             # Playwright contra Tauri
cargo test                   # Rust unit + integration
cargo test -- --ignored      # incluye los `#[ignore]` (cannot test)

# Cobertura
npm run coverage             # Vitest con c8
cargo tarpaulin              # cobertura Rust

# CI local — DEBE ejecutarse antes de cerrar cualquier fase
./scripts/ci.sh              # lint + types + cargo check + todos los tests + cobertura

# Build
npm run tauri:build          # binarios firmados
```

**Regla**: nunca declares una fase como completada sin haber ejecutado `./scripts/ci.sh` con salida 0.

---

## 6. Convenciones de código

### 6.1 TypeScript
- `tsconfig.json` en modo `strict`. No relajar.
- Prohibido `any` salvo en boundaries justificados con comentario `// any-justified: <razón>`.
- Prohibido `// @ts-ignore` y `// @ts-expect-error` sin comentario explicativo.
- Imports absolutos desde `@/` (configurado en `tsconfig` y `vite.config`).

### 6.2 Rust
- `#![deny(warnings)]` en crates de producción.
- Errores con `thiserror` (librería) / `anyhow` solo en `main.rs` y comandos Tauri.
- `unsafe` prohibido salvo justificación con `// SAFETY: <invariante>`.

### 6.3 Estilo
- TS: Prettier + ESLint config del repo.
- Rust: `cargo fmt` + `cargo clippy -- -D warnings`.
- Commits: prefijo `phase-N:` cuando aplique. Mensajes en español o inglés (consistente con el repo).

### 6.4 Nombres
- Archivos React: `PascalCase.tsx` para componentes, `camelCase.ts` para hooks/utils.
- Módulos Rust: `snake_case`.
- IDs en runtime: **UUIDv7** (orden temporal natural, útil para sync futuro).

---

## 7. Comunicación con el usuario

### 7.1 Cuándo preguntar
- Cuando una decisión del PRD admite dos interpretaciones razonables.
- Cuando descubras que una prueba aprobada es incoherente con otra prueba aprobada.
- Antes de introducir una dependencia nueva no listada en el PRD.
- Antes de tocar cualquier archivo en `tests/` o `fixtures/`.

### 7.2 Cuándo NO preguntar
- Detalles de implementación dentro del alcance de la fase y consistentes con el PRD.
- Refactors internos a un módulo que no cambian su API pública.
- Nombres de variables locales, organización interna de funciones.

### 7.3 Formato de preguntas
- Una pregunta concreta por turno cuando sea posible.
- Si necesitas varias, numéralas y agrúpalas al final del mensaje.
- Acompaña cada pregunta con tu recomendación tentativa.

### 7.4 Estado al final de cada respuesta
Cuando estés en medio de una fase, termina cada respuesta con un bloque:

```
---
Fase actual: N — <nombre>
Paso actual: <1-Entry | 2-Plan | 3-Pruebas | 4-Implementación>
Esperando: <"OK entry fase N" | "OK plan fase N" | "OK pruebas fase N" | "OK fase N" | respuesta a pregunta>
```

---

## 8. Frases de control reconocidas

El agente debe reconocer estas frases del usuario como instrucciones operativas con efecto inmediato:

| Frase del usuario | Efecto |
|-------------------|--------|
| `OK entry fase N` | Aprueba paso 1, puedes empezar el plan |
| `OK plan fase N` | Aprueba paso 2, puedes crear fixtures y pruebas |
| `OK pruebas fase N` | Aprueba paso 3, puedes implementar |
| `OK fase N` | Cierra la fase N, puedes iniciar la N+1 |
| `autorizo modificar pruebas: <ruta>` | Permite editar pruebas en esa ruta solo durante la respuesta actual |
| `rollback fase N` | Vuelve al último estado aprobado de la fase N-1 (git checkout del tag correspondiente) |
| `freeze` | Detén toda implementación, espera nuevas instrucciones |
| `status` | Devuelve fase actual, paso actual, tests pasando/fallando, cobertura |

Cualquier otra frase se interpreta como input normal de conversación.

---

## 9. Manejo de errores y bloqueos

### 9.1 Test que no debería fallar pero falla
1. Verifica que entendiste el spec del PRD.
2. Si el spec es ambiguo, **pregunta al usuario**. No adivines.
3. Si el spec es claro y la prueba es correcta, el código está mal: arréglalo.
4. Si crees que la prueba está mal, **NO la toques**: márcala `cannot test` con justificación y reporta.

### 9.2 Dependencia faltante o rota
1. Reporta al usuario con el comando exacto que falla.
2. Sugiere instalación o versión.
3. **No instales dependencias del sistema** sin permiso (sí puedes correr `npm install` y `cargo add` para deps del proyecto, pero anótalas en el reporte).

### 9.3 Conflicto entre el PRD y la realidad técnica
- Documéntalo en el reporte bajo "Riesgos detectados".
- Propón al usuario una de tres acciones: ajustar PRD, ajustar pruebas (con autorización), o mantener `cannot test`.

### 9.4 Cobertura no alcanza el umbral
- No bajes el umbral.
- No agregues pruebas triviales para inflar el número.
- Reporta qué código quedó sin cubrir y por qué. El usuario decide si se acepta.

---

## 10. Checklist pre-cierre de fase

Antes de generar `report.md` y declarar la fase cerrada, verifica:

- [ ] `./scripts/ci.sh` corrido con éxito (exit 0).
- [ ] 0 tests fallando.
- [ ] Tests `cannot test` listados en el reporte con justificación.
- [ ] Cobertura cumple umbral (80% líneas, 75% ramas en código nuevo).
- [ ] Sin warnings de Clippy.
- [ ] Sin warnings de TypeScript.
- [ ] Sin `any` o `@ts-ignore` sin justificar.
- [ ] Sin llamadas de red nuevas.
- [ ] Sin imports cruzados entre métodos de estudio.
- [ ] `docs/phase-N/report.md` generado con el formato de §4.
- [ ] Tag de git sugerido: `phase-N-complete` (el usuario decide si crearlo).

Si cualquier ítem falla, **la fase no está cerrada**. Reporta el bloqueo, no cierres.

---

## 11. Lo que este documento NO cubre

- Decisiones de producto: están en `PRD.md`.
- Detalles de schema de datos: están en `PRD.md` §2 y en `schemas/`.
- Definición del algoritmo FSRS: delegado al crate `rs-fsrs`.
- Política de releases: definida al llegar a la Fase 8.

Si algo no está cubierto ni aquí ni en el PRD, **pregunta al usuario** antes de decidir por tu cuenta.

---

*Versión del documento: 1.0 — alineado con PRD learnMe v0.1*
