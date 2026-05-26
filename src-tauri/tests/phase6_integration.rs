// Phase 6 integration tests — full stats pipeline with fixture-seeded DB.
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
    stats::compute,
};
use rusqlite::Connection;
use serde::Deserialize;

fn make_db() -> Connection {
    let mut conn = Connection::open_in_memory().unwrap();
    conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
    learnme_lib::db::apply_migrations(&mut conn).unwrap();
    conn
}

#[derive(Deserialize)]
struct HistoryEntry {
    grade: i32,
    reviewed_at: String,
    prev_stability: f64,
    prev_difficulty: f64,
    prev_due: String,
}

fn load_stats_history() -> Vec<HistoryEntry> {
    let path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../fixtures/reviews/stats-history.json"
    );
    let data = std::fs::read_to_string(path)
        .expect("fixtures/reviews/stats-history.json not found — run from repo root");
    serde_json::from_str(&data).expect("invalid JSON in stats-history.json")
}

// ── Scenario: pipeline completo stats con historial real ────────────────────

#[test]
fn phase6_integration_stats_from_fixture() {
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
            front: "front".into(),
            back: "back".into(),
            tags: vec![],
        },
    )
    .unwrap()
    .id;

    let entries = load_stats_history();
    assert_eq!(
        entries.len(),
        100,
        "fixture must contain exactly 100 entries"
    );

    for entry in &entries {
        review_log::insert(
            &conn,
            CreateReviewLog {
                card_id: card_id.clone(),
                grade: entry.grade,
                reviewed_at: entry.reviewed_at.clone(),
                prev_stability: entry.prev_stability,
                prev_difficulty: entry.prev_difficulty,
                prev_due: entry.prev_due.clone(),
            },
        )
        .unwrap();
    }

    let today = NaiveDate::from_ymd_opt(2026, 5, 25).unwrap();
    let stats = compute(&conn, &deck_id, today).unwrap();

    let retention = stats
        .retention
        .expect("100 reviews → retention must be Some");
    assert!(
        (retention - 0.80).abs() < 0.01,
        "expected retention ≈ 0.80, got {retention}"
    );

    let heatmap_sum: u32 = stats.heatmap.iter().sum();
    assert_eq!(
        heatmap_sum, 100,
        "heatmap total must equal total review count (100)"
    );

    assert!(
        stats.forecast.iter().all(|&v| v <= 1),
        "1 card in deck → no forecast day can exceed 1"
    );
}

// ── Scenario: ventana de 30 días es precisa (inclusión del límite) ────────────

#[test]
fn phase6_integration_30day_window_boundary() {
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
            front: "f".into(),
            back: "b".into(),
            tags: vec![],
        },
    )
    .unwrap()
    .id;

    let today = NaiveDate::from_ymd_opt(2026, 5, 25).unwrap();

    // 10 reviews at 2026-04-25 (exactly today-30d) — INSIDE window, all grade=1
    for h in 8u32..18 {
        review_log::insert(
            &conn,
            CreateReviewLog {
                card_id: card_id.clone(),
                grade: 1,
                reviewed_at: format!("2026-04-25T{h:02}:00:00Z"),
                prev_stability: 0.5,
                prev_difficulty: 5.0,
                prev_due: "2026-04-25T08:00:00Z".into(),
            },
        )
        .unwrap();
    }
    // 10 reviews at 2026-04-24 (today-31d) — OUTSIDE window
    for h in 8u32..18 {
        review_log::insert(
            &conn,
            CreateReviewLog {
                card_id: card_id.clone(),
                grade: 1,
                reviewed_at: format!("2026-04-24T{h:02}:00:00Z"),
                prev_stability: 0.5,
                prev_difficulty: 5.0,
                prev_due: "2026-04-24T08:00:00Z".into(),
            },
        )
        .unwrap();
    }

    let stats = compute(&conn, &deck_id, today).unwrap();

    // Only the 10 in-window reviews count; all grade=1 → retention = 0.0
    let retention = stats
        .retention
        .expect("10 in-window reviews → retention must be Some");
    assert!(
        retention < 0.01,
        "all in-window reviews are grade=1 → retention ≈ 0.0, got {retention}"
    );

    // Both batches (2026-04-24 and 2026-04-25) are within the 365d heatmap window.
    // The 30d retention window excludes 2026-04-24, but the heatmap does not.
    let heatmap_sum: u32 = stats.heatmap.iter().sum();
    assert_eq!(
        heatmap_sum, 20,
        "both batches (2026-04-24 and 2026-04-25) are within 365d heatmap window"
    );
}
