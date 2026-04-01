use serde_json::Value;
use std::process::Command;

#[tauri::command]
pub fn get_pricing_map() -> Value {
    use crate::data::pricing::MODEL_PRICING;
    let mut map = serde_json::Map::new();
    for (name, price) in MODEL_PRICING.iter() {
        map.insert(name.to_string(), serde_json::json!({
            "input": price.input,
            "output": price.output,
            "cache_write": price.cache_write,
            "cache_read": price.cache_read,
        }));
    }
    Value::Object(map)
}

#[tauri::command]
pub async fn export_data(format: String, records: Vec<Value>) -> Result<String, String> {
    if format == "csv" {
        let mut out = String::from("\u{FEFF}时间,会话ID,模型,项目,Input,Output,Cache写,Cache读,费用\n");
        for r in &records {
            out.push_str(&format!(
                "{},{},{},{},{},{},{},{},{}\n",
                r.get("timestamp").and_then(|v| v.as_str()).unwrap_or(""),
                r.get("session_id").and_then(|v| v.as_str()).unwrap_or(""),
                r.get("model").and_then(|v| v.as_str()).unwrap_or(""),
                r.get("project").and_then(|v| v.as_str()).unwrap_or(""),
                r.get("input_tokens").and_then(|v| v.as_u64()).unwrap_or(0),
                r.get("output_tokens").and_then(|v| v.as_u64()).unwrap_or(0),
                r.get("cache_creation_input_tokens").and_then(|v| v.as_u64()).unwrap_or(0),
                r.get("cache_read_input_tokens").and_then(|v| v.as_u64()).unwrap_or(0),
                r.get("cost_usd").and_then(|v| v.as_f64()).unwrap_or(0.0),
            ));
        }
        Ok(out)
    } else {
        serde_json::to_string_pretty(&records).map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn switch_context(session_id: String, cwd: String) -> Result<Value, String> {
    let target_cwd = if !cwd.is_empty() && std::path::Path::new(&cwd).exists() {
        cwd
    } else {
        dirs::home_dir().unwrap_or_default().to_string_lossy().to_string()
    };

    // Write a temp .bat file to avoid Windows quoting issues
    let bat_content = format!("@echo off\ncd /d \"{}\"\nclaude --resume {}\n", target_cwd, session_id);
    let bat_path = std::env::temp_dir().join(format!("claude-resume-{}.bat", chrono::Utc::now().timestamp_millis()));
    std::fs::write(&bat_path, &bat_content).map_err(|e| e.to_string())?;

    Command::new("cmd")
        .args(["/c", "start", &format!("Claude - {}", &session_id[..8.min(session_id.len())]), "cmd", "/k", &bat_path.to_string_lossy()])
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({"success": true}))
}
