pub use crate::methods::anki::export::cmd_export_anki_deck;
pub use crate::methods::anki::import::{cmd_import_anki_deck, ImportError, ImportResult};

#[tauri::command]
pub async fn import_anki_deck(
    state: tauri::State<'_, crate::db::AppState>,
    category_id: String,
    file_path: String,
) -> Result<ImportResult, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    cmd_import_anki_deck(&conn, &category_id, &file_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn export_anki_deck(
    state: tauri::State<'_, crate::db::AppState>,
    deck_id: String,
) -> Result<serde_json::Value, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    cmd_export_anki_deck(&conn, &deck_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_card(
    state: tauri::State<'_, crate::db::AppState>,
    deck_id: String,
    front: String,
    back: String,
    tags: Vec<String>,
) -> Result<crate::core::types::Card, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    crate::commands::card::cmd_add_card(&conn, &deck_id, front, back, tags)
        .map_err(|e| e.to_string())
}

// Silence unused import warning for ImportError (used only for type inference in map_err)
const _: fn() = || {
    let _: Option<ImportError> = None;
};
