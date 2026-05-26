use chrono::{Duration, NaiveDate};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::core::error::RepoError;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StateCount {
    pub new: u32,
    pub learning: u32,
    pub review: u32,
    pub relearning: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeckStats {
    pub retention: Option<f64>,
    pub by_state: StateCount,
    pub heatmap: Vec<u32>,
    pub forecast: Vec<u32>,
}

pub fn compute(conn: &Connection, deck_id: &str, today: NaiveDate) -> Result<DeckStats, RepoError> {
    Ok(DeckStats {
        retention: compute_retention(conn, deck_id, today)?,
        by_state: compute_by_state(conn, deck_id)?,
        heatmap: compute_heatmap(conn, deck_id, today)?,
        forecast: compute_forecast(conn, deck_id, today)?,
    })
}

fn compute_retention(
    conn: &Connection,
    deck_id: &str,
    today: NaiveDate,
) -> Result<Option<f64>, RepoError> {
    let window_start = (today - Duration::days(30)).to_string();
    let row: (i64, i64) = conn.query_row(
        "SELECT COUNT(*), COALESCE(SUM(CASE WHEN rl.grade >= 2 THEN 1 ELSE 0 END), 0) \
         FROM review_logs rl \
         JOIN cards c ON c.id = rl.card_id \
         WHERE c.deck_id = ?1 \
         AND DATE(rl.reviewed_at) >= ?2",
        rusqlite::params![deck_id, window_start],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;
    let (total, successes) = row;
    if total == 0 {
        Ok(None)
    } else {
        Ok(Some(successes as f64 / total as f64))
    }
}

fn compute_by_state(conn: &Connection, deck_id: &str) -> Result<StateCount, RepoError> {
    let mut stmt =
        conn.prepare("SELECT state, COUNT(*) FROM cards WHERE deck_id = ?1 GROUP BY state")?;
    let mut counts = StateCount {
        new: 0,
        learning: 0,
        review: 0,
        relearning: 0,
    };
    let rows = stmt
        .query_map(rusqlite::params![deck_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, u32>(1)?))
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(RepoError::from_sqlite)?;
    for (state, count) in rows {
        match state.as_str() {
            "new" => counts.new = count,
            "learning" => counts.learning = count,
            "review" => counts.review = count,
            "relearning" => counts.relearning = count,
            _ => {}
        }
    }
    Ok(counts)
}

fn compute_heatmap(
    conn: &Connection,
    deck_id: &str,
    today: NaiveDate,
) -> Result<Vec<u32>, RepoError> {
    let heatmap_start = today - Duration::days(364);
    let mut buckets = vec![0u32; 365];

    let mut stmt = conn.prepare(
        "SELECT DATE(rl.reviewed_at) as day, COUNT(*) \
         FROM review_logs rl \
         JOIN cards c ON c.id = rl.card_id \
         WHERE c.deck_id = ?1 \
         AND DATE(rl.reviewed_at) >= ?2 \
         GROUP BY day",
    )?;
    let rows = stmt
        .query_map(
            rusqlite::params![deck_id, heatmap_start.to_string()],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, u32>(1)?)),
        )?
        .collect::<Result<Vec<_>, _>>()
        .map_err(RepoError::from_sqlite)?;

    for (day_str, count) in rows {
        if let Ok(day) = NaiveDate::parse_from_str(&day_str, "%Y-%m-%d") {
            let idx = (day - heatmap_start).num_days();
            if (0..365).contains(&idx) {
                buckets[idx as usize] = count;
            }
        }
    }
    Ok(buckets)
}

fn compute_forecast(
    conn: &Connection,
    deck_id: &str,
    today: NaiveDate,
) -> Result<Vec<u32>, RepoError> {
    let mut forecast = vec![0u32; 7];
    for i in 0..7i64 {
        let day = (today + Duration::days(i)).to_string();
        let count: u32 = conn.query_row(
            "SELECT COUNT(*) FROM cards \
             WHERE deck_id = ?1 \
             AND state IN ('review', 'learning', 'relearning') \
             AND DATE(due) = ?2",
            rusqlite::params![deck_id, day],
            |row| row.get(0),
        )?;
        forecast[i as usize] = count;
    }
    Ok(forecast)
}
