# learnMe

> FSRS spaced repetition. 100% local. No subscriptions. No servers. Just you and your knowledge.

**learnMe** is a desktop application for Linux and macOS that lets you study any subject using the most advanced spaced repetition algorithm available today: **FSRS v5**. Import decks in seconds, study at an AI-optimized pace that maximizes long-term retention, and export your complete progress as a portable file. Your study history never leaves your machine.

---

## Why learnMe?

| Problem with other apps | learnMe |
|---|---|
| Anki is powerful but dated and hard to configure | Clean 3-panel layout, frictionless flow |
| Quizlet and similar apps require an account and send your data to the cloud | 100% local, no network calls, no account |
| Modern apps charge a monthly subscription for basic features | Open source, free forever |
| Anki's legacy SM-2 algorithm is suboptimal | FSRS v5 — state of the art in spaced repetition |
| Backups are complicated or use proprietary formats | Open `.learnme` format: plain JSON, portable across installations |

---

## How It Works

learnMe is built on three core concepts:

### Categories
Top-level buckets that group related decks. Think of them as subjects: "Languages", "Medicine", "Programming". Categories appear in the left navigation panel.

### Decks (Studies)
A deck lives inside a category and holds flashcards. Each deck tracks its own FSRS state independently — cards in "Spanish A2" don't affect cards in "Anatomy".

### Cards
Each card has a **front** (question) and a **back** (answer), both rendered as Markdown. Behind the scenes, FSRS v5 tracks two parameters per card:

- **Stability (S)** — days until the probability of recall drops below 90%.
- **Difficulty (D)** — how inherently hard this specific card is (1–10). FSRS learns this from your rating history.

When you finish reviewing a card, you rate it:

| Rating | Meaning | Keyboard |
|---|---|---|
| **Again** | Did not recall | `1` |
| **Hard** | Recalled with difficulty | `2` |
| **Good** | Recalled correctly | `3` |
| **Easy** | Recalled effortlessly | `4` |

The algorithm recalculates the next review interval automatically. The more consistently you recall a card, the longer the interval grows — weeks, then months.

### Study Session Flow

```
Select deck → Start review → See front → Think → Space → See back → Rate → Next card
```

When all due cards are reviewed, the session ends and you return to the deck detail view.

---

## Key Features

- **FSRS v5 algorithm** — Same algorithm powering modern Anki. Calculates the optimal interval per card based on your actual retention history, not fixed formulas.
- **JSON deck import** — Drop a `.json` file on a deck and cards appear in seconds.
- **Markdown in cards** — Front and back render full Markdown: lists, code blocks, headings, emphasis.
- **Per-deck statistics** — 30-day retention, FSRS state distribution (new / learning / review / relearning), 365-day activity heatmap, 7-day forecast.
- **Full session backup** — Export your entire database (categories, decks, cards, review logs) as a single `.learnme` file. Import on another machine in one click.
- **Light and dark mode** — Persists between sessions.
- **Keyboard-first** — `⌘K` / `Ctrl+K` for the command palette, `Space` to rate cards.
- **Zero telemetry** — No data leaves your machine. Ever.

---

## Screenshots

### Main view — categories and decks

The desktop layout uses 3 panels: left navigation, item list, and detail/inspection. Categories group study decks. Create categories and decks with the `+ New` button in each panel header.

*(Cards for a selected deck appear in the right panel — front, FSRS state badge, and edit/delete buttons per row.)*

### Statistics panel

Each deck has its own statistics page accessible via the **Statistics** button:

- **Retention (30d)**: percentage of cards recalled correctly in the last 30 days.
- **State distribution**: card counts per FSRS phase.
- **Activity (365 days)**: heatmap of days with completed reviews.
- **Forecast (7 days)**: bar chart of cards due each day for the next week.

### Settings — session backup

From **Settings** you can export and import your full session. The **Export session** button generates a `.learnme` file at a path you choose. **Import session** loads a previously exported file with intelligent conflict resolution.

---

## Download

