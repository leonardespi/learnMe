# learnMe

> Repetición espaciada FSRS. 100% local. Sin suscripciones. Sin servidores. Solo tú y tu conocimiento.

**learnMe** es una aplicación de escritorio para Linux y macOS que te permite estudiar cualquier materia usando el algoritmo de repetición espaciada más avanzado disponible hoy: **FSRS v5**. Importa mazos en segundos, estudia con un ritmo optimizado por IA que maximiza la retención a largo plazo, y exporta tu progreso completo en un archivo portable. Tu historial de estudio nunca sale de tu máquina.

---

## ¿Por qué learnMe?

| Problema con otras apps | learnMe |
|---|---|
| Anki es potente pero anticuado y confuso de usar | Interfaz limpia de 3 paneles, flujo sin fricción |
| Quizlet y similares requieren cuenta y envían tus datos a la nube | 100% local, sin red, sin cuenta |
| Apps modernas cobran suscripción mensual por funciones básicas | Código abierto, gratis para siempre |
| El algoritmo SM-2 de Anki antiguo es subóptimo | FSRS v5, el estado del arte en repetición espaciada |
| Los backups son complicados o propietarios | Formato `.learnme` abierto, JSON legible, portable entre instalaciones |

---

## Características principales

- **Algoritmo FSRS v5** — El mismo algoritmo que usa Anki moderno. Calcula el intervalo óptimo por carta basándose en tu historial de retención real, no en fórmulas fijas.
- **Importación de mazos JSON** — Un archivo JSON con tus flashcards y las tienes en segundos dentro de cualquier categoría.
- **Markdown en cartas** — El anverso y reverso de cada carta se renderiza como Markdown. Listas, código, énfasis, todo funciona.
- **Estadísticas por mazo** — Retención a 30 días, distribución de estados (nueva/aprendiendo/repaso/reaprendiendo), heatmap de actividad de 365 días, previsión de carga los próximos 7 días.
- **Backup de sesión completo** — Exporta toda tu base de datos (categorías, mazos, cartas, historial de repasos) en un único archivo `.learnme`. Importa en otra máquina en un clic.
- **Modo claro y oscuro** — Cambia desde Ajustes. El tema persiste entre sesiones.
- **Teclado primero** — Atajos para todo: `⌘K` / `Ctrl+K` para la paleta de comandos, `Espacio` para calificar cartas.
- **Sin telemetría** — Ningún dato sale de tu máquina. Nunca.

---

## Capturas de pantalla

### Vista principal — categorías y mazos

El layout de escritorio usa 3 paneles: navegación lateral, lista de ítems, e inspección. Cada categoría agrupa mazos de estudio. Los mazos se crean con `+ Nuevo` y las categorías con el mismo botón en el panel izquierdo.

| Modo claro | Modo oscuro |
|---|---|
| Panel de categorías vacío listo para empezar | Panel de categorías en modo oscuro |

*(Las cartas del mazo aparecen en el panel derecho al seleccionar un mazo — anverso, estado FSRS y botones de edición/borrado por fila.)*

### Panel de estadísticas

Cada mazo tiene su propia página de estadísticas accesible con el botón **Estadísticas**:

- **Retención (30d)**: porcentaje de cartas recordadas correctamente en los últimos 30 días.
- **Distribución de estados**: cuántas cartas están en cada fase (nueva, aprendiendo, repaso, reaprendiendo).
- **Actividad (365 días)**: heatmap de días con repasos realizados.
- **Previsión (7 días)**: gráfico de barras con cuántas cartas vencen cada día de la semana siguiente.

### Ajustes — backup de sesión

Desde **Ajustes** puedes exportar e importar tu sesión completa. El botón naranja **Exportar sesión** genera un archivo `.learnme` en la ruta que elijas. El botón **Importar sesión** carga un archivo previamente exportado con resolución inteligente de conflictos.

---

## Instalación

### Requisitos previos

