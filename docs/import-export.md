# Deck import / export

Decks are imported and exported as `.json` files. The format is a plain JSON object — human-readable, diff-friendly, and AI-friendly.

---

## Deck JSON schema

```json
{
  "schemaVersion": "1.0.0",
  "method": "anki",
  "name": "My Deck",
  "tags": ["optional", "deck-level-tags"],
  "cards": [
    {
      "front": "Question — Markdown supported",
      "back": "Answer — Markdown supported",
      "tags": ["optional", "card-tags"],
      "state": "new"
    }
  ]
}
```

### Root fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `schemaVersion` | `string` | yes | Use `"1.0.0"` |
| `method` | `"anki"` | yes | Must be exactly `"anki"` |
| `name` | `string` (non-empty) | yes | Deck name shown in the UI |
| `tags` | `string[]` | no | Deck-level tags; defaults to `[]` |
| `cards` | `object[]` | yes | Array of card objects |

### Card fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `front` | `string` (non-empty) | yes | Question face; Markdown rendered |
| `back` | `string` (non-empty) | yes | Answer face; Markdown rendered |
| `tags` | `string[]` | no | Card-level tags; defaults to `[]` |
| `state` | `"new" \| "learning" \| "review" \| "relearning"` | no | FSRS state; defaults to `"new"` |
| `stability` | `number` | no | FSRS stability (days); omit for new cards |
| `difficulty` | `number` | no | FSRS difficulty 1–10; omit for new cards |
| `due` | `string` (ISO 8601) | no | Next review date; omit for new cards |
| `lastReview` | `string \| null` (ISO 8601) | no | Last review timestamp; omit for new cards |
| `reps` | `integer ≥ 0` | no | Total review count; omit for new cards |
| `lapses` | `integer ≥ 0` | no | Lapse count; omit for new cards |

**For new cards:** only `front`, `back`, and optionally `tags` and `state: "new"` are needed. Leave all FSRS fields out.

**For roundtrip exports:** all FSRS fields are present. Importing such a file restores the exact card state.

---

## Validation errors

| Error | Cause | Fix |
|---|---|---|
| `Missing required field: method` | `method` key absent | Add `"method": "anki"` |
| `Invalid enum value: method` | `method` is not `"anki"` | Set `"method"` to the literal string `"anki"` |
| `String must contain at least 1 character: name` | `name` is `""` | Provide a non-empty deck name |
| `String must contain at least 1 character: front` | Card `front` is empty | All cards need non-empty `front` |
| `String must contain at least 1 character: back` | Card `back` is empty | All cards need non-empty `back` |
| `Unrecognized key: <key>` | Extra field in root or card object | Remove fields not in the schema above |
| `Invalid JSON` | Malformed JSON syntax | Validate with a JSON linter |

---

## Re-import (deduplication)

Importing a `.json` file into a deck that already has cards uses semantic deduplication:

- Cards matched by **exact `front` + `back`** (after trimming whitespace) are **skipped** — their existing FSRS state is preserved.
- Cards not found in the deck are **inserted** as new.
- The import result reports `{ inserted: N, skipped: M }`.

This means you can re-import an updated version of a deck to add new cards without resetting progress on existing ones.

---

## Roundtrip export

Exporting a deck via **right-click → Export deck** produces a `.json` file with all FSRS fields populated. Re-importing that file into an empty deck restores the exact card states.

Export format is a superset of the import format — all card fields are present, including `stability`, `difficulty`, `due`, `lastReview`, `reps`, `lapses`, and `state`.

---

## Generating decks with AI

Give any LLM a source of truth (article, notes, code) and ask it to generate a learnMe deck.

**Prompt template:**

````
You are a spaced repetition expert. Generate a learnMe flashcard deck as a single valid JSON object.

## STRICT SCHEMA — follow exactly, no extra fields

```json
{
  "schemaVersion": "1.0.0",
  "method": "anki",
  "name": "<deck name>",
  "tags": ["<tag1>"],
  "cards": [
    {
      "front": "<question — Markdown supported>",
      "back": "<answer — Markdown supported>",
      "tags": ["<card-tag>"],
      "state": "new"
    }
  ]
}
```

Rules:
- Root fields: schemaVersion, method, name, tags, cards — NOTHING ELSE.
- Card fields: front, back, tags, state — NOTHING ELSE for new cards.
- method must be exactly "anki".
- front and back must be non-empty strings.
- state must be "new" for all generated cards.
- Do NOT include $schema, id, stability, difficulty, due, lastReview, reps, or lapses.
- Output raw JSON only. No explanation, no markdown fences.

## SOURCE OF TRUTH

[PASTE YOUR CONTENT HERE]

## DECK PARAMETERS

- Deck name: [NAME]
- Number of cards: [~N]
- Card style: [e.g. "direct Q&A", "fill-in-the-blank", "definition → term"]
- Language: [e.g. English]

Generate the JSON deck now.
````

Save the output as `my-deck.json` and import it via **Import .json** on any deck.
