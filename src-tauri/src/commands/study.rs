use rusqlite::Connection;
use serde::Deserialize;

use crate::core::{error::RepoError, types::Study};
use crate::repo::study::UpdateStudy;

#[derive(Deserialize)]
pub struct CreateStudyPayload {
    pub category_id: String,
    pub method: String,
    pub name: String,
    pub payload: serde_json::Value,
}

pub fn cmd_study_create(
    conn: &Connection,
    payload: CreateStudyPayload,
) -> Result<Study, RepoError> {
    crate::repo::study::create(
        conn,
        crate::repo::study::CreateStudy {
            category_id: payload.category_id,
            method: payload.method,
            name: payload.name,
            payload: payload.payload,
        },
    )
}

pub fn cmd_study_list_by_category(
    conn: &Connection,
    category_id: &str,
) -> Result<Vec<Study>, RepoError> {
    crate::repo::study::list_by_category(conn, category_id)
}

pub fn cmd_study_update(conn: &Connection, id: &str, name: String) -> Result<Study, RepoError> {
    crate::repo::study::update(conn, id, UpdateStudy { name })
}

pub fn cmd_study_delete(conn: &Connection, id: &str) -> Result<(), RepoError> {
    crate::repo::study::get_by_id(conn, id)?;
    conn.execute(
        "DELETE FROM review_logs WHERE card_id IN (SELECT id FROM cards WHERE deck_id = ?1)",
        rusqlite::params![id],
    )
    .map_err(RepoError::Db)?;
    conn.execute(
        "DELETE FROM cards WHERE deck_id = ?1",
        rusqlite::params![id],
    )
    .map_err(RepoError::Db)?;
    crate::repo::study::delete(conn, id)
}

