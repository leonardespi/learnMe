use rusqlite::Connection;
use thiserror::Error;

pub use crate::session::types::ImportMode;
use crate::session::{
    checksum::compute_checksum,
    types::{LearnmeCard, LearnmeData, LearnmeFile},
};

const MAX_SUPPORTED_VERSION: u32 = 1;

#[derive(Debug, Error)]
pub enum ImportError {
    #[error("checksum mismatch: expected {expected}, got {actual}")]
    ChecksumMismatch { expected: String, actual: String },
    #[error("unsupported version {found}, max supported is {max}")]
    UnsupportedVersion { found: u32, max: u32 },
    #[error("orphan entity: {entity} id={id} references missing {missing_ref}")]
    OrphanEntity {
        entity: String,
        id: String,
        missing_ref: String,
    },
    #[error("validation error: {0}")]
    Validation(String),
    #[error("database: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("serialization: {0}")]
    Serialization(String),
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
}

impl serde::Serialize for ImportError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

pub fn validate_version(version: u32) -> Result<(), ImportError> {
    if version > MAX_SUPPORTED_VERSION {
        return Err(ImportError::UnsupportedVersion {
            found: version,
            max: MAX_SUPPORTED_VERSION,
        });
    }
    Ok(())
}

pub fn verify_checksum(file: &LearnmeFile) -> Result<(), ImportError> {
    let expected = compute_checksum(
        &file.data,
        &file.app_version,
        &file.generated_at,
        file.version,
    )
    .map_err(ImportError::Serialization)?;
    if file.checksum != expected {
        return Err(ImportError::ChecksumMismatch {
            expected,
            actual: file.checksum.clone(),
        });
    }
    Ok(())
}

pub fn validate_fk_integrity(data: &LearnmeData) -> Result<(), ImportError> {
    use std::collections::HashSet;

    let cat_ids: HashSet<&str> = data.categories.iter().map(|c| c.id.as_str()).collect();
    let study_ids: HashSet<&str> = data.studies.iter().map(|s| s.id.as_str()).collect();
    let card_ids: HashSet<&str> = data.cards.iter().map(|c| c.id.as_str()).collect();

    for s in &data.studies {
        if !cat_ids.contains(s.category_id.as_str()) {
            return Err(ImportError::OrphanEntity {
                entity: "study".into(),
                id: s.id.clone(),
                missing_ref: s.category_id.clone(),
            });
        }
    }

    for c in &data.cards {
        if !study_ids.contains(c.study_id.as_str()) {
            return Err(ImportError::OrphanEntity {
                entity: "card".into(),
                id: c.id.clone(),
                missing_ref: c.study_id.clone(),
            });
        }
    }

    for rl in &data.review_logs {
        if !card_ids.contains(rl.card_id.as_str()) {
            return Err(ImportError::OrphanEntity {
                entity: "reviewLog".into(),
                id: rl.id.clone(),
                missing_ref: rl.card_id.clone(),
            });
        }
    }

    Ok(())
}

pub fn resolve_conflict<'a>(
    existing: &'a LearnmeCard,
    incoming: &'a LearnmeCard,
) -> &'a LearnmeCard {
    if incoming.reps > existing.reps {
        return incoming;
    }
    if existing.reps > incoming.reps {
        return existing;
    }
    match (&existing.last_reviewed, &incoming.last_reviewed) {
        (None, Some(_)) => incoming,
        (Some(_), None) => existing,
        (Some(e_date), Some(i_date)) => {
            if i_date > e_date {
                incoming
            } else {
                existing
            }
        }
        (None, None) => existing,
    }
}

pub fn session_import(
    conn: &Connection,
    file: &LearnmeFile,
    mode: ImportMode,
) -> Result<(), ImportError> {
    validate_version(file.version)?;
    verify_checksum(file)?;
    validate_fk_integrity(&file.data)?;

    conn.execute_batch("BEGIN;")?;
    let result = do_import(conn, &file.data, mode);
    match result {
        Ok(()) => {
            conn.execute_batch("COMMIT;")?;
            Ok(())
        }
        Err(e) => {
            conn.execute_batch("ROLLBACK;").ok();
            Err(e)
        }
    }
}

