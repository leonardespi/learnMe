// Phase 4 integration tests — multi-table CRUD scenarios.
// These tests reference functions not yet implemented; they MUST fail to compile (red)
// until production code is written in step 4.
use learnme_lib::{
    commands::{
        card::cmd_card_delete,
        settings::{cmd_settings_get, cmd_settings_set},
        study::{cmd_study_delete, cmd_study_update},
    },
    repo::{
        card,
        category::{self, CreateCategory, UpdateCategory},
        review_log::{self, CreateReviewLog},
        study::{self, CreateStudy},
    },
};
use rusqlite::Connection;

fn make_db() -> Connection {
    let mut conn = Connection::open_in_memory().unwrap();
    conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
    learnme_lib::db::apply_migrations(&mut conn).unwrap();
    conn
}

// ── Scenario: Full category CRUD lifecycle ───────────────────────────────────

#[test]
fn phase4_category_crud_full_lifecycle() {
    let conn = make_db();

    let cat = category::create(
        &conn,
        CreateCategory {
            name: "Idiomas".into(),
            color: None,
        },
    )
    .unwrap();

    let all = category::list(&conn).unwrap();
    assert_eq!(all.len(), 1);
    assert_eq!(all[0].name, "Idiomas");

    let updated = category::update(
        &conn,
        &cat.id,
        UpdateCategory {
            name: "Idiomas Edit".into(),
            color: Some("#FF0000".into()),
        },
    )
    .unwrap();
    assert_eq!(updated.name, "Idiomas Edit");
    assert_eq!(updated.color, Some("#FF0000".into()));

    let fetched = category::get_by_id(&conn, &cat.id).unwrap();
    assert_eq!(fetched.name, "Idiomas Edit");

    category::delete(&conn, &cat.id).unwrap();

    let all_after = category::list(&conn).unwrap();
    assert!(all_after.is_empty(), "category must be gone after delete");
}

// ── Scenario: study_update persists name ────────────────────────────────────

#[test]
fn phase4_study_update_persists() {
    let conn = make_db();
    let cat_id = category::create(
        &conn,
        CreateCategory {
            name: "Cat".into(),
            color: None,
        },
    )
    .unwrap()
    .id;

    let study_id = study::create(
        &conn,
        CreateStudy {
            category_id: cat_id.clone(),
            method: "anki".into(),
            name: "Original".into(),
            payload: serde_json::json!({}),
        },
    )
    .unwrap()
    .id;

    cmd_study_update(&conn, &study_id, "Actualizado".into()).unwrap();

    let fetched = study::get_by_id(&conn, &study_id).unwrap();
    assert_eq!(fetched.name, "Actualizado");
}

// ── Scenario: study_delete with cards and review_logs (app-layer ordering) ──

#[test]
fn phase4_study_delete_cascade_app_layer() {
    let conn = make_db();
    let cat_id = category::create(
        &conn,
        CreateCategory {
            name: "Cat".into(),
            color: None,
        },
    )
    .unwrap()
    .id;

    let deck_id = study::create(
        &conn,
        CreateStudy {
            category_id: cat_id.clone(),
            method: "anki".into(),
            name: "Deck".into(),
            payload: serde_json::json!({}),
        },
    )
    .unwrap()
    .id;

    let card1_id = card::insert(
        &conn,
        &deck_id,
        card::CreateCard {
            front: "a".into(),
            back: "b".into(),
            tags: vec![],
        },
    )
    .unwrap()
    .id;
    let card2_id = card::insert(
        &conn,
        &deck_id,
        card::CreateCard {
            front: "c".into(),
            back: "d".into(),
            tags: vec![],
        },
    )
    .unwrap()
    .id;
    let card3_id = card::insert(
        &conn,
        &deck_id,
        card::CreateCard {
            front: "e".into(),
            back: "f".into(),
            tags: vec![],
        },
    )
    .unwrap()
    .id;

    review_log::insert(
        &conn,
        CreateReviewLog {
            card_id: card1_id.clone(),
            grade: 3,
            reviewed_at: "2026-05-24T00:00:00Z".into(),
            prev_stability: 0.0,
            prev_difficulty: 0.0,
            prev_due: "2026-05-24T00:00:00Z".into(),
        },
    )
    .unwrap();
    review_log::insert(
        &conn,
        CreateReviewLog {
            card_id: card1_id.clone(),
            grade: 4,
            reviewed_at: "2026-05-25T00:00:00Z".into(),
            prev_stability: 1.0,
            prev_difficulty: 5.0,
            prev_due: "2026-05-25T00:00:00Z".into(),
        },
    )
    .unwrap();

    cmd_study_delete(&conn, &deck_id).unwrap();

    let cards = card::list_by_deck(&conn, &deck_id).unwrap();
    assert!(cards.is_empty(), "all cards must be deleted");

    let review_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM review_logs WHERE card_id IN (?1, ?2, ?3)",
            rusqlite::params![card1_id, card2_id, card3_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(review_count, 0, "review_logs must be deleted before cards");

    let studies = study::list_by_category(&conn, &cat_id).unwrap();
    assert!(studies.is_empty(), "study must be deleted");
}

// ── Scenario: card_delete with review_logs (app-layer ordering) ──────────────

#[test]
fn phase4_card_delete_cascade_review_logs() {
    let conn = make_db();
    let cat_id = category::create(
        &conn,
        CreateCategory {
            name: "Cat".into(),
            color: None,
        },
    )
    .unwrap()
    .id;

    let deck_id = study::create(
        &conn,
        CreateStudy {
            category_id: cat_id,
            method: "anki".into(),
            name: "Deck".into(),
            payload: serde_json::json!({}),
        },
    )
    .unwrap()
    .id;

    let card_id = card::insert(
        &conn,
        &deck_id,
        card::CreateCard {
            front: "x".into(),
            back: "y".into(),
            tags: vec![],
        },
    )
    .unwrap()
    .id;

    for grade in [1, 2, 3] {
        review_log::insert(
            &conn,
            CreateReviewLog {
                card_id: card_id.clone(),
                grade,
                reviewed_at: "2026-05-24T00:00:00Z".into(),
                prev_stability: 0.0,
                prev_difficulty: 0.0,
                prev_due: "2026-05-24T00:00:00Z".into(),
            },
        )
        .unwrap();
    }

    cmd_card_delete(&conn, &card_id).unwrap();

    let cards = card::list_by_deck(&conn, &deck_id).unwrap();
    assert!(cards.is_empty(), "card must be deleted");

    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM review_logs WHERE card_id = ?1",
            rusqlite::params![card_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(count, 0, "review_logs must be deleted before card");
}

// ── Scenario: settings persist theme ────────────────────────────────────────

#[test]
fn phase4_settings_theme_persist() {
    let conn = make_db();

    cmd_settings_set(&conn, "theme", "dark".into()).unwrap();
    let val = cmd_settings_get(&conn, "theme").unwrap();
    assert_eq!(val, Some("dark".into()));

    cmd_settings_set(&conn, "theme", "light".into()).unwrap();
    let val2 = cmd_settings_get(&conn, "theme").unwrap();
    assert_eq!(val2, Some("light".into()));
}
