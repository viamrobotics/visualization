use serde::Serialize;
use serde_json::Value;
use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};

const LAUNCH_FILE_FLAG: &str = "--launch-file";
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

/// Reads the launch file, deletes it whether or not parsing succeeds, then parses it.
/// Errors name the path and never include the file contents.
pub fn read_and_remove(path: &Path) -> Result<Value, String> {
    let display = path.display();
    let contents = fs::read_to_string(path)
        .map_err(|err| format!("Cannot read launch file {display}: {err}"))?;
    if let Err(err) = fs::remove_file(path) {
        eprintln!("Could not remove launch file {display}: {err}");
    }
    let value: Value = serde_json::from_str(&contents)
        .map_err(|_| format!("Cannot parse launch file {display} as JSON"))?;
    match value.get("version").and_then(Value::as_u64) {
        Some(SUPPORTED_VERSION) => Ok(value),
        Some(version) => Err(format!(
            "Launch file version {version} is not supported, expected {SUPPORTED_VERSION}"
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

/// Loads the launch file named in `args`, if any. Failures are logged to stderr and returned.
pub fn load_from_args(args: &[String]) -> Option<LaunchConfigPayload> {
    let path = find_launch_file(args)?;
    let result = read_and_remove(&path);
    if let Err(error) = &result {
        eprintln!("{error}");
    }
    Some(result.into())
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
    fn unsupported_version_errors_and_removes_file() {
        let path = temp_file(r#"{"version":2}"#);
        let error = read_and_remove(&path).unwrap_err();
        assert!(error.contains('2'), "{error}");
        assert!(!path.exists());
    }

    #[test]
    fn invalid_json_errors_and_removes_file() {
        let path = temp_file("not json");
        assert!(read_and_remove(&path).is_err());
        assert!(!path.exists());
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