fn do_import(conn: &Connection, data: &LearnmeData, mode: ImportMode) -> Result<(), ImportError> {
    if mode == ImportMode::Replace {
        conn.execute_batch(
            "DELETE FROM review_logs; DELETE FROM cards; DELETE FROM studies; DELETE FROM categories;",
        )?;
    }

    let now = chrono::Utc::now().to_rfc3339();

    for cat in &data.categories {
        let existing: Option<String> = conn
            .query_row(
                "SELECT name FROM categories WHERE id = ?1",
                rusqlite::params![cat.id],
                |row| row.get(0),
            )
            .optional()?;
        if existing.is_none() {
            conn.execute(
                "INSERT INTO categories (id, name, color, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
                rusqlite::params![cat.id, cat.name, cat.color, now, now],
            )?;
        }
        // UUID exists (same or different name) → keep local, no update
    }

    for study in &data.studies {
        let exists: bool = conn
            .query_row(
                "SELECT 1 FROM studies WHERE id = ?1",
                rusqlite::params![study.id],
                |_| Ok(true),
            )
            .optional()?
            .unwrap_or(false);
        if !exists {
            let payload_json = "{}";
            conn.execute(
                "INSERT INTO studies (id, category_id, method, name, payload_json, created_at, updated_at) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                rusqlite::params![
                    study.id,
                    study.category_id,
                    study.method,
                    study.name,
                    payload_json,
                    now,
                    now
                ],
            )?;
        }
    }

    for file_card in &data.cards {
        let db_card_opt = find_card_by_id(conn, &file_card.id)?;

        if let Some(db_card) = db_card_opt {
            let winner = resolve_conflict(&db_card, file_card);
            if (winner.id == file_card.id && winner.id != db_card.id)
                || winner.reps > db_card.reps
                || (winner.reps == file_card.reps
                    && winner.last_reviewed == file_card.last_reviewed
                    && db_card.last_reviewed != file_card.last_reviewed)
            {
                apply_card_update(conn, &db_card.id, file_card)?;
            }
            // else existing wins → no-op
        } else {
            let semantic_match =
                find_card_by_content(conn, &file_card.study_id, &file_card.front, &file_card.back)?;
            if let Some(existing) = semantic_match {
                let winner = resolve_conflict(&existing, file_card);
                if std::ptr::eq(winner, file_card)
                    || winner.reps > existing.reps
                    || (winner.reps == file_card.reps
                        && winner.last_reviewed == file_card.last_reviewed)
                {
                    apply_card_update(conn, &existing.id, file_card)?;
                }
            } else {
                let tags_json =
                    serde_json::to_string(&file_card.tags).unwrap_or_else(|_| "[]".into());
                conn.execute(
                    "INSERT INTO cards \
                     (id, deck_id, front, back, tags_json, stability, difficulty, due, \
                      last_review, state, reps, lapses) \
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                    rusqlite::params![
                        file_card.id,
                        file_card.study_id,
                        file_card.front,
                        file_card.back,
                        tags_json,
                        file_card.stability,
                        file_card.difficulty,
                        file_card.due,
                        file_card.last_reviewed,
                        file_card.state,
                        file_card.reps,
                        file_card.lapses,
                    ],
                )?;
            }
        }
    }

    for rl in &data.review_logs {
        let exists: bool = conn
            .query_row(
                "SELECT 1 FROM review_logs WHERE id = ?1",
                rusqlite::params![rl.id],
                |_| Ok(true),
            )
            .optional()?
            .unwrap_or(false);
        if !exists {
            conn.execute(
                "INSERT INTO review_logs \
                 (id, card_id, grade, reviewed_at, prev_stability, prev_difficulty, prev_due) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                rusqlite::params![
                    rl.id,
                    rl.card_id,
                    rl.grade,
                    rl.reviewed_at,
                    rl.stability,
                    rl.difficulty,
                    rl.reviewed_at,
                ],
            )?;
        }
    }

    Ok(())
}

fn find_card_by_id(conn: &Connection, id: &str) -> Result<Option<LearnmeCard>, ImportError> {
    let result = conn.query_row(
        "SELECT id, deck_id, front, back, tags_json, state, stability, difficulty, \
         due, last_review, reps, lapses FROM cards WHERE id = ?1",
        rusqlite::params![id],
        |row| {
            let tags_json: String = row.get(4)?;
            let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
            Ok(LearnmeCard {
                id: row.get(0)?,
                study_id: row.get(1)?,
                front: row.get(2)?,
                back: row.get(3)?,
                tags,
                state: row.get(5)?,
                stability: row.get(6)?,
                difficulty: row.get(7)?,
                elapsed_days: 0,
                scheduled_days: 0,
                due: row.get(8)?,
                last_reviewed: row.get(9)?,
                reps: row.get(10)?,
                lapses: row.get(11)?,
            })
        },
    );
    match result {
        Ok(c) => Ok(Some(c)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(ImportError::Db(e)),
    }
}

fn find_card_by_content(
    conn: &Connection,
    deck_id: &str,
    front: &str,
    back: &str,
) -> Result<Option<LearnmeCard>, ImportError> {
    let result = conn.query_row(
        "SELECT id, deck_id, front, back, tags_json, state, stability, difficulty, \
         due, last_review, reps, lapses \
         FROM cards WHERE deck_id = ?1 AND TRIM(front) = ?2 AND TRIM(back) = ?3 LIMIT 1",
        rusqlite::params![deck_id, front.trim(), back.trim()],
        |row| {
            let tags_json: String = row.get(4)?;
            let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
            Ok(LearnmeCard {
                id: row.get(0)?,
                study_id: row.get(1)?,
                front: row.get(2)?,
                back: row.get(3)?,
                tags,
                state: row.get(5)?,
                stability: row.get(6)?,
                difficulty: row.get(7)?,
                elapsed_days: 0,
                scheduled_days: 0,
                due: row.get(8)?,
                last_reviewed: row.get(9)?,
                reps: row.get(10)?,
                lapses: row.get(11)?,
            })
        },
    );
    match result {
        Ok(c) => Ok(Some(c)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(ImportError::Db(e)),
    }
}

fn apply_card_update(
    conn: &Connection,
    card_id: &str,
    winner: &LearnmeCard,
) -> Result<(), ImportError> {
    let tags_json = serde_json::to_string(&winner.tags).unwrap_or_else(|_| "[]".into());
    conn.execute(
        "UPDATE cards SET stability=?1, difficulty=?2, due=?3, last_review=?4, \
         state=?5, reps=?6, lapses=?7, tags_json=?8 WHERE id=?9",
        rusqlite::params![
            winner.stability,
            winner.difficulty,
            winner.due,
            winner.last_reviewed,
            winner.state,
            winner.reps,
            winner.lapses,
            tags_json,
            card_id,
        ],
    )?;
    Ok(())
}

trait OptionalExt<T> {
    fn optional(self) -> Result<Option<T>, rusqlite::Error>;
}

impl<T> OptionalExt<T> for Result<T, rusqlite::Error> {
    fn optional(self) -> Result<Option<T>, rusqlite::Error> {
        match self {
            Ok(v) => Ok(Some(v)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }
}
