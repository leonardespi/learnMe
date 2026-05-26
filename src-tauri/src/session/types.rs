use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LearnmeCategory {
    pub id: String,
    pub name: String,
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LearnmeStudy {
    pub id: String,
    pub category_id: String,
    pub name: String,
    pub method: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LearnmeCard {
    pub id: String,
    pub study_id: String,
    pub front: String,
    pub back: String,
    pub tags: Vec<String>,
    pub state: String,
    pub stability: f64,
    pub difficulty: f64,
    pub elapsed_days: u32,
    pub scheduled_days: u32,
    pub reps: i64,
    pub lapses: i64,
    pub due: String,
    pub last_reviewed: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LearnmeReviewLog {
    pub id: String,
    pub card_id: String,
    pub grade: i32,
    pub reviewed_at: String,
    pub stability: f64,
    pub difficulty: f64,
    pub elapsed_days: u32,
    pub scheduled_days: u32,
    pub review_state: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LearnmeData {
    pub categories: Vec<LearnmeCategory>,
    pub studies: Vec<LearnmeStudy>,
    pub cards: Vec<LearnmeCard>,
    pub review_logs: Vec<LearnmeReviewLog>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LearnmeFile {
    pub version: u32,
    pub generated_at: String,
    pub app_version: String,
    pub checksum: String,
    pub data: LearnmeData,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ImportMode {
    Merge,
    Replace,
}
