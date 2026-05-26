use sha2::{Digest, Sha256};
use std::collections::BTreeMap;

use crate::session::types::LearnmeData;

pub fn compute_checksum(
    data: &LearnmeData,
    app_version: &str,
    _generated_at: &str,
    version: u32,
) -> Result<String, String> {
    let data_value = serde_json::to_value(data).map_err(|e| format!("serialization error: {e}"))?;

    let mut canonical: BTreeMap<String, serde_json::Value> = BTreeMap::new();
    canonical.insert(
        "appVersion".into(),
        serde_json::Value::String(app_version.to_string()),
    );
    canonical.insert("data".into(), data_value);
    // generatedAt intentionally excluded: including it breaks export determinism
    // (two calls at different times would produce different checksums). The checksum
    // covers only the data payload, appVersion, and schema version.
    canonical.insert("version".into(), serde_json::Value::Number(version.into()));

    let canonical_str =
        serde_json::to_string(&canonical).map_err(|e| format!("serialization error: {e}"))?;

    let hash = Sha256::digest(canonical_str.as_bytes());
    Ok(format!("{hash:x}"))
}
