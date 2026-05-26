use chrono::Utc;
use rusqlite::Connection;
use uuid::Uuid;

use crate::core::{
    error::{RepoError, ValidationError},
    types::Study,
};

pub struct CreateStudy {
    pub category_id: String,
    pub method: String,
    pub name: String,
    pub payload: serde_json::Value,
}

pub struct UpdateStudy {
    pub name: String,
}

pub fn create(conn: &Connection, input: CreateStudy) -> Result<Study, RepoError> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err(RepoError::Validation(ValidationError::EmptyName));
    }
    let id = Uuid::now_v7().to_string();
    let now = Utc::now().to_rfc3339();
    let payload_json = serde_json::to_string(&input.payload).unwrap_or_else(|_| "{}".into());
    conn.execute(
        "INSERT INTO studies (id, category_id, method, name, payload_json, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![id, input.category_id, input.method, name, payload_json, now, now],
    )
    .map_err(RepoError::from_sqlite)?;
    Ok(Study {
        id,
        category_id: input.category_id,
        method: input.method,
        name,
        payload: input.payload,
        created_at: now.clone(),
        updated_at: now,
    })
}

pub fn get_by_id(conn: &Connection, id: &str) -> Result<Study, RepoError> {
    let mut stmt = conn.prepare(
        "SELECT id, category_id, method, name, payload_json, created_at, updated_at \
         FROM studies WHERE id = ?1",
    )?;
    let result = stmt.query_row(rusqlite::params![id], |row| {
        let payload_json: String = row.get(4)?;
        let payload = serde_json::from_str(&payload_json).unwrap_or(serde_json::json!({}));
        Ok(Study {
            id: row.get(0)?,
            category_id: row.get(1)?,
            method: row.get(2)?,
            name: row.get(3)?,
            payload,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
        })
    });
    match result {
        Ok(s) => Ok(s),
        Err(rusqlite::Error::QueryReturnedNoRows) => Err(RepoError::NotFound),
        Err(e) => Err(RepoError::Db(e)),
    }
}

pub fn find_by_category_name_method(
    conn: &Connection,
    category_id: &str,
    name: &str,
    method: &str,
) -> Result<Option<Study>, RepoError> {
    let mut stmt = conn.prepare(
        "SELECT id, category_id, method, name, payload_json, created_at, updated_at \
         FROM studies WHERE category_id = ?1 AND name = ?2 AND method = ?3 LIMIT 1",
    )?;
    let result = stmt.query_row(rusqlite::params![category_id, name, method], |row| {
        let payload_json: String = row.get(4)?;
        let payload = serde_json::from_str(&payload_json).unwrap_or(serde_json::json!({}));
        Ok(Study {
            id: row.get(0)?,
            category_id: row.get(1)?,
            method: row.get(2)?,
            name: row.get(3)?,
            payload,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
        })
    });
    match result {
        Ok(s) => Ok(Some(s)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(RepoError::Db(e)),
    }
}

pub fn update(conn: &Connection, id: &str, input: UpdateStudy) -> Result<Study, RepoError> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err(RepoError::Validation(ValidationError::EmptyName));
    }
    let now = Utc::now().to_rfc3339();
    let affected = conn.execute(
        "UPDATE studies SET name = ?1, updated_at = ?2 WHERE id = ?3",
        rusqlite::params![name, now, id],
    )?;
    if affected == 0 {
        return Err(RepoError::NotFound);
    }
    get_by_id(conn, id)
}

pub fn delete(conn: &Connection, id: &str) -> Result<(), RepoError> {
    let rows = conn
        .execute("DELETE FROM studies WHERE id = ?1", rusqlite::params![id])
        .map_err(RepoError::from_sqlite)?;
    if rows == 0 {
        return Err(RepoError::NotFound);
    }
    Ok(())
}

