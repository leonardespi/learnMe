// Phase 4 unit tests — new commands and repo functions.
// These tests reference functions not yet implemented; they MUST fail to compile (red)
// until production code is written in step 4.
use learnme_lib::{
    commands::{
        card::cmd_card_delete,
        category::{cmd_category_delete, cmd_category_update},
        settings::{cmd_settings_get, cmd_settings_set},
        study::{cmd_study_delete, cmd_study_update},
    },
    repo::{
        card,
        category::{self, CreateCategory},
        review_log::{self, CreateReviewLog},
        study::{self, CreateStudy, UpdateStudy},
    },
};
use rusqlite::Connection;

fn make_db() -> Connection {
    let mut conn = Connection::open_in_memory().unwrap();
    conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
    learnme_lib::db::apply_migrations(&mut conn).unwrap();
    conn
}

fn make_category(conn: &Connection) -> String {
    category::create(
        conn,
        CreateCategory {
            name: "Cat".into(),
            color: None,
        },
    )
    .unwrap()
    .id
}

fn make_study(conn: &Connection, category_id: &str) -> String {
    study::create(
        conn,
        CreateStudy {
            category_id: category_id.into(),
            method: "anki".into(),
            name: "Deck".into(),
            payload: serde_json::json!({}),
        },
    )
    .unwrap()
    .id
}

fn make_card(conn: &Connection, deck_id: &str) -> String {
    card::insert(
        conn,
        deck_id,
        card::CreateCard {
            front: "front".into(),
            back: "back".into(),
            tags: vec![],
        },
    )
    .unwrap()
    .id
}

fn make_review_log(conn: &Connection, card_id: &str) {
    review_log::insert(
        conn,
        CreateReviewLog {
            card_id: card_id.into(),
            grade: 3,
            reviewed_at: "2026-05-24T00:00:00Z".into(),
            prev_stability: 0.0,
            prev_difficulty: 0.0,
            prev_due: "2026-05-24T00:00:00Z".into(),
        },
    )
    .unwrap();
}

// ── repo::study::update ──────────────────────────────────────────────────────

#[test]
fn phase4_study_update_happy_path() {
    // Test #1: update existing study name
    let conn = make_db();
    let cat_id = make_category(&conn);
    let study_id = make_study(&conn, &cat_id);

    let updated = study::update(
        &conn,
        &study_id,
        UpdateStudy {
            name: "Deck Editado".into(),
        },
    )
    .unwrap();

    assert_eq!(updated.name, "Deck Editado");
    assert_eq!(updated.id, study_id);
}

#[test]
fn phase4_study_update_empty_name_errors() {
    // Test #2: empty name returns ValidationError
    let conn = make_db();
    let cat_id = make_category(&conn);
    let study_id = make_study(&conn, &cat_id);

    let err = study::update(&conn, &study_id, UpdateStudy { name: "".into() }).unwrap_err();
    assert!(
        matches!(
            err,
            learnme_lib::core::error::RepoError::Validation(
                learnme_lib::core::error::ValidationError::EmptyName
            )
        ),
        "expected ValidationError::EmptyName, got {err:?}"
    );
}

#[test]
fn phase4_study_update_not_found_errors() {
    // Test #3: non-existent id returns NotFound
    let conn = make_db();

    let err = study::update(&conn, "nonexistent-id", UpdateStudy { name: "X".into() }).unwrap_err();
    assert!(
        matches!(err, learnme_lib::core::error::RepoError::NotFound),
        "expected NotFound, got {err:?}"
    );
}

// ── repo::card::delete ───────────────────────────────────────────────────────

#[test]
fn phase4_card_delete_without_review_logs() {
    // Test #4: delete card with no review_logs
    let conn = make_db();
    let cat_id = make_category(&conn);
    let deck_id = make_study(&conn, &cat_id);
    let card_id = make_card(&conn, &deck_id);

    card::delete(&conn, &card_id).unwrap();

    let cards = card::list_by_deck(&conn, &deck_id).unwrap();
    assert!(cards.is_empty(), "card must be gone after delete");
}

