use chrono::{DateTime, Duration, Utc};
use learnme_lib::{
    commands::{
        deck::{cmd_forecast, cmd_next_card},
        review::cmd_record_review,
    },
    core::{
        error::{RepoError, ValidationError},
        types::{Card, CardFsrsUpdate},
    },
    methods::anki::fsrs::apply_review,
    repo::{card, category, study},
};
use rusqlite::Connection;

fn make_db() -> Connection {
    let mut conn = Connection::open_in_memory().unwrap();
    conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
    learnme_lib::db::apply_migrations(&mut conn).unwrap();
    conn
}

fn make_deck(conn: &Connection) -> String {
    let cat_id = category::create(
        conn,
        category::CreateCategory {
            name: "Cat".into(),
            color: None,
        },
    )
    .unwrap()
    .id;
    study::create(
        conn,
        study::CreateStudy {
            category_id: cat_id,
            method: "anki".into(),
            name: "Deck".into(),
            payload: serde_json::json!({}),
        },
    )
    .unwrap()
    .id
}

fn make_card_id(conn: &Connection) -> String {
    let deck_id = make_deck(conn);
    card::bulk_insert(
        conn,
        &deck_id,
        vec![card::CreateCard {
            front: "Q".into(),
            back: "A".into(),
            tags: vec![],
        }],
    )
    .unwrap();
    card::list_by_deck(conn, &deck_id)
        .unwrap()
        .into_iter()
        .next()
        .unwrap()
        .id
}

fn new_card() -> Card {
    Card {
        id: "dummy-id".into(),
        deck_id: "dummy-deck".into(),
        front: "front".into(),
        back: "back".into(),
        tags: vec![],
        stability: 0.0,
        difficulty: 0.0,
        due: "2026-01-01T00:00:00Z".into(),
        last_review: None,
        state: "new".into(),
        reps: 0,
        lapses: 0,
    }
}

fn fixed_now() -> DateTime<Utc> {
    DateTime::parse_from_rfc3339("2026-01-01T00:00:00Z")
        .unwrap()
        .with_timezone(&Utc)
}

// === study::get_by_id (tests #1–2) ===

#[test]
fn study_get_by_id_found() {
    let conn = make_db();
    let deck_id = make_deck(&conn);
    let s = study::get_by_id(&conn, &deck_id).unwrap();
    assert_eq!(s.id, deck_id);
    assert_eq!(s.name, "Deck");
}

#[test]
fn study_get_by_id_not_found() {
    let conn = make_db();
    let err = study::get_by_id(&conn, "00000000-0000-0000-0000-000000000000").unwrap_err();
    assert!(matches!(err, RepoError::NotFound));
}

// === study::delete (tests #3–5) ===

#[test]
fn study_delete_happy_path() {
    let conn = make_db();
    let deck_id = make_deck(&conn);
    study::delete(&conn, &deck_id).unwrap();
    let err = study::get_by_id(&conn, &deck_id).unwrap_err();
    assert!(matches!(err, RepoError::NotFound));
}

#[test]
fn study_delete_not_found() {
    let conn = make_db();
    let err = study::delete(&conn, "00000000-0000-0000-0000-000000000000").unwrap_err();
    assert!(matches!(err, RepoError::NotFound));
}

#[test]
fn study_delete_with_cards_violates_fk() {
    let conn = make_db();
    let deck_id = make_deck(&conn);
    card::bulk_insert(
        &conn,
        &deck_id,
        vec![card::CreateCard {
            front: "Q".into(),
            back: "A".into(),
            tags: vec![],
        }],
    )
    .unwrap();
    let err = study::delete(&conn, &deck_id).unwrap_err();
    assert!(matches!(err, RepoError::ForeignKeyViolation));
}

// === card::update_fsrs (tests #6–7) ===

