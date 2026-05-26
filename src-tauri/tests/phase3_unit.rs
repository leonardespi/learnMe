// Phase 3 unit tests — import/export/add_card
// These tests reference modules not yet implemented; they MUST fail (red) until
// production code is written in step 4.
use learnme_lib::{
    commands::card::cmd_add_card,
    methods::anki::{
        export::build_export_payload,
        import::{compute_new_cards, parse_file, validate_schema, CardPayload, ImportError},
    },
};
use rusqlite::Connection;

fn make_db() -> Connection {
    let mut conn = Connection::open_in_memory().unwrap();
    conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
    learnme_lib::db::apply_migrations(&mut conn).unwrap();
    conn
}

fn make_deck(conn: &Connection) -> String {
    let cat_id = learnme_lib::repo::category::create(
        conn,
        learnme_lib::repo::category::CreateCategory {
            name: "Test".into(),
            color: None,
        },
    )
    .unwrap()
    .id;
    learnme_lib::repo::study::create(
        conn,
        learnme_lib::repo::study::CreateStudy {
            category_id: cat_id,
            method: "anki".into(),
            name: "Test Deck".into(),
            payload: serde_json::json!({}),
        },
    )
    .unwrap()
    .id
}

fn fixture_path(name: &str) -> String {
    format!("{}/../fixtures/decks/{}", env!("CARGO_MANIFEST_DIR"), name)
}

// ── validate_schema ──────────────────────────────────────────────────────────

#[test]
fn validate_schema_valid_deck() {
    let path = fixture_path("spanish-a2-valid.json");
    let raw = std::fs::read_to_string(&path).expect("fixture must exist");
    let value: serde_json::Value = serde_json::from_str(&raw).unwrap();
    assert!(
        validate_schema(&value).is_ok(),
        "valid deck must pass schema"
    );
}

#[test]
fn validate_schema_missing_method() {
    let path = fixture_path("missing-method.json");
    let raw = std::fs::read_to_string(&path).unwrap();
    let value: serde_json::Value = serde_json::from_str(&raw).unwrap();
    let err = validate_schema(&value).unwrap_err();
    match err {
        ImportError::Schema { ref pointer, .. } => {
            assert!(
                pointer.contains("method"),
                "error pointer must reference 'method', got: {pointer}"
            );
        }
        other => panic!("expected ImportError::Schema, got: {other:?}"),
    }
}

#[test]
fn validate_schema_missing_schema_version() {
    let path = fixture_path("missing-schema-version.json");
    let raw = std::fs::read_to_string(&path).unwrap();
    let value: serde_json::Value = serde_json::from_str(&raw).unwrap();
    let err = validate_schema(&value).unwrap_err();
    match err {
        ImportError::Schema { ref pointer, .. } => {
            assert!(
                pointer.contains("schemaVersion"),
                "error pointer must reference 'schemaVersion', got: {pointer}"
            );
        }
        other => panic!("expected ImportError::Schema, got: {other:?}"),
    }
}

#[test]
fn validate_schema_missing_cards() {
    let path = fixture_path("missing-cards.json");
    let raw = std::fs::read_to_string(&path).unwrap();
    let value: serde_json::Value = serde_json::from_str(&raw).unwrap();
    let err = validate_schema(&value).unwrap_err();
    match err {
        ImportError::Schema { ref pointer, .. } => {
            assert!(
                pointer.contains("cards"),
                "error pointer must reference 'cards', got: {pointer}"
            );
        }
        other => panic!("expected ImportError::Schema, got: {other:?}"),
    }
}

#[test]
fn validate_schema_null_value() {
    let err = validate_schema(&serde_json::Value::Null).unwrap_err();
    assert!(
        matches!(err, ImportError::Schema { .. }),
        "null value must produce SchemaError"
    );
}

#[test]
fn validate_schema_unicode_deck() {
    let path = fixture_path("unicode-edge.json");
    let raw = std::fs::read_to_string(&path).unwrap();
    let value: serde_json::Value = serde_json::from_str(&raw).unwrap();
    assert!(
        validate_schema(&value).is_ok(),
        "unicode deck must pass schema"
    );
}

// ── parse_file ───────────────────────────────────────────────────────────────

#[test]
fn parse_file_valid_path() {
    let path = fixture_path("spanish-a2-valid.json");
    let result = parse_file(&path);
    assert!(result.is_ok(), "valid file must parse: {result:?}");
}

