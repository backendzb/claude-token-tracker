use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use tokio::io::{AsyncBufReadExt, BufReader};
use walkdir::WalkDir;

use super::models::{
    BucketData, BucketProjection, SessionSummary, UsageOptions, UsageRecord, collect_models,
};
use super::pricing::calculate_cost;

const SESSION_DURATION_MS: i64 = 5 * 60 * 60 * 1000; // 5 hours

/// Get all possible Claude config paths
fn get_claude_paths() -> Vec<PathBuf> {
    let home = dirs::home_dir().unwrap_or_default();
    vec![
        home.join(".config").join("claude").join("projects"),
        home.join(".claude").join("projects"),
    ]
}

/// Recursively find all .jsonl files
fn find_jsonl_files(base: &PathBuf) -> Vec<PathBuf> {
    if !base.exists() {
        return vec![];
    }
    WalkDir::new(base)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path()
                .extension()
                .map_or(false, |ext| ext == "jsonl")
        })
        .map(|e| e.into_path())
        .collect()
}

/// Extract project name from path
fn extract_project(path: &PathBuf) -> String {
    // Path like: ~/.claude/projects/{project_name}/{session}.jsonl
    let components: Vec<_> = path.components().collect();
    for (i, comp) in components.iter().enumerate() {
        if comp.as_os_str() == "projects" && i + 1 < components.len() {
            return components[i + 1].as_os_str().to_string_lossy().to_string();
        }
    }
    "unknown".to_string()
}

/// Extract content preview from message blocks
fn get_content_preview(message: &serde_json::Value) -> String {
    if let Some(content) = message.get("content") {
        if let Some(s) = content.as_str() {
            return s.chars().take(100).collect();
        }
        if let Some(arr) = content.as_array() {
            for block in arr {
                if let Some(text) = block.get("text").and_then(|t| t.as_str()) {
                    return text.chars().take(100).collect();
                }
            }
        }
    }
    String::new()
}

