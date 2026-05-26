use chrono::{Duration, Utc};
use learnme_lib::{
    commands::{deck::cmd_next_card, review::cmd_record_review},
    core::types::CardFsrsUpdate,
    repo::{card, category, study},
};
use rusqlite::Connection;

fn make_db() -> Connection {
    let mut conn = Connection::open_in_memory().unwrap();
    conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
    learnme_lib::db::apply_migrations(&mut conn).unwrap();
    conn
}

/// Scenario I-1: full review cycle — create deck, insert 3 cards,
/// review first card with grade 3, verify state transition and
/// that next call returns a different card.
#[test]
fn full_review_cycle_3_cards() {
    let conn = make_db();
    let cat_id = category::create(
        &conn,
        category::CreateCategory {
            name: "Math".into(),
            color: None,
        },
    )
    .unwrap()
    .id;
    let deck_id = study::create(
        &conn,
        study::CreateStudy {
            category_id: cat_id,
            method: "anki".into(),
            name: "Algebra".into(),
            payload: serde_json::json!({}),
        },
    )
    .unwrap()
    .id;
    card::bulk_insert(
        &conn,
        &deck_id,
        vec![
            card::CreateCard {
                front: "Q1".into(),
                back: "A1".into(),
                tags: vec![],
            },
            card::CreateCard {
                front: "Q2".into(),
                back: "A2".into(),
                tags: vec![],
            },
            card::CreateCard {
                front: "Q3".into(),
                back: "A3".into(),
                tags: vec![],
            },
        ],
    )
    .unwrap();

    let now = Utc::now();
    let card_1 = cmd_next_card(&conn, &deck_id, 3).unwrap().unwrap();
    let result = cmd_record_review(&conn, &card_1.id, 3, now).unwrap();

    assert_eq!(result.card.state, "learning");
    assert_eq!(result.card.reps, 1);
    assert_eq!(result.card.lapses, 0);
    assert_eq!(result.review_log.card_id, card_1.id);
    assert_eq!(result.review_log.grade, 3);

    // After reviewing card_1 (now in learning with due in the future),
    // next_card should return a different card.
    let card_2 = cmd_next_card(&conn, &deck_id, 2).unwrap().unwrap();
    assert_ne!(card_2.id, card_1.id);
}

/// Scenario I-2: priority ordering — learning overdue > review overdue > new.
/// Sets up 4 cards with different states via update_fsrs and verifies
/// cmd_next_card returns the learning card first.
#[test]
fn next_card_priority_learning_before_review_before_new() {
    let conn = make_db();
    let cat_id = category::create(
        &conn,
        category::CreateCategory {
            name: "Lang".into(),
            color: None,
        },
    )
    .unwrap()
    .id;
    let deck_id = study::create(
        &conn,
        study::CreateStudy {
            category_id: cat_id,
            method: "anki".into(),
            name: "Spanish".into(),
            payload: serde_json::json!({}),
        },
    )
    .unwrap()
    .id;
    card::bulk_insert(
        &conn,
        &deck_id,
        vec![
            card::CreateCard {
                front: "c1_review".into(),
                back: "A".into(),
                tags: vec![],
            },
            card::CreateCard {
                front: "c2_learning".into(),
                back: "B".into(),
                tags: vec![],
            },
            card::CreateCard {
                front: "c3_new".into(),
                back: "C".into(),
                tags: vec![],
            },
            card::CreateCard {
                front: "c4_future".into(),
                back: "D".into(),
                tags: vec![],
            },
        ],
    )
    .unwrap();
    let cards = card::list_by_deck(&conn, &deck_id).unwrap();

    // c1 → overdue review (30 days ago)
    card::update_fsrs(
        &conn,
        &cards[0].id,
        CardFsrsUpdate {
            stability: 10.0,
            difficulty: 5.0,
            due: "2025-12-01T00:00:00Z".into(),
            last_review: "2025-12-01T00:00:00Z".into(),
            state: "review".into(),
            reps: 3,
            lapses: 0,
        },
    )
    .unwrap();
    // c2 → overdue learning (1 hour ago) — highest priority
    let one_hour_ago = (Utc::now() - Duration::hours(1)).to_rfc3339();
    card::update_fsrs(
        &conn,
        &cards[1].id,
        CardFsrsUpdate {
            stability: 3.0,
            difficulty: 5.0,
            due: one_hour_ago.clone(),
            last_review: one_hour_ago,
            state: "learning".into(),
            reps: 1,
            lapses: 0,
        },
    )
    .unwrap();
    // c4 → due in the future (not eligible)
    let future_due = (Utc::now() + Duration::days(5)).to_rfc3339();
    card::update_fsrs(
        &conn,
        &cards[3].id,
        CardFsrsUpdate {
            stability: 10.0,
            difficulty: 5.0,
            due: future_due,
            last_review: "2025-12-01T00:00:00Z".into(),
            state: "review".into(),
            reps: 2,
            lapses: 0,
        },
    )
    .unwrap();

    let first = cmd_next_card(&conn, &deck_id, 1).unwrap().unwrap();
    assert_eq!(
        first.id, cards[1].id,
        "learning overdue should have highest priority"
    );
    assert_eq!(first.state, "learning");
}
