// Phase 6 unit tests — review_log::list_by_deck and stats::compute.
// These tests reference symbols not yet implemented; they MUST fail to compile (red)
// until production code is written in step 4.
use chrono::NaiveDate;
use learnme_lib::{
    repo::{
        card,
        category::{self, CreateCategory},
        review_log::{self, CreateReviewLog},
        study::{self, CreateStudy},
    },
    stats::{compute, DeckStats, StateCount},
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
        CreateCategory {
            name: "Cat".into(),
            color: None,
        },
    )
    .unwrap()
    .id;
    study::create(
        conn,
        CreateStudy {
            category_id: cat_id,
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
            front: "f".into(),
            back: "b".into(),
            tags: vec![],
        },
    )
    .unwrap()
    .id
}

fn insert_log(conn: &Connection, card_id: &str, grade: i32, reviewed_at: &str) {
    review_log::insert(
        conn,
        CreateReviewLog {
            card_id: card_id.into(),
            grade,
            reviewed_at: reviewed_at.into(),
            prev_stability: 0.5,
            prev_difficulty: 5.0,
            prev_due: reviewed_at.into(),
        },
    )
    .unwrap();
}

// ── review_log::list_by_deck ─────────────────────────────────────────────────

#[test]
fn phase6_list_by_deck_happy_path() {
    let conn = make_db();
    let deck_id = make_deck(&conn);
    let card1 = make_card(&conn, &deck_id);
    let card2 = make_card(&conn, &deck_id);
    insert_log(&conn, &card1, 3, "2026-05-23T09:00:00Z");
    insert_log(&conn, &card1, 3, "2026-05-24T09:00:00Z");
    insert_log(&conn, &card2, 1, "2026-05-22T09:00:00Z");

    let logs = review_log::list_by_deck(&conn, &deck_id).unwrap();

    assert_eq!(logs.len(), 3, "2 cards with 3 total reviews");
    assert!(
        logs[0].reviewed_at >= logs[1].reviewed_at,
        "ordered by reviewed_at desc"
    );
    assert!(logs[1].reviewed_at >= logs[2].reviewed_at);
}

#[test]
fn phase6_list_by_deck_empty() {
    let conn = make_db();
    let deck_id = make_deck(&conn);
    let _card = make_card(&conn, &deck_id);

    let logs = review_log::list_by_deck(&conn, &deck_id).unwrap();

    assert!(logs.is_empty(), "deck with no reviews returns empty vec");
}

#[test]
fn phase6_list_by_deck_isolates_by_deck() {
    let conn = make_db();
    let deck_a = make_deck(&conn);
    let deck_b = make_deck(&conn);
    let card_a = make_card(&conn, &deck_a);
    let card_b = make_card(&conn, &deck_b);
    insert_log(&conn, &card_a, 3, "2026-05-25T09:00:00Z");
    insert_log(&conn, &card_b, 3, "2026-05-25T10:00:00Z");
    insert_log(&conn, &card_b, 3, "2026-05-25T11:00:00Z");

    let logs_a = review_log::list_by_deck(&conn, &deck_a).unwrap();
    let logs_b = review_log::list_by_deck(&conn, &deck_b).unwrap();

    assert_eq!(logs_a.len(), 1, "deck A has 1 review");
    assert_eq!(logs_b.len(), 2, "deck B has 2 reviews");
}

#[test]
fn phase6_list_by_deck_multiple_cards() {
    let conn = make_db();
    let deck_id = make_deck(&conn);
    let cards: Vec<String> = (0..3).map(|_| make_card(&conn, &deck_id)).collect();
    for card_id in &cards {
        insert_log(&conn, card_id, 3, "2026-05-25T09:00:00Z");
        insert_log(&conn, card_id, 3, "2026-05-24T09:00:00Z");
    }

    let logs = review_log::list_by_deck(&conn, &deck_id).unwrap();

    assert_eq!(logs.len(), 6, "3 cards × 2 reviews = 6 logs total");
}

// ── stats::compute ───────────────────────────────────────────────────────────

#[test]
fn phase6_stats_empty_deck() {
    let conn = make_db();
    let deck_id = make_deck(&conn);
    let today = NaiveDate::from_ymd_opt(2026, 5, 25).unwrap();

    let stats: DeckStats = compute(&conn, &deck_id, today).unwrap();

    assert!(
        stats.retention.is_none(),
        "0 reviews → retention must be None"
    );
    assert_eq!(stats.heatmap.len(), 365, "heatmap must have 365 entries");
    assert!(
        stats.heatmap.iter().all(|&v| v == 0),
        "no reviews → all heatmap buckets must be 0"
    );
    assert_eq!(stats.forecast.len(), 7, "forecast must have 7 entries");
}