Pre-built binaries for Linux are available on the [Releases page](https://github.com/leonardespi/learnMe/releases/tag/v0.1.0).

### Debian / Ubuntu

```bash
wget https://github.com/leonardespi/learnMe/releases/download/v0.1.0/learnMe_0.1.0_amd64.deb
sudo dpkg -i learnMe_0.1.0_amd64.deb
```

### Fedora / Red Hat / openSUSE

```bash
wget https://github.com/leonardespi/learnMe/releases/download/v0.1.0/learnMe-0.1.0-1.x86_64.rpm
sudo rpm -i learnMe-0.1.0-1.x86_64.rpm
```

### Any Linux distro (AppImage)

```bash
wget https://github.com/leonardespi/learnMe/releases/download/v0.1.0/learnMe_0.1.0_amd64.AppImage
chmod +x learnMe_0.1.0_amd64.AppImage
./learnMe_0.1.0_amd64.AppImage
```

| Package | Platform | Size |
|---|---|---|
| [`learnMe_0.1.0_amd64.deb`](https://github.com/leonardespi/learnMe/releases/download/v0.1.0/learnMe_0.1.0_amd64.deb) | Debian / Ubuntu | 6.4 MB |
| [`learnMe-0.1.0-1.x86_64.rpm`](https://github.com/leonardespi/learnMe/releases/download/v0.1.0/learnMe-0.1.0-1.x86_64.rpm) | Fedora / Red Hat | 6.4 MB |
| [`learnMe_0.1.0_amd64.AppImage`](https://github.com/leonardespi/learnMe/releases/download/v0.1.0/learnMe_0.1.0_amd64.AppImage) | Any Linux (x86_64) | 78 MB |

---

## Build from source

### Prerequisites

- **Node.js** ≥ 18
- **Rust** ≥ 1.78 (with `cargo`)
- **Tauri system dependencies** for your distro:
  - Ubuntu/Debian: `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`
  - Arch: `webkit2gtk-4.1 libappindicator-gtk3`
  - macOS: Xcode Command Line Tools

### Development

```bash
git clone <repo-url>
cd learnme
npm install
npm run tauri:dev
```

### Production build

```bash
npm run tauri:build
```

The signed binary lands in `src-tauri/target/release/bundle/`.

### Frontend only (no Tauri)

```bash
npm run dev
# → http://localhost:1420
```

---

## Usage Guide

### 1. Create a category

Categories organize decks by subject. Examples: "Languages", "Medicine", "Programming".

1. Open the app. The initial view shows the **CATEGORIES** panel.
2. Click **+ New** in the panel header.
3. Type the name and press `Enter` or the ✓ button.

### 2. Create a deck

A deck lives inside a category and holds your cards.

1. Click a category to expand it. The **STUDIES** panel appears.
2. Click **+ New**, type the deck name, and confirm.

### 3. Import cards from a JSON file

The fastest way to populate a deck. Prepare a `.json` file matching the [deck import schema](#deck-import-contract-json-file), then:

1. Select the deck in the studies panel. The deck detail panel appears on the right.
2. Click **Import .json**.
3. Select your file. A confirmation with the file name is shown.
4. Click **Confirm**.

Cards appear immediately in the list, each showing its FSRS state (`new`, `learning`, `review`, `relearning`) as a colored badge.

### 4. Edit or delete a card

Each card row shows two buttons on hover:

- **✎ (Pencil)** — Opens an inline edit panel. Modify front and back, save with ✓.
- **🗑 (Trash)** — Deletes the card and its review history.

Hover over a deck or category in their respective panels to rename or delete them with the same icons.

### 5. Start a review session

1. Select a deck.
2. Click **Start review** (or press `Space` with the deck selected).
3. The front face of the first card appears. Think about the answer.
4. Press `Space` to reveal the back.
5. Rate your recall (`1`–`4`).
6. Repeat until all due cards are reviewed.

### 6. Review statistics

From the deck detail panel, click **Statistics** to see retention, state distribution, activity heatmap, and the 7-day forecast.

### 7. Export full session

Go to **Settings** → **Session backup** → **Export session**. Choose a path and file name. A `.learnme` file is generated containing your entire database.

### 8. Import a session

Go to **Settings** → **Import session**. Select a `.learnme` file.

Default import mode is **merge**: preserves local progress and the file's progress, resolving per-card conflicts with "most reviewed wins". See [Session import conflict resolution](#session-import-conflict-resolution) for full details.

---

## Generating Decks with AI

The fastest way to create a rich deck is to give an LLM a source of truth (a book chapter, a Wikipedia article, lecture notes, a code file) and ask it to generate a valid learnMe JSON deck.

Copy the prompt below, replace the placeholders, and paste it into any AI assistant (Claude, ChatGPT, Gemini, etc.):

````
You are a spaced repetition expert. Generate a learnMe flashcard deck as a single valid JSON object.

## STRICT SCHEMA — follow exactly, no extra fields

```json
{
  "schemaVersion": "1.0.0",
  "method": "anki",
  "name": "<deck name>",
  "tags": ["<tag1>", "<tag2>"],
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
- Root fields allowed: schemaVersion, method, name, tags, cards — NOTHING ELSE.
- Card fields allowed: front, back, tags, state — NOTHING ELSE for new cards.
- method must be exactly "anki".
- front and back must be non-empty strings. Markdown is supported and encouraged.
- state must be "new" for all generated cards.
- Do NOT include $schema, id, stability, difficulty, due, lastReview, reps, or lapses — the app assigns these on import.
- Output raw JSON only. No explanation, no markdown fences, no commentary.

## SOURCE OF TRUTH

[PASTE YOUR CONTENT HERE — article, chapter, notes, code, etc.]

## DECK PARAMETERS

- Deck name: [NAME]
- Tags: [TAG1, TAG2, ...]
- Number of cards: [~N]
- Card style: [e.g. "concise Q&A", "fill-in-the-blank", "true/false with explanation", "definition → term"]
- Language: [e.g. English, Spanish, mixed]

Generate the JSON deck now.
````

### Example prompt filled in

```
Deck name: Studio Ghibli Trivia
Tags: anime, ghibli, film
Number of cards: ~10
Card style: direct Q&A, answers include bold key facts
Language: English
Source: [paste your Ghibli article here]
```

### Example output (matches active deck style)

```json
{
  "schemaVersion": "1.0.0",
  "method": "anki",
  "name": "Studio Ghibli Trivia",
  "tags": ["anime", "ghibli", "film"],
  "cards": [
    {
      "front": "Who co-founded Studio Ghibli and directed *Spirited Away*?",
      "back": "**Hayao Miyazaki** co-founded Studio Ghibli alongside Isao Takahata in 1985.",
      "tags": ["directors"],
      "state": "new"
    },
    {
      "front": "### True or False\nIsao Takahata directed *My Neighbor Totoro*.",
      "back": "**False.** *My Neighbor Totoro* (1988) was directed by **Hayao Miyazaki**. Takahata directed *Grave of the Fireflies* the same year.",
      "tags": ["directors", "films"],
      "state": "new"
    }
  ]
}
```

Save the output as `my-deck.json` and import it via **Import .json** inside any deck.

---

## Deck Import Contract (JSON file)

To import a deck from a file, the JSON must conform to the following schema. Optional fields carry over FSRS state and are used for roundtrip export/import workflows.

### Full schema

> **Note**: the block below is the JSON Schema document (the validator). It is not a valid deck file. In particular, **do not include `$schema` in your `.json` files** — the schema has `additionalProperties: false` and will reject it.

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

### Required root-level fields

| Field | Type | Description |
|---|---|---|
| `schemaVersion` | `string` | Schema version. Currently `"1.0.0"`. |
| `method` | `string` | Must be exactly `"anki"`. Other values are rejected. |
| `name` | `string` | Deck name. Minimum 1 character. Used as the study name on creation. |
| `cards` | `array` | Array of cards. May be empty `[]`. |

### Optional root-level fields

| Field | Type | Description |
|---|---|---|
| `tags` | `string[]` | Global deck tags. Informational for now. Default: `[]`. |

### Card fields

| Field | Required | Type | Description |
|---|---|---|---|
| `front` | ✅ | `string` | Card front face. Supports Markdown. Min 1 character. |
| `back` | ✅ | `string` | Card back face. Supports Markdown. Min 1 character. |
| `tags` | ❌ | `string[]` | Card-level tags. Default: `[]`. |
| `stability` | ❌ | `number` | FSRS stability — days until 90% recall probability. Default: `0`. |
| `difficulty` | ❌ | `number` | FSRS difficulty of the card. Default: `0`. |
| `due` | ❌ | `string` | Due date ISO 8601. Default: now. |
| `lastReview` | ❌ | `string \| null` | Last review timestamp ISO 8601. Default: `null`. |
| `state` | ❌ | `"new" \| "learning" \| "review" \| "relearning"` | FSRS state. Default: `"new"`. |
| `reps` | ❌ | `integer ≥ 0` | Total review count. Default: `0`. |
| `lapses` | ❌ | `integer ≥ 0` | Total `Again` ratings. Default: `0`. |

### Deduplication on import

If cards already exist in the target deck, the importer applies these rules:

1. **New card (front+back not in deck)** → inserted directly.
2. **Same `front` and `back` (semantic match)** → `reps` and `lastReview` are compared. More reviews wins. Tie broken by most recent `lastReview`.
3. **Exact duplicate** → silently skipped.

The command returns `{ "inserted": N, "skipped": M }`.

### Minimal valid example

```json
{
  "schemaVersion": "1.0.0",
  "method": "anki",
  "name": "World Capitals",
  "cards": [
    { "front": "Capital of France?", "back": "Paris" },
    { "front": "Capital of Japan?",  "back": "Tokyo" },
    { "front": "Capital of Brazil?", "back": "Brasília" }
  ]
}
```

### Example with preserved FSRS state (roundtrips)

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

### Common validation errors

| Error | Cause | Fix |
|---|---|---|
| `schema error at /method: ...` | `method` is not `"anki"` | Change value to `"anki"` |
| `schema error at /cards/0/front: ...` | `front` is empty or missing | All `front` and `back` must have at least 1 character |
| `schema error at /cards/N: ...` | Unrecognized property on a card | Remove any properties not listed in the schema (`additionalProperties: false`) |
| `schema error at ...: ...` | Unrecognized root property (e.g. `$schema`) | Root also has `additionalProperties: false`. Only `schemaVersion`, `method`, `name`, `tags`, `cards` are allowed |
| `parse error: ...` | File is not valid JSON | Validate your JSON before importing |

---

## Deck Export Format (`.json`)

When you export a deck individually (via internal command), the generated JSON has this format:

```json
{
  "schemaVersion": "1.0.0",
  "method": "anki",
  "name": "Deck name",
  "tags": [],
  "cards": [
    {
      "front": "front text",
      "back": "back text",
      "tags": ["tag1"],
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

This JSON conforms to the same schema accepted by the importer — an export is directly re-importable.

---

## Session File Contract (`.learnme`)

A `.learnme` file is a **complete backup of your entire database**: categories, decks, cards with FSRS state, and review logs. Generated from **Settings → Export session**.

### File structure

```
<file>.learnme  (JSON, UTF-8, pretty-printed)
├── version          : number    — Format version (currently: 1)
├── generatedAt      : string    — ISO 8601 UTC export timestamp
├── appVersion       : string    — learnMe version that generated the file (e.g. "0.1.0")
├── checksum         : string    — SHA-256 hex of data + appVersion + generatedAt + version
└── data
    ├── categories   : Category[]
    ├── studies      : Study[]
    ├── cards        : Card[]
    └── reviewLogs   : ReviewLog[]
```

### `Category` type

```json
{
  "id":    "01944b2a-0000-7000-8000-000000000001",
  "name":  "Languages",
  "color": "#3b82f6"
}
```

| Field | Type | Description |
|---|---|---|
| `id` | `string` | UUIDv7 |
| `name` | `string` | Category name |
| `color` | `string \| null` | Hex color. `null` if no color was assigned |

### `Study` (deck) type

```json
{
  "id":         "01944b2a-0000-7000-8000-000000000002",
  "categoryId": "01944b2a-0000-7000-8000-000000000001",
  "name":       "Vocabulary A2",
  "method":     "anki"
}
```

| Field | Type | Description |
|---|---|---|
| `id` | `string` | UUIDv7 |
| `categoryId` | `string` | Parent category ID |
| `name` | `string` | Deck name |
| `method` | `string` | Always `"anki"` in v0.1 |

### `Card` type

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

| Field | Type | Description |
|---|---|---|
| `id` | `string` | UUIDv7 |
| `studyId` | `string` | Parent deck ID |
| `front` | `string` | Front face (Markdown) |
| `back` | `string` | Back face (Markdown) |
| `tags` | `string[]` | Tags |
| `state` | `"new" \| "learning" \| "review" \| "relearning"` | Current FSRS state |
| `stability` | `number` | FSRS S parameter: days until 90% recall |
| `difficulty` | `number` | FSRS D parameter: inherent card difficulty (1–10) |
| `elapsedDays` | `number` | Days since `lastReviewed` at export time |
| `scheduledDays` | `number` | Days between `lastReviewed` and `due` |
| `reps` | `number` | Total reviews |
| `lapses` | `number` | Total `Again` ratings |
| `due` | `string` | Next review date (ISO 8601 UTC) |
| `lastReviewed` | `string \| null` | Last review date (ISO 8601 UTC) or `null` if never reviewed |

### `ReviewLog` type

```json
{
  "id":            "01944b2a-0000-7000-8000-000000000010",
  "cardId":        "01944b2a-0000-7000-8000-000000000003",
  "grade":         3,
  "reviewedAt":    "2026-05-26T09:00:00Z",
  "stability":     9.1,
  "difficulty":    5.0,
  "elapsedDays":   0,
  "scheduledDays": 0,
  "reviewState":   0
}
```

| Field | Type | Description |
|---|---|---|
| `id` | `string` | UUIDv7 |
| `cardId` | `string` | Reviewed card ID |
| `grade` | `integer` | Rating given: `1` = Again, `2` = Hard, `3` = Good, `4` = Easy |
| `reviewedAt` | `string` | Review timestamp (ISO 8601 UTC) |
| `stability` | `number` | Stability **before** this review |
| `difficulty` | `number` | Difficulty **before** this review |
| `elapsedDays` | `number` | Days since the previous review |
| `scheduledDays` | `number` | Days that were scheduled between reviews |
| `reviewState` | `integer` | Review state (internal FSRS use) |

### Minimal valid `.learnme` file

```json
{
  "version": 1,
  "generatedAt": "2026-05-26T10:00:00Z",
  "appVersion": "0.1.0",
  "checksum": "c2722b3ac8e9f3f0c46146b5eb1bdf9b83fbaafa2229e704a5ea720769602c70",
  "data": {
    "categories": [
      { "id": "01944b2a-0000-7000-8000-000000000001", "name": "Languages", "color": null }
    ],
    "studies": [
      {
        "id":         "01944b2a-0000-7000-8000-000000000002",
        "categoryId": "01944b2a-0000-7000-8000-000000000001",
        "name":       "Vocabulary A2",
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

> **Important**: the `checksum` field is a SHA-256 calculated over `data` serialized + `appVersion` + `generatedAt` + `version`. learnMe verifies this checksum on import. A `.learnme` file modified manually without updating the checksum will be rejected with a `checksum mismatch` error. To generate `.learnme` files programmatically, always use learnMe's official export.

---

## Session Import Conflict Resolution

When importing a session with **merge** mode (the default), learnMe applies the following rules per entity:

### Categories

- UUID already exists in local database → **local is kept** (no name or color update).
- UUID not found → **inserted** from the file.

### Decks (Studies)

- UUID already exists → **local is kept**.
- UUID not found → **inserted** from the file.

### Cards

| Situation | Rule |
|---|---|
| File card has **more `reps`** than local | File card wins |
| Local card has **more `reps`** than file | Local wins |
| Tied `reps`, file card has more recent `lastReview` | File card wins |
| Tied `reps`, local card has more recent `lastReview` | Local wins |
| Neither has `lastReview` (both `null`) | Local wins |
| Only file card has `lastReview` | File card wins |
| No UUID match but same `front`+`back` in same deck | Same reps/date logic applies as a semantic match |
| No UUID match, no content match | Inserted as new |

### ReviewLogs

- UUID already exists → **ignored** (no duplicates inserted).
- UUID not found → **inserted**.

### `replace` mode

If you use **replace** mode (not available from the UI currently, code-only), all tables are dropped before import. Used to restore a clean session from a backup.

### Pre-import validations

Before touching the database, learnMe validates:

1. **Supported version**: the file's `version` field cannot exceed the maximum supported version (currently `1`).
2. **Checksum**: recalculated and verified against the file's `checksum` field.
3. **Referential integrity**: no deck may reference a missing category, no card a missing deck, no `reviewLog` a missing card.

If any validation fails, **the import is cancelled entirely** (transaction rollback). Nothing is modified.

---

## The FSRS v5 Algorithm

FSRS (Free Spaced Repetition Scheduler) is the state-of-the-art spaced repetition algorithm, designed to maximize long-term retention while minimizing study time.

Unlike the SM-2 algorithm (Anki's legacy scheduler), FSRS explicitly models two memory properties per card:

- **Stability (S)**: days until the recall probability drops below 90%.
- **Difficulty (D)**: how inherently hard the card is (1–10). FSRS learns this automatically from your rating history.

The interval to the next review is calculated as:

```
interval = S × ln(FSRS_TARGET_RETENTION) / ln(0.9)
```

where `FSRS_TARGET_RETENTION` defaults to `0.9` (90% target retention).

Each rating (`Again`, `Hard`, `Good`, `Easy`) updates S and D using the official FSRS v5 formulas, implemented by the Rust crate [`rs-fsrs`](https://crates.io/crates/rs-fsrs).

---

## Card States

| State | Color | Meaning |
|---|---|---|
| `new` | Blue | Card has never been reviewed |
| `learning` | Orange | Initial learning phase (first reviews hours apart) |
| `review` | Green | In spaced repetition cycle (intervals in days or weeks) |
| `relearning` | Purple | Forgotten and relearning (`Again` rated while in `review` state) |

---

## Markdown in Cards

Front and back faces render full Markdown:

```
**bold**            → bold
*italic*            → italic
`inline code`       → inline code
# Heading
- Bullet list
1. Numbered list
> Blockquote

```code
code block
```
```

Particularly useful for technical subjects: define formulas as code, list steps numerically, or use headings to structure complex cards.

---

## Privacy

learnMe is **100% local** by design:

- No learnMe server exists.
- No analytics SDK, telemetry, remote crash reporting, or A/B testing.
- The only network activity occurs during `npm install` and `cargo build` to download build-time dependencies. Nothing else.
- Your decks, ratings, and study history **never leave your machine**.
- The `.learnme` backup file is yours: open JSON, human-readable, portable. Not tied to any account or service.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri 2 |
| Frontend | React 18 + TypeScript (strict) |
| Global state | Zustand |
| Data fetching | TanStack Query |
| Styles | Tailwind CSS 4 + CSS variables |
| Backend | Rust |
| Database | Embedded SQLite (`rusqlite` + `bundled`) |
| Migrations | `refinery` |
| SRS algorithm | FSRS v5 via `rs-fsrs` crate |
| Schema validation | JSON Schema (generated from Zod, consumed by `jsonschema` in Rust) |
| Icons | `lucide-react` |
| TS unit tests | Vitest + Testing Library |
| Rust unit tests | `cargo test` |
| E2E tests | Playwright + `tauri-driver` |

---

## Development & Tests

```bash
# TypeScript unit tests
npm run test

# TypeScript tests in watch mode
npm run test:watch

# Rust tests
cargo test

# Lint and typecheck
npm run lint
npm run typecheck
cargo clippy -- -D warnings

# Full CI suite (lint + types + cargo check + all tests)
./scripts/ci.sh
```

---

## License

MIT — see `LICENSE`.

---

*learnMe v0.1.0 — Linux + macOS*
