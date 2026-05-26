use rusqlite::Connection;

use crate::core::error::RepoError;

pub fn set(conn: &Connection, key: &str, value: &str) -> Result<(), RepoError> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2) \
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        rusqlite::params![key, value],
    )?;
    Ok(())
}

pub fn get(conn: &Connection, key: &str) -> Result<Option<String>, RepoError> {
    match conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        rusqlite::params![key],
        |row| row.get::<_, String>(0),
    ) {
        Ok(val) => Ok(Some(val)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(RepoError::Db(e)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::new_test_db;

    #[test]
    fn set_then_get() {
        let conn = new_test_db();
        set(&conn, "theme", "dark").unwrap();
        let val = get(&conn, "theme").unwrap();
        assert_eq!(val, Some("dark".into()));
    }

    #[test]
    fn get_nonexistent_returns_none() {
        let conn = new_test_db();
        let val = get(&conn, "nonexistent_key").unwrap();
        assert_eq!(val, None);
    }

    #[test]
    fn set_upserts_value() {
        let conn = new_test_db();
        set(&conn, "theme", "dark").unwrap();
        set(&conn, "theme", "light").unwrap();
        let val = get(&conn, "theme").unwrap();
        assert_eq!(val, Some("light".into()), "second set must overwrite first");
    }
}