pub fn list_all(conn: &Connection) -> Result<Vec<Study>, RepoError> {
    let mut stmt = conn.prepare(
        "SELECT id, category_id, method, name, payload_json, created_at, updated_at \
         FROM studies ORDER BY created_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        let payload_json: String = row.get(4)?;
        let payload = serde_json::from_str(&payload_json).unwrap_or(serde_json::json!({}));
        Ok(Study {
            id: row.get(0)?,
            category_id: row.get(1)?,
            method: row.get(2)?,
            name: row.get(3)?,
            payload,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(RepoError::Db)
}

pub fn list_by_category(conn: &Connection, category_id: &str) -> Result<Vec<Study>, RepoError> {
    let mut stmt = conn.prepare(
        "SELECT id, category_id, method, name, payload_json, created_at, updated_at \
         FROM studies WHERE category_id = ?1 ORDER BY created_at DESC",
    )?;
    let rows = stmt.query_map(rusqlite::params![category_id], |row| {
        let payload_json: String = row.get(4)?;
        let payload = serde_json::from_str(&payload_json).unwrap_or(serde_json::json!({}));
        Ok(Study {
            id: row.get(0)?,
            category_id: row.get(1)?,
            method: row.get(2)?,
            name: row.get(3)?,
            payload,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(RepoError::Db)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::new_test_db;
    use crate::repo::category;

    fn make_category(conn: &Connection) -> String {
        category::create(
            conn,
            category::CreateCategory {
                name: "Test".into(),
                color: None,
            },
        )
        .unwrap()
        .id
    }

    // --- create ---

    #[test]
    fn create_happy_path() {
        let conn = new_test_db();
        let cat_id = make_category(&conn);
        let study = create(
            &conn,
            CreateStudy {
                category_id: cat_id.clone(),
                method: "anki".into(),
                name: "Spanish A2".into(),
                payload: serde_json::json!({}),
            },
        )
        .unwrap();
        assert_eq!(study.name, "Spanish A2");
        assert_eq!(study.method, "anki");
        assert_eq!(study.category_id, cat_id);
        assert!(!study.id.is_empty());
    }

    #[test]
    fn create_nonexistent_category_fk_error() {
        let conn = new_test_db();
        let err = create(
            &conn,
            CreateStudy {
                category_id: "00000000-0000-0000-0000-000000000000".into(),
                method: "anki".into(),
                name: "X".into(),
                payload: serde_json::json!({}),
            },
        )
        .unwrap_err();
        assert!(matches!(err, RepoError::ForeignKeyViolation));
    }

    #[test]
    fn create_empty_name_errors() {
        let conn = new_test_db();
        let cat_id = make_category(&conn);
        let err = create(
            &conn,
            CreateStudy {
                category_id: cat_id,
                method: "anki".into(),
                name: "".into(),
                payload: serde_json::json!({}),
            },
        )
        .unwrap_err();
        assert!(matches!(
            err,
            RepoError::Validation(ValidationError::EmptyName)
        ));
    }

    // --- list_by_category ---

    #[test]
    fn list_returns_studies_for_category() {
        let conn = new_test_db();
        let cat_id = make_category(&conn);
        create(
            &conn,
            CreateStudy {
                category_id: cat_id.clone(),
                method: "anki".into(),
                name: "Deck 1".into(),
                payload: serde_json::json!({}),
            },
        )
        .unwrap();
        create(
            &conn,
            CreateStudy {
                category_id: cat_id.clone(),
                method: "anki".into(),
                name: "Deck 2".into(),
                payload: serde_json::json!({}),
            },
        )
        .unwrap();
        let studies = list_by_category(&conn, &cat_id).unwrap();
        assert_eq!(studies.len(), 2);
    }

    #[test]
    fn list_empty_for_category_with_no_studies() {
        let conn = new_test_db();
        let cat_id = make_category(&conn);
        let studies = list_by_category(&conn, &cat_id).unwrap();
        assert!(studies.is_empty());
    }
}
