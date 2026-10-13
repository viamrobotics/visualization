mod launch_config;

use std::sync::Mutex;
use tauri::{Emitter, Manager};

use launch_config::{LaunchConfigState, load_from_args};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(payload) = load_from_args(&argv) {
                if let Ok(mut current) = app.state::<LaunchConfigState>().0.lock() {
                    *current = Some(payload.clone());
                }
                let _ = app.emit("launch-config-changed", payload);
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
            app.manage(LaunchConfigState(Mutex::new(load_from_args(&args))));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
