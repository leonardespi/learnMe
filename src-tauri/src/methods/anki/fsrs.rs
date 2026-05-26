use chrono::DateTime;
use chrono::Utc;
use rs_fsrs::{Card as FsrsCard, Rating, State, FSRS};

use crate::core::{
    error::{RepoError, ValidationError},
    types::{Card, CardFsrsUpdate},
};

pub fn apply_review(
    card: &Card,
    grade: u8,
    now: DateTime<Utc>,
) -> Result<CardFsrsUpdate, RepoError> {
    let rating = match grade {
        1 => Rating::Again,
        2 => Rating::Hard,
        3 => Rating::Good,
        4 => Rating::Easy,
        _ => return Err(RepoError::Validation(ValidationError::InvalidGrade)),
    };

    let last_review = card
        .last_review
        .as_ref()
        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or(now);

    let due = DateTime::parse_from_rfc3339(&card.due)
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or(now);

    let state = match card.state.as_str() {
        "learning" => State::Learning,
        "review" => State::Review,
        "relearning" => State::Relearning,
        _ => State::New,
    };

    let scheduled_days = if matches!(state, State::New) {
        0
    } else {
        (due - last_review).num_days().max(0)
    };

    let fsrs_card = FsrsCard {
        due,
        stability: card.stability,
        difficulty: card.difficulty,
        elapsed_days: 0,
        scheduled_days,
        reps: card.reps as i32,
        lapses: card.lapses as i32,
        state,
        last_review,
    };

    let info = FSRS::default().next(fsrs_card, now, rating);
    let updated = &info.card;

    let new_state = match updated.state {
        State::New => "new",
        State::Learning => "learning",
        State::Review => "review",
        State::Relearning => "relearning",
    };

    Ok(CardFsrsUpdate {
        stability: updated.stability,
        difficulty: updated.difficulty,
        due: updated.due.to_rfc3339(),
        last_review: now.to_rfc3339(),
        state: new_state.into(),
        reps: updated.reps as i64,
        lapses: updated.lapses as i64,
    })
}
