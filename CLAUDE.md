# CLAUDE.md — learnMe

> Proceso completo de fases en `CLAUDE.full.md`. Este archivo cubre trabajo diario.
> Si hay conflicto con `PRD.md`, gana el PRD; reporta la discrepancia antes de actuar.

---

## Stack

Tauri 2 + React 18 + TypeScript strict + Rust + SQLite + FSRS.  
Frontend: `src/` — Backend: `src-tauri/src/` — Tests: `tests/` + módulos `#[cfg(test)]`.

---

## Reglas inviolables

### Tests — no tocar sin autorización explícita
Prohibido crear, modificar o eliminar cualquier archivo en:
`tests/**`, `**/*.test.ts`, `**/*.spec.ts`, `**/tests.rs`, `**/*_test.rs`, `#[cfg(test)]` existentes, `fixtures/**`, `schemas/**`.

Única excepción — frase literal del usuario:
> `autorizo modificar pruebas: <ruta exacta>`

Aplica solo a esa ruta, solo durante la respuesta actual.

### Sin red en producción
Prohibido introducir llamadas de red en `src/` o `src-tauri/src/`.

### Sin trampas de pruebas
Prohibido: asserts triviales, comentar asserts, cambiar `expected` para que coincida con `actual` incorrecto, mocks tan amplios que no prueban nada real.

### Scope
No implementar funcionalidad fuera de la tarea actual. No refactorizar "de paso". Anotar mejoras detectadas al usuario en lugar de aplicarlas.

### Modularidad de métodos
Ningún archivo fuera de `src-tauri/src/methods/anki/` y `src/features/methods/anki/` puede importar de esos paths. `core/` solo conoce el trait `StudyMethod`.

---

## Comandos

```bash
npm run tauri:dev        # dev completo
npm run dev              # solo frontend → localhost:1420
npm run test             # Vitest unit
npm run test:watch       # watch
npm run test:e2e         # Playwright
cargo test               # Rust
npm run coverage         # cobertura TS
cargo tarpaulin          # cobertura Rust
./scripts/ci.sh          # suite completa — obligatorio antes de cerrar fase
npm run tauri:build      # build producción
```

---

## Convenciones

**TypeScript**: strict, sin `any` sin comentario `// any-justified: <razón>`, sin `@ts-ignore` sin explicación, imports absolutos desde `@/`.

**Rust**: `#![deny(warnings)]`, errores con `thiserror` / `anyhow` solo en `main.rs`, `unsafe` solo con `// SAFETY: <invariante>`.

**Nombres**: componentes React `PascalCase.tsx`, hooks/utils `camelCase.ts`, módulos Rust `snake_case`, IDs en runtime UUIDv7.

**Comentarios**: solo cuando el WHY no es obvio. Sin docstrings multi-línea. Sin comentarios que expliquen qué hace el código.

---

## Frases de control

| Frase | Efecto |
|-------|--------|
| `OK entry fase N` | Aprueba paso 1 de la fase |
| `OK plan fase N` | Aprueba el plan de pruebas |
| `OK pruebas fase N` | Aprueba fixtures+pruebas, empieza implementación |
| `OK fase N` | Cierra la fase |
| `autorizo modificar pruebas: <ruta>` | Permite editar pruebas en esa ruta, solo esta respuesta |
| `rollback fase N` | Vuelve al estado aprobado de la fase N-1 |
| `freeze` | Detén toda implementación |
| `status` | Fase actual, paso, tests, cobertura |

---

## Flujo de fases (resumen)

Trabajo en fases usa 4 pasos con gate humano: **Entry → Plan → Pruebas (rojo) → Implementación (verde)**.  
No saltar pasos. No combinar pasos. Esperar respuesta del usuario entre cada uno.  
Detalle completo en `CLAUDE.full.md §2–§4`.

---

*Versión corta — alineado con CLAUDE.full.md v1.0*
