use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageRecord {
    pub timestamp: String,
    #[serde(default)]
    pub session_id: String,
    #[serde(default)]
    pub request_id: String,
    #[serde(default)]
    pub message_id: String,
    pub model: String,
    #[serde(default)]
    pub input_tokens: u64,
    #[serde(default)]
    pub output_tokens: u64,
    #[serde(default)]
    pub cache_creation_input_tokens: u64,
    #[serde(default)]
    pub cache_read_input_tokens: u64,
    #[serde(default)]
    pub speed: String,
    #[serde(default)]
    pub cost_usd: f64,
    #[serde(default)]
    pub content: String,
    #[serde(default)]
    pub content_preview: String,
    #[serde(default)]
    pub user_query: String,
    #[serde(default)]
    pub project: String,
    #[serde(default)]
    pub cwd: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageOptions {
    pub since: Option<String>,
    pub until: Option<String>,
    pub project: Option<String>,
    #[serde(rename = "sessionId")]
    pub session_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SessionSummary {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub project: String,
    #[serde(rename = "requestCount")]
    pub request_count: u64,
    #[serde(rename = "totalTokens")]
    pub total_tokens: u64,
    #[serde(rename = "totalCost")]
    pub total_cost: f64,
    pub models: Vec<String>,
    #[serde(rename = "firstTimestamp")]
    pub first_timestamp: String,
    #[serde(rename = "lastTimestamp")]
    pub last_timestamp: String,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_creation_input_tokens: u64,
    pub cache_read_input_tokens: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct BucketData {
    pub id: String,
    #[serde(rename = "startTime")]
    pub start_time: String,
    #[serde(rename = "endTime")]
    pub end_time: String,
    #[serde(rename = "isActive")]
    pub is_active: bool,
    #[serde(rename = "requestCount")]
    pub request_count: u64,
    #[serde(rename = "totalTokens")]
    pub total_tokens: u64,
    #[serde(rename = "costUSD")]
    pub cost_usd: f64,
    #[serde(rename = "burnRate")]
    pub burn_rate: f64,
    pub models: Vec<String>,
    pub projection: Option<BucketProjection>,
}

#[derive(Debug, Clone, Serialize)]
pub struct BucketProjection {
    #[serde(rename = "totalCost")]
    pub total_cost: f64,
    #[serde(rename = "remainingMinutes")]
    pub remaining_minutes: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct Settings {
    #[serde(rename = "dailyBudget")]
    pub daily_budget: f64,
    #[serde(rename = "monthlyBudget")]
    pub monthly_budget: f64,
    #[serde(rename = "requestThreshold")]
    pub request_threshold: f64,
    pub shortcut: String,
    #[serde(rename = "floatShortcut")]
    pub float_shortcut: String,
    pub theme: String,
    #[serde(rename = "floatOpacity")]
    pub float_opacity: f64,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            daily_budget: 0.0,
            monthly_budget: 0.0,
            request_threshold: 0.0,
            shortcut: "Ctrl+Shift+T".to_string(),
            float_shortcut: String::new(),
            theme: "dark".to_string(),
            float_opacity: 0.9,
        }
    }
}

/// Helper to collect unique models from records
pub fn collect_models(records: &[UsageRecord]) -> Vec<String> {
    let set: HashSet<&str> = records.iter().map(|r| r.model.as_str()).collect();
    let mut v: Vec<String> = set.into_iter().map(|s| s.to_string()).collect();
    v.sort();
    v
}
