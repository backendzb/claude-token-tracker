use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::Manager;

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

/// Install track-usage.cjs hook into ~/.claude/settings.json
pub fn install_hook(app_handle: &tauri::AppHandle) {
    let home = dirs::home_dir().unwrap_or_default();
    let settings_path = home.join(".claude").join("settings.json");
    let logs_dir = home.join(".claude").join("usage-logs");
    let state_dir = logs_dir.join(".state");

    // Find track-usage.cjs in resources
    let resource_path = app_handle
        .path()
        .resource_dir()
        .ok()
        .map(|d: PathBuf| d.join("track-usage.cjs"))
        .unwrap_or_default();

    // Fallback: look next to the executable
    let script_path = if resource_path.exists() {
        resource_path
    } else {
        let exe_dir = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.to_path_buf()))
            .unwrap_or_default();
        let p = exe_dir.join("track-usage.cjs");
        if p.exists() { p } else {
            // Dev mode: project root
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent().unwrap_or(std::path::Path::new(".")).join("track-usage.cjs")
        }
    };

    let hook_cmd = format!("node \"{}\"", script_path.to_string_lossy().replace('\\', "/"));

    // Read existing settings
    let mut settings: serde_json::Value = if settings_path.exists() {
        fs::read_to_string(&settings_path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    // Check if already installed
    if let Some(stops) = settings.get("hooks").and_then(|h| h.get("Stop")).and_then(|s| s.as_array()) {
        for entry in stops {
            if let Some(hooks) = entry.get("hooks").and_then(|h| h.as_array()) {
                for h in hooks {
                    if let Some(cmd) = h.get("command").and_then(|c| c.as_str()) {
                        if cmd.contains("track-usage.cjs") {
                            return; // Already installed
                        }
                    }
                }
            }
        }
    }

    // Install hook
    let hooks = settings.as_object_mut().unwrap();
    if !hooks.contains_key("hooks") {
        hooks.insert("hooks".to_string(), serde_json::json!({}));
    }
    let hooks_obj = hooks.get_mut("hooks").unwrap().as_object_mut().unwrap();
    if !hooks_obj.contains_key("Stop") {
        hooks_obj.insert("Stop".to_string(), serde_json::json!([]));
    }
    let stop_arr = hooks_obj.get_mut("Stop").unwrap().as_array_mut().unwrap();
    stop_arr.push(serde_json::json!({
        "hooks": [{
            "type": "command",
            "command": hook_cmd,
            "timeout": 5000
        }]
    }));

    // Ensure directories exist
    let _ = fs::create_dir_all(&state_dir);

    // Ensure .claude dir exists
    let claude_dir = home.join(".claude");
    let _ = fs::create_dir_all(&claude_dir);

    // Write settings
    if let Ok(json) = serde_json::to_string_pretty(&settings) {
        let _ = fs::write(&settings_path, json);
    }
}

/// Read Claude Code's stats-cache.json for quick stats
#[tauri::command]
pub fn get_stats_cache() -> Value {
    let home = dirs::home_dir().unwrap_or_default();
    let path = home.join(".claude").join("stats-cache.json");
    match fs::read_to_string(&path) {
        Ok(s) => serde_json::from_str(&s).unwrap_or(serde_json::json!(null)),
        Err(_) => serde_json::json!(null),
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
