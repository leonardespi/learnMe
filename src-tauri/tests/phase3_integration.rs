// Phase 3 integration tests — full import/export/roundtrip flows
// These tests reference commands not yet implemented; they MUST fail (red) until
// production code is written in step 4.
use learnme_lib::{
    commands::anki::{cmd_export_anki_deck, cmd_import_anki_deck},
    methods::anki::import::{validate_schema, ImportError, ImportResult},
};
use rusqlite::Connection;

fn make_db() -> Connection {
    let mut conn = Connection::open_in_memory().unwrap();
    conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
    learnme_lib::db::apply_migrations(&mut conn).unwrap();
    conn
}

fn make_category(conn: &Connection, name: &str) -> String {
    learnme_lib::repo::category::create(
        conn,
        learnme_lib::repo::category::CreateCategory {
            name: name.into(),
            color: None,
        },
    )
    .unwrap()
    .id
}

fn fixture_path(name: &str) -> String {
    format!("{}/../fixtures/decks/{}", env!("CARGO_MANIFEST_DIR"), name)
}

// ── Scenario I3-1: Import completo en DB vacía ───────────────────────────────

#[test]
fn import_full_deck_into_empty_db() {
    let conn = make_db();
    let cat_id = make_category(&conn, "Idiomas");
    let path = fixture_path("spanish-a2-valid.json");

    let result: ImportResult = cmd_import_anki_deck(&conn, &cat_id, &path).unwrap();

    assert_eq!(result.inserted, 50, "all 50 cards must be inserted");
    assert_eq!(result.skipped, 0, "no cards must be skipped");

    // study was created automatically
    let studies = learnme_lib::repo::study::list_by_category(&conn, &cat_id).unwrap();
    assert_eq!(studies.len(), 1, "one study must be created");
    assert_eq!(studies[0].name, "Spanish A2 Vocabulary");
    assert_eq!(studies[0].method, "anki");

    let cards = learnme_lib::repo::card::list_by_deck(&conn, &studies[0].id).unwrap();
    assert_eq!(cards.len(), 50, "50 cards must be present in DB");

    for card in &cards {
        assert_eq!(card.state, "new", "all imported cards must start as new");
        assert_eq!(card.reps, 0);
        assert_eq!(card.lapses, 0);
    }
}

// ── Scenario I3-2: Re-import total dedupe ────────────────────────────────────

#[test]
fn reimport_same_file_dedupes_all() {
    let conn = make_db();
    let cat_id = make_category(&conn, "Idiomas");
    let path = fixture_path("spanish-a2-valid.json");

    // First import
    let first = cmd_import_anki_deck(&conn, &cat_id, &path).unwrap();
    assert_eq!(first.inserted, 50);

    let studies = learnme_lib::repo::study::list_by_category(&conn, &cat_id).unwrap();
    let deck_id = &studies[0].id;

    // Modify FSRS state of 5 cards to verify preservation
    let cards = learnme_lib::repo::card::list_by_deck(&conn, deck_id).unwrap();
    for card in cards.iter().take(5) {
        learnme_lib::repo::card::update_fsrs(
            &conn,
            &card.id,
            learnme_lib::core::types::CardFsrsUpdate {
                stability: 5.5,
                difficulty: 7.2,
                due: "2099-01-01T00:00:00Z".into(),
                last_review: "2026-05-01T00:00:00Z".into(),
                state: "review".into(),
                reps: 3,
                lapses: 1,
            },
        )
        .unwrap();
    }

    // Second import (same file)
    let second = cmd_import_anki_deck(&conn, &cat_id, &path).unwrap();
    assert_eq!(
        second.inserted, 0,
        "no new cards must be inserted on re-import"
    );
    assert_eq!(second.skipped, 50, "all 50 must be skipped");

    // Only one study must exist
    let studies_after = learnme_lib::repo::study::list_by_category(&conn, &cat_id).unwrap();
    assert_eq!(
        studies_after.len(),
        1,
        "re-import must not create duplicate study"
    );

    // FSRS state preserved for modified cards
    let cards_after = learnme_lib::repo::card::list_by_deck(&conn, deck_id).unwrap();
    assert_eq!(cards_after.len(), 50, "card count unchanged");

    let modified: Vec<_> = cards_after.iter().filter(|c| c.state == "review").collect();
    assert_eq!(
        modified.len(),
        5,
        "5 reviewed cards must retain review state"
    );
    for card in modified {
        assert_eq!(card.stability, 5.5, "stability must be preserved");
        assert_eq!(card.reps, 3, "reps must be preserved");
    }
}

// ── Scenario I3-3: Re-import parcial (50 existing + 10 nuevas) ───────────────

