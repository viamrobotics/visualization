mod draw_server;
mod launch_config;
mod save_file;

use std::sync::Mutex;
use tauri::{Emitter, Manager};

use draw_server::DrawServerState;
use launch_config::{LaunchConfigState, load_from_args};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
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
        .invoke_handler(tauri::generate_handler![
            launch_config::launch_config,
            draw_server::draw_service_port,
            save_file::save_file
        ])
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
            app.manage(DrawServerState::default());
            // Debug runs already get a server from `pnpm dev`; opt in to test the sidecar.
            if !cfg!(debug_assertions) || std::env::var_os("VIAM_VISUALIZER_SIDECAR").is_some() {
                match draw_server::spawn(app.handle()) {
                    Ok(server) => {
                        if let Ok(mut current) = app.state::<DrawServerState>().0.lock() {
                            *current = Some(server);
                        }
                    }
                    Err(e) => log::error!("failed to start draw-server: {e}"),
                }
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    // Tauri does not reap sidecars, so kill on both exit events.
    app.run(|app, event| {
        if matches!(
            event,
            tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit
        ) {
            draw_server::kill(&app.state());
        }
    });
}