#[test]
fn parse_file_nonexistent_path() {
    let err = parse_file("/tmp/learnme_nonexistent_test_file.json").unwrap_err();
    assert!(
        matches!(err, ImportError::Io(_)),
        "missing file must produce IoError, got: {err:?}"
    );
}

#[test]
fn parse_file_binary_file() {
    let path = fixture_path("binary.bin");
    let err = parse_file(&path).unwrap_err();
    assert!(
        matches!(err, ImportError::Parse(_)),
        "binary file must produce ParseError, got: {err:?}"
    );
}

#[test]
fn parse_file_schema_invalid_json_is_still_ok_value() {
    // parse_file only parses JSON; schema validation is separate
    let path = fixture_path("missing-cards.json");
    let result = parse_file(&path);
    assert!(
        result.is_ok(),
        "missing-cards.json is valid JSON, parse must succeed: {result:?}"
    );
}

// ── compute_new_cards ────────────────────────────────────────────────────────

fn make_cards(fronts_backs: &[(&str, &str)]) -> Vec<CardPayload> {
    fronts_backs
        .iter()
        .map(|(f, b)| CardPayload {
            front: f.to_string(),
            back: b.to_string(),
            tags: vec![],
        })
        .collect()
}

fn existing_set(fronts_backs: &[(&str, &str)]) -> std::collections::HashSet<(String, String)> {
    fronts_backs
        .iter()
        .map(|(f, b)| (f.to_string(), b.to_string()))
        .collect()
}

#[test]
fn compute_new_cards_no_existing() {
    let incoming = make_cards(&[("a", "1"), ("b", "2"), ("c", "3")]);
    let existing = existing_set(&[]);
    let (to_insert, skipped) = compute_new_cards(&existing, incoming);
    assert_eq!(to_insert.len(), 3);
    assert_eq!(skipped, 0);
}

#[test]
fn compute_new_cards_all_existing() {
    let pairs = [("a", "1"), ("b", "2"), ("c", "3")];
    let incoming = make_cards(&pairs);
    let existing = existing_set(&pairs);
    let (to_insert, skipped) = compute_new_cards(&existing, incoming);
    assert_eq!(to_insert.len(), 0);
    assert_eq!(skipped, 3);
}

#[test]
fn compute_new_cards_partial_overlap() {
    let existing = existing_set(&[("a", "1"), ("b", "2")]);
    let incoming = make_cards(&[("a", "1"), ("b", "2"), ("c", "3"), ("d", "4")]);
    let (to_insert, skipped) = compute_new_cards(&existing, incoming);
    assert_eq!(to_insert.len(), 2);
    assert_eq!(skipped, 2);
    let fronts: Vec<&str> = to_insert.iter().map(|c| c.front.as_str()).collect();
    assert!(fronts.contains(&"c"));
    assert!(fronts.contains(&"d"));
}

#[test]
fn compute_new_cards_empty_deck() {
    let (to_insert, skipped) = compute_new_cards(&existing_set(&[]), vec![]);
    assert_eq!(to_insert.len(), 0);
    assert_eq!(skipped, 0);
}

// ── build_export_payload ─────────────────────────────────────────────────────

#[test]
fn build_export_payload_matches_schema() {
    let conn = make_db();
    let deck_id = make_deck(&conn);
    learnme_lib::repo::card::bulk_insert(
        &conn,
        &deck_id,
        vec![
            learnme_lib::repo::card::CreateCard {
                front: "casa".into(),
                back: "house".into(),
                tags: vec!["noun".into()],
            },
            learnme_lib::repo::card::CreateCard {
                front: "correr".into(),
                back: "to run".into(),
                tags: vec!["verb".into()],
            },
        ],
    )
    .unwrap();
    let study = learnme_lib::repo::study::get_by_id(&conn, &deck_id).unwrap();
    let cards = learnme_lib::repo::card::list_by_deck(&conn, &deck_id).unwrap();
    let payload = build_export_payload(&study, &cards);
    assert!(
        validate_schema(&payload).is_ok(),
        "export output must pass schema validation"
    );
    assert_eq!(payload["method"], "anki");
    assert_eq!(payload["schemaVersion"], "1.0.0");
    assert_eq!(payload["cards"].as_array().unwrap().len(), 2);
}

