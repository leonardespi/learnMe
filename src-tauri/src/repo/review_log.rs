use rusqlite::Connection;
use uuid::Uuid;

use crate::core::{error::RepoError, types::ReviewLog};

pub struct CreateReviewLog {
    pub card_id: String,
    pub grade: i32,
    pub reviewed_at: String,
    pub prev_stability: f64,
    pub prev_difficulty: f64,
    pub prev_due: String,
}

pub fn insert(conn: &Connection, input: CreateReviewLog) -> Result<ReviewLog, RepoError> {
    let id = Uuid::now_v7().to_string();
    conn.execute(
        "INSERT INTO review_logs \
         (id, card_id, grade, reviewed_at, prev_stability, prev_difficulty, prev_due) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![
            id,
            input.card_id,
            input.grade,
            input.reviewed_at,
            input.prev_stability,
            input.prev_difficulty,
            input.prev_due
        ],
    )
    .map_err(RepoError::from_sqlite)?;
    Ok(ReviewLog {
        id,
        card_id: input.card_id,
        grade: input.grade,
        reviewed_at: input.reviewed_at,
        prev_stability: input.prev_stability,
        prev_difficulty: input.prev_difficulty,
        prev_due: input.prev_due,
    })
}

pub fn list_by_deck(conn: &Connection, deck_id: &str) -> Result<Vec<ReviewLog>, RepoError> {
    let mut stmt = conn.prepare(
        "SELECT rl.id, rl.card_id, rl.grade, rl.reviewed_at, \
                rl.prev_stability, rl.prev_difficulty, rl.prev_due \
         FROM review_logs rl \
         JOIN cards c ON c.id = rl.card_id \
         WHERE c.deck_id = ?1 \
         ORDER BY rl.reviewed_at DESC",
    )?;
    let logs = stmt
        .query_map(rusqlite::params![deck_id], |row| {
            Ok(ReviewLog {
                id: row.get(0)?,
                card_id: row.get(1)?,
                grade: row.get(2)?,
                reviewed_at: row.get(3)?,
                prev_stability: row.get(4)?,
                prev_difficulty: row.get(5)?,
                prev_due: row.get(6)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(RepoError::from_sqlite)?;
    Ok(logs)
}

pub fn list_all(conn: &Connection) -> Result<Vec<ReviewLog>, RepoError> {
    let mut stmt = conn.prepare(
        "SELECT id, card_id, grade, reviewed_at, prev_stability, prev_difficulty, prev_due \
         FROM review_logs ORDER BY reviewed_at ASC",
    )?;
    let logs = stmt
        .query_map([], |row| {
            Ok(ReviewLog {
                id: row.get(0)?,
                card_id: row.get(1)?,
                grade: row.get(2)?,
                reviewed_at: row.get(3)?,
                prev_stability: row.get(4)?,
                prev_difficulty: row.get(5)?,
                prev_due: row.get(6)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(RepoError::Db)?;
    Ok(logs)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::new_test_db;
    use crate::repo::{card, category, study};

    fn make_card(conn: &Connection) -> String {
        let cat_id = category::create(
            conn,
            category::CreateCategory {
                name: "Cat".into(),
                color: None,
            },
        )
        .unwrap()
        .id;
        let deck_id = study::create(
            conn,
            study::CreateStudy {
                category_id: cat_id,
                method: "anki".into(),
                name: "Deck".into(),
                payload: serde_json::json!({}),
            },
        )
        .unwrap()
        .id;
        let cards = card::bulk_insert(
            conn,
            &deck_id,
            vec![card::CreateCard {
                front: "front".into(),
                back: "back".into(),
                tags: vec![],
            }],
        )
        .unwrap();
        assert_eq!(cards, 1);
        card::list_by_deck(conn, &deck_id)
            .unwrap()
            .into_iter()
            .next()
            .unwrap()
            .id
    }

    #[test]
    fn insert_happy_path() {
        let conn = new_test_db();
        let card_id = make_card(&conn);
        let log = insert(
            &conn,
            CreateReviewLog {
                card_id: card_id.clone(),
                grade: 3,
                reviewed_at: "2026-05-24T12:00:00Z".into(),
                prev_stability: 0.0,
                prev_difficulty: 0.0,
                prev_due: "2026-05-24T12:00:00Z".into(),
            },
        )
        .unwrap();
        assert!(!log.id.is_empty());
        assert_eq!(log.card_id, card_id);
        assert_eq!(log.grade, 3);
    }

    #[test]
    fn insert_nonexistent_card_fk_error() {
        let conn = new_test_db();
        let err = insert(
            &conn,
            CreateReviewLog {
                card_id: "00000000-0000-0000-0000-000000000000".into(),
                grade: 3,
                reviewed_at: "2026-05-24T12:00:00Z".into(),
                prev_stability: 0.0,
                prev_difficulty: 0.0,
                prev_due: "2026-05-24T12:00:00Z".into(),
            },
        )
        .unwrap_err();
        assert!(matches!(err, RepoError::ForeignKeyViolation));
    }
}
