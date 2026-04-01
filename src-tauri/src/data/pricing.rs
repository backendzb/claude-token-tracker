use std::collections::HashMap;
use std::sync::LazyLock;

#[derive(Debug, Clone)]
pub struct ModelPrice {
    pub input: f64,
    pub output: f64,
    pub cache_write: f64,
    pub cache_read: f64,
    pub input_above_200k: Option<f64>,
    pub output_above_200k: Option<f64>,
    pub cache_write_above_200k: Option<f64>,
    pub cache_read_above_200k: Option<f64>,
    pub fast_multiplier: Option<f64>,
}

const TIERED_THRESHOLD: u64 = 200_000;

pub static MODEL_PRICING: LazyLock<HashMap<&'static str, ModelPrice>> = LazyLock::new(|| {
    let mut m = HashMap::new();

    // Opus 4.6 (1M context) — $5/$25 per M
    let opus46 = ModelPrice {
        input: 5e-6, output: 25e-6, cache_write: 6.25e-6, cache_read: 5e-7,
        input_above_200k: Some(1e-5), output_above_200k: Some(37.5e-6),
        cache_write_above_200k: Some(12.5e-6), cache_read_above_200k: Some(1e-6),
        fast_multiplier: Some(6.0),
    };
    m.insert("claude-opus-4-6", opus46.clone());
    m.insert("claude-opus-4-6-20260205", opus46);

    // Opus 4.5 — $5/$25 per M
    let opus45 = ModelPrice {
        input: 5e-6, output: 25e-6, cache_write: 6.25e-6, cache_read: 5e-7,
        input_above_200k: None, output_above_200k: None,
        cache_write_above_200k: None, cache_read_above_200k: None,
        fast_multiplier: None,
    };
    m.insert("claude-opus-4-5", opus45.clone());
    m.insert("claude-opus-4-5-20250918", opus45);

    // Opus 4 (200K context) — $15/$75 per M
    let opus4 = ModelPrice {
        input: 15e-6, output: 75e-6, cache_write: 18.75e-6, cache_read: 1.5e-6,
        input_above_200k: None, output_above_200k: None,
        cache_write_above_200k: None, cache_read_above_200k: None,
        fast_multiplier: None,
    };
    m.insert("claude-opus-4-0", opus4.clone());
    m.insert("claude-opus-4-0-20250514", opus4);

    // Sonnet 4.6 — $3/$15 per M
    let sonnet46 = ModelPrice {
        input: 3e-6, output: 15e-6, cache_write: 3.75e-6, cache_read: 3e-7,
        input_above_200k: Some(6e-6), output_above_200k: Some(22.5e-6),
        cache_write_above_200k: Some(7.5e-6), cache_read_above_200k: Some(6e-7),
        fast_multiplier: None,
    };
    m.insert("claude-sonnet-4-6", sonnet46.clone());
    m.insert("claude-sonnet-4-6-20260205", sonnet46);

    // Sonnet 4.5 — $3/$15 per M
    let sonnet45 = ModelPrice {
        input: 3e-6, output: 15e-6, cache_write: 3.75e-6, cache_read: 3e-7,
        input_above_200k: None, output_above_200k: None,
        cache_write_above_200k: None, cache_read_above_200k: None,
        fast_multiplier: None,
    };
    m.insert("claude-sonnet-4-5", sonnet45.clone());
    m.insert("claude-sonnet-4-5-20250514", sonnet45);

    // Haiku 4.5 — $1/$5 per M
    let haiku45 = ModelPrice {
        input: 1e-6, output: 5e-6, cache_write: 1.25e-6, cache_read: 1e-7,
        input_above_200k: None, output_above_200k: None,
        cache_write_above_200k: None, cache_read_above_200k: None,
        fast_multiplier: None,
    };
    m.insert("claude-haiku-4-5", haiku45.clone());
    m.insert("claude-haiku-4-5-20251001", haiku45);

    // Sonnet 3.5 — $3/$15 per M
    let sonnet35 = ModelPrice {
        input: 3e-6, output: 15e-6, cache_write: 3.75e-6, cache_read: 3e-7,
        input_above_200k: None, output_above_200k: None,
        cache_write_above_200k: None, cache_read_above_200k: None,
        fast_multiplier: None,
    };
    m.insert("claude-3-5-sonnet", sonnet35.clone());
    m.insert("claude-3-5-sonnet-20241022", sonnet35);

    // Haiku 3.5 — $0.8/$4 per M
    let haiku35 = ModelPrice {
        input: 8e-7, output: 4e-6, cache_write: 1e-6, cache_read: 8e-8,
        input_above_200k: None, output_above_200k: None,
        cache_write_above_200k: None, cache_read_above_200k: None,
        fast_multiplier: None,
    };
    m.insert("claude-3-5-haiku", haiku35.clone());
    m.insert("claude-3-5-haiku-20241022", haiku35);

    m
});

fn tiered_cost(tokens: u64, base: f64, tiered: Option<f64>) -> f64 {
    if tokens == 0 {
        return 0.0;
    }
    match tiered {
        Some(above_price) if tokens > TIERED_THRESHOLD => {
            let below = TIERED_THRESHOLD as f64 * base;
            let above = (tokens - TIERED_THRESHOLD) as f64 * above_price;
            below + above
        }
        _ => tokens as f64 * base,
    }
}

pub fn get_pricing(model_name: &str) -> Option<&ModelPrice> {
    // Exact match
    if let Some(p) = MODEL_PRICING.get(model_name) {
        return Some(p);
    }
    // Prefix match
    for (key, price) in MODEL_PRICING.iter() {
        if model_name.starts_with(key) {
            return Some(price);
        }
    }
    // Fuzzy: extract keywords
    let keywords: Vec<&str> = model_name.split(|c: char| c == '-' || c == '_').collect();
    for (key, price) in MODEL_PRICING.iter() {
        if keywords.iter().any(|kw| key.contains(kw) && kw.len() > 3) {
            return Some(price);
        }
    }
    None
}

pub fn calculate_cost(
    input_tokens: u64,
    output_tokens: u64,
    cache_write: u64,
    cache_read: u64,
    model_name: &str,
    speed: &str,
) -> f64 {
    let pricing = match get_pricing(model_name) {
        Some(p) => p,
        None => return 0.0,
    };

    let input_cost = tiered_cost(input_tokens, pricing.input, pricing.input_above_200k);
    let output_cost = tiered_cost(output_tokens, pricing.output, pricing.output_above_200k);
    let cw_cost = tiered_cost(cache_write, pricing.cache_write, pricing.cache_write_above_200k);
    let cr_cost = tiered_cost(cache_read, pricing.cache_read, pricing.cache_read_above_200k);

    let mut total = input_cost + output_cost + cw_cost + cr_cost;

    // Fast mode multiplier
    if speed == "fast" {
        if let Some(mult) = pricing.fast_multiplier {
            total *= mult;
        }
    }

    (total * 10000.0).round() / 10000.0
}
