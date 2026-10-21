use serde::Serialize;
use serde_json::Value;
use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::{AppHandle, Emitter, Manager};

const LAUNCH_FILE_FLAG: &str = "--launch-file";
const LAUNCH_CONFIG_EVENT: &str = "launch-config-changed";
const SUPPORTED_VERSION: u64 = 1;

/// Returns the path given as `--launch-file <path>` or `--launch-file=path`.
pub fn find_launch_file(args: &[String]) -> Option<PathBuf> {
    let inline_prefix = format!("{LAUNCH_FILE_FLAG}=");
    let mut remaining = args.iter();
    while let Some(arg) = remaining.next() {
        if arg == LAUNCH_FILE_FLAG {
            return remaining.next().map(PathBuf::from);
        }
        if let Some(path) = arg.strip_prefix(&inline_prefix) {
            return Some(PathBuf::from(path));
        }
    }
    None
}

/// Reads and parses the launch file. Deletes it once it parses as a JSON object with a
/// `version` key, supported or not, so the token does not outlive the read. Anything else
/// stays on disk, since the path may name a file that was never a launch file.
/// Errors name the path and never include the file contents.
pub fn read_and_remove(path: &Path) -> Result<Value, String> {
    let display = path.display();
    let contents = fs::read_to_string(path)
        .map_err(|err| format!("Cannot read launch file {display}: {err}"))?;
    let value: Value = serde_json::from_str(&contents)
        .map_err(|_| format!("Cannot parse launch file {display} as JSON"))?;
    let version = match value.as_object().and_then(|object| object.get("version")) {
        Some(version) => version.as_u64(),
        None => return Err(format!("{display} is not a launch file, it has no version")),
    };
    if let Err(err) = fs::remove_file(path) {
        eprintln!("Could not remove launch file {display}: {err}");
    }
    match version {
        Some(SUPPORTED_VERSION) => Ok(value),
        Some(version) => Err(format!(
            "Launch file {display} version {version} is not supported, expected {SUPPORTED_VERSION}"
        )),
        None => Err(format!(
            "Launch file {display} has no integer version, expected {SUPPORTED_VERSION}"
        )),
    }
}

/// Exactly one field is set.
#[derive(Clone, Serialize)]
pub struct LaunchConfigPayload {
    pub config: Option<Value>,
    pub error: Option<String>,
}

impl From<Result<Value, String>> for LaunchConfigPayload {
    fn from(result: Result<Value, String>) -> Self {
        match result {
            Ok(config) => Self {
                config: Some(config),
                error: None,
            },
            Err(error) => Self {
                config: None,
                error: Some(error),
            },
        }
    }
}

pub struct LaunchConfigState(pub Mutex<Option<LaunchConfigPayload>>);

/// Returns the current launch payload, or `None` when the app started without `--launch-file`.
#[tauri::command]
pub fn launch_config(state: tauri::State<'_, LaunchConfigState>) -> Option<LaunchConfigPayload> {
    state.0.lock().ok().and_then(|payload| payload.clone())
}

/// Loads the launch file named in `args`, if any. A relative path resolves against `cwd`,
/// the directory the launch ran from, which differs from this process's on a relaunch.
pub fn load_from_args(args: &[String], cwd: &Path) -> Option<LaunchConfigPayload> {
    let path = cwd.join(find_launch_file(args)?);
    Some(load_from_path(&path))
}

/// Loads the launch file at `path`. Failures are logged to stderr and returned.
pub fn load_from_path(path: &Path) -> LaunchConfigPayload {
    let result = read_and_remove(path);
    if let Err(error) = &result {
        eprintln!("{error}");
    }
    result.into()
}

/// Stores `payload` as the current launch config and tells the window it changed.
pub fn replace(app: &AppHandle, payload: LaunchConfigPayload) {
    if let Ok(mut current) = app.state::<LaunchConfigState>().0.lock() {
        *current = Some(payload.clone());
    }
    let _ = app.emit(LAUNCH_CONFIG_EVENT, payload);
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};

    fn strings(args: &[&str]) -> Vec<String> {
        args.iter().map(|arg| arg.to_string()).collect()
    }

    fn temp_file(contents: &str) -> PathBuf {
        static COUNTER: AtomicU32 = AtomicU32::new(0);
        let id = COUNTER.fetch_add(1, Ordering::SeqCst);
        let path = std::env::temp_dir().join(format!(
            "launch-config-test-{}-{id}.json",
            std::process::id()
        ));
        fs::write(&path, contents).unwrap();
        path
    }

    #[test]
    fn finds_separate_value() {
        let args = strings(&["app", "--launch-file", "/tmp/a.json"]);
        assert_eq!(find_launch_file(&args), Some(PathBuf::from("/tmp/a.json")));
    }

    #[test]
    fn finds_equals_value() {
        let args = strings(&["app", "--launch-file=/tmp/b.json"]);
        assert_eq!(find_launch_file(&args), Some(PathBuf::from("/tmp/b.json")));
    }

    #[test]
    fn missing_value_is_none() {
        assert_eq!(find_launch_file(&strings(&["app", "--launch-file"])), None);
        assert_eq!(find_launch_file(&strings(&["app"])), None);
    }

    #[test]
    fn version_one_round_trips_and_removes_file() {
        let path = temp_file(r#"{"version":1,"host":"h"}"#);
        let value = read_and_remove(&path).unwrap();
        assert_eq!(value["host"], "h");
        assert!(!path.exists());
    }

    #[test]
    fn unsupported_version_errors_with_path_and_removes_file() {
        let path = temp_file(r#"{"version":2}"#);
        let error = read_and_remove(&path).unwrap_err();
        assert!(error.contains("version 2"), "{error}");
        assert!(error.contains(&path.display().to_string()), "{error}");
        assert!(!path.exists());
    }

    #[test]
    fn non_integer_version_errors_and_removes_file() {
        let path = temp_file(r#"{"version":"1"}"#);
        assert!(read_and_remove(&path).is_err());
        assert!(!path.exists());
    }

    #[test]
    fn invalid_json_errors_and_keeps_file() {
        let path = temp_file("not json");
        assert!(read_and_remove(&path).is_err());
        assert!(path.exists());
        fs::remove_file(path).unwrap();
    }

    #[test]
    fn json_without_version_errors_and_keeps_file() {
        let path = temp_file(r#"{"host":"h"}"#);
        let error = read_and_remove(&path).unwrap_err();
        assert!(error.contains("not a launch file"), "{error}");
        assert!(path.exists());
        fs::remove_file(path).unwrap();
    }

    #[test]
    fn relative_path_resolves_against_cwd() {
        let path = temp_file(r#"{"version":1}"#);
        let name = path.file_name().unwrap().to_str().unwrap();
        let cwd = path.parent().unwrap();
        let payload = load_from_args(&strings(&["app", "--launch-file", name]), cwd).unwrap();
        assert!(payload.config.is_some(), "{:?}", payload.error);
        assert!(!path.exists());
    }

    #[test]
    fn absolute_path_ignores_cwd() {
        let path = temp_file(r#"{"version":1}"#);
        let args = strings(&["app", "--launch-file", path.to_str().unwrap()]);
        let payload = load_from_args(&args, Path::new("/does-not-exist")).unwrap();
        assert!(payload.config.is_some(), "{:?}", payload.error);
    }

    #[test]
    fn missing_path_error_names_path() {
        let path = std::env::temp_dir().join("launch-config-test-does-not-exist.json");
        let error = read_and_remove(&path).unwrap_err();
        assert!(
            error.contains("launch-config-test-does-not-exist"),
            "{error}"
        );
    }
}
