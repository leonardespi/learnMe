use chrono::Utc;
use rusqlite::Connection;

use crate::{
    core::error::RepoError,
    repo::{card, category, review_log, study},
    session::{
        checksum::compute_checksum,
        types::{
            LearnmeCard, LearnmeCategory, LearnmeData, LearnmeFile, LearnmeReviewLog, LearnmeStudy,
        },
    },
};

pub fn build_learnme(conn: &Connection, app_version: &str) -> Result<LearnmeFile, RepoError> {
    let generated_at = Utc::now().to_rfc3339();

    let categories: Vec<LearnmeCategory> = category::list(conn)?
        .into_iter()
        .map(|c| LearnmeCategory {
            id: c.id,
            name: c.name,
            color: c.color,
        })
        .collect();

    let mut studies_out: Vec<LearnmeStudy> = vec![];
    let mut cards_out: Vec<LearnmeCard> = vec![];

    for cat in &categories {
        let cat_studies = study::list_by_category(conn, &cat.id)?;
        for s in cat_studies {
            let deck_cards = card::list_by_deck(conn, &s.id)?;
            for c in deck_cards {
                let elapsed_days = compute_elapsed_days(&c.last_review, &generated_at);
                let scheduled_days = compute_scheduled_days(&c.last_review, &c.due);
                cards_out.push(LearnmeCard {
                    id: c.id,
                    study_id: s.id.clone(),
                    front: c.front,
                    back: c.back,
                    tags: c.tags,
                    state: c.state,
                    stability: c.stability,
                    difficulty: c.difficulty,
                    elapsed_days,
                    scheduled_days,
                    reps: c.reps,
                    lapses: c.lapses,
                    due: c.due,
                    last_reviewed: c.last_review,
                });
            }
            studies_out.push(LearnmeStudy {
                id: s.id,
                category_id: s.category_id,
                name: s.name,
                method: s.method,
            });
        }
    }

    let all_logs = review_log::list_all(conn)?;
    let review_logs_out: Vec<LearnmeReviewLog> = all_logs
        .into_iter()
        .map(|rl| LearnmeReviewLog {
            id: rl.id,
            card_id: rl.card_id,
            grade: rl.grade,
            reviewed_at: rl.reviewed_at,
            stability: rl.prev_stability,
            difficulty: rl.prev_difficulty,
            elapsed_days: 0,
            scheduled_days: 0,
            review_state: 0,
        })
        .collect();

    let data = LearnmeData {
        categories,
        studies: studies_out,
        cards: cards_out,
        review_logs: review_logs_out,
    };

    let checksum =
        compute_checksum(&data, app_version, &generated_at, 1).map_err(RepoError::Migration)?;

    Ok(LearnmeFile {
        version: 1,
        generated_at,
        app_version: app_version.to_string(),
        checksum,
        data,
    })
}

fn compute_elapsed_days(last_review: &Option<String>, now: &str) -> u32 {
    let Some(lr) = last_review else { return 0 };
    let Ok(lr_dt) = chrono::DateTime::parse_from_rfc3339(lr) else {
        return 0;
    };
    let Ok(now_dt) = chrono::DateTime::parse_from_rfc3339(now) else {
        return 0;
    };
    let diff = now_dt.signed_duration_since(lr_dt);
    diff.num_days().max(0) as u32
}

fn compute_scheduled_days(last_review: &Option<String>, due: &str) -> u32 {
    let Some(lr) = last_review else { return 0 };
    let Ok(lr_dt) = chrono::DateTime::parse_from_rfc3339(lr) else {
        return 0;
    };
    let Ok(due_dt) = chrono::DateTime::parse_from_rfc3339(due) else {
        return 0;
    };
    let diff = due_dt.signed_duration_since(lr_dt);
    diff.num_days().max(0) as u32
}
