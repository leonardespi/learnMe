use crate::{core::error::RepoError, db::AppState, stats::DeckStats};

pub fn cmd_get_stats(conn: &rusqlite::Connection, study_id: &str) -> Result<DeckStats, RepoError> {
    crate::stats::compute(conn, study_id, chrono::Utc::now().date_naive())
}

// CANNOT TEST: requires tauri::State<AppState> with live Tauri runtime
#[tauri::command]
pub async fn get_stats(
    state: tauri::State<'_, AppState>,
    study_id: String,
) -> Result<DeckStats, RepoError> {
    let conn = state.db.lock().unwrap();
    cmd_get_stats(&conn, &study_id)
}