fn fsrs_update_learning() -> CardFsrsUpdate {
    CardFsrsUpdate {
        stability: 3.1262,
        difficulty: 6.8,
        due: "2026-01-01T00:10:00Z".into(),
        last_review: "2026-01-01T00:00:00Z".into(),
        state: "learning".into(),
        reps: 1,
        lapses: 0,
    }
}

#[test]
fn card_update_fsrs_happy_path() {
    let conn = make_db();
    let card_id = make_card_id(&conn);
    let updated = card::update_fsrs(&conn, &card_id, fsrs_update_learning()).unwrap();
    assert_eq!(updated.state, "learning");
    assert_eq!(updated.reps, 1);
    assert_eq!(updated.lapses, 0);
    assert!((updated.stability - 3.1262).abs() < 1e-4);
}

#[test]
fn card_update_fsrs_not_found() {
    let conn = make_db();
    let err = card::update_fsrs(
        &conn,
        "00000000-0000-0000-0000-000000000000",
        fsrs_update_learning(),
    )
    .unwrap_err();
    assert!(matches!(err, RepoError::NotFound));
}

// === methods::anki::fsrs::apply_review (tests #8–14) ===

#[test]
fn apply_review_new_good_state_learning() {
    let card = new_card();
    let now = fixed_now();
    let result = apply_review(&card, 3, now).unwrap();
    assert_eq!(result.state, "learning");
    assert_eq!(result.reps, 1);
    assert_eq!(result.lapses, 0);
    assert!(result.stability > 0.0);
    let due = DateTime::parse_from_rfc3339(&result.due)
        .unwrap()
        .with_timezone(&Utc);
    assert!(due > now);
    assert!(due <= now + Duration::minutes(15));
}

#[test]
fn apply_review_new_again_learning_no_lapses() {
    let card = new_card();
    let now = fixed_now();
    let result = apply_review(&card, 1, now).unwrap();
    assert_eq!(result.state, "learning");
    assert_eq!(result.reps, 1);
    assert_eq!(result.lapses, 0);
    let due = DateTime::parse_from_rfc3339(&result.due)
        .unwrap()
        .with_timezone(&Utc);
    assert!(due > now);
    assert!(due <= now + Duration::minutes(5));
}

#[test]
fn apply_review_review_again_relearning_lapses_incremented() {
    let card = Card {
        id: "dummy".into(),
        deck_id: "dummy".into(),
        front: "Q".into(),
        back: "A".into(),
        tags: vec![],
        stability: 10.0,
        difficulty: 5.0,
        due: "2025-12-22T00:00:00Z".into(),
        last_review: Some("2025-12-22T00:00:00Z".into()),
        state: "review".into(),
        reps: 3,
        lapses: 0,
    };
    let result = apply_review(&card, 1, fixed_now()).unwrap();
    assert_eq!(result.state, "relearning");
    assert_eq!(result.lapses, 1);
}

#[test]
fn apply_review_new_easy_jumps_to_review() {
    let card = new_card();
    let result = apply_review(&card, 4, fixed_now()).unwrap();
    assert_eq!(result.state, "review");
    // w[3] = 15.4722 → scheduled_days ≈ 15; minimum 14 with rounding
    let due = DateTime::parse_from_rfc3339(&result.due)
        .unwrap()
        .with_timezone(&Utc);
    assert!(due > fixed_now() + Duration::days(13));
}

#[test]
fn apply_review_grade_0_invalid() {
    let card = new_card();
    let err = apply_review(&card, 0, fixed_now()).unwrap_err();
    assert!(matches!(
        err,
        RepoError::Validation(ValidationError::InvalidGrade)
    ));
}

#[test]
fn apply_review_grade_5_invalid() {
    let card = new_card();
    let err = apply_review(&card, 5, fixed_now()).unwrap_err();
    assert!(matches!(
        err,
        RepoError::Validation(ValidationError::InvalidGrade)
    ));
}

#[test]
fn apply_review_determinism_snapshot() {
    let card = new_card();
    let result = apply_review(&card, 3, fixed_now()).unwrap();
    insta::assert_debug_snapshot!("apply_review_new_good_determinism", result);
}

