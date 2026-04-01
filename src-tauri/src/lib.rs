mod commands;
mod data;

use commands::{usage, settings, conversation, system};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

/// Shared app state
struct AppState {
    float_visible: Arc<Mutex<bool>>,
}

/// Setup system tray with context menu
fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let show_i = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
    let quit_i = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("Claude Token Tracker")
        .menu(&menu)
        .on_menu_event(|app, event| {
            match event.id().as_ref() {
                "show" => {
                    if let Some(win) = app.get_webview_window("main") {
                        let _ = win.show();
                        let _ = win.set_focus();
                    }
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let tauri::tray::TrayIconEvent::DoubleClick { .. } = event {
                let app = tray.app_handle();
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}

/// Register global shortcuts
fn register_shortcuts(app: &tauri::AppHandle) {
    // Unregister all first
    let _ = app.global_shortcut().unregister_all();

    // Read settings for shortcut config
    let settings: serde_json::Value = commands::settings::get_settings();
    let main_key = settings.get("shortcut")
        .and_then(|v| v.as_str())
        .unwrap_or("Ctrl+Shift+T")
        .to_string();

    let float_key = settings.get("floatShortcut")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    // Main window toggle shortcut
    let app_clone = app.clone();
    if let Ok(shortcut) = main_key.parse::<tauri_plugin_global_shortcut::Shortcut>() {
        let _ = app.global_shortcut().on_shortcut(shortcut, move |_app, _sc, event| {
            if event.state == ShortcutState::Pressed {
                if let Some(win) = app_clone.get_webview_window("main") {
                    if win.is_visible().unwrap_or(false) && win.is_focused().unwrap_or(false) {
                        let _ = win.hide();
                    } else {
                        let _ = win.show();
                        let _ = win.set_focus();
                    }
                }
            }
        });
    }

    // Float window toggle shortcut
    if !float_key.is_empty() {
        let app_clone2 = app.clone();
        if let Ok(shortcut) = float_key.parse::<tauri_plugin_global_shortcut::Shortcut>() {
            let _ = app.global_shortcut().on_shortcut(shortcut, move |_app, _sc, event| {
                if event.state == ShortcutState::Pressed {
                    let state = app_clone2.state::<AppState>();
                    let visible = toggle_float(&app_clone2, &state);
                    let _ = app_clone2.emit("float-toggled", visible);
                }
            });
        }
    }
}

/// Start file watcher for JSONL changes
fn start_file_watcher(app_handle: tauri::AppHandle) {
    std::thread::spawn(move || {
        use notify::{Watcher, RecursiveMode, Event};
        use std::sync::mpsc;

        let (tx, rx) = mpsc::channel::<notify::Result<Event>>();
        let mut watcher = match notify::recommended_watcher(tx) {
            Ok(w) => w,
            Err(e) => { eprintln!("[watcher] Failed to create: {}", e); return; }
        };

        let home = dirs::home_dir().unwrap_or_default();
        let watch_dirs = vec![
            home.join(".config").join("claude").join("projects"),
            home.join(".claude").join("projects"),
        ];

        for dir in &watch_dirs {
            if dir.exists() {
                let _ = watcher.watch(dir, RecursiveMode::Recursive);
            }
        }

        let mut last_emit = Instant::now();
        let debounce = Duration::from_secs(2);

        loop {
            match rx.recv_timeout(Duration::from_secs(1)) {
                Ok(Ok(event)) => {
                    let is_jsonl = event.paths.iter().any(|p: &PathBuf| {
                        p.extension().map_or(false, |e| e == "jsonl")
                    });
                    if is_jsonl && last_emit.elapsed() > debounce {
                        last_emit = Instant::now();
                        let _ = app_handle.emit("data-changed", ());
                    }
                }
                Ok(Err(e)) => eprintln!("[watcher] Error: {}", e),
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {}
                Err(_) => break,
            }
        }
    });
}

/// Toggle float window visibility (pre-created in tauri.conf.json)
fn toggle_float(app: &tauri::AppHandle, state: &AppState) -> bool {
    let mut visible = state.float_visible.lock().unwrap();

    if let Some(win) = app.get_webview_window("float") {
        if *visible {
            let _ = win.hide();
            *visible = false;
        } else {
            let _ = win.show();
            let _ = win.set_focus();
            *visible = true;
        }
    }
    *visible
}

#[tauri::command]
fn toggle_float_window(app: tauri::AppHandle, state: tauri::State<'_, AppState>) -> serde_json::Value {
    let visible = toggle_float(&app, &state);
    serde_json::json!({"visible": visible})
}

#[tauri::command]
fn get_float_visible(state: tauri::State<'_, AppState>) -> bool {
    *state.float_visible.lock().unwrap()
}

#[tauri::command]
fn float_set_always_on_top(app: tauri::AppHandle, flag: bool) {
    if let Some(win) = app.get_webview_window("float") {
        let _ = win.set_always_on_top(flag);
    }
}

/// Re-register shortcuts (called from frontend after settings change)
#[tauri::command]
fn register_shortcuts_cmd(app: tauri::AppHandle) {
    register_shortcuts(&app);
}

/// Hide main window to tray
#[tauri::command]
fn hide_to_tray(app: tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.hide();
    }
}

/// Quit app
#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(AppState {
            float_visible: Arc::new(Mutex::new(false)),
        })
        .invoke_handler(tauri::generate_handler![
            usage::get_usage,
            usage::get_projects,
            usage::get_sessions,
            usage::get_buckets,
            usage::get_time_buckets,
            usage::get_version,
            settings::get_settings,
            settings::save_settings,
            conversation::get_session_index,
            conversation::load_conversation,
            system::get_pricing_map,
            system::export_data,
            system::get_stats_cache,
            system::switch_context,
            toggle_float_window,
            get_float_visible,
            float_set_always_on_top,
            register_shortcuts_cmd,
            hide_to_tray,
            quit_app,
        ])
        .setup(|app| {
            setup_tray(app)?;
            start_file_watcher(app.handle().clone());
            register_shortcuts(app.handle());

            // Auto-install track-usage hook on first launch
            system::install_hook(app.handle());

            // Intercept close → let frontend handle with dialog
            let main_win = app.get_webview_window("main").unwrap();
            let app_handle = app.handle().clone();
            main_win.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    // Emit event to frontend to show dialog
                    let _ = app_handle.emit("close-requested", ());
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
