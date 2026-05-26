use std::collections::HashSet;

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::core::error::RepoError;
use crate::repo::{card, category, study};

const SCHEMA_STR: &str = include_str!("../../../../schemas/anki-deck.v1.json");

#[derive(Debug, Error)]
pub enum ImportError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("parse error: {0}")]
    Parse(serde_json::Error),
    #[error("schema error at {pointer}: {message}")]
    Schema { pointer: String, message: String },
    #[error("database error: {0}")]
    Repo(#[from] RepoError),
}

impl From<serde_json::Error> for ImportError {
    fn from(e: serde_json::Error) -> Self {
        ImportError::Parse(e)
    }
}

impl serde::Serialize for ImportError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

// Public type — used by tests via compute_new_cards (simple dedup unit tests)
#[derive(Debug, Clone)]
pub struct CardPayload {
    pub front: String,
    pub back: String,
    pub tags: Vec<String>,
}

// Internal type — deserialized from JSON (includes optional FSRS state for roundtrip)
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CardImportData {
    front: String,
    back: String,
    #[serde(default)]
    tags: Vec<String>,
    stability: Option<f64>,
    difficulty: Option<f64>,
    due: Option<String>,
    last_review: Option<String>,
    state: Option<String>,
    reps: Option<i64>,
    lapses: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ImportResult {
    pub inserted: u32,
    pub skipped: u32,
}

pub fn validate_schema(value: &serde_json::Value) -> Result<(), ImportError> {
    let schema_value: serde_json::Value =
        serde_json::from_str(SCHEMA_STR).expect("embedded schema must be valid JSON");
    let compiled = jsonschema::JSONSchema::compile(&schema_value)
        .expect("embedded schema must be valid JSON Schema");

    if let Err(mut errors) = compiled.validate(value) {
        if let Some(error) = errors.next() {
            return Err(ImportError::Schema {
                pointer: extract_pointer(&error),
                message: error.to_string(),
            });
        }
    }
    Ok(())
}

fn extract_pointer(error: &jsonschema::ValidationError<'_>) -> String {
    use jsonschema::error::ValidationErrorKind;
    match &error.kind {
        ValidationErrorKind::Required { property } => {
            let name = property.as_str().unwrap_or("?");
            format!("/{name}")
        }
        _ => error.instance_path.to_string(),
    }
}

pub fn parse_file(path: &str) -> Result<serde_json::Value, ImportError> {
    let bytes = std::fs::read(path).map_err(ImportError::Io)?;
    let value: serde_json::Value = serde_json::from_slice(&bytes).map_err(ImportError::Parse)?;
    Ok(value)
}

pub fn compute_new_cards(
    existing: &HashSet<(String, String)>,
    incoming: Vec<CardPayload>,
) -> (Vec<CardPayload>, usize) {
    let mut to_insert = Vec::new();
    let mut skipped = 0usize;
    for payload in incoming {
        let key = (
            payload.front.trim().to_string(),
            payload.back.trim().to_string(),
        );
        if existing.contains(&key) {
            skipped += 1;
        } else {
            to_insert.push(payload);
        }
    }
    (to_insert, skipped)
}

pub fn cmd_import_anki_deck_by_study(
    conn: &Connection,
    study_id: &str,
    value: &serde_json::Value,
) -> Result<ImportResult, ImportError> {
    validate_schema(value)?;

    let cards_json = value["cards"].as_array().cloned().unwrap_or_default();

    let existing_cards = card::list_by_deck(conn, study_id)?;
    let existing_set: HashSet<(String, String)> = existing_cards
        .iter()
        .map(|c| (c.front.clone(), c.back.clone()))
        .collect();

    let incoming: Vec<CardImportData> = cards_json
        .into_iter()
        .filter_map(|v| serde_json::from_value(v).ok())
        .collect();

    let mut to_insert: Vec<&CardImportData> = Vec::new();
    let mut skipped = 0usize;
    for card_data in &incoming {
        let key = (card_data.front.trim().to_string(), card_data.back.trim().to_string());
        if existing_set.contains(&key) {
            skipped += 1;
        } else {
            to_insert.push(card_data);
        }
    }
    let inserted_count = to_insert.len() as u32;

    if !to_insert.is_empty() {
        let full_cards: Vec<card::CreateCardFull> = to_insert
            .into_iter()
            .map(|p| {
                let due = p.due.clone().unwrap_or_else(|| chrono::Utc::now().to_rfc3339());
                card::CreateCardFull {
                    front: p.front.clone(),
                    back: p.back.clone(),
                    tags: p.tags.clone(),
                    stability: p.stability.unwrap_or(0.0),
                    difficulty: p.difficulty.unwrap_or(0.0),
                    due,
                    last_review: p.last_review.clone(),
                    state: p.state.clone().unwrap_or_else(|| "new".to_string()),
                    reps: p.reps.unwrap_or(0),
                    lapses: p.lapses.unwrap_or(0),
                }
            })
            .collect();
        card::bulk_insert_full(conn, study_id, full_cards)?;
    }

    Ok(ImportResult { inserted: inserted_count, skipped: skipped as u32 })
}

pub fn cmd_import_anki_deck(
    conn: &Connection,
    category_id: &str,
    file_path: &str,
) -> Result<ImportResult, ImportError> {
    let value = parse_file(file_path)?;
    validate_schema(&value)?;

    let name = value["name"].as_str().unwrap_or("").trim().to_string();
    let method = value["method"].as_str().unwrap_or("").trim().to_string();
    let cards_json = value["cards"].as_array().cloned().unwrap_or_default();

    // Ensure category exists (FK guard)
    category::get_by_id(conn, category_id)?;

    // Find or create study
    let deck_id = match study::find_by_category_name_method(conn, category_id, &name, &method)? {
        Some(s) => s.id,
        None => {
            study::create(
                conn,
                study::CreateStudy {
                    category_id: category_id.to_string(),
                    method,
                    name,
                    payload: serde_json::json!({}),
                },
            )?
            .id
        }
    };

    // Build existing (front, back) set for dedupe
    let existing_cards = card::list_by_deck(conn, &deck_id)?;
    let existing_set: HashSet<(String, String)> = existing_cards
        .iter()
        .map(|c| (c.front.clone(), c.back.clone()))
        .collect();

    // Parse incoming cards (internal struct retains FSRS fields for roundtrip)
    let incoming: Vec<CardImportData> = cards_json
        .into_iter()
        .filter_map(|v| serde_json::from_value(v).ok())
        .collect();

    let mut to_insert: Vec<&CardImportData> = Vec::new();
    let mut skipped = 0usize;
    for card_data in &incoming {
        let key = (
            card_data.front.trim().to_string(),
            card_data.back.trim().to_string(),
        );
        if existing_set.contains(&key) {
            skipped += 1;
        } else {
            to_insert.push(card_data);
        }
    }
    let inserted_count = to_insert.len() as u32;

    if !to_insert.is_empty() {
        let full_cards: Vec<card::CreateCardFull> = to_insert
            .into_iter()
            .map(|p| {
                let due = p
                    .due
                    .clone()
                    .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());
                card::CreateCardFull {
                    front: p.front.clone(),
                    back: p.back.clone(),
                    tags: p.tags.clone(),
                    stability: p.stability.unwrap_or(0.0),
                    difficulty: p.difficulty.unwrap_or(0.0),
                    due,
                    last_review: p.last_review.clone(),
                    state: p.state.clone().unwrap_or_else(|| "new".to_string()),
                    reps: p.reps.unwrap_or(0),
                    lapses: p.lapses.unwrap_or(0),
                }
            })
            .collect();
        card::bulk_insert_full(conn, &deck_id, full_cards)?;
    }

    Ok(ImportResult {
        inserted: inserted_count,
        skipped: skipped as u32,
    })
}
