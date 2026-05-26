use chrono::{DateTime, Utc};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::{
    core::{
        error::RepoError,
        types::{Card, ReviewLog},
    },
    methods::anki::fsrs::apply_review,
    repo::{card, review_log},
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordReviewResult {
    pub card: Card,
    pub review_log: ReviewLog,
}

pub fn cmd_record_review(
    conn: &Connection,
    card_id: &str,
    grade: u8,
    now: DateTime<Utc>,
) -> Result<RecordReviewResult, RepoError> {
    let prev = card::get_by_id(conn, card_id)?;
    let update = apply_review(&prev, grade, now)?;

    let updated_card = card::update_fsrs(conn, card_id, update)?;

    let log = review_log::insert(
        conn,
        review_log::CreateReviewLog {
            card_id: card_id.to_string(),
            grade: grade as i32,
            reviewed_at: now.to_rfc3339(),
            prev_stability: prev.stability,
            prev_difficulty: prev.difficulty,
            prev_due: prev.due,
        },
    )?;

    Ok(RecordReviewResult {
        card: updated_card,
        review_log: log,
    })
}

// CANNOT TEST: requires tauri::State<AppState> with Tauri runtime — covered in E2E Phase 4
#[tauri::command]
pub async fn record_review(
    state: tauri::State<'_, crate::db::AppState>,
    card_id: String,
    grade: u8,
) -> Result<RecordReviewResult, RepoError> {
    let conn = state.db.lock().unwrap();
    cmd_record_review(&conn, &card_id, grade, Utc::now())
}
