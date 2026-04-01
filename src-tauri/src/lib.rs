mod commands;
mod data;

use commands::{usage, settings, conversation, system};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager, WebviewWindowBuilder, WebviewUrl,
};

/// Shared app state
struct AppState {
    float_visible: Mutex<bool>,
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

/// Toggle float window (create or destroy)
fn toggle_float(app: &tauri::AppHandle, state: &AppState) -> bool {
    let mut visible = state.float_visible.lock().unwrap();

    if *visible {
        // Close float window
        if let Some(win) = app.get_webview_window("float") {
            let _ = win.close();
        }
        *visible = false;
        false
    } else {
        // Create float window
        let url = WebviewUrl::App("index.html".into());
        if let Ok(win) = WebviewWindowBuilder::new(app, "float", url)
            .title("API 费用")
            .inner_size(200.0, 168.0)
            .resizable(false)
            .decorations(false)
            .transparent(true)
            .always_on_top(true)
            .skip_taskbar(true)
            .build()
        {
            // Navigate to float route
            let _ = win.eval("window.location.hash = '#/float'");
            *visible = true;
        }
        *visible
    }
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
            float_visible: Mutex::new(false),
        })
        .invoke_handler(tauri::generate_handler![
            // Data
            usage::get_usage,
            usage::get_projects,
            usage::get_sessions,
            usage::get_buckets,
            usage::get_version,
            // Settings
            settings::get_settings,
            settings::save_settings,
            // Conversations
            conversation::get_session_index,
            conversation::load_conversation,
            // System
            system::get_pricing_map,
            system::export_data,
            // Float
            toggle_float_window,
            get_float_visible,
        ])
        .setup(|app| {
            // System tray
            setup_tray(app)?;

            // File watcher
            start_file_watcher(app.handle().clone());

            // Window close → hide to tray (intercept close on main window)
            let main_win = app.get_webview_window("main").unwrap();
            let win_clone = main_win.clone();
            main_win.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = win_clone.hide();
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
