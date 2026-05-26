// Phase 7 unit tests — session::checksum, session::export, session::import validation.
// These tests reference symbols not yet implemented; they MUST fail to compile (red)
// until production code is written in step 4.
use learnme_lib::session::{
    checksum::compute_checksum,
    export::build_learnme,
    import::{resolve_conflict, validate_fk_integrity, validate_version, verify_checksum},
    types::{LearnmeCard, LearnmeData, LearnmeReviewLog},
};
use rusqlite::Connection;

fn make_db() -> Connection {
    let mut conn = Connection::open_in_memory().unwrap();
    conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
    learnme_lib::db::apply_migrations(&mut conn).unwrap();
    conn
}

fn minimal_data() -> LearnmeData {
    LearnmeData {
        categories: vec![],
        studies: vec![],
        cards: vec![],
        review_logs: vec![],
    }
}

// ── checksum::compute_checksum ──────────────────────────────────────────────

#[test]
fn phase7_unit_checksum_returns_64_char_hex() {
    let data = minimal_data();
    let result = compute_checksum(&data, "0.1.0", "2026-01-01T00:00:00Z", 1);
    assert!(result.is_ok());
    let hex = result.unwrap();
    assert_eq!(hex.len(), 64, "SHA-256 must be 64 hex chars");
    assert!(hex.chars().all(|c| c.is_ascii_hexdigit()), "must be hex");
}

#[test]
fn phase7_unit_checksum_determinism() {
    let data = minimal_data();
    let a = compute_checksum(&data, "0.1.0", "2026-01-01T00:00:00Z", 1).unwrap();
    let b = compute_checksum(&data, "0.1.0", "2026-01-01T00:00:00Z", 1).unwrap();
    assert_eq!(a, b, "checksum must be deterministic");
}

#[test]
fn phase7_unit_checksum_canonical_key_order() {
    // Build two data objects structurally equal but inserted in different order.
    // Canonical JSON sorts keys → same hash.
    use learnme_lib::session::types::LearnmeCategory;
    let cat = LearnmeCategory {
        id: "cat-1".into(),
        name: "X".into(),
        color: None,
    };
    let data1 = LearnmeData {
        categories: vec![cat.clone()],
        studies: vec![],
        cards: vec![],
        review_logs: vec![],
    };
    let data2 = LearnmeData {
        categories: vec![cat],
        studies: vec![],
        cards: vec![],
        review_logs: vec![],
    };
    let h1 = compute_checksum(&data1, "0.1.0", "2026-01-01T00:00:00Z", 1).unwrap();
    let h2 = compute_checksum(&data2, "0.1.0", "2026-01-01T00:00:00Z", 1).unwrap();
    assert_eq!(h1, h2);
}

#[test]
fn phase7_unit_checksum_sensitive_to_content() {
    let data_a = minimal_data();
    use learnme_lib::session::types::LearnmeCategory;
    let mut data_b = minimal_data();
    data_b.categories.push(LearnmeCategory {
        id: "cat-extra".into(),
        name: "Extra".into(),
        color: None,
    });
    let ha = compute_checksum(&data_a, "0.1.0", "2026-01-01T00:00:00Z", 1).unwrap();
    let hb = compute_checksum(&data_b, "0.1.0", "2026-01-01T00:00:00Z", 1).unwrap();
    assert_ne!(ha, hb, "different data must produce different checksums");
}

// ── export::build_learnme ───────────────────────────────────────────────────

#[test]
fn phase7_unit_export_build_learnme_with_data() {
    use learnme_lib::repo::{
        card,
        category::{self, CreateCategory},
        study::{self, CreateStudy},
    };
    let conn = make_db();
    let cat = category::create(
        &conn,
        CreateCategory {
            name: "Cat".into(),
            color: None,
        },
    )
    .unwrap();
    let study = study::create(
        &conn,
        CreateStudy {
            category_id: cat.id.clone(),
            method: "anki".into(),
            name: "Deck".into(),
            payload: serde_json::json!({}),
        },
    )
    .unwrap();
    card::insert(
        &conn,
        &study.id,
        card::CreateCard {
            front: "front1".into(),
            back: "back1".into(),
            tags: vec![],
        },
    )
    .unwrap();
    card::insert(
        &conn,
        &study.id,
        card::CreateCard {
            front: "front2".into(),
            back: "back2".into(),
            tags: vec![],
        },
    )
    .unwrap();

    let file = build_learnme(&conn, "0.1.0").unwrap();
    assert_eq!(file.version, 1);
    assert_eq!(file.app_version, "0.1.0");
    assert_eq!(file.data.categories.len(), 1);
    assert_eq!(file.data.cards.len(), 2);
}

#[test]
fn phase7_unit_export_empty_db_valid_checksum() {
    let conn = make_db();
    let file = build_learnme(&conn, "0.1.0").unwrap();
    assert_eq!(file.data.categories.len(), 0);
    assert_eq!(file.data.cards.len(), 0);
    // checksum must be self-consistent
    let expected = compute_checksum(
        &file.data,
        &file.app_version,
        &file.generated_at,
        file.version,
    )
    .unwrap();
    assert_eq!(file.checksum, expected);
}