#[test]
fn phase4_card_delete_with_review_logs_app_layer() {
    // Test #5: cmd_card_delete deletes review_logs first (app-layer, FK RESTRICT)
    let conn = make_db();
    let cat_id = make_category(&conn);
    let deck_id = make_study(&conn, &cat_id);
    let card_id = make_card(&conn, &deck_id);
    make_review_log(&conn, &card_id);
    make_review_log(&conn, &card_id);

    cmd_card_delete(&conn, &card_id).unwrap();

    let cards = card::list_by_deck(&conn, &deck_id).unwrap();
    assert!(cards.is_empty(), "card must be gone");
    let review_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM review_logs WHERE card_id = ?1",
            rusqlite::params![card_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(review_count, 0, "review_logs must be deleted before card");
}

#[test]
fn phase4_card_delete_not_found_errors() {
    // Test #6: non-existent card returns NotFound
    let conn = make_db();

    let err = card::delete(&conn, "nonexistent-id").unwrap_err();
    assert!(
        matches!(err, learnme_lib::core::error::RepoError::NotFound),
        "expected NotFound, got {err:?}"
    );
}

// ── cmd_category_update ──────────────────────────────────────────────────────

#[test]
fn phase4_cmd_category_update_happy_path() {
    // Test #7: update category name + color
    let conn = make_db();
    let cat_id = make_category(&conn);

    let updated = cmd_category_update(&conn, &cat_id, "Idiomas Edit".into(), None).unwrap();

    assert_eq!(updated.name, "Idiomas Edit");
}

#[test]
fn phase4_cmd_category_update_empty_name_errors() {
    // Test #8: empty name returns ValidationError
    let conn = make_db();
    let cat_id = make_category(&conn);

    let err = cmd_category_update(&conn, &cat_id, "".into(), None).unwrap_err();
    assert!(
        matches!(
            err,
            learnme_lib::core::error::RepoError::Validation(
                learnme_lib::core::error::ValidationError::EmptyName
            )
        ),
        "got {err:?}"
    );
}

#[test]
fn phase4_cmd_category_update_not_found_errors() {
    // Test #9: non-existent id returns NotFound
    let conn = make_db();

    let err = cmd_category_update(&conn, "nonexistent", "X".into(), None).unwrap_err();
    assert!(
        matches!(err, learnme_lib::core::error::RepoError::NotFound),
        "got {err:?}"
    );
}

// ── cmd_category_delete ──────────────────────────────────────────────────────

#[test]
fn phase4_cmd_category_delete_no_studies_happy_path() {
    // Test #10: delete category with no studies
    let conn = make_db();
    let cat_id = make_category(&conn);

    cmd_category_delete(&conn, &cat_id).unwrap();

    let all = category::list(&conn).unwrap();
    assert!(!all.iter().any(|c| c.id == cat_id), "category must be gone");
}

#[test]
fn phase4_cmd_category_delete_with_studies_fk_restrict() {
    // Test #11: deleting category that has studies → FK RESTRICT error
    let conn = make_db();
    let cat_id = make_category(&conn);
    let _study_id = make_study(&conn, &cat_id);

    let err = cmd_category_delete(&conn, &cat_id).unwrap_err();
    assert!(
        matches!(
            err,
            learnme_lib::core::error::RepoError::ForeignKeyViolation
        ),
        "expected ForeignKeyViolation (FK RESTRICT), got {err:?}"
    );
}

#[test]
fn phase4_cmd_category_delete_not_found_errors() {
    // Test #12: non-existent id returns NotFound
    let conn = make_db();

    let err = cmd_category_delete(&conn, "nonexistent").unwrap_err();
    assert!(
        matches!(err, learnme_lib::core::error::RepoError::NotFound),
        "got {err:?}"
    );
}

// ── cmd_study_delete (app-layer cascade) ─────────────────────────────────────

#[test]
fn phase4_cmd_study_delete_with_cards_and_reviews_app_layer() {
    // Test #13: cmd_study_delete removes review_logs → cards → study (app-layer ordering)
    let conn = make_db();
    let cat_id = make_category(&conn);
    let deck_id = make_study(&conn, &cat_id);
    let card1 = make_card(&conn, &deck_id);
    let card2 = make_card(&conn, &deck_id);
    let card3 = make_card(&conn, &deck_id);
    make_review_log(&conn, &card1);
    make_review_log(&conn, &card1);

    cmd_study_delete(&conn, &deck_id).unwrap();

    let cards = card::list_by_deck(&conn, &deck_id).unwrap();
    assert!(cards.is_empty(), "all cards must be deleted");

    let review_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM review_logs WHERE card_id IN (?1, ?2, ?3)",
            rusqlite::params![card1, card2, card3],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(review_count, 0, "review_logs must be deleted before cards");

    let studies = study::list_by_category(&conn, &cat_id).unwrap();
    assert!(studies.is_empty(), "study must be deleted");
}

#[test]
fn phase4_cmd_study_delete_empty_deck_happy_path() {
    // Test #14: delete study with no cards
    let conn = make_db();
    let cat_id = make_category(&conn);
    let deck_id = make_study(&conn, &cat_id);

    cmd_study_delete(&conn, &deck_id).unwrap();

    let studies = study::list_by_category(&conn, &cat_id).unwrap();
    assert!(studies.is_empty());
}

#[test]
fn phase4_cmd_study_delete_not_found_errors() {
    // Test #15: non-existent id returns NotFound
    let conn = make_db();

    let err = cmd_study_delete(&conn, "nonexistent").unwrap_err();
    assert!(
        matches!(err, learnme_lib::core::error::RepoError::NotFound),
        "got {err:?}"
    );
}

// ── cmd_settings_get / cmd_settings_set ──────────────────────────────────────

#[test]
fn phase4_settings_get_absent_returns_none() {
    // Test #16: get missing key returns Ok(None)
    let conn = make_db();
    let val = cmd_settings_get(&conn, "theme").unwrap();
    assert_eq!(val, None);
}

#[test]
fn phase4_settings_set_then_get() {
    // Test #17: set then get returns value
    let conn = make_db();
    cmd_settings_set(&conn, "theme", "dark".into()).unwrap();
    let val = cmd_settings_get(&conn, "theme").unwrap();
    assert_eq!(val, Some("dark".into()));
}

#[test]
fn phase4_settings_set_upserts() {
    // Test #18: second set overwrites first
    let conn = make_db();
    cmd_settings_set(&conn, "theme", "dark".into()).unwrap();
    cmd_settings_set(&conn, "theme", "light".into()).unwrap();
    let val = cmd_settings_get(&conn, "theme").unwrap();
    assert_eq!(val, Some("light".into()));
}

#[test]
fn phase4_settings_set_empty_key_errors() {
    // Test #19: empty key returns ValidationError
    let conn = make_db();
    let err = cmd_settings_set(&conn, "", "dark".into()).unwrap_err();
    assert!(
        matches!(
            err,
            learnme_lib::core::error::RepoError::Validation(
                learnme_lib::core::error::ValidationError::EmptyName
            )
        ),
        "expected ValidationError for empty key, got {err:?}"
    );
}

// ── cmd_study_update ─────────────────────────────────────────────────────────

#[test]
fn phase4_cmd_study_update_happy_path() {
    let conn = make_db();
    let cat_id = make_category(&conn);
    let study_id = make_study(&conn, &cat_id);

    let updated = cmd_study_update(&conn, &study_id, "Nombre Nuevo".into()).unwrap();
    assert_eq!(updated.name, "Nombre Nuevo");
}
