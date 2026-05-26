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
    crate::log_call("settings_get");
    let conn = state.db.lock().map_err(crate::log_err)?;
    cmd_settings_get(&conn, &key).map_err(crate::log_err)
}

#[tauri::command]
pub async fn settings_set(
    state: tauri::State<'_, crate::db::AppState>,
    key: String,
    value: String,
) -> Result<(), String> {
    crate::log_call("settings_set");
    let conn = state.db.lock().map_err(crate::log_err)?;
    cmd_settings_set(&conn, &key, value).map_err(crate::log_err)
}
