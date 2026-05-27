# learnMe

> FSRS spaced repetition. 100% local. No subscriptions. No servers.

**learnMe** is a desktop app for Linux and macOS that lets you study any subject using FSRS v5 — the state-of-the-art spaced repetition algorithm. Import decks in seconds, study at a pace that maximises long-term retention, and back up your progress as a single portable file. Your data never leaves your machine.

---

## Why learnMe?

| Problem with other apps | learnMe |
|---|---|
| Anki is powerful but dated and hard to configure | Clean 3-panel layout, frictionless flow |
| Quizlet requires an account and uploads your data | 100% local — no network calls, no account |
| Modern apps charge monthly for basic features | Open source, free forever |
| Anki's SM-2 algorithm uses fixed intervals | FSRS v5 predicts your actual forgetting curve |
| Backups use proprietary formats | Open `.learnme` format — plain JSON, portable |

---

## Screenshots

*Desktop layout — 3-panel view with categories, decks, and card detail.*

*(Screenshots coming soon — run `npm run tauri:dev` to see the app live.)*

---

## Download

Pre-built binaries for Linux — [all releases](https://github.com/leonardespi/learnMe/releases).

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

### Build and install from source
```bash
git clone https://github.com/leonardespi/learnMe.git
cd learnMe
bash install.sh
```

`install.sh` installs Node.js and Rust in user space (no sudo), compiles the app, and registers the `learnme` command. See [CONTRIBUTING.md](CONTRIBUTING.md) for manual setup.

---

## Quick start

1. **Create a category** — click **+ New** in the left panel. Example: "Languages".
2. **Create a deck** — select a category, click **+ New** in the middle panel.
3. **Import cards** — click **Import .json** on a deck and select a JSON file. ([deck format →](docs/import-export.md))
4. **Study** — click **Start review**. Press `Space` to reveal the back face, then rate with `1–4`.
5. **Back up** — go to **Settings → Export session** to save a `.learnme` file.

---

## Key features

- **FSRS v5** — predicts the optimal review interval per card from your actual rating history, not fixed formulas
- **JSON deck import** — drop a `.json` file to populate any deck instantly ([schema →](docs/import-export.md))
- **Markdown cards** — fronts and backs render full Markdown: code blocks, lists, headings
- **Per-deck statistics** — 30-day retention, state distribution, 365-day activity heatmap, 7-day forecast
- **Session backup** — export your entire database (categories, decks, cards, logs) as a single `.learnme` file ([spec →](docs/sync-spec.md))
- **Light and dark mode** — persists across sessions
- **Keyboard-first** — `Space` to flip, `1–4` to rate, `Ctrl+K` for the command palette
- **Zero telemetry** — nothing leaves your machine, ever

---

## Card ratings

| Key | Rating | Meaning |
|---|---|---|
| `1` | Again | Did not recall |
| `2` | Hard | Recalled with difficulty |
| `3` | Good | Recalled correctly |
| `4` | Easy | Recalled effortlessly |

FSRS v5 recalculates the next interval after each rating. Cards you recall easily are pushed weeks or months out; cards you forget are brought back the next day.

---

## Generating decks with AI

Give any LLM a source of truth (article, notes, code) and ask it to generate a learnMe deck.

<details>
<summary><b>Expand prompt template</b></summary>

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

Save the output as `my-deck.json` and import it via **Import .json** inside any deck.

Full schema reference and import rules: [docs/import-export.md](docs/import-export.md)

</details>

---

## Privacy

learnMe is **100% local**:

- No learnMe server exists.
- No analytics, telemetry, or remote crash reporting.
- Network activity occurs only during `npm install` and `cargo build` (build-time only).
- Your decks, ratings, and study history **never leave your machine**.

---

## Documentation

| Doc | Contents | Audience |
|---|---|---|
| [docs/import-export.md](docs/import-export.md) | Full deck JSON schema, validation errors, roundtrip examples, AI prompt | Power users / content creators |
| [docs/sync-spec.md](docs/sync-spec.md) | `.learnme` file format, entity types, merge/conflict logic | Integration developers |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Build from source, tech stack, test suite, code conventions | Contributors |
| [SECURITY.md](SECURITY.md) | Vulnerability reporting | Security researchers |

---

## License

MIT — see [LICENSE](LICENSE).