#[test]
fn phase7_unit_export_checksum_autoconsistent() {
    use learnme_lib::repo::{
        category::{self, CreateCategory},
        study::{self, CreateStudy},
    };
    let conn = make_db();
    let cat = category::create(
        &conn,
        CreateCategory {
            name: "C".into(),
            color: None,
        },
    )
    .unwrap();
    study::create(
        &conn,
        CreateStudy {
            category_id: cat.id,
            method: "anki".into(),
            name: "D".into(),
            payload: serde_json::json!({}),
        },
    )
    .unwrap();
    let file = build_learnme(&conn, "0.1.0").unwrap();
    let expected = compute_checksum(
        &file.data,
        &file.app_version,
        &file.generated_at,
        file.version,
    )
    .unwrap();
    assert_eq!(
        file.checksum, expected,
        "exported checksum must be self-consistent"
    );
}

// ── import::verify_checksum ─────────────────────────────────────────────────

#[test]
fn phase7_unit_import_verify_checksum_valid() {
    let conn = make_db();
    let file = build_learnme(&conn, "0.1.0").unwrap();
    let result = verify_checksum(&file);
    assert!(result.is_ok(), "self-consistent file must pass: {result:?}");
}

#[test]
fn phase7_unit_import_verify_checksum_tampered() {
    use learnme_lib::session::import::ImportError;
    let conn = make_db();
    let mut file = build_learnme(&conn, "0.1.0").unwrap();
    let last = file.checksum.pop().unwrap();
    file.checksum.push(if last == '0' { '1' } else { '0' });
    let result = verify_checksum(&file);
    assert!(
        matches!(result, Err(ImportError::ChecksumMismatch { .. })),
        "tampered checksum must fail: {result:?}"
    );
}

#[test]
fn phase7_unit_import_verify_checksum_empty_string() {
    use learnme_lib::session::import::ImportError;
    let conn = make_db();
    let mut file = build_learnme(&conn, "0.1.0").unwrap();
    file.checksum = "".into();
    let result = verify_checksum(&file);
    assert!(
        matches!(result, Err(ImportError::ChecksumMismatch { .. })),
        "empty checksum must fail: {result:?}"
    );
}

// ── import::validate_version ────────────────────────────────────────────────

#[test]
fn phase7_unit_validate_version_one_ok() {
    assert!(validate_version(1).is_ok());
}

#[test]
fn phase7_unit_validate_version_zero_ok() {
    assert!(validate_version(0).is_ok(), "version 0 is backward-compat");
}

#[test]
fn phase7_unit_validate_version_two_err() {
    use learnme_lib::session::import::ImportError;
    let result = validate_version(2);
    assert!(
        matches!(
            result,
            Err(ImportError::UnsupportedVersion { found: 2, .. })
        ),
        "version 2 must error: {result:?}"
    );
}

#[test]
fn phase7_unit_validate_version_ninety_nine_err() {
    use learnme_lib::session::import::ImportError;
    let result = validate_version(99);
    assert!(
        matches!(
            result,
            Err(ImportError::UnsupportedVersion { found: 99, .. })
        ),
        "version 99 must error: {result:?}"
    );
}

// ── import::validate_fk_integrity ──────────────────────────────────────────

#[test]
fn phase7_unit_fk_orphan_card() {
    use learnme_lib::session::{
        import::ImportError,
        types::{LearnmeCategory, LearnmeStudy},
    };
    let data = LearnmeData {
        categories: vec![LearnmeCategory {
            id: "cat-1".into(),
            name: "Cat".into(),
            color: None,
        }],
        studies: vec![LearnmeStudy {
            id: "study-1".into(),
            category_id: "cat-1".into(),
            name: "Deck".into(),
            method: "anki".into(),
        }],
        cards: vec![LearnmeCard {
            id: "card-1".into(),
            study_id: "nonexistent-study".into(),
            front: "f".into(),
            back: "b".into(),
            tags: vec![],
            state: "new".into(),
            stability: 0.0,
            difficulty: 0.0,
            elapsed_days: 0,
            scheduled_days: 0,
            reps: 0,
            lapses: 0,
            due: "2026-01-15T10:00:00Z".into(),
            last_reviewed: None,
        }],
        review_logs: vec![],
    };
    let result = validate_fk_integrity(&data);
    assert!(
        matches!(result, Err(ImportError::OrphanEntity { ref entity, .. }) if entity == "card"),
        "orphan card must error: {result:?}"
    );
}