#[test]
fn build_export_payload_snapshot() {
    let conn = make_db();
    let deck_id = make_deck(&conn);
    learnme_lib::repo::card::bulk_insert(
        &conn,
        &deck_id,
        vec![
            learnme_lib::repo::card::CreateCard {
                front: "uno".into(),
                back: "one".into(),
                tags: vec!["number".into()],
            },
            learnme_lib::repo::card::CreateCard {
                front: "dos".into(),
                back: "two".into(),
                tags: vec!["number".into()],
            },
        ],
    )
    .unwrap();
    let study = learnme_lib::repo::study::get_by_id(&conn, &deck_id).unwrap();
    let cards = learnme_lib::repo::card::list_by_deck(&conn, &deck_id).unwrap();
    let payload = build_export_payload(&study, &cards);
    // Snapshot the structure (exclude IDs and timestamps which are non-deterministic)
    let snapshot_cards: Vec<serde_json::Value> = payload["cards"]
        .as_array()
        .unwrap()
        .iter()
        .map(|c| {
            serde_json::json!({
                "front": c["front"],
                "back": c["back"],
                "tags": c["tags"],
                "state": c["state"],
                "stability": c["stability"],
                "difficulty": c["difficulty"],
            })
        })
        .collect();
    insta::assert_json_snapshot!("phase3_export_payload", snapshot_cards);
}

#[test]
fn build_export_payload_empty_deck() {
    let conn = make_db();
    let deck_id = make_deck(&conn);
    let study = learnme_lib::repo::study::get_by_id(&conn, &deck_id).unwrap();
    let cards = learnme_lib::repo::card::list_by_deck(&conn, &deck_id).unwrap();
    let payload = build_export_payload(&study, &cards);
    assert!(validate_schema(&payload).is_ok());
    assert_eq!(payload["cards"].as_array().unwrap().len(), 0);
}

// ── cmd_add_card ─────────────────────────────────────────────────────────────

#[test]
fn add_card_valid() {
    let conn = make_db();
    let deck_id = make_deck(&conn);
    let card = cmd_add_card(&conn, &deck_id, "casa".into(), "house".into(), vec![]).unwrap();
    assert_eq!(card.state, "new");
    assert_eq!(card.reps, 0);
    assert_eq!(card.lapses, 0);
    assert_eq!(card.stability, 0.0);
    assert_eq!(card.difficulty, 0.0);
    assert_eq!(card.front, "casa");
    assert_eq!(card.back, "house");
}

#[test]
fn add_card_empty_front() {
    let conn = make_db();
    let deck_id = make_deck(&conn);
    let err = cmd_add_card(&conn, &deck_id, "".into(), "house".into(), vec![]).unwrap_err();
    assert!(
        matches!(
            err,
            learnme_lib::core::error::RepoError::Validation(
                learnme_lib::core::error::ValidationError::EmptyFront
            )
        ),
        "empty front must produce EmptyFront, got: {err:?}"
    );
}

#[test]
fn add_card_empty_back() {
    let conn = make_db();
    let deck_id = make_deck(&conn);
    let err = cmd_add_card(&conn, &deck_id, "casa".into(), "".into(), vec![]).unwrap_err();
    assert!(
        matches!(
            err,
            learnme_lib::core::error::RepoError::Validation(
                learnme_lib::core::error::ValidationError::EmptyBack
            )
        ),
        "empty back must produce EmptyBack, got: {err:?}"
    );
}

#[test]
fn add_card_nonexistent_deck() {
    let conn = make_db();
    let err = cmd_add_card(
        &conn,
        "nonexistent-deck-id",
        "casa".into(),
        "house".into(),
        vec![],
    )
    .unwrap_err();
    assert!(
        matches!(
            err,
            learnme_lib::core::error::RepoError::ForeignKeyViolation
                | learnme_lib::core::error::RepoError::NotFound
        ),
        "nonexistent deck must produce FK or NotFound error, got: {err:?}"
    );
}

#[test]
fn add_card_with_tags() {
    let conn = make_db();
    let deck_id = make_deck(&conn);
    let card = cmd_add_card(
        &conn,
        &deck_id,
        "correr".into(),
        "to run".into(),
        vec!["verb".into(), "ar".into()],
    )
    .unwrap();
    assert_eq!(card.tags, vec!["verb", "ar"]);
}

#[test]
fn add_card_whitespace_only_front() {
    let conn = make_db();
    let deck_id = make_deck(&conn);
    let err = cmd_add_card(&conn, &deck_id, "   ".into(), "house".into(), vec![]).unwrap_err();
    assert!(
        matches!(
            err,
            learnme_lib::core::error::RepoError::Validation(
                learnme_lib::core::error::ValidationError::EmptyFront
            )
        ),
        "whitespace-only front must produce EmptyFront"
    );
}
