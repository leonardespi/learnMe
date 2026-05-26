// Phase 1 integration tests — run against in-memory SQLite with full migration applied.
// These tests call public repo functions across multiple tables to verify cross-entity behavior.

use learnme_lib::db::apply_migrations;
use learnme_lib::repo::{card, category, study};
use rusqlite::Connection;

fn setup() -> Connection {
    let mut conn = Connection::open_in_memory().unwrap();
    conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
    apply_migrations(&mut conn).unwrap();
    conn
}

// Scenario 1: Full category CRUD lifecycle
#[test]
fn category_crud_lifecycle() {
    let conn = setup();

    let math = category::create(
        &conn,
        category::CreateCategory {
            name: "Math".into(),
            color: None,
        },
    )
    .unwrap();
    let sci = category::create(
        &conn,
        category::CreateCategory {
            name: "Science".into(),
            color: None,
        },
    )
    .unwrap();
    let hist = category::create(
        &conn,
        category::CreateCategory {
            name: "History".into(),
            color: None,
        },
    )
    .unwrap();

    let all = category::list(&conn).unwrap();
    assert_eq!(all.len(), 3);

    let updated = category::update(
        &conn,
        &math.id,
        category::UpdateCategory {
            name: "Mathematics".into(),
            color: None,
        },
    )
    .unwrap();
    assert_eq!(updated.name, "Mathematics");

    let fetched = category::get_by_id(&conn, &math.id).unwrap();
    assert_eq!(fetched.name, "Mathematics");

    category::delete(&conn, &hist.id).unwrap();

    let remaining = category::list(&conn).unwrap();
    assert_eq!(remaining.len(), 2);

    let err = category::get_by_id(&conn, &hist.id).unwrap_err();
    assert!(matches!(err, learnme_lib::core::error::RepoError::NotFound));

    let _ = sci; // suppress unused warning
}

// Scenario 2: FK RESTRICT category→study
#[test]
fn fk_restrict_category_with_study() {
    let conn = setup();

    let cat = category::create(
        &conn,
        category::CreateCategory {
            name: "Languages".into(),
            color: None,
        },
    )
    .unwrap();

    study::create(
        &conn,
        study::CreateStudy {
            category_id: cat.id.clone(),
            method: "anki".into(),
            name: "Spanish".into(),
            payload: serde_json::json!({}),
        },
    )
    .unwrap();

    // delete category that has a study must fail
    let err = category::delete(&conn, &cat.id).unwrap_err();
    assert!(matches!(
        err,
        learnme_lib::core::error::RepoError::ForeignKeyViolation
    ));

    // category still exists
    assert!(category::get_by_id(&conn, &cat.id).is_ok());

    // creating a study with a non-existing category_id must also fail
    let fk_err = study::create(
        &conn,
        study::CreateStudy {
            category_id: "00000000-0000-0000-0000-000000000000".into(),
            method: "anki".into(),
            name: "Ghost".into(),
            payload: serde_json::json!({}),
        },
    )
    .unwrap_err();
    assert!(matches!(
        fk_err,
        learnme_lib::core::error::RepoError::ForeignKeyViolation
    ));

    let studies = study::list_by_category(&conn, &cat.id).unwrap();
    assert_eq!(studies.len(), 1);
}

// Scenario 3: Bulk insert 100 cards and retrieval
#[test]
fn bulk_insert_100_cards_and_retrieve() {
    let conn = setup();

    let cat = category::create(
        &conn,
        category::CreateCategory {
            name: "Lang".into(),
            color: None,
        },
    )
    .unwrap();
    let deck = study::create(
        &conn,
        study::CreateStudy {
            category_id: cat.id,
            method: "anki".into(),
            name: "Spanish A2".into(),
            payload: serde_json::json!({}),
        },
    )
    .unwrap();

    let fixture_path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../fixtures/cards/seed-100.json"
    );
    let raw = std::fs::read_to_string(fixture_path).expect("seed-100.json must exist");

    #[derive(serde::Deserialize)]
    struct SeedCard {
        front: String,
        back: String,
        tags: Vec<String>,
    }
    let seed: Vec<SeedCard> = serde_json::from_str(&raw).unwrap();

    let cards_input: Vec<card::CreateCard> = seed
        .into_iter()
        .map(|c| card::CreateCard {
            front: c.front,
            back: c.back,
            tags: c.tags,
        })
        .collect();

    let inserted = card::bulk_insert(&conn, &deck.id, cards_input).unwrap();
    assert_eq!(inserted, 100);

    let cards = card::list_by_deck(&conn, &deck.id).unwrap();
    assert_eq!(cards.len(), 100);
    assert_eq!(
        cards[0].front, "palabra_0",
        "fixture order must be preserved"
    );
    assert_eq!(cards[0].state, "new");
    assert_eq!(cards[0].reps, 0);
    assert_eq!(cards[0].lapses, 0);
}
