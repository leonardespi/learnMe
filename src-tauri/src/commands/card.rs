use rusqlite::Connection;
use serde::Deserialize;

use crate::core::{error::RepoError, types::Card};

#[derive(Deserialize)]
pub struct CardInput {
    pub front: String,
    pub back: String,
    pub tags: Vec<String>,
}

pub fn cmd_add_card(
    conn: &Connection,
    deck_id: &str,
    front: String,
    back: String,
    tags: Vec<String>,
) -> Result<crate::core::types::Card, crate::core::error::RepoError> {
    crate::repo::card::insert(
        conn,
        deck_id,
        crate::repo::card::CreateCard { front, back, tags },
    )
}

pub fn cmd_card_bulk_insert(
    conn: &Connection,
    deck_id: &str,
    cards: Vec<CardInput>,
) -> Result<usize, RepoError> {
    let create_cards = cards
        .into_iter()
        .map(|c| crate::repo::card::CreateCard {
            front: c.front,
            back: c.back,
            tags: c.tags,
        })
        .collect();
    crate::repo::card::bulk_insert(conn, deck_id, create_cards)
}

pub fn cmd_card_list_by_deck(conn: &Connection, deck_id: &str) -> Result<Vec<Card>, RepoError> {
    crate::repo::card::list_by_deck(conn, deck_id)
}

pub fn cmd_card_update(
    conn: &Connection,
    id: &str,
    front: String,
    back: String,
    tags: Vec<String>,
) -> Result<Card, RepoError> {
    crate::repo::card::update(conn, id, front, back, tags)
}

pub fn cmd_card_delete(conn: &Connection, id: &str) -> Result<(), RepoError> {
    conn.execute(
        "DELETE FROM review_logs WHERE card_id = ?1",
        rusqlite::params![id],
    )
    .map_err(RepoError::Db)?;
    crate::repo::card::delete(conn, id)
}

