use rusqlite::Connection;

use crate::core::error::{RepoError, ValidationError};

pub fn cmd_settings_get(conn: &Connection, key: &str) -> Result<Option<String>, RepoError> {
    crate::repo::settings::get(conn, key)
}

pub fn cmd_settings_set(conn: &Connection, key: &str, value: String) -> Result<(), RepoError> {
    if key.trim().is_empty() {
        return Err(RepoError::Validation(ValidationError::EmptyName));
    }
    crate::repo::settings::set(conn, key, &value)
}

#[tauri::command]
pub async fn settings_get(
    state: tauri::State<'_, crate::db::AppState>,
    key: String,
) -> Result<Option<String>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    cmd_settings_get(&conn, &key).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn settings_set(
    state: tauri::State<'_, crate::db::AppState>,
    key: String,
    value: String,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    cmd_settings_set(&conn, &key, value).map_err(|e| e.to_string())
}
