use std::{fs, sync::Mutex, sync::mpsc, time::Duration};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_shell::{ShellExt, process::CommandChild, process::CommandEvent};

const PORT_LINE_PREFIX: &str = "draw-server: listening on http://127.0.0.1:";
const STARTUP_TIMEOUT: Duration = Duration::from_secs(10);

pub struct DrawServer {
    port: u16,
    child: CommandChild,
}

#[derive(Default)]
pub struct DrawServerState(pub Mutex<Option<DrawServer>>);

/// Port 0 is rejected: it would mean the server never bound a real socket.
pub fn parse_port_line(line: &str) -> Option<u16> {
    let port = line
        .trim_end_matches(['\r', '\n'])
        .strip_prefix(PORT_LINE_PREFIX)?
        .parse::<u16>()
        .ok()?;
    (port != 0).then_some(port)
}

pub fn spawn(app: &AppHandle) -> Result<DrawServer, String> {
    let tmp_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("draw-tmp");
    fs::create_dir_all(&tmp_dir).map_err(|e| e.to_string())?;

    let (mut events, child) = app
        .shell()
        .sidecar("draw-server")
        .map_err(|e| e.to_string())?
        // Tauri never reaps sidecars on SIGTERM; the server exits when our stdin pipe closes.
        .args([
            "-port",
            "0",
            "-tmp-dir",
            &tmp_dir.to_string_lossy(),
            "-exit-on-stdin-close",
        ])
        .spawn()
        .map_err(|e| e.to_string())?;

    // The receiver is async; a std channel lets this sync caller bound the wait.
    let (port_tx, port_rx) = mpsc::channel();
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut port_tx = Some(port_tx);
        while let Some(event) = events.recv().await {
            match event {
                CommandEvent::Stdout(bytes) => {
                    let text = String::from_utf8_lossy(&bytes);
                    match port_tx.as_ref().and_then(|_| parse_port_line(&text)) {
                        Some(port) => {
                            if let Some(tx) = port_tx.take() {
                                let _ = tx.send(port);
                            }
                        }
                        None => log::info!(target: "draw-server", "{}", text.trim_end()),
                    }
                }
                CommandEvent::Stderr(bytes) => {
                    log::info!(target: "draw-server", "{}", String::from_utf8_lossy(&bytes).trim_end());
                }
                CommandEvent::Terminated(payload) => {
                    log::warn!("draw-server terminated: {payload:?}");
                    // Clearing the state makes draw_service_port answer null.
                    if let Ok(mut current) = handle.state::<DrawServerState>().0.lock() {
                        *current = None;
                    }
                    break;
                }
                _ => {}
            }
        }
    });

    match port_rx.recv_timeout(STARTUP_TIMEOUT) {
        Ok(port) => Ok(DrawServer { port, child }),
        Err(_) => {
            let _ = child.kill();
            Err("draw-server did not report a port in time".into())
        }
    }
}

#[tauri::command]
pub fn draw_service_port(state: State<DrawServerState>) -> Option<u16> {
    state.0.lock().ok()?.as_ref().map(|server| server.port)
}

pub fn kill(state: &DrawServerState) {
    if let Ok(mut current) = state.0.lock()
        && let Some(server) = current.take()
    {
        let _ = server.child.kill();
    }
}

#[cfg(test)]
mod tests {
    use super::parse_port_line;

    #[test]
    fn parses_contract_line() {
        assert_eq!(
            parse_port_line("draw-server: listening on http://127.0.0.1:59696"),
            Some(59696)
        );
    }

    #[test]
    fn tolerates_trailing_crlf() {
        assert_eq!(
            parse_port_line("draw-server: listening on http://127.0.0.1:59696\r\n"),
            Some(59696)
        );
    }

    #[test]
    fn rejects_port_zero() {
        assert_eq!(
            parse_port_line("draw-server: listening on http://127.0.0.1:0"),
            None
        );
    }

    #[test]
    fn rejects_stderr_log_line() {
        assert_eq!(
            parse_port_line(
                "2026/10/19 10:27:44 draw server Connect-RPC on http://localhost:59696"
            ),
            None
        );
    }
}