// === commands::review::cmd_record_review (tests #15–19) ===

#[test]
fn cmd_record_review_new_good_transitions_to_learning() {
    let conn = make_db();
    let card_id = make_card_id(&conn);
    let result = cmd_record_review(&conn, &card_id, 3, fixed_now()).unwrap();
    assert_eq!(result.card.state, "learning");
    assert_eq!(result.card.reps, 1);
    assert_eq!(result.review_log.card_id, card_id);
    assert_eq!(result.review_log.grade, 3);
}

#[test]
fn cmd_record_review_new_again_no_lapses() {
    let conn = make_db();
    let card_id = make_card_id(&conn);
    let result = cmd_record_review(&conn, &card_id, 1, fixed_now()).unwrap();
    assert_eq!(result.card.state, "learning");
    assert_eq!(result.card.lapses, 0);
}

#[test]
fn cmd_record_review_card_not_found() {
    let conn = make_db();
    let err = cmd_record_review(
        &conn,
        "00000000-0000-0000-0000-000000000000",
        3,
        fixed_now(),
    )
    .unwrap_err();
    assert!(matches!(err, RepoError::NotFound));
}

#[test]
fn cmd_record_review_grade_0_invalid() {
    let conn = make_db();
    let card_id = make_card_id(&conn);
    let err = cmd_record_review(&conn, &card_id, 0, fixed_now()).unwrap_err();
    assert!(matches!(
        err,
        RepoError::Validation(ValidationError::InvalidGrade)
    ));
}

#[test]
fn cmd_record_review_grade_5_invalid() {
    let conn = make_db();
    let card_id = make_card_id(&conn);
    let err = cmd_record_review(&conn, &card_id, 5, fixed_now()).unwrap_err();
    assert!(matches!(
        err,
        RepoError::Validation(ValidationError::InvalidGrade)
    ));
}

// === commands::deck::cmd_next_card (tests #20–24) ===

#[test]
fn cmd_next_card_empty_deck_returns_none() {
    let conn = make_db();
    let deck_id = make_deck(&conn);
    let result = cmd_next_card(&conn, &deck_id, 10).unwrap();
    assert!(result.is_none());
}

#[test]
fn cmd_next_card_one_new_card_returned() {
    let conn = make_db();
    let deck_id = make_deck(&conn);
    card::bulk_insert(
        &conn,
        &deck_id,
        vec![card::CreateCard {
            front: "Q".into(),
            back: "A".into(),
            tags: vec![],
        }],
    )
    .unwrap();
    let result = cmd_next_card(&conn, &deck_id, 1).unwrap();
    assert!(result.is_some());
    assert_eq!(result.unwrap().state, "new");
}

#[test]
fn cmd_next_card_overdue_review_before_new() {
    let conn = make_db();
    let deck_id = make_deck(&conn);
    card::bulk_insert(
        &conn,
        &deck_id,
        vec![
            card::CreateCard {
                front: "overdue".into(),
                back: "A".into(),
                tags: vec![],
            },
            card::CreateCard {
                front: "new_card".into(),
                back: "B".into(),
                tags: vec![],
            },
        ],
    )
    .unwrap();
    let cards = card::list_by_deck(&conn, &deck_id).unwrap();
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
    let result = cmd_next_card(&conn, &deck_id, 1).unwrap().unwrap();
    assert_eq!(result.id, cards[0].id);
    assert_eq!(result.state, "review");
}

#[test]
fn cmd_next_card_new_limit_zero_returns_none_when_only_new() {
    let conn = make_db();
    let deck_id = make_deck(&conn);
    card::bulk_insert(
        &conn,
        &deck_id,
        vec![
            card::CreateCard {
                front: "Q1".into(),
                back: "A".into(),
                tags: vec![],
            },
            card::CreateCard {
                front: "Q2".into(),
                back: "B".into(),
                tags: vec![],
            },
        ],
    )
    .unwrap();
    let result = cmd_next_card(&conn, &deck_id, 0).unwrap();
    assert!(result.is_none());
}

