CREATE TABLE IF NOT EXISTS categories (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    color      TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS studies (
    id           TEXT PRIMARY KEY,
    category_id  TEXT NOT NULL,
    method       TEXT NOT NULL,
    name         TEXT NOT NULL,
    payload_json TEXT NOT NULL DEFAULT '{}',
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS cards (
    id          TEXT PRIMARY KEY,
    deck_id     TEXT NOT NULL,
    front       TEXT NOT NULL,
    back        TEXT NOT NULL,
    tags_json   TEXT NOT NULL DEFAULT '[]',
    stability   REAL NOT NULL DEFAULT 0.0,
    difficulty  REAL NOT NULL DEFAULT 0.0,
    due         TEXT NOT NULL,
    last_review TEXT,
    state       TEXT NOT NULL DEFAULT 'new',
    reps        INTEGER NOT NULL DEFAULT 0,
    lapses      INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (deck_id) REFERENCES studies(id)
);

CREATE TABLE IF NOT EXISTS review_logs (
    id               TEXT PRIMARY KEY,
    card_id          TEXT NOT NULL,
    grade            INTEGER NOT NULL,
    reviewed_at      TEXT NOT NULL,
    prev_stability   REAL NOT NULL,
    prev_difficulty  REAL NOT NULL,
    prev_due         TEXT NOT NULL,
    FOREIGN KEY (card_id) REFERENCES cards(id)
);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
