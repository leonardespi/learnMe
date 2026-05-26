use chrono::Utc;
use rusqlite::Connection;
use uuid::Uuid;

use crate::core::{
    error::{RepoError, ValidationError},
    types::{Card, CardFsrsUpdate},
};

pub struct CreateCard {
    pub front: String,
    pub back: String,
    pub tags: Vec<String>,
}

pub fn bulk_insert(
    conn: &Connection,
    deck_id: &str,
    cards: Vec<CreateCard>,
) -> Result<usize, RepoError> {
    for card in &cards {
        if card.front.trim().is_empty() {
            return Err(RepoError::Validation(ValidationError::EmptyFront));
        }
        if card.back.trim().is_empty() {
            return Err(RepoError::Validation(ValidationError::EmptyBack));
        }
    }
    let count = cards.len();
    if count == 0 {
        return Ok(0);
    }
    let now = Utc::now().to_rfc3339();
    conn.execute_batch("SAVEPOINT bulk_insert")?;
    for card in &cards {
        let id = Uuid::now_v7().to_string();
        let tags_json = serde_json::to_string(&card.tags).unwrap_or_else(|_| "[]".into());
        let result = conn.execute(
            "INSERT INTO cards \
             (id, deck_id, front, back, tags_json, stability, difficulty, due, last_review, state, reps, lapses) \
             VALUES (?1, ?2, ?3, ?4, ?5, 0.0, 0.0, ?6, NULL, 'new', 0, 0)",
            rusqlite::params![id, deck_id, card.front.trim(), card.back.trim(), tags_json, now],
        );
        if let Err(e) = result {
            conn.execute_batch("ROLLBACK TO SAVEPOINT bulk_insert").ok();
            conn.execute_batch("RELEASE bulk_insert").ok();
            return Err(RepoError::from_sqlite(e));
        }
    }
    conn.execute_batch("RELEASE bulk_insert")?;
    Ok(count)
}

pub struct CreateCardFull {
    pub front: String,
    pub back: String,
    pub tags: Vec<String>,
    pub stability: f64,
    pub difficulty: f64,
    pub due: String,
    pub last_review: Option<String>,
    pub state: String,
    pub reps: i64,
    pub lapses: i64,
}

pub fn bulk_insert_full(
    conn: &Connection,
    deck_id: &str,
    cards: Vec<CreateCardFull>,
) -> Result<usize, RepoError> {
    for card in &cards {
        if card.front.trim().is_empty() {
            return Err(RepoError::Validation(ValidationError::EmptyFront));
        }
        if card.back.trim().is_empty() {
            return Err(RepoError::Validation(ValidationError::EmptyBack));
        }
    }
    let count = cards.len();
    if count == 0 {
        return Ok(0);
    }
    conn.execute_batch("SAVEPOINT bulk_insert_full")?;
    for card in &cards {
        let id = Uuid::now_v7().to_string();
        let tags_json = serde_json::to_string(&card.tags).unwrap_or_else(|_| "[]".into());
        let result = conn.execute(
            "INSERT INTO cards \
             (id, deck_id, front, back, tags_json, stability, difficulty, due, last_review, state, reps, lapses) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            rusqlite::params![
                id,
                deck_id,
                card.front.trim(),
                card.back.trim(),
                tags_json,
                card.stability,
                card.difficulty,
                card.due,
                card.last_review,
                card.state,
                card.reps,
                card.lapses,
            ],
        );
        if let Err(e) = result {
            conn.execute_batch("ROLLBACK TO SAVEPOINT bulk_insert_full")
                .ok();
            conn.execute_batch("RELEASE bulk_insert_full").ok();
            return Err(RepoError::from_sqlite(e));
        }
    }
    conn.execute_batch("RELEASE bulk_insert_full")?;
    Ok(count)
}