#[test]
fn cmd_next_card_learning_before_review_before_new() {
    let conn = make_db();
    let deck_id = make_deck(&conn);
    card::bulk_insert(
        &conn,
        &deck_id,
        vec![
            card::CreateCard {
                front: "review_overdue".into(),
                back: "A".into(),
                tags: vec![],
            },
            card::CreateCard {
                front: "learning_overdue".into(),
                back: "B".into(),
                tags: vec![],
            },
            card::CreateCard {
                front: "new_card".into(),
                back: "C".into(),
                tags: vec![],
            },
        ],
    )
    .unwrap();
    let cards = card::list_by_deck(&conn, &deck_id).unwrap();
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
    card::update_fsrs(
        &conn,
        &cards[1].id,
        CardFsrsUpdate {
            stability: 3.0,
            difficulty: 5.0,
            due: "2025-12-31T23:00:00Z".into(),
            last_review: "2025-12-31T22:00:00Z".into(),
            state: "learning".into(),
            reps: 1,
            lapses: 0,
        },
    )
    .unwrap();
    let result = cmd_next_card(&conn, &deck_id, 1).unwrap().unwrap();
    assert_eq!(result.id, cards[1].id);
    assert_eq!(result.state, "learning");
}

// === commands::deck::cmd_forecast (tests #25–26) ===

#[test]
fn cmd_forecast_empty_deck_all_zeros() {
    let conn = make_db();
    let deck_id = make_deck(&conn);
    let result = cmd_forecast(&conn, &deck_id, 7).unwrap();
    assert_eq!(result, vec![0u32; 7]);
}

#[test]
fn cmd_forecast_cards_distributed_correctly() {
    let conn = make_db();
    let deck_id = make_deck(&conn);
    card::bulk_insert(
        &conn,
        &deck_id,
        vec![
            card::CreateCard {
                front: "Q1".into(),
                back: "A".into(),
                tags: vec![],
            },
            card::CreateCard {
                front: "Q2".into(),
                back: "B".into(),
                tags: vec![],
            },
            card::CreateCard {
                front: "Q3".into(),
                back: "C".into(),
                tags: vec![],
            },
            card::CreateCard {
                front: "Q4".into(),
                back: "D".into(),
                tags: vec![],
            },
            card::CreateCard {
                front: "Q5".into(),
                back: "E".into(),
                tags: vec![],
            },
        ],
    )
    .unwrap();
    let cards = card::list_by_deck(&conn, &deck_id).unwrap();
    // 3 cards overdue (bucket 0)
    for c in &cards[0..3] {
        card::update_fsrs(
            &conn,
            &c.id,
            CardFsrsUpdate {
                stability: 10.0,
                difficulty: 5.0,
                due: "2025-12-01T00:00:00Z".into(),
                last_review: "2025-12-01T00:00:00Z".into(),
                state: "review".into(),
                reps: 2,
                lapses: 0,
            },
        )
        .unwrap();
    }
    // 2 cards due in 3 days (bucket 3)
    let due_3 = (Utc::now() + Duration::days(3))
        .format("%Y-%m-%dT12:00:00Z")
        .to_string();
    for c in &cards[3..5] {
        card::update_fsrs(
            &conn,
            &c.id,
            CardFsrsUpdate {
                stability: 10.0,
                difficulty: 5.0,
                due: due_3.clone(),
                last_review: "2025-12-01T00:00:00Z".into(),
                state: "review".into(),
                reps: 2,
                lapses: 0,
            },
        )
        .unwrap();
    }
    let result = cmd_forecast(&conn, &deck_id, 7).unwrap();
    assert_eq!(result.len(), 7);
    assert_eq!(result[0], 3);
    assert_eq!(result[3], 2);
}
