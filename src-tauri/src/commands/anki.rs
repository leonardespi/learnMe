pub use crate::methods::anki::export::cmd_export_anki_deck;
pub use crate::methods::anki::import::{cmd_import_anki_deck, ImportError, ImportResult};
use crate::methods::anki::import::cmd_import_anki_deck_by_study;

#[tauri::command]
pub async fn import_anki_deck(
    state: tauri::State<'_, crate::db::AppState>,
    study_id: String,
    deck: serde_json::Value,
) -> Result<ImportResult, String> {
    crate::log_call("import_anki_deck");
    let conn = state.db.lock().map_err(crate::log_err)?;
    cmd_import_anki_deck_by_study(&conn, &study_id, &deck).map_err(crate::log_err)
}

#[tauri::command]
pub async fn export_anki_deck(
    state: tauri::State<'_, crate::db::AppState>,
    deck_id: String,
) -> Result<serde_json::Value, String> {
    crate::log_call("export_anki_deck");
    let conn = state.db.lock().map_err(crate::log_err)?;
    cmd_export_anki_deck(&conn, &deck_id).map_err(crate::log_err)
}

#[tauri::command]
pub async fn add_card(
    state: tauri::State<'_, crate::db::AppState>,
    deck_id: String,
    front: String,
    back: String,
    tags: Vec<String>,
) -> Result<crate::core::types::Card, String> {
    crate::log_call("add_card");
    let conn = state.db.lock().map_err(crate::log_err)?;
    crate::commands::card::cmd_add_card(&conn, &deck_id, front, back, tags)
        .map_err(crate::log_err)
}

// Silence unused import warning for ImportError (used only for type inference in map_err)
const _: fn() = || {
    let _: Option<ImportError> = None;
};
