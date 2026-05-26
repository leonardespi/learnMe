use thiserror::Error;

#[derive(Debug, Error, PartialEq)]
pub enum ValidationError {
    #[error("name cannot be empty")]
    EmptyName,
    #[error("front cannot be empty")]
    EmptyFront,
    #[error("back cannot be empty")]
    EmptyBack,
    #[error("grade must be between 1 and 4")]
    InvalidGrade,
}

#[derive(Debug, Error)]
pub enum RepoError {
    #[error("record not found")]
    NotFound,
    #[error("foreign key violation")]
    ForeignKeyViolation,
    #[error("validation: {0}")]
    Validation(#[from] ValidationError),
    #[error("migration: {0}")]
    Migration(String),
    #[error("database: {0}")]
    Db(#[from] rusqlite::Error),
}

impl RepoError {
    pub fn from_sqlite(err: rusqlite::Error) -> Self {
        match &err {
            rusqlite::Error::SqliteFailure(ffi, _)
                if ffi.extended_code == rusqlite::ffi::SQLITE_CONSTRAINT_FOREIGNKEY =>
            {
                RepoError::ForeignKeyViolation
            }
            _ => RepoError::Db(err),
        }
    }
}

impl serde::Serialize for RepoError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}