- **Node.js** ≥ 18
- **Rust** ≥ 1.78 (con `cargo`)
- **Dependencias de sistema Tauri** según tu distro:
  - Ubuntu/Debian: `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`
  - Arch: `webkit2gtk-4.1 libappindicator-gtk3`
  - macOS: Xcode Command Line Tools

### Desarrollo

```bash
git clone <repo-url>
cd learnme
npm install
npm run tauri:dev
```

### Build de producción

```bash
npm run tauri:build
```

El binario firmado queda en `src-tauri/target/release/bundle/`.

### Solo el frontend (sin Tauri)

```bash
npm run dev
# → http://localhost:1420
```

---

## Guía de uso

### 1. Crear una categoría

Las categorías organizan tus mazos por tema. Ejemplos: "Idiomas", "Medicina", "Programación".

1. Abre la app. La vista inicial muestra el panel **CATEGORÍAS**.
2. Haz clic en **+ Nuevo** en el encabezado del panel.
3. Escribe el nombre y presiona `Enter` o el botón ✓.

La categoría aparece en el panel izquierdo de navegación y en la lista central.

### 2. Crear un mazo de estudio

Un mazo vive dentro de una categoría y contiene tus cartas.

1. Haz clic sobre una categoría para expandirla. Aparece el panel **ESTUDIOS**.
2. Haz clic en **+ Nuevo**, escribe el nombre del mazo y confirma.

### 3. Importar cartas desde un archivo JSON

