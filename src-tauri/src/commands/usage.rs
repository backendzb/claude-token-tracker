use crate::data::loader;
use crate::data::models::{BucketData, SessionSummary, UsageOptions, UsageRecord};

#[tauri::command]
pub async fn get_usage(options: Option<UsageOptions>) -> Result<Vec<UsageRecord>, String> {
    loader::load_all_usage_data(options).await
}

#[tauri::command]
pub async fn get_projects() -> Result<Vec<String>, String> {
    loader::get_project_list().await
}

#[tauri::command]
pub async fn get_sessions(options: Option<UsageOptions>) -> Result<Vec<SessionSummary>, String> {
    loader::load_session_list(options).await
}

#[tauri::command]
pub async fn get_buckets(options: Option<UsageOptions>) -> Result<Vec<BucketData>, String> {
    loader::load_bucket_data(options).await
}

#[tauri::command]
pub fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
