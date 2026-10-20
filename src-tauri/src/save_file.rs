use tauri::{
    AppHandle,
    ipc::{InvokeBody, Request},
};
use tauri_plugin_dialog::DialogExt;

const FILE_NAME_HEADER: &str = "x-file-name";

/// Shows a native save dialog and writes the raw IPC body to the chosen path.
/// Returns the saved path, or `None` when the user cancels.
#[tauri::command]
pub async fn save_file(app: AppHandle, request: Request<'_>) -> Result<Option<String>, String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("save_file expects a raw byte body".to_string());
    };
    let file_name = request
        .headers()
        .get(FILE_NAME_HEADER)
        .and_then(|value| value.to_str().ok())
        .filter(|name| !name.is_empty())
        .ok_or_else(|| format!("save_file requires a {FILE_NAME_HEADER} header"))?;

    let Some(file_path) = app
        .dialog()
        .file()
        .set_file_name(file_name)
        .blocking_save_file()
    else {
        return Ok(None);
    };
    let path = file_path.into_path().map_err(|e| e.to_string())?;
    std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(Some(path.to_string_lossy().into_owned()))
}