Esta es la forma más rápida de poblar un mazo. Prepara un archivo `.json` con el formato de mazo Anki (ver [Contrato de importación de mazos](#contrato-de-importación-de-mazos--archivoj-son)) y:

1. Selecciona el mazo en el panel de estudios. Aparece el panel de detalle del mazo a la derecha.
2. Haz clic en **Importar .json**.
3. Selecciona tu archivo. Se muestra una confirmación con el nombre del archivo.
4. Haz clic en **Confirmar**.

Las cartas aparecen de inmediato en la lista. Cada carta muestra su estado FSRS (`new`, `learning`, `review`, `relearning`) con un badge de color.

### 4. Agregar cartas manualmente

Usa el botón **+ Agregar carta** en el panel de detalle del mazo. *(Disponible en la próxima versión — el flujo de importación JSON cubre la mayoría de los casos de uso.)*

### 5. Editar o borrar una carta

Cada fila de carta tiene dos botones que aparecen al hacer hover:

- **✎ (Pencil)** — Abre un panel de edición inline. Modifica el anverso y reverso y guarda con ✓.
- **🗑 (Trash)** — Elimina la carta y su historial de repasos.

Para renombrar o eliminar un mazo, haz hover sobre él en el panel **ESTUDIOS** y usa los mismos iconos.

Para renombrar o eliminar una categoría, haz hover sobre ella en el panel **CATEGORÍAS** y usa los mismos iconos.

### 6. Iniciar una sesión de repaso

1. Selecciona un mazo.
2. Haz clic en **Iniciar repaso** (o presiona `Espacio` con el mazo seleccionado).
3. Aparece la cara frontal de la carta. Lee, piensa en la respuesta.
4. Presiona `Espacio` para revelar la respuesta (reverso).
5. Califica tu recuerdo:

| Calificación | Significado | Atajo |
|---|---|---|
| **Again** | No lo recordé | `1` |
| **Hard** | Lo recordé con dificultad | `2` |
| **Good** | Lo recordé correctamente | `3` |
| **Easy** | Lo recordé sin esfuerzo | `4` |

El algoritmo FSRS v5 calcula el próximo intervalo automáticamente según tu calificación e historial. No necesitas configurar nada.

6. Al terminar todas las cartas vencidas, la sesión finaliza y puedes volver al detalle del mazo.

### 7. Revisar estadísticas

Desde el panel de detalle del mazo, haz clic en **Estadísticas** para ver:

- Retención a 30 días
- Estado actual de todas las cartas
- Historial de actividad (365 días)
- Carga prevista los próximos 7 días

### 8. Exportar la sesión completa

Ve a **Ajustes** (en la barra lateral) → sección **Session backup** → **Exportar sesión**.

Elige una ruta y nombre de archivo. Se genera un `.learnme` con **toda** tu base de datos: categorías, mazos, cartas, historial de repasos. El archivo es JSON legible y portable.

### 9. Importar una sesión

Ve a **Ajustes** → **Importar sesión**. Selecciona un archivo `.learnme`.

El modo de importación por defecto es **merge** (fusión): conserva tu progreso local y el del archivo importado, resolviendo conflictos por carta con la regla "gana la más revisada". Ver [Resolución de conflictos en importación de sesión](#resolución-de-conflictos-en-importación-de-sesión) para los detalles completos.

---

## Contrato de importación de mazos (archivo `.json`)

Para importar un mazo desde archivo, el JSON debe cumplir el siguiente schema. Los campos opcionales se usan para importar cartas con su estado FSRS preservado (por ejemplo, al hacer un roundtrip de exportación/importación).

### Schema completo

> **Nota**: el bloque siguiente es el documento del JSON Schema (el validador). No es un archivo de mazo válido. En particular, **no incluyas `$schema` en tus archivos `.json`** — el schema tiene `additionalProperties: false` y lo rechazará.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["schemaVersion", "method", "name", "cards"],
  "additionalProperties": false,
  "properties": {
    "schemaVersion": { "type": "string" },
    "method":        { "type": "string", "const": "anki" },
    "name":          { "type": "string", "minLength": 1 },
    "tags":          { "type": "array", "items": { "type": "string" }, "default": [] },
    "cards": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["front", "back"],
        "additionalProperties": false,
        "properties": {
          "front":      { "type": "string", "minLength": 1 },
          "back":       { "type": "string", "minLength": 1 },
          "tags":       { "type": "array", "items": { "type": "string" }, "default": [] },
          "stability":  { "type": "number" },
          "difficulty": { "type": "number" },
          "due":        { "type": "string" },
          "lastReview": { "type": ["string", "null"] },
          "state":      { "type": "string", "enum": ["new", "learning", "review", "relearning"] },
          "reps":       { "type": "integer", "minimum": 0 },
          "lapses":     { "type": "integer", "minimum": 0 }
        }
      }
    }
  }
}
```

### Campos obligatorios del nivel raíz

| Campo | Tipo | Descripción |
|---|---|---|
| `schemaVersion` | `string` | Versión del schema. Actualmente `"1.0.0"`. |
| `method` | `string` | Debe ser exactamente `"anki"`. Otros valores son rechazados. |
| `name` | `string` | Nombre del mazo. Mínimo 1 carácter. Se usa como nombre del estudio creado. |
| `cards` | `array` | Array de cartas. Puede estar vacío `[]`. |

### Campos opcionales del nivel raíz

| Campo | Tipo | Descripción |
|---|---|---|
| `tags` | `string[]` | Tags globales del mazo. Actualmente informativos. Default: `[]`. |

### Campos de cada carta

| Campo | Obligatorio | Tipo | Descripción |
|---|---|---|---|
| `front` | ✅ | `string` | Cara frontal de la carta. Soporta Markdown. Mínimo 1 carácter. |
| `back` | ✅ | `string` | Cara trasera de la carta. Soporta Markdown. Mínimo 1 carácter. |
| `tags` | ❌ | `string[]` | Etiquetas de la carta. Default: `[]`. |
| `stability` | ❌ | `number` | Estado FSRS: estabilidad de la memoria. Default: `0`. |
| `difficulty` | ❌ | `number` | Estado FSRS: dificultad de la carta. Default: `0`. |
| `due` | ❌ | `string` | Fecha de vencimiento ISO 8601. Default: ahora. |
| `lastReview` | ❌ | `string \| null` | Fecha del último repaso ISO 8601. Default: `null`. |
| `state` | ❌ | `"new" \| "learning" \| "review" \| "relearning"` | Estado FSRS. Default: `"new"`. |
| `reps` | ❌ | `integer ≥ 0` | Número de repasos totales. Default: `0`. |
| `lapses` | ❌ | `integer ≥ 0` | Número de errores acumulados. Default: `0`. |

### Comportamiento de deduplicación al importar

Si ya existen cartas en el mazo destino, el importador aplica las siguientes reglas:

1. **Carta nueva (front+back no existen en el mazo)** → se inserta directamente.
2. **Carta con mismo `front` y `back` (coincidencia semántica)** → se comparan los `reps` y la fecha de `lastReview`. Gana la carta con más repasos. En empate, gana la revisada más recientemente.
3. **Cartas duplicadas exactas** → se ignoran silenciosamente (`skipped`).

El comando devuelve `{ "inserted": N, "skipped": M }`.

### Ejemplo mínimo válido

```json
{
  "schemaVersion": "1.0.0",
  "method": "anki",
  "name": "Capitales del mundo",
  "cards": [
    { "front": "¿Capital de Francia?", "back": "París" },
    { "front": "¿Capital de Japón?",   "back": "Tokio" },
    { "front": "¿Capital de Brasil?",  "back": "Brasilia" }
  ]
}
```

### Ejemplo con estado FSRS preservado (para roundtrips)

```json
{
  "schemaVersion": "1.0.0",
  "method": "anki",
  "name": "Spanish A2 Vocabulary",
  "tags": ["language", "spanish"],
  "cards": [
    {
      "front": "casa",
      "back": "house",
      "tags": ["noun"],
      "stability": 12.4,
      "difficulty": 5.2,
      "due": "2026-06-03T10:00:00Z",
      "lastReview": "2026-05-26T09:00:00Z",
      "state": "review",
      "reps": 8,
      "lapses": 1
    },
    {
      "front": "correr",
      "back": "to run",
      "tags": ["verb"],
      "stability": 0.0,
      "difficulty": 0.0,
      "due": "2026-05-26T10:00:00Z",
      "lastReview": null,
      "state": "new",
      "reps": 0,
      "lapses": 0
    }
  ]
}
```

### Errores de validación comunes

| Error | Causa | Solución |
|---|---|---|
| `schema error at /method: ...` | `method` no es `"anki"` | Cambia el valor a `"anki"` |
| `schema error at /cards/0/front: ...` | `front` está vacío o ausente | Todos los `front` y `back` deben tener al menos 1 carácter |
| `schema error at /cards/N: ...` | Propiedad no reconocida en la carta | Elimina las propiedades no listadas en el schema (es `additionalProperties: false`) |
| `schema error at ...: ...` | Propiedad no reconocida en el raíz (ej. `$schema`) | El raíz también tiene `additionalProperties: false`. Solo se permiten `schemaVersion`, `method`, `name`, `tags`, `cards` |
| `parse error: ...` | El archivo no es JSON válido | Valida tu JSON antes de importar |

---

## Formato de exportación de mazos (`.json`)

Cuando exportas un mazo individualmente (función disponible vía comando interno), el JSON generado tiene este formato:

```json
{
  "schemaVersion": "1.0.0",
  "method": "anki",
  "name": "Nombre del mazo",
  "tags": [],
  "cards": [
    {
      "front": "texto del anverso",
      "back": "texto del reverso",
      "tags": ["etiqueta1"],
      "stability": 12.4,
      "difficulty": 5.2,
      "due": "2026-06-03T10:00:00Z",
      "lastReview": "2026-05-26T09:00:00Z",
      "state": "review",
      "reps": 8,
      "lapses": 1
    }
  ]
}
```

Este JSON cumple el mismo schema que acepta el importador. Es decir, un export es directamente re-importable.

---

## Contrato de sesión completa (archivo `.learnme`)

El archivo `.learnme` es un **backup completo de toda tu base de datos**: categorías, mazos, cartas con estado FSRS e historial de repasos. Se genera desde **Ajustes → Exportar sesión**.

### Estructura del archivo

```
<archivo>.learnme (JSON, UTF-8, pretty-printed)
├── version          : number    — Versión del formato (actualmente: 1)
├── generatedAt      : string    — ISO 8601 UTC. Momento de la exportación
├── appVersion       : string    — Versión de learnMe que generó el archivo (ej. "0.1.0")
├── checksum         : string    — SHA-256 hex de data+appVersion+generatedAt+version
└── data
    ├── categories   : Category[]
    ├── studies      : Study[]
    ├── cards        : Card[]
    └── reviewLogs   : ReviewLog[]