pub fn insert(conn: &Connection, deck_id: &str, input: CreateCard) -> Result<Card, RepoError> {
    let front = input.front.trim().to_string();
    let back = input.back.trim().to_string();
    if front.is_empty() {
        return Err(RepoError::Validation(ValidationError::EmptyFront));
    }
    if back.is_empty() {
        return Err(RepoError::Validation(ValidationError::EmptyBack));
    }
    let id = Uuid::now_v7().to_string();
    let now = Utc::now().to_rfc3339();
    let tags_json = serde_json::to_string(&input.tags).unwrap_or_else(|_| "[]".into());
    conn.execute(
        "INSERT INTO cards \
         (id, deck_id, front, back, tags_json, stability, difficulty, due, last_review, state, reps, lapses) \
         VALUES (?1, ?2, ?3, ?4, ?5, 0.0, 0.0, ?6, NULL, 'new', 0, 0)",
        rusqlite::params![id, deck_id, front, back, tags_json, now],
    )
    .map_err(RepoError::from_sqlite)?;
    get_by_id(conn, &id)
}

pub fn get_by_id(conn: &Connection, id: &str) -> Result<Card, RepoError> {
    let mut stmt = conn.prepare(
        "SELECT id, deck_id, front, back, tags_json, stability, difficulty, due, \
         last_review, state, reps, lapses FROM cards WHERE id = ?1",
    )?;
    let result = stmt.query_row(rusqlite::params![id], |row| {
        let tags_json: String = row.get(4)?;
        let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
        Ok(Card {
            id: row.get(0)?,
            deck_id: row.get(1)?,
            front: row.get(2)?,
            back: row.get(3)?,
            tags,
            stability: row.get(5)?,
            difficulty: row.get(6)?,
            due: row.get(7)?,
            last_review: row.get(8)?,
            state: row.get(9)?,
            reps: row.get(10)?,
            lapses: row.get(11)?,
        })
    });
    match result {
        Ok(c) => Ok(c),
        Err(rusqlite::Error::QueryReturnedNoRows) => Err(RepoError::NotFound),
        Err(e) => Err(RepoError::Db(e)),
    }
}

pub fn update_fsrs(
    conn: &Connection,
    card_id: &str,
    update: CardFsrsUpdate,
) -> Result<Card, RepoError> {
    let rows = conn
        .execute(
            "UPDATE cards SET stability=?1, difficulty=?2, due=?3, last_review=?4, \
             state=?5, reps=?6, lapses=?7 WHERE id=?8",
            rusqlite::params![
                update.stability,
                update.difficulty,
                update.due,
                update.last_review,
                update.state,
                update.reps,
                update.lapses,
                card_id
            ],
        )
        .map_err(RepoError::from_sqlite)?;
    if rows == 0 {
        return Err(RepoError::NotFound);
    }
    get_by_id(conn, card_id)
}

pub fn update(
    conn: &Connection,
    id: &str,
    front: String,
    back: String,
    tags: Vec<String>,
) -> Result<Card, RepoError> {
    if front.trim().is_empty() {
        return Err(RepoError::Validation(ValidationError::EmptyFront));
    }
    if back.trim().is_empty() {
        return Err(RepoError::Validation(ValidationError::EmptyBack));
    }
    let tags_json = serde_json::to_string(&tags).unwrap_or_else(|_| "[]".into());
    let rows = conn.execute(
        "UPDATE cards SET front = ?1, back = ?2, tags_json = ?3 WHERE id = ?4",
        rusqlite::params![front.trim(), back.trim(), tags_json, id],
    )?;
    if rows == 0 {
        return Err(RepoError::NotFound);
    }
    get_by_id(conn, id)
}

pub fn delete(conn: &Connection, id: &str) -> Result<(), RepoError> {
    let rows = conn
        .execute("DELETE FROM cards WHERE id = ?1", rusqlite::params![id])
        .map_err(RepoError::from_sqlite)?;
    if rows == 0 {
        return Err(RepoError::NotFound);
    }
    Ok(())
}

