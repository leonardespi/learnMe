use chrono::{Duration, Utc};
use rusqlite::{Connection, OptionalExtension};

use crate::core::{error::RepoError, types::Card};

fn row_to_card(row: &rusqlite::Row<'_>) -> rusqlite::Result<Card> {
    let tags_json: String = row.get(4)?;
    let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
    Ok(Card {
        id: row.get(0)?,
        deck_id: row.get(1)?,
        front: row.get(2)?,
        back: row.get(3)?,
        tags,
        stability: row.get(5)?,
        difficulty: row.get(6)?,
        due: row.get(7)?,
        last_review: row.get(8)?,
        state: row.get(9)?,
        reps: row.get(10)?,
        lapses: row.get(11)?,
    })
}

const CARD_SELECT: &str = "SELECT id, deck_id, front, back, tags_json, stability, difficulty, \
    due, last_review, state, reps, lapses FROM cards";

pub fn cmd_next_card(
    conn: &Connection,
    deck_id: &str,
    new_limit: u32,
) -> Result<Option<Card>, RepoError> {
    let now = Utc::now().to_rfc3339();

    // Priority 1: learning/relearning overdue
    let mut stmt = conn.prepare(&format!(
        "{CARD_SELECT} WHERE deck_id = ?1 AND state IN ('learning', 'relearning') \
         AND due <= ?2 ORDER BY due ASC LIMIT 1"
    ))?;
    if let Some(c) = stmt
        .query_row(rusqlite::params![deck_id, now], row_to_card)
        .optional()?
    {
        return Ok(Some(c));
    }

    // Priority 2: review overdue
    let mut stmt = conn.prepare(&format!(
        "{CARD_SELECT} WHERE deck_id = ?1 AND state = 'review' \
         AND due <= ?2 ORDER BY due ASC LIMIT 1"
    ))?;
    if let Some(c) = stmt
        .query_row(rusqlite::params![deck_id, now], row_to_card)
        .optional()?
    {
        return Ok(Some(c));
    }

    // Priority 3: new cards (if cap > 0)
    if new_limit > 0 {
        let mut stmt = conn.prepare(&format!(
            "{CARD_SELECT} WHERE deck_id = ?1 AND state = 'new' ORDER BY rowid ASC LIMIT 1"
        ))?;
        if let Some(c) = stmt
            .query_row(rusqlite::params![deck_id], row_to_card)
            .optional()?
        {
            return Ok(Some(c));
        }
    }

    Ok(None)
}

pub fn cmd_forecast(conn: &Connection, deck_id: &str, days: u32) -> Result<Vec<u32>, RepoError> {
    let today_start = Utc::now()
        .date_naive()
        .and_hms_opt(0, 0, 0)
        .unwrap()
        .and_utc();
    let mut result = Vec::with_capacity(days as usize);

    for i in 0..days {
        let day_end = (today_start + Duration::days(i as i64 + 1)).to_rfc3339();

        let count: u32 = if i == 0 {
            conn.query_row(
                "SELECT COUNT(*) FROM cards WHERE deck_id = ?1 \
                 AND state IN ('review', 'learning', 'relearning') AND due < ?2",
                rusqlite::params![deck_id, day_end],
                |row| row.get(0),
            )?
        } else {
            let day_start = (today_start + Duration::days(i as i64)).to_rfc3339();
            conn.query_row(
                "SELECT COUNT(*) FROM cards WHERE deck_id = ?1 \
                 AND state IN ('review', 'learning', 'relearning') AND due >= ?2 AND due < ?3",
                rusqlite::params![deck_id, day_start, day_end],
                |row| row.get(0),
            )?
        };

        result.push(count);
    }

    Ok(result)
}

// CANNOT TEST: requires tauri::State<AppState> with Tauri runtime — covered in E2E Phase 4
#[tauri::command]
pub async fn next_card(
    state: tauri::State<'_, crate::db::AppState>,
    deck_id: String,
    new_limit: u32,
) -> Result<Option<Card>, RepoError> {
    let conn = state.db.lock().unwrap();
    cmd_next_card(&conn, &deck_id, new_limit)
}

// CANNOT TEST: requires tauri::State<AppState> with Tauri runtime — covered in E2E Phase 4
#[tauri::command]
pub async fn forecast(
    state: tauri::State<'_, crate::db::AppState>,
    deck_id: String,
    days: u32,
) -> Result<Vec<u32>, RepoError> {
    let conn = state.db.lock().unwrap();
    cmd_forecast(&conn, &deck_id, days)
}
