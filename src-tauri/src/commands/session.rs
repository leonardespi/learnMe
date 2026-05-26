use crate::{
    db::AppState,
    session::{
        export::build_learnme,
        import::session_import,
        types::{ImportMode, LearnmeFile},
    },
};

/// Test helper: returns a simulated error without touching the DB, or Ok(()) transparently.
/// Not a Tauri command — never exposed via IPC. Kept in the production build intentionally
/// so integration tests can import it; dead_code lint suppressed for public items by rustc.
pub fn simulate_import_error(
    _conn: &rusqlite::Connection,
    simulate_error: Option<String>,
) -> Result<(), String> {
    if let Some(err) = simulate_error {
        return Err(err);
    }
    Ok(())
}

#[tauri::command]
pub async fn session_export(
    state: tauri::State<'_, AppState>,
    dest_path: String,
) -> Result<(), String> {
    crate::log_call("session_export");
    let conn = state.db.lock().map_err(crate::log_err)?;
    let file = build_learnme(&conn, env!("CARGO_PKG_VERSION")).map_err(crate::log_err)?;
    let json =
        serde_json::to_string_pretty(&file).map_err(|e| format!("serialization error: {e}"))?;
    std::fs::write(&dest_path, json).map_err(|e| format!("write error: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn session_import_cmd(
    state: tauri::State<'_, AppState>,
    src_path: String,
    mode: String,
) -> Result<(), String> {
    crate::log_call("session_import_cmd");
    let raw = std::fs::read_to_string(&src_path).map_err(|e| format!("read error: {e}"))?;
    let file: LearnmeFile = serde_json::from_str(&raw).map_err(|e| format!("parse error: {e}"))?;
    let import_mode = match mode.as_str() {
        "replace" => ImportMode::Replace,
        _ => ImportMode::Merge,
    };
    let conn = state.db.lock().map_err(crate::log_err)?;
    session_import(&conn, &file, import_mode).map_err(crate::log_err)
}
