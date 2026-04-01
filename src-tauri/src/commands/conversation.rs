use serde::Serialize;
use serde_json::Value;
use std::collections::HashSet;
use std::path::PathBuf;
use tokio::io::{AsyncBufReadExt, BufReader};
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize)]
pub struct SessionIndex {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub project: String,
    #[serde(rename = "firstUserMsg")]
    pub first_user_msg: String,
    #[serde(rename = "firstTimestamp")]
    pub first_timestamp: String,
    #[serde(rename = "lastTimestamp")]
    pub last_timestamp: String,
    #[serde(rename = "msgCount")]
    pub msg_count: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ConversationMessage {
    pub role: String,
    pub content: String,
    pub timestamp: String,
    pub model: String,
    #[serde(rename = "toolCalls")]
    pub tool_calls: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ConversationData {
    pub messages: Vec<ConversationMessage>,
    pub project: String,
}

fn get_claude_paths() -> Vec<PathBuf> {
    let home = dirs::home_dir().unwrap_or_default();
    vec![
        home.join(".config").join("claude").join("projects"),
        home.join(".claude").join("projects"),
    ]
}

fn extract_project(path: &PathBuf) -> String {
    let components: Vec<_> = path.components().collect();
    for (i, comp) in components.iter().enumerate() {
        if comp.as_os_str() == "projects" && i + 1 < components.len() {
            return components[i + 1].as_os_str().to_string_lossy().to_string();
        }
    }
    "unknown".to_string()
}

fn find_jsonl_files(base: &PathBuf) -> Vec<PathBuf> {
    if !base.exists() {
        return vec![];
    }
    WalkDir::new(base)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().map_or(false, |ext| ext == "jsonl"))
        .map(|e| e.into_path())
        .collect()
}

fn extract_text(message: &Value) -> String {
    if let Some(content) = message.get("content") {
        if let Some(s) = content.as_str() {
            return s.to_string();
        }
        if let Some(arr) = content.as_array() {
            let mut texts = Vec::new();
            for block in arr {
                if let Some(t) = block.get("text").and_then(|t| t.as_str()) {
                    texts.push(t.to_string());
                }
            }
            return texts.join("\n");
        }
    }
    String::new()
}

fn extract_tool_calls(message: &Value) -> Vec<String> {
    let mut tools = Vec::new();
    if let Some(content) = message.get("content").and_then(|c| c.as_array()) {
        for block in content {
            if block.get("type").and_then(|t| t.as_str()) == Some("tool_use") {
                if let Some(name) = block.get("name").and_then(|n| n.as_str()) {
                    tools.push(name.to_string());
                }
            }
        }
    }
    tools
}

#[tauri::command]
pub async fn get_session_index() -> Result<Vec<SessionIndex>, String> {
    let mut all_files: Vec<PathBuf> = Vec::new();
    for base in get_claude_paths() {
        all_files.extend(find_jsonl_files(&base));
    }

    let mut sessions: Vec<SessionIndex> = Vec::new();
    let mut seen_ids: HashSet<String> = HashSet::new();

    for file_path in &all_files {
        let session_id = file_path.file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();

        if session_id.is_empty() || !seen_ids.insert(session_id.clone()) {
            continue;
        }

        let project = extract_project(file_path);
        let file = match tokio::fs::File::open(file_path).await {
            Ok(f) => f,
            Err(_) => continue,
        };

        let reader = BufReader::new(file);
        let mut lines = reader.lines();
        let mut first_user_msg = String::new();
        let mut first_ts = String::new();
        let mut last_ts = String::new();
        let mut count: u64 = 0;

        while let Ok(Some(line)) = lines.next_line().await {
            let obj: Value = match serde_json::from_str(&line) {
                Ok(v) => v,
                Err(_) => continue,
            };
            let msg_type = obj.get("type").and_then(|t| t.as_str()).unwrap_or("");
            if msg_type != "human" && msg_type != "user" && msg_type != "assistant" {
                continue;
            }
            count += 1;
            let ts = obj.get("timestamp")
                .or_else(|| obj.get("message").and_then(|m| m.get("timestamp")))
                .and_then(|t| t.as_str())
                .unwrap_or("")
                .to_string();
            if first_ts.is_empty() && !ts.is_empty() {
                first_ts = ts.clone();
            }
            if !ts.is_empty() {
                last_ts = ts;
            }
            if first_user_msg.is_empty() && (msg_type == "human" || msg_type == "user") {
                if let Some(msg) = obj.get("message") {
                    first_user_msg = extract_text(msg).chars().take(120).collect();
                }
            }
        }

        if count > 0 {
            sessions.push(SessionIndex {
                session_id,
                project,
                first_user_msg,
                first_timestamp: first_ts,
                last_timestamp: last_ts,
                msg_count: count,
            });
        }
    }

    sessions.sort_by(|a, b| b.last_timestamp.cmp(&a.last_timestamp));
    Ok(sessions)
}

#[tauri::command]
pub async fn load_conversation(session_id: String) -> Result<ConversationData, String> {
    let mut all_files: Vec<PathBuf> = Vec::new();
    for base in get_claude_paths() {
        all_files.extend(find_jsonl_files(&base));
    }

    let file_path = all_files.iter().find(|p| {
        p.file_stem().map(|s| s.to_string_lossy().to_string()) == Some(session_id.clone())
    });

    let file_path = match file_path {
        Some(p) => p.clone(),
        None => return Err("Session not found".to_string()),
    };

    let project = extract_project(&file_path);
    let file = tokio::fs::File::open(&file_path).await.map_err(|e| e.to_string())?;
    let reader = BufReader::new(file);
    let mut lines = reader.lines();
    let mut messages: Vec<ConversationMessage> = Vec::new();

    while let Ok(Some(line)) = lines.next_line().await {
        let obj: Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(_) => continue,
        };
        let msg_type = obj.get("type").and_then(|t| t.as_str()).unwrap_or("");
        let role = match msg_type {
            "human" | "user" => "user",
            "assistant" => "assistant",
            _ => continue,
        };

        let message = obj.get("message").unwrap_or(&obj);
        let content = extract_text(message);
        let ts = obj.get("timestamp")
            .or_else(|| message.get("timestamp"))
            .and_then(|t| t.as_str())
            .unwrap_or("")
            .to_string();
        let model = message.get("model").and_then(|m| m.as_str()).unwrap_or("").to_string();
        let tool_calls = extract_tool_calls(message);

        messages.push(ConversationMessage {
            role: role.to_string(),
            content,
            timestamp: ts,
            model,
            tool_calls,
        });
    }

    Ok(ConversationData { messages, project })
}
