use chrono::Utc;
use rusqlite::Connection;
use uuid::Uuid;

use crate::core::{
    error::{RepoError, ValidationError},
    types::Category,
};

pub struct CreateCategory {
    pub name: String,
    pub color: Option<String>,
}

pub struct UpdateCategory {
    pub name: String,
    pub color: Option<String>,
}

pub fn create(conn: &Connection, input: CreateCategory) -> Result<Category, RepoError> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err(RepoError::Validation(ValidationError::EmptyName));
    }
    let id = Uuid::now_v7().to_string();
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO categories (id, name, color, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![id, name, input.color, now, now],
    )?;
    Ok(Category {
        id,
        name,
        color: input.color,
        created_at: now.clone(),
        updated_at: now,
    })
}

pub fn list(conn: &Connection) -> Result<Vec<Category>, RepoError> {
    let mut stmt = conn.prepare(
        "SELECT id, name, color, created_at, updated_at FROM categories ORDER BY created_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Category {
            id: row.get(0)?,
            name: row.get(1)?,
            color: row.get(2)?,
            created_at: row.get(3)?,
            updated_at: row.get(4)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(RepoError::Db)
}

pub fn get_by_id(conn: &Connection, id: &str) -> Result<Category, RepoError> {
    conn.query_row(
        "SELECT id, name, color, created_at, updated_at FROM categories WHERE id = ?1",
        rusqlite::params![id],
        |row| {
            Ok(Category {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        },
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => RepoError::NotFound,
        other => RepoError::Db(other),
    })
}

pub fn update(conn: &Connection, id: &str, input: UpdateCategory) -> Result<Category, RepoError> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err(RepoError::Validation(ValidationError::EmptyName));
    }
    let now = Utc::now().to_rfc3339();
    let affected = conn.execute(
        "UPDATE categories SET name = ?1, color = ?2, updated_at = ?3 WHERE id = ?4",
        rusqlite::params![name, input.color, now, id],
    )?;
    if affected == 0 {
        return Err(RepoError::NotFound);
    }
    get_by_id(conn, id)
}

pub fn delete(conn: &Connection, id: &str) -> Result<(), RepoError> {
    get_by_id(conn, id)?;
    conn.execute(
        "DELETE FROM categories WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(RepoError::from_sqlite)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::new_test_db;
    use crate::repo::study;

    // --- create ---

    #[test]
    fn create_happy_path() {
        let conn = new_test_db();
        let cat = create(
            &conn,
            CreateCategory {
                name: "Idiomas".into(),
                color: None,
            },
        )
        .unwrap();
        assert_eq!(cat.name, "Idiomas");
        assert!(!cat.id.is_empty(), "id must be set");
        assert!(!cat.created_at.is_empty());
        assert!(!cat.updated_at.is_empty());
    }

    #[test]
    fn create_empty_name_errors() {
        let conn = new_test_db();
        let err = create(
            &conn,
            CreateCategory {
                name: "".into(),
                color: None,
            },
        )
        .unwrap_err();
        assert!(matches!(
            err,
            RepoError::Validation(ValidationError::EmptyName)
        ));
    }

    #[test]
    fn create_whitespace_name_errors() {
        let conn = new_test_db();
        let err = create(
            &conn,
            CreateCategory {
                name: "   ".into(),
                color: None,
            },
        )
        .unwrap_err();
        assert!(matches!(
            err,
            RepoError::Validation(ValidationError::EmptyName)
        ));
    }

    // --- list ---

    #[test]
    fn list_empty_db() {
        let conn = new_test_db();
        let cats = list(&conn).unwrap();
        assert!(cats.is_empty());
    }

    #[test]
    fn list_returns_ordered_desc() {
        let conn = new_test_db();
        create(
            &conn,
            CreateCategory {
                name: "A".into(),
                color: None,
            },
        )
        .unwrap();
        create(
            &conn,
            CreateCategory {
                name: "B".into(),
                color: None,
            },
        )
        .unwrap();
        create(
            &conn,
            CreateCategory {
                name: "C".into(),
                color: None,
            },
        )
        .unwrap();
        let cats = list(&conn).unwrap();
        assert_eq!(cats.len(), 3);
        assert_eq!(
            cats[0].name, "C",
            "most recently created first (created_at DESC)"
        );
    }

    // --- get_by_id ---

    #[test]
    fn get_by_id_found() {
        let conn = new_test_db();
        let created = create(
            &conn,
            CreateCategory {
                name: "Math".into(),
                color: None,
            },
        )
        .unwrap();
        let fetched = get_by_id(&conn, &created.id).unwrap();
        assert_eq!(fetched.id, created.id);
        assert_eq!(fetched.name, "Math");
    }

    #[test]
    fn get_by_id_not_found() {
        let conn = new_test_db();
        let err = get_by_id(&conn, "00000000-0000-0000-0000-000000000000").unwrap_err();
        assert!(matches!(err, RepoError::NotFound));
    }

    // --- update ---

    #[test]
    fn update_happy_path() {
        let conn = new_test_db();
        let created = create(
            &conn,
            CreateCategory {
                name: "Old".into(),
                color: None,
            },
        )
        .unwrap();
        let updated = update(
            &conn,
            &created.id,
            UpdateCategory {
                name: "Languages".into(),
                color: None,
            },
        )
        .unwrap();
        assert_eq!(updated.name, "Languages");
        assert!(
            updated.updated_at >= updated.created_at,
            "updated_at must not precede created_at"
        );
    }

    #[test]
    fn update_not_found() {
        let conn = new_test_db();
        let err = update(
            &conn,
            "00000000-0000-0000-0000-000000000000",
            UpdateCategory {
                name: "X".into(),
                color: None,
            },
        )
        .unwrap_err();
        assert!(matches!(err, RepoError::NotFound));
    }

    #[test]
    fn update_empty_name_errors() {
        let conn = new_test_db();
        let created = create(
            &conn,
            CreateCategory {
                name: "Old".into(),
                color: None,
            },
        )
        .unwrap();
        let err = update(
            &conn,
            &created.id,
            UpdateCategory {
                name: "".into(),
                color: None,
            },
        )
        .unwrap_err();
        assert!(matches!(
            err,
            RepoError::Validation(ValidationError::EmptyName)
        ));
    }

    // --- delete ---

    #[test]
    fn delete_happy_path() {
        let conn = new_test_db();
        let created = create(
            &conn,
            CreateCategory {
                name: "Temp".into(),
                color: None,
            },
        )
        .unwrap();
        delete(&conn, &created.id).unwrap();
        let err = get_by_id(&conn, &created.id).unwrap_err();
        assert!(matches!(err, RepoError::NotFound));
    }

    #[test]
    fn delete_not_found() {
        let conn = new_test_db();
        let err = delete(&conn, "00000000-0000-0000-0000-000000000000").unwrap_err();
        assert!(matches!(err, RepoError::NotFound));
    }

    #[test]
    fn delete_with_study_violates_fk() {
        let conn = new_test_db();
        let cat = create(
            &conn,
            CreateCategory {
                name: "Languages".into(),
                color: None,
            },
        )
        .unwrap();
        study::create(
            &conn,
            study::CreateStudy {
                category_id: cat.id.clone(),
                method: "anki".into(),
                name: "Spanish".into(),
                payload: serde_json::json!({}),
            },
        )
        .unwrap();
        let err = delete(&conn, &cat.id).unwrap_err();
        assert!(matches!(err, RepoError::ForeignKeyViolation));
        // category must still exist
        assert!(get_by_id(&conn, &cat.id).is_ok());
    }
}