#[test]
fn phase6_stats_retention_80_percent() {
    let conn = make_db();
    let deck_id = make_deck(&conn);
    let card_id = make_card(&conn, &deck_id);
    let today = NaiveDate::from_ymd_opt(2026, 5, 25).unwrap();

    // 20 grade=1: 2026-05-01 to 2026-05-05, 4 per day — mirrors stats-history.json
    for day in 1u32..=5 {
        for h in [9u32, 11, 14, 16] {
            insert_log(
                &conn,
                &card_id,
                1,
                &format!("2026-05-{:02}T{:02}:00:00Z", day, h),
            );
        }
    }
    // 80 grade=3: 2026-05-06 to 2026-05-25, 4 per day
    for day in 6u32..=25 {
        for h in [9u32, 11, 14, 16] {
            insert_log(
                &conn,
                &card_id,
                3,
                &format!("2026-05-{:02}T{:02}:00:00Z", day, h),
            );
        }
    }

    let stats: DeckStats = compute(&conn, &deck_id, today).unwrap();

    let retention = stats.retention.unwrap();
    assert!(
        (retention - 0.80).abs() < 0.01,
        "expected retention ≈ 0.80, got {retention}"
    );
}

#[test]
fn phase6_stats_heatmap_bucket_sum() {
    let conn = make_db();
    let deck_id = make_deck(&conn);
    let card_id = make_card(&conn, &deck_id);
    let today = NaiveDate::from_ymd_opt(2026, 5, 25).unwrap();

    // 5 reviews on 2026-05-15 (10 days ago → heatmap index 354 = 364-10)
    for h in [9u32, 10, 11, 14, 16] {
        insert_log(&conn, &card_id, 3, &format!("2026-05-15T{h:02}:00:00Z"));
    }

    let stats: DeckStats = compute(&conn, &deck_id, today).unwrap();

    assert_eq!(
        stats.heatmap[354], 5,
        "index 354 (today-10d = 2026-05-15) must have 5 reviews"
    );
    assert_eq!(
        stats.heatmap.iter().sum::<u32>(),
        5,
        "heatmap total must equal total review count"
    );
}

#[test]
fn phase6_stats_forecast_tomorrow() {
    let conn = make_db();
    let deck_id = make_deck(&conn);
    let today = NaiveDate::from_ymd_opt(2026, 5, 25).unwrap();

    // 3 cards with due = tomorrow (2026-05-26)
    for _ in 0..3 {
        let card_id = make_card(&conn, &deck_id);
        conn.execute(
            "UPDATE cards SET due = ?1, state = 'review' WHERE id = ?2",
            rusqlite::params!["2026-05-26T00:00:00Z", card_id],
        )
        .unwrap();
    }

    let stats: DeckStats = compute(&conn, &deck_id, today).unwrap();

    assert_eq!(
        stats.forecast[1], 3,
        "forecast[1] (tomorrow = 2026-05-26) must have 3 cards"
    );
}

#[test]
fn phase6_stats_by_state_counts() {
    let conn = make_db();
    let deck_id = make_deck(&conn);
    let today = NaiveDate::from_ymd_opt(2026, 5, 25).unwrap();

    let state_counts = [
        ("new", 2u32),
        ("learning", 1),
        ("review", 3),
        ("relearning", 1),
    ];
    for (state, count) in state_counts {
        for _ in 0..count {
            let card_id = make_card(&conn, &deck_id);
            conn.execute(
                "UPDATE cards SET state = ?1 WHERE id = ?2",
                rusqlite::params![state, card_id],
            )
            .unwrap();
        }
    }

    let stats: DeckStats = compute(&conn, &deck_id, today).unwrap();
    let by_state: StateCount = stats.by_state;

    assert_eq!(by_state.new, 2);
    assert_eq!(by_state.learning, 1);
    assert_eq!(by_state.review, 3);
    assert_eq!(by_state.relearning, 1);
}

#[test]
fn phase6_stats_heatmap_ignores_reviews_older_than_365_days() {
    let conn = make_db();
    let deck_id = make_deck(&conn);
    let card_id = make_card(&conn, &deck_id);
    let today = NaiveDate::from_ymd_opt(2026, 5, 25).unwrap();

    // 2025-05-24 = 366 days before 2026-05-25 → outside 365d window
    insert_log(&conn, &card_id, 3, "2025-05-24T09:00:00Z");

    let stats: DeckStats = compute(&conn, &deck_id, today).unwrap();

    assert!(
        stats.heatmap.iter().all(|&v| v == 0),
        "review >365 days old must not appear in heatmap"
    );
}

#[test]
fn phase6_stats_retention_excludes_reviews_older_than_30_days() {
    let conn = make_db();
    let deck_id = make_deck(&conn);
    let card_id = make_card(&conn, &deck_id);
    let today = NaiveDate::from_ymd_opt(2026, 5, 25).unwrap();

    // 10 reviews at 2026-04-24 (31 days ago) — outside rolling 30d window
    for h in 8u32..18 {
        insert_log(&conn, &card_id, 1, &format!("2026-04-24T{h:02}:00:00Z"));
    }
    // 1 review within 30d (2026-05-24), grade=3 → retention must be 1.0
    insert_log(&conn, &card_id, 3, "2026-05-24T09:00:00Z");

    let stats: DeckStats = compute(&conn, &deck_id, today).unwrap();

    let retention = stats.retention.unwrap();
    assert!(
        (retention - 1.0).abs() < 0.01,
        "only the in-window grade=3 review counts; expected retention=1.0, got {retention}"
    );
}
