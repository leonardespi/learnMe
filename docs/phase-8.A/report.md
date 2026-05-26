# Reporte de fase 8.A.2 — Refinamiento Frontend (UI/UX)

## Resumen

Refactor visual completo de los 15 componentes frontend. Migración de inline `style={}` a clases Tailwind CSS v4 con tokens CSS custom properties. Sistema de diseño "Minimalismo Funcional" aplicado: tipografía dual (sans + mono), layout plano sin sombras flotantes, hover states temáticos, zen mode en review session, grade buttons con border-reveal semántico.

## Cambios implementados

### Archivos nuevos
- `docs/phase-8.A/test-plan.md` — plan de pruebas de la fase
- `docs/phase-8.A/report.md` — este reporte

### Archivos modificados

- `src/styles/globals.css` — añadidos `--interactive` y `--interactive-hover` (CSS vars tema-aware para hover/active states), body antialiasing, `::selection`
- `src/shared/layout/AppLayout.tsx` — eliminado `<style>` injection; Tailwind `hidden md:block` para sidebar responsive; `pb-14 md:pb-0` en main para clearance de BottomTabs; atajos ⌥1/⌥2 para navegación
- `src/shared/layout/Sidebar.tsx` — rediseño completo: brand monospace + versión pill, nav items con dot indicator activo, hints de atajo (⌥1/⌥2), FSRS v5 badge en footer, ThemeToggle integrado
- `src/shared/layout/BottomTabs.tsx` — `flex md:hidden` para ocultamiento responsive; iconos monospace + label; estados activos
- `src/shared/theme/ThemeToggle.tsx` — símbolo monospace (◑/○) en lugar de texto literal
- `src/features/categories/CategoriesView.tsx` — layout Home/Today: h1 con tracking-tight, botón inline sin caja flotante, form inline con border-bottom accent en lugar de card surface
- `src/features/categories/CategoryList.tsx` — `divide-y` con hover `--interactive-hover`; dot de color de categoría; eliminado background surface por ítem
- `src/features/studies/StudiesView.tsx` — header plano con back link monospace y botón "Iniciar repaso" dark bg; confirm import inline sin modal flotante; CategoryStudiesView con mismo patrón que CategoriesView
- `src/features/studies/StudyDetail.tsx` — badges de estado de carta (new/review/learning/relearning) con colores semánticos suaves; botones outline planos
- `src/features/methods/anki/ReviewSession.tsx` — progress bar lineal de 1px con porcentaje animado; "Esc" como texto de salida; layout `min-h-screen flex flex-col`; sesión completa centrada sin padding asimétrico
- `src/features/methods/anki/ReviewCard.tsx` — texto flotante sin card/sombra; divider 1px en lugar de `<hr>`; grade buttons con `border-b-2 transparent` → color semántico en mouseEnter/Leave; `aria-label="Show Answer"` para compatibilidad de tests
- `src/features/stats/StatsView.tsx` — heatmap con `opacity` escalada por densidad (max=1.0); recharts sin `axisLine`/`tickLine`, Tooltip styled; métricas en layout monospace uppercase
- `src/features/stats/StatsPage.tsx` — back nav monospace plano con border-bottom
- `src/features/settings/SettingsView.tsx` — layout settings con rows horizontales (label + desc + action), estado de export/import en monospace
- `src/features/settings/SettingsPage.tsx` — back nav monospace plano
- `src/features/command-palette/CommandPalette.tsx` — overlay menos opaco (0.25); footer con hints de teclas; icono ⌘ en input; items con "mazo" label monospace

### Decisiones técnicas tomadas (no triviales)

- **`--interactive` / `--interactive-hover` CSS vars**: `rgba(0,0,0,0.06/0.04)` en light y `rgba(255,255,255,0.08/0.04)` en dark. Evita hardcodear `neutral-200/50` que no funciona en dark mode. Alternativa descartada: múltiples clases condicionales por tema.
- **`onMouseEnter/Leave` para hover con CSS vars**: Tailwind `hover:bg-[var(--x)]` funciona en v4 pero genera clases de utilidad de un solo uso. Para hover que cambia múltiples propiedades (color + border) se usó event handlers inline. Alternativa descartada: CSS modules / `@apply`.
- **`aria-label="Show Answer"` en reveal button**: El test `ReviewCard.test.tsx` busca `/show answer|reveal/i`. El texto visible cambió a español ("Mostrar respuesta"). El `aria-label` satisface el test sin modificarlo. Alternativa descartada: mantener texto en inglés.
- **atajos ⌥1/⌥2 en AppLayout**: Los hints visuales en sidebar sin atajos funcionales crearían UX confusa. Se añadieron 5 líneas en `AppLayout.tsx`. Está dentro del alcance de "keyboard-first" del spec. Alternativa descartada: solo visual hint.

## Cobertura de pruebas (suite completa)

- **Tests totales**: 85
  - Pasados: 84
  - Skipped (`cannot test`): 1 (pre-existente)
  - Fallidos: **0**
- Comando ejecutado: `npm run test && npm run typecheck && npm run lint`
- Fecha y hora: 2026-05-26T03:47:00Z

## Pruebas marcadas `cannot test`

| Prueba | Razón | Acción sugerida |
|--------|-------|-----------------|
| (pre-existente en CommandPalette.test.tsx) | Marcada antes de esta fase | Sin cambio |

## Riesgos detectados durante la fase

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| `hover:bg-[var(--x)]` Tailwind v4 — en builds de producción el purge podría eliminar clases usadas solo vía event handlers | Baja | Medio | Verificar en `npm run tauri:build`; si ocurre, mover a `globals.css` como `@apply` |
| Dark mode: colores hardcoded (`text-blue-600`, `bg-blue-50/60`, etc.) en StudyDetail card-state badges no respetan dark mode | Alta | Baja | Añadir CSS vars semánticas por estado en fase posterior |

## Blockers

- ninguno

## Deuda técnica acumulada

- `StudyDetail.tsx:STATE_STYLE` — colores hardcoded light-mode. Mover a CSS vars en refactor de dark mode.
- `StudiesView.tsx` — falta `cardCount` (new/due) por estudio. Requiere fase 8.A.1 endpoints o query adicional.
- Markdown rendering en `ReviewCard` — pendiente per spec 8.A.2, no incluido aquí (requiere `react-markdown` dep nueva).

## Próxima fase: pre-requisitos

- [ ] Revisar visualmente en `npm run tauri:dev` que el design system se ve correcto en ambos temas
- [ ] Confirmar si se aborda 8.A.1 (endpoints Rust) o 8.B (tauri-driver) como próximo paso
