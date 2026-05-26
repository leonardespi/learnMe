use rusqlite::Connection;
use std::sync::Mutex;

use crate::core::error::RepoError;

mod embedded {
    refinery::embed_migrations!("migrations");
}

pub struct AppState {
    pub db: Mutex<Connection>,
}

pub fn apply_migrations(conn: &mut Connection) -> Result<(), RepoError> {
    embedded::migrations::runner()
        .run(conn)
        .map(|_| ())
        .map_err(|e| RepoError::Migration(e.to_string()))
}

pub fn open_db(path: &str) -> Result<Connection, RepoError> {
    let mut conn = Connection::open(path).map_err(RepoError::Db)?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(RepoError::Db)?;
    apply_migrations(&mut conn)?;
    Ok(conn)
}

#[cfg(test)]
pub fn new_test_db() -> Connection {
    let mut conn = Connection::open_in_memory().unwrap();
    conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
    apply_migrations(&mut conn).unwrap();
    conn
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migration_applies_once() {
        let conn = new_test_db();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' \
                 AND name IN ('categories','studies','cards','review_logs','settings')",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 5, "all 5 tables must exist after migration");
    }

    #[test]
    fn migration_idempotent() {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        apply_migrations(&mut conn).unwrap();
        apply_migrations(&mut conn).unwrap(); // second application must not fail
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' \
                 AND name IN ('categories','studies','cards','review_logs','settings')",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 5);
    }
}
