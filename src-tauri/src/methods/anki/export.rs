use rusqlite::Connection;

use crate::core::{
    error::RepoError,
    types::{Card, Study},
};
use crate::repo::{card, study};

pub fn build_export_payload(study: &Study, cards: &[Card]) -> serde_json::Value {
    let cards_json: Vec<serde_json::Value> = cards
        .iter()
        .map(|c| {
            serde_json::json!({
                "front": c.front,
                "back": c.back,
                "tags": c.tags,
                "stability": c.stability,
                "difficulty": c.difficulty,
                "due": c.due,
                "lastReview": c.last_review,
                "state": c.state,
                "reps": c.reps,
                "lapses": c.lapses,
            })
        })
        .collect();

    serde_json::json!({
        "schemaVersion": "1.0.0",
        "method": study.method,
        "name": study.name,
        "tags": [],
        "cards": cards_json,
    })
}

pub fn cmd_export_anki_deck(
    conn: &Connection,
    deck_id: &str,
) -> Result<serde_json::Value, RepoError> {
    let s = study::get_by_id(conn, deck_id)?;
    let cards = card::list_by_deck(conn, deck_id)?;
    Ok(build_export_payload(&s, &cards))
}
