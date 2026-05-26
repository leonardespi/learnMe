// Test-only Tauri commands for E2E native tests.
// `dev_reset_db` truncates all tables so each native E2E test starts from a clean DB.
// Safe in a local desktop app: the command is only reachable via the app's own WebView IPC.

#[tauri::command]
pub async fn dev_reset_db(
    state: tauri::State<'_, crate::db::AppState>,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(crate::log_err)?;
    conn.execute_batch(
        "DELETE FROM review_logs;\
         DELETE FROM cards;\
         DELETE FROM studies;\
         DELETE FROM categories;\
         DELETE FROM settings;",
    )
    .map_err(|e| e.to_string())
}
