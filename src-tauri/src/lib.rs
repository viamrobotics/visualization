mod launch_config;

use std::{path::Path, sync::Mutex};
use tauri::{AppHandle, Manager, RunEvent};

use launch_config::{LaunchConfigState, load_from_args};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            if let Some(payload) = load_from_args(&argv, Path::new(&cwd)) {
                launch_config::replace(app, payload);
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .invoke_handler(tauri::generate_handler![launch_config::launch_config])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            let args: Vec<String> = std::env::args().collect();
            let cwd = std::env::current_dir().unwrap_or_default();
            app.manage(LaunchConfigState(Mutex::new(load_from_args(&args, &cwd))));
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(handle_run_event);
}

/// `open -a <app> <file>` hands macOS apps the file as an open event, not argv, and a
/// relaunch through `open` drops `--args` entirely. Treat an opened file as a launch file.
#[cfg(target_os = "macos")]
fn handle_run_event(app: &AppHandle, event: RunEvent) {
    if let RunEvent::Opened { urls } = event
        && let Some(path) = urls.iter().rev().find_map(|url| url.to_file_path().ok())
    {
        launch_config::replace(app, launch_config::load_from_path(&path));
    }
}

#[cfg(not(target_os = "macos"))]
fn handle_run_event(_app: &AppHandle, _event: RunEvent) {}
