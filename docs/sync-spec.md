# Session sync spec — `.learnme` format

A `.learnme` file is a UTF-8 plain-text JSON file that captures a complete snapshot of your learnMe database: categories, decks, cards, and review history. It is human-readable, `git diff`-friendly, and contains no binary data.

---

## Envelope

```json
{
  "version": 1,
  "generatedAt": "2026-05-26T14:32:00.000Z",
  "appVersion": "0.1.0",
  "checksum": "<sha256-hex>",
  "data": { ... }
}
```

| Field | Type | Notes |
|---|---|---|
| `version` | `integer ≥ 0` | Format version. Currently `1`. |
| `generatedAt` | `string` (ISO 8601 UTC) | Export timestamp. |
| `appVersion` | `string` (semver) | App version that generated the file. |
| `checksum` | `string` (SHA-256 hex) | Integrity hash — see below. |
| `data` | `object` | All entity arrays — see [Payload](#payload). |

### Checksum

SHA-256 is computed over the UTF-8 bytes of a canonical JSON string containing only `appVersion`, `data`, `generatedAt`, and `version` — in strict alphabetical key order, with no extra whitespace. The `checksum` field itself is excluded from the hash.

On import, Rust recomputes the hash independently. A mismatch results in `Err(ChecksumMismatch)` and the database is not touched.

---

## Payload

`data` contains four arrays:

```json
{
  "categories": [ ... ],
  "studies":    [ ... ],
  "cards":      [ ... ],
  "reviewLogs": [ ... ]
}
```

### `categories`

| Field | Type | Notes |
|---|---|---|
| `id` | `string` (UUIDv7) | Primary key |
| `name` | `string` (non-empty) | Category label |
| `color` | `string \| null` | Optional hex color |

### `studies`

One study = one deck. Currently only `method: "anki"` exists.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` (UUIDv7) | Primary key |
| `categoryId` | `string` (UUIDv7) | FK → `categories.id` |
| `name` | `string` (non-empty) | Deck name |
| `method` | `string` | `"anki"` (or future method identifier) |

### `cards`

| Field | Type | Notes |
|---|---|---|
| `id` | `string` (UUIDv7) | Primary key |
| `studyId` | `string` (UUIDv7) | FK → `studies.id` |
| `front` | `string` (non-empty) | Question face (Markdown) |
| `back` | `string` (non-empty) | Answer face (Markdown) |
| `tags` | `string[]` | Card-level tags |
| `state` | `"new" \| "learning" \| "review" \| "relearning"` | FSRS state |
| `stability` | `number` | FSRS stability (days) |
| `difficulty` | `number` | FSRS difficulty 1–10 |
| `elapsedDays` | `integer ≥ 0` | Days since last review |
| `scheduledDays` | `integer ≥ 0` | Scheduled interval |
| `reps` | `integer ≥ 0` | Total review count |
| `lapses` | `integer ≥ 0` | Lapse count |
| `due` | `string` (ISO 8601) | Next review date |
| `lastReviewed` | `string \| null` (ISO 8601) | Last review timestamp |

### `reviewLogs`

One row per rating event.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` (UUIDv7) | Primary key |
| `cardId` | `string` (UUIDv7) | FK → `cards.id` |
| `grade` | `integer 1–4` | 1=Again, 2=Hard, 3=Good, 4=Easy |
| `reviewedAt` | `string` (ISO 8601) | Review timestamp |
| `stability` | `number` | FSRS stability after this review |
| `difficulty` | `number` | FSRS difficulty after this review |
| `elapsedDays` | `integer ≥ 0` | Elapsed days at review time |
| `scheduledDays` | `integer ≥ 0` | Interval assigned at review time |
| `reviewState` | `integer` | Internal FSRS state integer |

---

## Session import — conflict resolution

Import runs in two modes: **merge** (default) and **replace**.

### Merge mode

Entities are matched by UUID. For each entity in the file:

- **No local match** → inserted as-is.
- **UUID match** → resolved by type:

| Entity | Resolution |
|---|---|
| `categories` | Local wins (name/color not overwritten). |
| `studies` | Local wins (name not overwritten). |
| `cards` | **Most-advanced FSRS state wins**: higher `reps` wins; on tie, more recent `lastReviewed` wins. |
| `reviewLogs` | **Additive**: logs in the file that are absent locally are inserted. No log is ever deleted or overwritten. |

**Semantic card deduplication:** within the same study, if two cards share the same `front`+`back` (after trimming) but different UUIDs, the record with more FSRS progress is kept. Duplicate review logs are merged additively.

### Replace mode

The local database is cleared before import. The file's content becomes the new state. No conflict resolution needed.

---

## Pre-import validations

All checks run before any write. On any failure the database is not modified.

1. **Checksum** — SHA-256 must match (see [Checksum](#checksum)).
2. **Version** — `version` must be `≤ current supported version`. Unknown future versions are rejected.
3. **Referential integrity** — every `study.categoryId` must exist in `categories`; every `card.studyId` must exist in `studies`; every `reviewLog.cardId` must exist in `cards`.
4. **Required fields** — all required fields per entity must be present and well-typed.

---

## Minimal valid `.learnme` example

```json
{
  "version": 1,
  "generatedAt": "2026-01-01T00:00:00.000Z",
  "appVersion": "0.1.0",
  "checksum": "<sha256-hex>",
  "data": {
    "categories": [
      { "id": "01...", "name": "Languages", "color": null }
    ],
    "studies": [
      { "id": "02...", "categoryId": "01...", "name": "Spanish basics", "method": "anki" }
    ],
    "cards": [
      {
        "id": "03...",
        "studyId": "02...",
        "front": "¿Cómo te llamas?",
        "back": "What is your name?",
        "tags": [],
        "state": "new",
        "stability": 0,
        "difficulty": 5,
        "elapsedDays": 0,
        "scheduledDays": 0,
        "reps": 0,
        "lapses": 0,
        "due": "2026-01-01T00:00:00.000Z",
        "lastReviewed": null
      }
    ],
    "reviewLogs": []
  }
}
```
