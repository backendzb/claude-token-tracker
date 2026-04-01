use serde_json::Value;

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