pub fn list_by_deck(conn: &Connection, deck_id: &str) -> Result<Vec<Card>, RepoError> {
    let mut stmt = conn.prepare(
        "SELECT id, deck_id, front, back, tags_json, stability, difficulty, due, \
         last_review, state, reps, lapses \
         FROM cards WHERE deck_id = ?1 ORDER BY rowid ASC",
    )?;
    let rows = stmt.query_map(rusqlite::params![deck_id], |row| {
        let tags_json: String = row.get(4)?;
        let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
        Ok(Card {
            id: row.get(0)?,
            deck_id: row.get(1)?,
            front: row.get(2)?,
            back: row.get(3)?,
            tags,
            stability: row.get(5)?,
            difficulty: row.get(6)?,
            due: row.get(7)?,
            last_review: row.get(8)?,
            state: row.get(9)?,
            reps: row.get(10)?,
            lapses: row.get(11)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(RepoError::Db)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::new_test_db;
    use crate::repo::{category, study};

    fn make_deck(conn: &Connection) -> String {
        let cat_id = category::create(
            conn,
            category::CreateCategory {
                name: "Cat".into(),
                color: None,
            },
        )
        .unwrap()
        .id;
        study::create(
            conn,
            study::CreateStudy {
                category_id: cat_id,
                method: "anki".into(),
                name: "Deck".into(),
                payload: serde_json::json!({}),
            },
        )
        .unwrap()
        .id
    }

    fn valid_card(i: usize) -> CreateCard {
        CreateCard {
            front: format!("palabra_{i}"),
            back: format!("word_{i}"),
            tags: vec![],
        }
    }

    // --- bulk_insert ---

    #[test]
    fn bulk_insert_100_cards() {
        let conn = new_test_db();
        let deck_id = make_deck(&conn);
        let cards: Vec<_> = (0..100).map(valid_card).collect();
        let inserted = bulk_insert(&conn, &deck_id, cards).unwrap();
        assert_eq!(inserted, 100);
        let listed = list_by_deck(&conn, &deck_id).unwrap();
        assert_eq!(listed.len(), 100);
    }

    #[test]
    fn bulk_insert_zero_cards() {
        let conn = new_test_db();
        let deck_id = make_deck(&conn);
        let inserted = bulk_insert(&conn, &deck_id, vec![]).unwrap();
        assert_eq!(inserted, 0);
    }

    #[test]
    fn bulk_insert_empty_front_errors_and_rolls_back() {
        let conn = new_test_db();
        let deck_id = make_deck(&conn);
        let err = bulk_insert(
            &conn,
            &deck_id,
            vec![CreateCard {
                front: "".into(),
                back: "word".into(),
                tags: vec![],
            }],
        )
        .unwrap_err();
        assert!(matches!(
            err,
            RepoError::Validation(ValidationError::EmptyFront)
        ));
        let remaining = list_by_deck(&conn, &deck_id).unwrap();
        assert!(
            remaining.is_empty(),
            "rollback: no cards inserted on validation error"
        );
    }

    #[test]
    fn bulk_insert_whitespace_front_errors() {
        let conn = new_test_db();
        let deck_id = make_deck(&conn);
        let err = bulk_insert(
            &conn,
            &deck_id,
            vec![CreateCard {
                front: "   ".into(),
                back: "word".into(),
                tags: vec![],
            }],
        )
        .unwrap_err();
        assert!(matches!(
            err,
            RepoError::Validation(ValidationError::EmptyFront)
        ));
    }

    #[test]
    fn bulk_insert_empty_back_errors_and_rolls_back() {
        let conn = new_test_db();
        let deck_id = make_deck(&conn);
        let err = bulk_insert(
            &conn,
            &deck_id,
            vec![CreateCard {
                front: "word".into(),
                back: "".into(),
                tags: vec![],
            }],
        )
        .unwrap_err();
        assert!(matches!(
            err,
            RepoError::Validation(ValidationError::EmptyBack)
        ));
        let remaining = list_by_deck(&conn, &deck_id).unwrap();
        assert!(
            remaining.is_empty(),
            "rollback: no cards inserted on validation error"
        );
    }

    #[test]
    fn bulk_insert_whitespace_back_errors() {
        let conn = new_test_db();
        let deck_id = make_deck(&conn);
        let err = bulk_insert(
            &conn,
            &deck_id,
            vec![CreateCard {
                front: "word".into(),
                back: "   ".into(),
                tags: vec![],
            }],
        )
        .unwrap_err();
        assert!(matches!(
            err,
            RepoError::Validation(ValidationError::EmptyBack)
        ));
    }

    #[test]
    fn bulk_insert_nonexistent_deck_fk_error() {
        let conn = new_test_db();
        let err = bulk_insert(
            &conn,
            "00000000-0000-0000-0000-000000000000",
            vec![valid_card(0)],
        )
        .unwrap_err();
        assert!(matches!(err, RepoError::ForeignKeyViolation));
    }

    // --- list_by_deck ---

    #[test]
    fn list_by_deck_returns_cards_with_default_fsrs_state() {
        let conn = new_test_db();
        let deck_id = make_deck(&conn);
        bulk_insert(&conn, &deck_id, (0..5).map(valid_card).collect()).unwrap();
        let cards = list_by_deck(&conn, &deck_id).unwrap();
        assert_eq!(cards.len(), 5);
        for card in &cards {
            assert_eq!(card.state, "new");
            assert_eq!(card.reps, 0);
            assert_eq!(card.lapses, 0);
        }
    }

    #[test]
    fn list_by_deck_empty_when_no_cards() {
        let conn = new_test_db();
        let deck_id = make_deck(&conn);
        let cards = list_by_deck(&conn, &deck_id).unwrap();
        assert!(cards.is_empty());
    }

    // --- update ---

    #[test]
    fn update_happy_path() {
        let conn = new_test_db();
        let deck_id = make_deck(&conn);
        let card = insert(
            &conn,
            &deck_id,
            CreateCard {
                front: "casa".into(),
                back: "house".into(),
                tags: vec![],
            },
        )
        .unwrap();
        let updated = update(
            &conn,
            &card.id,
            "hogar".into(),
            "home".into(),
            vec!["noun".into()],
        )
        .unwrap();
        assert_eq!(updated.front, "hogar");
        assert_eq!(updated.back, "home");
        assert_eq!(updated.tags, vec!["noun"]);
        assert_eq!(updated.id, card.id);
    }

    #[test]
    fn update_not_found() {
        let conn = new_test_db();
        let err = update(
            &conn,
            "00000000-0000-0000-0000-000000000000",
            "f".into(),
            "b".into(),
            vec![],
        )
        .unwrap_err();
        assert!(matches!(err, RepoError::NotFound));
    }

    #[test]
    fn update_empty_front_errors() {
        let conn = new_test_db();
        let deck_id = make_deck(&conn);
        let card = insert(
            &conn,
            &deck_id,
            CreateCard {
                front: "casa".into(),
                back: "house".into(),
                tags: vec![],
            },
        )
        .unwrap();
        let err = update(&conn, &card.id, "".into(), "home".into(), vec![]).unwrap_err();
        assert!(matches!(
            err,
            RepoError::Validation(ValidationError::EmptyFront)
        ));
    }

    #[test]
    fn update_empty_back_errors() {
        let conn = new_test_db();
        let deck_id = make_deck(&conn);
        let card = insert(
            &conn,
            &deck_id,
            CreateCard {
                front: "casa".into(),
                back: "house".into(),
                tags: vec![],
            },
        )
        .unwrap();
        let err = update(&conn, &card.id, "casa".into(), "".into(), vec![]).unwrap_err();
        assert!(matches!(
            err,
            RepoError::Validation(ValidationError::EmptyBack)
        ));
    }

    #[test]
    fn update_whitespace_front_errors() {
        let conn = new_test_db();
        let deck_id = make_deck(&conn);
        let card = insert(
            &conn,
            &deck_id,
            CreateCard {
                front: "casa".into(),
                back: "house".into(),
                tags: vec![],
            },
        )
        .unwrap();
        let err = update(&conn, &card.id, "   ".into(), "home".into(), vec![]).unwrap_err();
        assert!(matches!(
            err,
            RepoError::Validation(ValidationError::EmptyFront)
        ));
    }

    #[test]
    fn update_whitespace_back_errors() {
        let conn = new_test_db();
        let deck_id = make_deck(&conn);
        let card = insert(
            &conn,
            &deck_id,
            CreateCard {
                front: "casa".into(),
                back: "house".into(),
                tags: vec![],
            },
        )
        .unwrap();
        let err = update(&conn, &card.id, "casa".into(), "   ".into(), vec![]).unwrap_err();
        assert!(matches!(
            err,
            RepoError::Validation(ValidationError::EmptyBack)
        ));
    }

    #[test]
    fn update_tags_replaced() {
        let conn = new_test_db();
        let deck_id = make_deck(&conn);
        let card = insert(
            &conn,
            &deck_id,
            CreateCard {
                front: "run".into(),
                back: "correr".into(),
                tags: vec!["a".into()],
            },
        )
        .unwrap();
        let updated = update(
            &conn,
            &card.id,
            "run".into(),
            "correr".into(),
            vec!["b".into(), "c".into()],
        )
        .unwrap();
        assert_eq!(updated.tags, vec!["b", "c"]);
    }
}
