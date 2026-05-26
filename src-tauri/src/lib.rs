pub mod commands;
pub mod core;
pub mod db;
pub mod methods;
pub mod repo;
pub mod session;
pub mod stats;

/// Converts any error to String. In debug builds, also prints to stderr with color.
pub fn log_err<E: std::fmt::Display>(e: E) -> String {
    let msg = e.to_string();
    #[cfg(debug_assertions)]
    eprintln!("\x1b[31m[IPC ❌]\x1b[0m {}", msg);
    msg
}

/// Logs an IPC command call to stderr in debug builds.
#[cfg(debug_assertions)]
pub fn log_call(cmd: &str) {
    eprintln!("\x1b[36m[IPC →]\x1b[0m {}", cmd);
}
#[cfg(not(debug_assertions))]
pub fn log_call(_cmd: &str) {}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            use tauri::Manager;
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("app data dir must be available");
            std::fs::create_dir_all(&data_dir).expect("failed to create app data dir");
            let db_path = data_dir.join("learnme.db");
            let conn = db::open_db(db_path.to_str().expect("db path must be valid UTF-8"))
                .expect("failed to open database");
            app.manage(db::AppState {
                db: std::sync::Mutex::new(conn),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::category::category_create,
            commands::category::category_list,
            commands::category::category_update,
            commands::category::category_delete,
            commands::study::study_create,
            commands::study::study_list_by_category,
            commands::study::study_list_all,
            commands::study::study_update,
            commands::study::study_delete,
            commands::card::card_bulk_insert,
            commands::card::card_list_by_deck,
            commands::card::card_delete,
            commands::card::card_update,
            commands::review::record_review,
            commands::deck::next_card,
            commands::deck::forecast,
            commands::anki::import_anki_deck,
            commands::anki::export_anki_deck,
            commands::anki::add_card,
            commands::settings::settings_get,
            commands::settings::settings_set,
            commands::stats::get_stats,
            commands::session::session_export,
            commands::session::session_import_cmd,
            commands::test_utils::dev_reset_db,
        ])
        .run(tauri::generate_context!())
        .expect("error while running learnMe");
}

#[cfg(test)]
mod tests {
    #[test]
    fn smoke() {
        assert!(true);
    }
}