```

### Tipo `Category`

```json
{
  "id":    "01944b2a-0000-7000-8000-000000000001",
  "name":  "Idiomas",
  "color": "#3b82f6"
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `string` | UUIDv7 de la categoría |
| `name` | `string` | Nombre de la categoría |
| `color` | `string \| null` | Color hex. `null` si no se asignó color |

### Tipo `Study` (mazo)

```json
{
  "id":         "01944b2a-0000-7000-8000-000000000002",
  "categoryId": "01944b2a-0000-7000-8000-000000000001",
  "name":       "Vocabulario A2",
  "method":     "anki"
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `string` | UUIDv7 del mazo |
| `categoryId` | `string` | ID de la categoría padre |
| `name` | `string` | Nombre del mazo |
| `method` | `string` | Siempre `"anki"` en v0.1 |

### Tipo `Card`

```json
{
  "id":            "01944b2a-0000-7000-8000-000000000003",
  "studyId":       "01944b2a-0000-7000-8000-000000000002",
  "front":         "casa",
  "back":          "house",
  "tags":          ["noun"],
  "state":         "review",
  "stability":     12.4,
  "difficulty":    5.2,
  "elapsedDays":   3,
  "scheduledDays": 12,
  "reps":          8,
  "lapses":        1,
  "due":           "2026-06-07T10:00:00Z",
  "lastReviewed":  "2026-05-26T09:00:00Z"
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `string` | UUIDv7 de la carta |
| `studyId` | `string` | ID del mazo al que pertenece |
| `front` | `string` | Anverso (Markdown) |
| `back` | `string` | Reverso (Markdown) |
| `tags` | `string[]` | Etiquetas |
| `state` | `"new" \| "learning" \| "review" \| "relearning"` | Estado FSRS actual |
| `stability` | `number` | Parámetro S de FSRS: días hasta 90% de retención |
| `difficulty` | `number` | Parámetro D de FSRS: dificultad inherente de la carta (1-10) |
| `elapsedDays` | `number` | Días transcurridos desde `lastReviewed` hasta la exportación |
| `scheduledDays` | `number` | Días entre `lastReviewed` y `due` |
| `reps` | `number` | Total de repasos realizados |
| `lapses` | `number` | Total de errores (`Again`) |
| `due` | `string` | Fecha de próximo repaso (ISO 8601 UTC) |
| `lastReviewed` | `string \| null` | Fecha del último repaso (ISO 8601 UTC) o `null` si nunca se repasó |

### Tipo `ReviewLog`

```json
{
  "id":           "01944b2a-0000-7000-8000-000000000010",
  "cardId":       "01944b2a-0000-7000-8000-000000000003",
  "grade":        3,
  "reviewedAt":   "2026-05-26T09:00:00Z",
  "stability":    9.1,
  "difficulty":   5.0,
  "elapsedDays":  0,
  "scheduledDays": 0,
  "reviewState":  0
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `string` | UUIDv7 del log |
| `cardId` | `string` | ID de la carta repasada |
| `grade` | `integer` | Calificación dada: `1` = Again, `2` = Hard, `3` = Good, `4` = Easy |
| `reviewedAt` | `string` | Timestamp del repaso (ISO 8601 UTC) |
| `stability` | `number` | Estabilidad **previa** al repaso |
| `difficulty` | `number` | Dificultad **previa** al repaso |
| `elapsedDays` | `number` | Días transcurridos desde el repaso anterior |
| `scheduledDays` | `number` | Días que estaban programados entre repasos |
| `reviewState` | `integer` | Estado de la revisión (uso interno FSRS) |

### Ejemplo mínimo de archivo `.learnme` válido

```json
{
  "version": 1,
  "generatedAt": "2026-05-26T10:00:00Z",
  "appVersion": "0.1.0",
  "checksum": "c2722b3ac8e9f3f0c46146b5eb1bdf9b83fbaafa2229e704a5ea720769602c70",
  "data": {
    "categories": [
      { "id": "01944b2a-0000-7000-8000-000000000001", "name": "Idiomas", "color": null }
    ],
    "studies": [
      {
        "id":         "01944b2a-0000-7000-8000-000000000002",
        "categoryId": "01944b2a-0000-7000-8000-000000000001",
        "name":       "Vocabulario A2",
        "method":     "anki"
      }
    ],
    "cards": [
      {
        "id":            "01944b2a-0000-7000-8000-000000000003",
        "studyId":       "01944b2a-0000-7000-8000-000000000002",
        "front":         "casa",
        "back":          "house",
        "tags":          [],
        "state":         "new",
        "stability":     0.0,
        "difficulty":    0.0,
        "elapsedDays":   0,
        "scheduledDays": 0,
        "reps":          0,
        "lapses":        0,
        "due":           "2026-05-26T10:00:00Z",
        "lastReviewed":  null
      }
    ],
    "reviewLogs": []
  }
}
```

> **Importante**: el campo `checksum` es un SHA-256 calculado sobre `data` serializado + `appVersion` + `generatedAt` + `version`. learnMe verifica este checksum al importar. Un archivo `.learnme` modificado manualmente sin actualizar el checksum será rechazado con error `checksum mismatch`. Para generar archivos `.learnme` programáticamente, usa siempre la exportación oficial de learnMe.

---

## Resolución de conflictos en importación de sesión

Cuando importas una sesión con modo **merge** (el modo por defecto), learnMe aplica las siguientes reglas para cada entidad:

### Categorías

- Si el UUID ya existe en la base de datos local → **se mantiene la local** (sin actualización de nombre ni color).
- Si el UUID no existe → **se inserta** la categoría del archivo.

### Mazos (Studies)

- Si el UUID ya existe → **se mantiene el local**.
- Si el UUID no existe → **se inserta** el mazo del archivo.

### Cartas

La resolución de conflictos en cartas es más sofisticada:

| Situación | Regla |
|---|---|
| La carta del archivo tiene **más `reps`** que la local | Gana la del archivo (más experiencia de repaso) |
| La carta local tiene **más `reps`** que la del archivo | Gana la local |
| Empate en `reps`: la del archivo tiene `lastReviewed` más reciente | Gana la del archivo |
| Empate en `reps`: la local tiene `lastReviewed` más reciente | Gana la local |
| Ninguna tiene `lastReviewed` (ambas son `null`) | Gana la local |
| Solo la del archivo tiene `lastReviewed` | Gana la del archivo |
| La carta no existe por UUID pero coincide en `front`+`back` dentro del mismo mazo | Se aplica la misma lógica de reps/fechas como "match semántico" |
| La carta no existe por UUID ni por contenido | Se inserta nueva |

### ReviewLogs

- Si el UUID ya existe → **se ignora** (no se insertan duplicados).
- Si el UUID no existe → **se inserta**.

### Modo `replace`

Si usas el modo **replace** (no disponible desde la UI actualmente, solo desde código), se borran **todas** las tablas antes de importar. Se usa para restaurar una sesión limpia desde un backup.

### Validaciones previas a la importación

Antes de tocar la base de datos, learnMe valida:

1. **Versión soportada**: el campo `version` del archivo no puede superar la versión máxima soportada (actualmente `1`).
2. **Checksum**: se recalcula y verifica contra el campo `checksum` del archivo.
3. **Integridad referencial**: ningún mazo puede referenciar una categoría que no esté en el archivo, ninguna carta puede referenciar un mazo que no esté en el archivo, y ningún `reviewLog` puede referenciar una carta que no esté en el archivo.

Si cualquiera de estas validaciones falla, **la importación se cancela en su totalidad** (rollback de transacción). No se modifica nada.

---

## El algoritmo FSRS v5

FSRS (Free Spaced Repetition Scheduler) es el algoritmo de repetición espaciada de última generación, diseñado para maximizar la retención a largo plazo minimizando el tiempo de estudio.

A diferencia del algoritmo SM-2 (el histórico de Anki), FSRS modela explícitamente dos propiedades de la memoria por carta:

- **Stability (S)**: cuántos días pueden pasar antes de que la probabilidad de recordar la carta caiga por debajo del 90%.
- **Difficulty (D)**: cuán inherentemente difícil es la carta (escala 1-10). FSRS aprende este valor automáticamente basándose en tu historial de calificaciones.

El intervalo al próximo repaso se calcula como:

```
intervalo = S × ln(FSRS_TARGET_RETENTION) / ln(0.9)
```

donde `FSRS_TARGET_RETENTION` es la retención objetivo (por defecto 0.9, es decir, el 90%).

Cada calificación (`Again`, `Hard`, `Good`, `Easy`) actualiza S y D usando las fórmulas oficiales de FSRS v5, implementadas por el crate Rust [`rs-fsrs`](https://crates.io/crates/rs-fsrs).

---

## Estados de las cartas

| Estado | Color | Significado |
|---|---|---|
| `new` | Azul | La carta nunca ha sido repasada |
| `learning` | Naranja | En proceso de aprendizaje inicial (primeros repasos en horas) |
| `review` | Verde | En ciclo de repaso espaciado (intervalos en días o semanas) |
| `relearning` | Púrpura | Olvidada y en re-aprendizaje (calificación `Again` en estado `review`) |

---

## Markdown en cartas

El anverso y reverso de cada carta se renderiza como Markdown. Puedes usar:

```
**negrita**           → negrita
*cursiva*             → cursiva
`código inline`       → código inline
# Encabezado
- Lista de puntos
1. Lista numerada
> Cita

```código
bloque de código
```
```

Esto es especialmente útil para materias técnicas: define fórmulas con código, lista pasos numerados, o usa encabezados para estructurar cartas complejas.

---

## Privacidad

learnMe es **100% local** por diseño:

- No existe ningún servidor de learnMe.
- No hay SDK de analytics, telemetría, crash reporting remoto ni A/B testing.
- La única conexión de red que ocurre es durante `npm install` y `cargo build` para descargar dependencias de build-time. Nada más.
- Tus mazos, tus calificaciones y tu historial de estudio **nunca salen de tu máquina**.
- El archivo `.learnme` de backup es tuyo: JSON abierto, legible, portable. No está atado a ninguna cuenta ni servicio.

---

## Stack técnico

| Capa | Tecnología |
|---|---|
| Shell desktop | Tauri 2 |
| Frontend | React 18 + TypeScript (strict) |
| Estado global | Zustand |
| Data fetching | TanStack Query |
| Estilos | Tailwind CSS 4 + CSS variables |
| Backend | Rust |
| Base de datos | SQLite embebido (`rusqlite` + `bundled`) |
| Migraciones | `refinery` |
| Algoritmo SRS | FSRS v5 vía crate `rs-fsrs` |
| Validación de schema | JSON Schema (generado desde Zod, consumido por `jsonschema` en Rust) |
| Iconos | `lucide-react` |
| Tests unitarios TS | Vitest + Testing Library |
| Tests unitarios Rust | `cargo test` |
| Tests E2E | Playwright + `tauri-driver` |

---

## Desarrollo y tests

```bash
# Tests unitarios TypeScript
npm run test

# Tests TypeScript en modo watch
npm run test:watch

# Tests Rust
cargo test

# Linting y typecheck
npm run lint
npm run typecheck
cargo clippy -- -D warnings

# Suite CI completa (lint + types + cargo check + todos los tests)
./scripts/ci.sh
```

---

## Licencia

MIT — ver `LICENSE`.

---

*learnMe v0.1.0 — Linux + macOS*