#[tauri::command]
pub async fn card_update(
    state: tauri::State<'_, crate::db::AppState>,
    id: String,
    front: String,
    back: String,
    tags: Vec<String>,
) -> Result<Card, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    cmd_card_update(&conn, &id, front, back, tags).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn card_bulk_insert(
    state: tauri::State<'_, crate::db::AppState>,
    deck_id: String,
    cards: Vec<CardInput>,
) -> Result<usize, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    cmd_card_bulk_insert(&conn, &deck_id, cards).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn card_delete(
    state: tauri::State<'_, crate::db::AppState>,
    id: String,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    cmd_card_delete(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn card_list_by_deck(
    state: tauri::State<'_, crate::db::AppState>,
    deck_id: String,
) -> Result<Vec<Card>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    cmd_card_list_by_deck(&conn, &deck_id).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::{
        category::{cmd_category_create, CreateCategoryPayload},
        study::{cmd_study_create, CreateStudyPayload},
    };
    use crate::db::new_test_db;

    fn make_deck_id(conn: &Connection) -> String {
        let cat_id = cmd_category_create(
            conn,
            CreateCategoryPayload {
                name: "Cat".into(),
                color: None,
            },
        )
        .unwrap()
        .id;
        cmd_study_create(
            conn,
            CreateStudyPayload {
                category_id: cat_id,
                method: "anki".into(),
                name: "Deck".into(),
                payload: serde_json::json!({}),
            },
        )
        .unwrap()
        .id
    }

    fn fixture_cards(n: usize) -> Vec<CardInput> {
        (0..n)
            .map(|i| CardInput {
                front: format!("palabra_{i}"),
                back: format!("word_{i}"),
                tags: vec![],
            })
            .collect()
    }

    #[test]
    fn cmd_bulk_insert_5_cards() {
        let conn = new_test_db();
        let deck_id = make_deck_id(&conn);
        let inserted = cmd_card_bulk_insert(&conn, &deck_id, fixture_cards(5)).unwrap();
        assert_eq!(inserted, 5);
    }

    #[test]
    fn cmd_list_by_deck_returns_inserted() {
        let conn = new_test_db();
        let deck_id = make_deck_id(&conn);
        cmd_card_bulk_insert(&conn, &deck_id, fixture_cards(5)).unwrap();
        let cards = cmd_card_list_by_deck(&conn, &deck_id).unwrap();
        assert_eq!(cards.len(), 5);
        serde_json::to_value(&cards).expect("Vec<Card> must serialize to JSON");
    }

    // --- cmd_card_update ---

    #[test]
    fn cmd_card_update_happy_path() {
        let conn = new_test_db();
        let deck_id = make_deck_id(&conn);
        let inserted = cmd_card_bulk_insert(&conn, &deck_id, fixture_cards(1)).unwrap();
        assert_eq!(inserted, 1);
        let card = cmd_card_list_by_deck(&conn, &deck_id).unwrap().remove(0);
        let updated = cmd_card_update(
            &conn,
            &card.id,
            "nuevo".into(),
            "new".into(),
            vec!["tag1".into()],
        )
        .unwrap();
        assert_eq!(updated.front, "nuevo");
        assert_eq!(updated.back, "new");
        assert_eq!(updated.tags, vec!["tag1"]);
        serde_json::to_value(&updated).expect("Card must serialize to JSON");
    }

    #[test]
    fn cmd_card_update_not_found() {
        let conn = new_test_db();
        let err = cmd_card_update(
            &conn,
            "00000000-0000-0000-0000-000000000000",
            "f".into(),
            "b".into(),
            vec![],
        )
        .unwrap_err();
        assert!(!err.to_string().is_empty());
    }

    #[test]
    fn cmd_card_update_empty_front_errors() {
        let conn = new_test_db();
        let deck_id = make_deck_id(&conn);
        cmd_card_bulk_insert(&conn, &deck_id, fixture_cards(1)).unwrap();
        let card = cmd_card_list_by_deck(&conn, &deck_id).unwrap().remove(0);
        let err = cmd_card_update(&conn, &card.id, "".into(), "b".into(), vec![]).unwrap_err();
        assert!(!err.to_string().is_empty());
    }

    // --- cmd_card_delete ---

    #[test]
    fn cmd_card_delete_happy_path() {
        let conn = new_test_db();
        let deck_id = make_deck_id(&conn);
        cmd_card_bulk_insert(&conn, &deck_id, fixture_cards(1)).unwrap();
        let card = cmd_card_list_by_deck(&conn, &deck_id).unwrap().remove(0);
        cmd_card_delete(&conn, &card.id).unwrap();
        let remaining = cmd_card_list_by_deck(&conn, &deck_id).unwrap();
        assert!(remaining.is_empty());
    }

    #[test]
    fn cmd_card_delete_cascades_review_logs() {
        let conn = new_test_db();
        let deck_id = make_deck_id(&conn);
        cmd_card_bulk_insert(&conn, &deck_id, fixture_cards(1)).unwrap();
        let card = cmd_card_list_by_deck(&conn, &deck_id).unwrap().remove(0);
        // insert 3 review_logs for this card
        for i in 0..3 {
            crate::repo::review_log::insert(
                &conn,
                crate::repo::review_log::CreateReviewLog {
                    card_id: card.id.clone(),
                    grade: i + 1,
                    reviewed_at: "2026-05-26T00:00:00Z".into(),
                    prev_stability: 0.0,
                    prev_difficulty: 0.0,
                    prev_due: "2026-05-26T00:00:00Z".into(),
                },
            )
            .unwrap();
        }
        let log_count_before: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM review_logs WHERE card_id = ?1",
                rusqlite::params![card.id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(log_count_before, 3);

        cmd_card_delete(&conn, &card.id).unwrap();

        let log_count_after: i64 = conn
            .query_row("SELECT COUNT(*) FROM review_logs", [], |row| row.get(0))
            .unwrap();
        assert_eq!(log_count_after, 0);
    }

    #[test]
    fn cmd_card_delete_not_found() {
        let conn = new_test_db();
        let err = cmd_card_delete(&conn, "00000000-0000-0000-0000-000000000000").unwrap_err();
        assert!(!err.to_string().is_empty());
    }
}
