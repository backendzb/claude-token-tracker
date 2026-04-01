use serde_json::Value;
use std::fs;
use std::path::PathBuf;

fn settings_path() -> PathBuf {
    let data_dir = dirs::config_dir()
        .unwrap_or_else(|| dirs::home_dir().unwrap_or_default())
        .join("com.claude.token-tracker");
    fs::create_dir_all(&data_dir).ok();
    data_dir.join("settings.json")
}

#[tauri::command]
pub fn get_settings() -> Value {
    let path = settings_path();
    match fs::read_to_string(&path) {
        Ok(s) => serde_json::from_str(&s).unwrap_or(serde_json::json!({
            "dailyBudget": 0, "monthlyBudget": 0, "requestThreshold": 0,
            "shortcut": "Ctrl+Shift+T", "floatShortcut": "", "theme": "dark", "floatOpacity": 0.9
        })),
        Err(_) => serde_json::json!({
            "dailyBudget": 0, "monthlyBudget": 0, "requestThreshold": 0,
            "shortcut": "Ctrl+Shift+T", "floatShortcut": "", "theme": "dark", "floatOpacity": 0.9
        }),
    }
}

#[tauri::command]
pub fn save_settings(settings: Value) -> Result<Value, String> {
    let path = settings_path();
    let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({"success": true}))
}