/// Load all usage data from JSONL transcript files
pub async fn load_all_usage_data(options: Option<UsageOptions>) -> Result<Vec<UsageRecord>, String> {
    let opts = options.unwrap_or(UsageOptions {
        since: None, until: None, project: None, session_id: None,
    });

    let mut all_files: Vec<PathBuf> = Vec::new();
    for base in get_claude_paths() {
        all_files.extend(find_jsonl_files(&base));
    }

    let mut records: Vec<UsageRecord> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();

    for file_path in &all_files {
        let project = extract_project(file_path);

        // Filter by project if specified
        if let Some(ref proj_filter) = opts.project {
            if !proj_filter.is_empty() && project != *proj_filter {
                continue;
            }
        }

        let file = match tokio::fs::File::open(file_path).await {
            Ok(f) => f,
            Err(_) => continue,
        };
        let reader = BufReader::new(file);
        let mut lines = reader.lines();
        let mut last_user_query = String::new();

        // Extract session ID from filename
        let session_id = file_path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();

        // Filter by sessionId
        if let Some(ref sid) = opts.session_id {
            if !sid.is_empty() && session_id != *sid {
                continue;
            }
        }

        while let Ok(Some(line)) = lines.next_line().await {
            let obj: serde_json::Value = match serde_json::from_str(&line) {
                Ok(v) => v,
                Err(_) => continue,
            };

            let msg_type = obj.get("type").and_then(|t| t.as_str()).unwrap_or("");

            // Track last user query
            if msg_type == "human" || msg_type == "user" {
                if let Some(msg) = obj.get("message") {
                    last_user_query = get_content_preview(msg);
                }
                continue;
            }

            if msg_type != "assistant" {
                continue;
            }

            let message = match obj.get("message") {
                Some(m) => m,
                None => continue,
            };

            let usage = match message.get("usage") {
                Some(u) => u,
                None => continue,
            };

            let msg_id = message.get("id").and_then(|i| i.as_str()).unwrap_or("");
            let req_id = obj.get("requestId").and_then(|r| r.as_str()).unwrap_or("");
            let dedup_key = format!("{}:{}", msg_id, req_id);

            if !dedup_key.is_empty() && dedup_key != ":" && !seen.insert(dedup_key) {
                continue;
            }

            let model = message.get("model").and_then(|m| m.as_str()).unwrap_or("unknown");
            let input_tokens = usage.get("input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
            let output_tokens = usage.get("output_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
            let cache_write = usage.get("cache_creation_input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
            let cache_read = usage.get("cache_read_input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
            let speed = obj.get("speed").and_then(|s| s.as_str()).unwrap_or("standard");

            let cost = if let Some(c) = obj.get("costUSD").and_then(|c| c.as_f64()) {
                c
            } else {
                calculate_cost(input_tokens, output_tokens, cache_write, cache_read, model, speed)
            };

            let timestamp = obj.get("timestamp")
                .or_else(|| message.get("timestamp"))
                .and_then(|t| t.as_str())
                .unwrap_or("")
                .to_string();

            // Date filtering
            if let Some(ref since) = opts.since {
                if !since.is_empty() && timestamp < *since {
                    continue;
                }
            }
            if let Some(ref until) = opts.until {
                if !until.is_empty() && timestamp > *until {
                    continue;
                }
            }

            let cwd = obj.get("cwd").and_then(|c| c.as_str()).unwrap_or("").to_string();

            records.push(UsageRecord {
                timestamp,
                session_id: session_id.clone(),
                request_id: req_id.to_string(),
                message_id: msg_id.to_string(),
                model: model.to_string(),
                input_tokens,
                output_tokens,
                cache_creation_input_tokens: cache_write,
                cache_read_input_tokens: cache_read,
                speed: speed.to_string(),
                cost_usd: cost,
                content: get_content_preview(message),
                content_preview: get_content_preview(message),
                user_query: last_user_query.clone(),
                project: project.clone(),
                cwd,
            });
        }
    }

    // Sort by timestamp
    records.sort_by(|a, b| a.timestamp.cmp(&b.timestamp));

    Ok(records)
}

/// Group records by session
pub async fn load_session_list(options: Option<UsageOptions>) -> Result<Vec<SessionSummary>, String> {
    let records = load_all_usage_data(options).await?;
    let mut map: HashMap<String, Vec<&UsageRecord>> = HashMap::new();

    for r in &records {
        map.entry(r.session_id.clone()).or_default().push(r);
    }

    let mut sessions: Vec<SessionSummary> = map
        .into_iter()
        .map(|(sid, recs)| {
            let input: u64 = recs.iter().map(|r| r.input_tokens).sum();
            let output: u64 = recs.iter().map(|r| r.output_tokens).sum();
            let cw: u64 = recs.iter().map(|r| r.cache_creation_input_tokens).sum();
            let cr: u64 = recs.iter().map(|r| r.cache_read_input_tokens).sum();
            let cost: f64 = recs.iter().map(|r| r.cost_usd).sum();
            let models = collect_models(&recs.iter().map(|r| (*r).clone()).collect::<Vec<_>>());
            let first = recs.iter().map(|r| r.timestamp.as_str()).min().unwrap_or("").to_string();
            let last = recs.iter().map(|r| r.timestamp.as_str()).max().unwrap_or("").to_string();
            let project = recs.first().map(|r| r.project.clone()).unwrap_or_default();

            SessionSummary {
                session_id: sid,
                project,
                request_count: recs.len() as u64,
                total_tokens: input + output + cw + cr,
                total_cost: cost,
                models,
                first_timestamp: first,
                last_timestamp: last,
                input_tokens: input,
                output_tokens: output,
                cache_creation_input_tokens: cw,
                cache_read_input_tokens: cr,
            }
        })
        .collect();

    sessions.sort_by(|a, b| b.last_timestamp.cmp(&a.last_timestamp));
    Ok(sessions)
}

/// 5-hour window bucket analysis
pub async fn load_bucket_data(options: Option<UsageOptions>) -> Result<Vec<BucketData>, String> {
    let records = load_all_usage_data(options).await?;
    if records.is_empty() {
        return Ok(vec![]);
    }

    let mut buckets: Vec<Vec<&UsageRecord>> = Vec::new();
    let mut current_bucket: Vec<&UsageRecord> = Vec::new();
    let mut bucket_start_ms: i64 = 0;

    for r in &records {
        let ts_ms = chrono::DateTime::parse_from_rfc3339(&r.timestamp)
            .or_else(|_| chrono::DateTime::parse_from_str(&r.timestamp, "%Y-%m-%dT%H:%M:%S%.fZ"))
            .map(|dt| dt.timestamp_millis())
            .unwrap_or(0);

        if current_bucket.is_empty() || (ts_ms - bucket_start_ms) > SESSION_DURATION_MS {
            if !current_bucket.is_empty() {
                buckets.push(current_bucket);
                current_bucket = Vec::new();
            }
            bucket_start_ms = ts_ms;
        }
        current_bucket.push(r);
    }
    if !current_bucket.is_empty() {
        buckets.push(current_bucket);
    }

    let now_ms = chrono::Utc::now().timestamp_millis();

    let result: Vec<BucketData> = buckets
        .into_iter()
        .map(|recs| {
            let first_ts = recs.first().unwrap().timestamp.clone();
            let last_ts = recs.last().unwrap().timestamp.clone();
            let start_ms = chrono::DateTime::parse_from_rfc3339(&first_ts)
                .map(|d| d.timestamp_millis())
                .unwrap_or(0);
            let end_ms = start_ms + SESSION_DURATION_MS;
            let last_ms = chrono::DateTime::parse_from_rfc3339(&last_ts)
                .map(|d| d.timestamp_millis())
                .unwrap_or(start_ms);

            let is_active = now_ms >= start_ms && now_ms <= end_ms;
            let cost: f64 = recs.iter().map(|r| r.cost_usd).sum();
            let input: u64 = recs.iter().map(|r| r.input_tokens).sum();
            let output: u64 = recs.iter().map(|r| r.output_tokens).sum();
            let cw: u64 = recs.iter().map(|r| r.cache_creation_input_tokens).sum();
            let cr: u64 = recs.iter().map(|r| r.cache_read_input_tokens).sum();
            let total_tokens = input + output + cw + cr;

            let duration_min = ((last_ms - start_ms) as f64) / 60000.0;
            let burn_rate = if duration_min > 0.0 { (cost / duration_min) * 60.0 } else { 0.0 };
            let burn_rate = (burn_rate * 10000.0).round() / 10000.0;

            let projection = if is_active && burn_rate > 0.0 {
                let remain_min = ((end_ms - now_ms) as f64 / 60000.0).max(0.0) as i64;
                let projected = cost + (burn_rate / 60.0) * remain_min as f64;
                Some(BucketProjection {
                    total_cost: (projected * 10000.0).round() / 10000.0,
                    remaining_minutes: remain_min,
                })
            } else {
                None
            };

            let models = collect_models(&recs.iter().map(|r| (*r).clone()).collect::<Vec<_>>());
            let end_time = chrono::DateTime::from_timestamp_millis(end_ms)
                .map(|d| d.to_rfc3339())
                .unwrap_or_default();

            BucketData {
                id: first_ts.clone(),
                start_time: first_ts,
                end_time,
                is_active,
                request_count: recs.len() as u64,
                total_tokens,
                cost_usd: cost,
                burn_rate,
                models,
                projection,
            }
        })
        .collect();

    Ok(result)
}

/// Get unique project names
pub async fn get_project_list() -> Result<Vec<String>, String> {
    let mut projects: HashSet<String> = HashSet::new();
    for base in get_claude_paths() {
        if !base.exists() {
            continue;
        }
        if let Ok(entries) = std::fs::read_dir(&base) {
            for entry in entries.flatten() {
                if entry.path().is_dir() {
                    projects.insert(entry.file_name().to_string_lossy().to_string());
                }
            }
        }
    }
    let mut list: Vec<String> = projects.into_iter().collect();
    list.sort();
    Ok(list)
}