#[test]
fn reimport_extended_file_inserts_new_skips_existing() {
    let conn = make_db();
    let cat_id = make_category(&conn, "Idiomas");

    let first =
        cmd_import_anki_deck(&conn, &cat_id, &fixture_path("spanish-a2-valid.json")).unwrap();
    assert_eq!(first.inserted, 50);

    let second =
        cmd_import_anki_deck(&conn, &cat_id, &fixture_path("spanish-a2-extended.json")).unwrap();
    assert_eq!(second.inserted, 10, "10 new cards must be inserted");
    assert_eq!(second.skipped, 50, "50 existing must be skipped");

    let studies = learnme_lib::repo::study::list_by_category(&conn, &cat_id).unwrap();
    let cards = learnme_lib::repo::card::list_by_deck(&conn, &studies[0].id).unwrap();
    assert_eq!(cards.len(), 60, "total must be 60 after partial re-import");

    let new_cards: Vec<_> = cards.iter().filter(|c| c.state == "new").collect();
    assert_eq!(
        new_cards.len(),
        60,
        "all cards (including new 10) must be in new state"
    );
}

// ── Scenario I3-4: Export → Import roundtrip (snapshot) ─────────────────────

#[test]
fn export_import_roundtrip_preserves_cards() {
    let conn = make_db();
    let cat_id = make_category(&conn, "Source");

    cmd_import_anki_deck(&conn, &cat_id, &fixture_path("spanish-a2-valid.json")).unwrap();
    let studies = learnme_lib::repo::study::list_by_category(&conn, &cat_id).unwrap();
    let deck_id = &studies[0].id;

    // Export
    let exported: serde_json::Value = cmd_export_anki_deck(&conn, deck_id).unwrap();

    // Exported payload is schema-valid
    assert!(
        validate_schema(&exported).is_ok(),
        "exported deck must pass schema validation"
    );

    // Write to temp file and re-import as new deck
    let tmp = std::env::temp_dir().join("learnme_test_roundtrip.json");
    std::fs::write(&tmp, serde_json::to_string(&exported).unwrap()).unwrap();

    let cat2_id = make_category(&conn, "Destination");
    let result = cmd_import_anki_deck(&conn, &cat2_id, tmp.to_str().unwrap()).unwrap();

    std::fs::remove_file(&tmp).ok();

    assert_eq!(result.inserted, 50, "roundtrip must import all 50 cards");
    assert_eq!(result.skipped, 0);

    let studies2 = learnme_lib::repo::study::list_by_category(&conn, &cat2_id).unwrap();
    let cards2 = learnme_lib::repo::card::list_by_deck(&conn, &studies2[0].id).unwrap();

    assert_eq!(cards2.len(), 50);

    // Snapshot the roundtrip cards (front, back, tags, state — no IDs)
    let snapshot: Vec<serde_json::Value> = cards2
        .iter()
        .map(|c| {
            serde_json::json!({
                "front": c.front,
                "back": c.back,
                "tags": c.tags,
                "state": c.state,
            })
        })
        .collect();
    insta::assert_json_snapshot!("phase3_roundtrip_cards", snapshot);
}

// ── Scenario I3-5: Performance benchmark (opt-in, not in CI) ─────────────────

// CANNOT TEST: benchmark — opt-in only; long-running test not suitable for CI.
// Run manually: cargo test -- --ignored phase3 --nocapture
#[ignore]
#[test]
fn import_10k_cards_under_5_seconds() {
    let conn = make_db();
    let cat_id = make_category(&conn, "Bench");
    let path = fixture_path("10k-cards.json");
    let start = std::time::Instant::now();
    let result = cmd_import_anki_deck(&conn, &cat_id, &path).unwrap();
    let elapsed = start.elapsed();
    assert_eq!(result.inserted, 10_000);
    assert!(
        elapsed.as_millis() < 5_000,
        "10k import must complete in under 5s, took {}ms",
        elapsed.as_millis()
    );
}

// ── Error path: import invalid schema file ────────────────────────────────────

#[test]
fn import_missing_method_returns_schema_error() {
    let conn = make_db();
    let cat_id = make_category(&conn, "Test");
    let path = fixture_path("missing-method.json");
    let err = cmd_import_anki_deck(&conn, &cat_id, &path).unwrap_err();
    assert!(
        matches!(err, ImportError::Schema { .. }),
        "missing method must produce SchemaError, got: {err:?}"
    );
}

#[test]
fn import_binary_file_returns_parse_error() {
    let conn = make_db();
    let cat_id = make_category(&conn, "Test");
    let path = fixture_path("binary.bin");
    let err = cmd_import_anki_deck(&conn, &cat_id, &path).unwrap_err();
    assert!(
        matches!(err, ImportError::Parse(_)),
        "binary file must produce ParseError, got: {err:?}"
    );
}