#[tauri::command]
pub async fn study_create(
    state: tauri::State<'_, crate::db::AppState>,
    payload: CreateStudyPayload,
) -> Result<Study, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    cmd_study_create(&conn, payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn study_list_by_category(
    state: tauri::State<'_, crate::db::AppState>,
    category_id: String,
) -> Result<Vec<Study>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    cmd_study_list_by_category(&conn, &category_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn study_update(
    state: tauri::State<'_, crate::db::AppState>,
    id: String,
    name: String,
) -> Result<Study, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    cmd_study_update(&conn, &id, name).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn study_delete(
    state: tauri::State<'_, crate::db::AppState>,
    id: String,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    cmd_study_delete(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn study_list_all(
    state: tauri::State<'_, crate::db::AppState>,
) -> Result<Vec<Study>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    crate::repo::study::list_all(&conn).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::category::{cmd_category_create, CreateCategoryPayload};
    use crate::db::new_test_db;

    fn make_category_id(conn: &Connection) -> String {
        cmd_category_create(
            conn,
            CreateCategoryPayload {
                name: "Cat".into(),
                color: None,
            },
        )
        .unwrap()
        .id
    }

    #[test]
    fn cmd_study_create_happy_path() {
        let conn = new_test_db();
        let cat_id = make_category_id(&conn);
        let study = cmd_study_create(
            &conn,
            CreateStudyPayload {
                category_id: cat_id.clone(),
                method: "anki".into(),
                name: "Deck".into(),
                payload: serde_json::json!({}),
            },
        )
        .unwrap();
        assert_eq!(study.name, "Deck");
        assert_eq!(study.method, "anki");
        assert_eq!(study.category_id, cat_id);
        serde_json::to_value(&study).expect("Study must serialize to JSON");
    }

    #[test]
    fn cmd_study_create_invalid_category_returns_err() {
        let conn = new_test_db();
        let err = cmd_study_create(
            &conn,
            CreateStudyPayload {
                category_id: "00000000-0000-0000-0000-000000000000".into(),
                method: "anki".into(),
                name: "X".into(),
                payload: serde_json::json!({}),
            },
        )
        .unwrap_err();
        assert!(!err.to_string().is_empty());
    }

    #[test]
    fn cmd_study_list_returns_studies() {
        let conn = new_test_db();
        let cat_id = make_category_id(&conn);
        cmd_study_create(
            &conn,
            CreateStudyPayload {
                category_id: cat_id.clone(),
                method: "anki".into(),
                name: "Deck 1".into(),
                payload: serde_json::json!({}),
            },
        )
        .unwrap();
        let studies = cmd_study_list_by_category(&conn, &cat_id).unwrap();
        assert_eq!(studies.len(), 1);
        serde_json::to_value(&studies).expect("Vec<Study> must serialize to JSON");
    }

    // --- cmd_study_update ---

    #[test]
    fn cmd_study_update_happy_path() {
        let conn = new_test_db();
        let cat_id = make_category_id(&conn);
        let study = cmd_study_create(
            &conn,
            CreateStudyPayload {
                category_id: cat_id,
                method: "anki".into(),
                name: "Old".into(),
                payload: serde_json::json!({}),
            },
        )
        .unwrap();
        let updated = cmd_study_update(&conn, &study.id, "New Name".into()).unwrap();
        assert_eq!(updated.name, "New Name");
        assert_eq!(updated.id, study.id);
    }

    #[test]
    fn cmd_study_update_not_found() {
        let conn = new_test_db();
        let err = cmd_study_update(&conn, "00000000-0000-0000-0000-000000000000", "X".into())
            .unwrap_err();
        assert!(!err.to_string().is_empty());
    }

    #[test]
    fn cmd_study_update_empty_name_errors() {
        let conn = new_test_db();
        let cat_id = make_category_id(&conn);
        let study = cmd_study_create(
            &conn,
            CreateStudyPayload {
                category_id: cat_id,
                method: "anki".into(),
                name: "Old".into(),
                payload: serde_json::json!({}),
            },
        )
        .unwrap();
        let err = cmd_study_update(&conn, &study.id, "".into()).unwrap_err();
        assert!(!err.to_string().is_empty());
    }

    // --- cmd_study_delete ---

    #[test]
    fn cmd_study_delete_happy_path_no_cards() {
        let conn = new_test_db();
        let cat_id = make_category_id(&conn);
        let study = cmd_study_create(
            &conn,
            CreateStudyPayload {
                category_id: cat_id.clone(),
                method: "anki".into(),
                name: "Deck".into(),
                payload: serde_json::json!({}),
            },
        )
        .unwrap();
        cmd_study_delete(&conn, &study.id).unwrap();
        let studies = cmd_study_list_by_category(&conn, &cat_id).unwrap();
        assert!(studies.is_empty());
    }

    #[test]
    fn cmd_study_delete_cascades_cards_and_logs() {
        use crate::commands::card::{cmd_card_bulk_insert, cmd_card_list_by_deck, CardInput};
        let conn = new_test_db();
        let cat_id = make_category_id(&conn);
        let study = cmd_study_create(
            &conn,
            CreateStudyPayload {
                category_id: cat_id.clone(),
                method: "anki".into(),
                name: "Deck".into(),
                payload: serde_json::json!({}),
            },
        )
        .unwrap();
        let cards_input: Vec<CardInput> = (0..3)
            .map(|i| CardInput {
                front: format!("f{i}"),
                back: format!("b{i}"),
                tags: vec![],
            })
            .collect();
        cmd_card_bulk_insert(&conn, &study.id, cards_input).unwrap();
        let cards = cmd_card_list_by_deck(&conn, &study.id).unwrap();
        assert_eq!(cards.len(), 3);
        // insert 2 review_logs per card
        for card in &cards {
            for j in 0..2 {
                crate::repo::review_log::insert(
                    &conn,
                    crate::repo::review_log::CreateReviewLog {
                        card_id: card.id.clone(),
                        grade: j + 1,
                        reviewed_at: "2026-05-26T00:00:00Z".into(),
                        prev_stability: 0.0,
                        prev_difficulty: 0.0,
                        prev_due: "2026-05-26T00:00:00Z".into(),
                    },
                )
                .unwrap();
            }
        }
        cmd_study_delete(&conn, &study.id).unwrap();
        let remaining_cards: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM cards WHERE deck_id = ?1",
                rusqlite::params![study.id],
                |r| r.get(0),
            )
            .unwrap();
        let remaining_logs: i64 = conn
            .query_row("SELECT COUNT(*) FROM review_logs", [], |r| r.get(0))
            .unwrap();
        let remaining_cats: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM categories WHERE id = ?1",
                rusqlite::params![cat_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(remaining_cards, 0, "cards must be deleted with study");
        assert_eq!(remaining_logs, 0, "review_logs must be deleted with study");
        assert_eq!(remaining_cats, 1, "category must remain intact");
    }

    #[test]
    fn cmd_study_delete_not_found() {
        let conn = new_test_db();
        let err = cmd_study_delete(&conn, "00000000-0000-0000-0000-000000000000").unwrap_err();
        assert!(!err.to_string().is_empty());
    }
}
