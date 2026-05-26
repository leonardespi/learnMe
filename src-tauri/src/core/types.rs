use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CardFsrsUpdate {
    pub stability: f64,
    pub difficulty: f64,
    pub due: String,
    pub last_review: String,
    pub state: String,
    pub reps: i64,
    pub lapses: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: String,
    pub name: String,
    pub color: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Study {
    pub id: String,
    pub category_id: String,
    pub method: String,
    pub name: String,
    pub payload: serde_json::Value,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Card {
    pub id: String,
    pub deck_id: String,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewLog {
    pub id: String,
    pub card_id: String,
    pub grade: i32,
    pub reviewed_at: String,
    pub prev_stability: f64,
    pub prev_difficulty: f64,
    pub prev_due: String,
}
