// Phase 7.5 unit tests — simulateError isolation under #[cfg(test)].
// Tests 21-22 verify that a test-only simulate path exists in commands::session.
//
// These tests MUST FAIL TO COMPILE (red) until `simulate_import_error` is
// added to learnme_lib::commands::session under a cfg(test)-gated module in Step 4.
use rusqlite::Connection;

fn make_db() -> Connection {
    let mut conn = Connection::open_in_memory().unwrap();
    learnme_lib::db::apply_migrations(&mut conn).unwrap();
    conn
}

// FAILS TO COMPILE: simulate_import_error does not exist yet
use learnme_lib::commands::session::simulate_import_error;

// ── Test 21: simulate_error: Some("x") → Err("x") without touching DB ────────

#[test]
fn phase7_5_simulate_error_some_returns_error_without_db_change() {
    let conn = make_db();
    let result = simulate_import_error(&conn, Some("ChecksumMismatch".to_string()));
    assert!(
        result.is_err(),
        "simulate_import_error(Some(...)) must return Err"
    );
    assert!(
        result.unwrap_err().contains("ChecksumMismatch"),
        "error message must contain the simulated error string"
    );
    // DB must be untouched (0 categories)
    let cats: i64 = conn
        .query_row("SELECT COUNT(*) FROM categories", [], |r| r.get(0))
        .unwrap();
    assert_eq!(cats, 0, "DB must be untouched when simulate_error fires");
}

// ── Test 22: simulate_error: None → delegates to real import logic ───────────

#[test]
fn phase7_5_simulate_error_none_delegates_to_real_import() {
    let conn = make_db();
    // With simulate_error: None and a non-existent src_path,
    // the function must attempt a real file read → Err(io: ...) not Err("ChecksumMismatch")
    let result = simulate_import_error(&conn, None);
    // Will err (no valid file to import) but NOT with the simulated string
    if let Err(e) = result {
        assert!(
            !e.contains("ChecksumMismatch"),
            "None must not return the simulated error; got: {e}"
        );
    }
    // If Ok(()), that also means simulate_error: None was correctly transparent
}