#[test]
fn phase7_unit_fk_orphan_reviewlog() {
    use learnme_lib::session::{
        import::ImportError,
        types::{LearnmeCategory, LearnmeStudy},
    };
    let data = LearnmeData {
        categories: vec![LearnmeCategory {
            id: "cat-1".into(),
            name: "Cat".into(),
            color: None,
        }],
        studies: vec![LearnmeStudy {
            id: "study-1".into(),
            category_id: "cat-1".into(),
            name: "Deck".into(),
            method: "anki".into(),
        }],
        cards: vec![LearnmeCard {
            id: "card-1".into(),
            study_id: "study-1".into(),
            front: "f".into(),
            back: "b".into(),
            tags: vec![],
            state: "new".into(),
            stability: 0.0,
            difficulty: 0.0,
            elapsed_days: 0,
            scheduled_days: 0,
            reps: 0,
            lapses: 0,
            due: "2026-01-15T10:00:00Z".into(),
            last_reviewed: None,
        }],
        review_logs: vec![LearnmeReviewLog {
            id: "log-1".into(),
            card_id: "nonexistent-card".into(),
            grade: 3,
            reviewed_at: "2026-01-15T09:00:00Z".into(),
            stability: 5.0,
            difficulty: 0.3,
            elapsed_days: 1,
            scheduled_days: 7,
            review_state: 1,
        }],
    };
    let result = validate_fk_integrity(&data);
    assert!(
        matches!(result, Err(ImportError::OrphanEntity { ref entity, .. }) if entity == "reviewLog"),
        "orphan reviewLog must error: {result:?}"
    );
}

#[test]
fn phase7_unit_fk_orphan_study() {
    use learnme_lib::session::{
        import::ImportError,
        types::{LearnmeCategory, LearnmeStudy},
    };
    let data = LearnmeData {
        categories: vec![LearnmeCategory {
            id: "cat-1".into(),
            name: "Cat".into(),
            color: None,
        }],
        studies: vec![LearnmeStudy {
            id: "study-1".into(),
            category_id: "nonexistent-category".into(),
            name: "Deck".into(),
            method: "anki".into(),
        }],
        cards: vec![],
        review_logs: vec![],
    };
    let result = validate_fk_integrity(&data);
    assert!(
        matches!(result, Err(ImportError::OrphanEntity { ref entity, .. }) if entity == "study"),
        "orphan study must error: {result:?}"
    );
}

#[test]
fn phase7_unit_fk_valid_data_ok() {
    use learnme_lib::session::types::{LearnmeCategory, LearnmeStudy};
    let data = LearnmeData {
        categories: vec![LearnmeCategory {
            id: "cat-1".into(),
            name: "Cat".into(),
            color: None,
        }],
        studies: vec![LearnmeStudy {
            id: "study-1".into(),
            category_id: "cat-1".into(),
            name: "Deck".into(),
            method: "anki".into(),
        }],
        cards: vec![LearnmeCard {
            id: "card-1".into(),
            study_id: "study-1".into(),
            front: "f".into(),
            back: "b".into(),
            tags: vec![],
            state: "new".into(),
            stability: 0.0,
            difficulty: 0.0,
            elapsed_days: 0,
            scheduled_days: 0,
            reps: 0,
            lapses: 0,
            due: "2026-01-15T10:00:00Z".into(),
            last_reviewed: None,
        }],
        review_logs: vec![],
    };
    assert!(validate_fk_integrity(&data).is_ok());
}

// ── import::resolve_conflict ────────────────────────────────────────────────

fn make_card(id: &str, reps: i64, last_reviewed: Option<&str>, stability: f64) -> LearnmeCard {
    LearnmeCard {
        id: id.into(),
        study_id: "study-1".into(),
        front: "casa".into(),
        back: "house".into(),
        tags: vec![],
        state: "review".into(),
        stability,
        difficulty: 0.3,
        elapsed_days: 5,
        scheduled_days: 10,
        reps,
        lapses: 0,
        due: "2026-01-20T10:00:00Z".into(),
        last_reviewed: last_reviewed.map(String::from),
    }
}

#[test]
fn phase7_unit_conflict_existing_wins() {
    let existing = make_card("existing", 5, Some("2026-01-10T00:00:00Z"), 15.0);
    let incoming = make_card("incoming", 3, Some("2026-01-08T00:00:00Z"), 5.0);
    let winner = resolve_conflict(&existing, &incoming);
    assert_eq!(winner.id, "existing", "higher reps must win");
    assert_eq!(winner.stability, 15.0);
}

#[test]
fn phase7_unit_conflict_incoming_wins() {
    let existing = make_card("existing", 2, Some("2026-01-05T00:00:00Z"), 5.0);
    let incoming = make_card("incoming", 4, Some("2026-01-09T00:00:00Z"), 12.0);
    let winner = resolve_conflict(&existing, &incoming);
    assert_eq!(winner.id, "incoming", "higher reps must win");
    assert_eq!(winner.stability, 12.0);
}

#[test]
fn phase7_unit_conflict_tiebreak_by_date() {
    // same reps, incoming has a review date while existing has none
    let existing = make_card("existing", 3, None, 8.0);
    let incoming = make_card("incoming", 3, Some("2026-01-09T00:00:00Z"), 8.0);
    let winner = resolve_conflict(&existing, &incoming);
    assert_eq!(winner.id, "incoming", "tiebreak: date present beats null");
}
