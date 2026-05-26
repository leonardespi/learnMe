use rusqlite::Connection;
use serde::Deserialize;

use crate::core::{error::RepoError, types::Category};

#[derive(Deserialize)]
pub struct CreateCategoryPayload {
    pub name: String,
    pub color: Option<String>,
}

pub fn cmd_category_create(
    conn: &Connection,
    payload: CreateCategoryPayload,
) -> Result<Category, RepoError> {
    crate::repo::category::create(
        conn,
        crate::repo::category::CreateCategory {
            name: payload.name,
            color: payload.color,
        },
    )
}

pub fn cmd_category_list(conn: &Connection) -> Result<Vec<Category>, RepoError> {
    crate::repo::category::list(conn)
}

pub fn cmd_category_update(
    conn: &Connection,
    id: &str,
    name: String,
    color: Option<String>,
) -> Result<Category, RepoError> {
    crate::repo::category::update(
        conn,
        id,
        crate::repo::category::UpdateCategory { name, color },
    )
}

pub fn cmd_category_delete(conn: &Connection, id: &str) -> Result<(), RepoError> {
    crate::repo::category::delete(conn, id)
}

#[tauri::command]
pub async fn category_create(
    state: tauri::State<'_, crate::db::AppState>,
    payload: CreateCategoryPayload,
) -> Result<Category, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    cmd_category_create(&conn, payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn category_list(
    state: tauri::State<'_, crate::db::AppState>,
) -> Result<Vec<Category>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    cmd_category_list(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn category_update(
    state: tauri::State<'_, crate::db::AppState>,
    id: String,
    name: String,
    color: Option<String>,
) -> Result<Category, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    cmd_category_update(&conn, &id, name, color).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn category_delete(
    state: tauri::State<'_, crate::db::AppState>,
    id: String,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    cmd_category_delete(&conn, &id).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::new_test_db;

    #[test]
    fn cmd_create_happy_path() {
        let conn = new_test_db();
        let cat = cmd_category_create(
            &conn,
            CreateCategoryPayload {
                name: "Test".into(),
                color: None,
            },
        )
        .unwrap();
        assert_eq!(cat.name, "Test");
        assert!(!cat.id.is_empty());
        // must be JSON-serializable without panic
        serde_json::to_value(&cat).expect("Category must serialize to JSON");
    }

    #[test]
    fn cmd_create_empty_name_returns_err() {
        let conn = new_test_db();
        let err = cmd_category_create(
            &conn,
            CreateCategoryPayload {
                name: "".into(),
                color: None,
            },
        )
        .unwrap_err();
        assert!(!err.to_string().is_empty());
    }

    #[test]
    fn cmd_list_returns_all() {
        let conn = new_test_db();
        cmd_category_create(
            &conn,
            CreateCategoryPayload {
                name: "A".into(),
                color: None,
            },
        )
        .unwrap();
        cmd_category_create(
            &conn,
            CreateCategoryPayload {
                name: "B".into(),
                color: None,
            },
        )
        .unwrap();
        let cats = cmd_category_list(&conn).unwrap();
        assert_eq!(cats.len(), 2);
        // must be JSON-serializable
        serde_json::to_value(&cats).expect("Vec<Category> must serialize to JSON");
    }
}
