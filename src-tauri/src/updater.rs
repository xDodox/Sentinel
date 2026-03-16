use crate::app_dir;
use std::fs;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Emitter;

static SCRIPT_WATCHER_ACTIVE: AtomicBool = AtomicBool::new(false);

#[tauri::command]
pub fn open_scripts_folder() -> Result<(), String> {
    let path = app_dir().join("scripts");
    let _ = fs::create_dir_all(&path);
    #[cfg(windows)]
    std::process::Command::new("explorer.exe")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("Failed to open folder: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn open_autoexec_folder() -> Result<(), String> {
    let path = dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("_Sentinel")
        .join("autoexe");
    let _ = fs::create_dir_all(&path);
    #[cfg(windows)]
    std::process::Command::new("explorer.exe")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("Failed to open folder: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn start_script_watcher(handle: tauri::AppHandle) {
    if SCRIPT_WATCHER_ACTIVE.load(Ordering::SeqCst) {
        return;
    }
    SCRIPT_WATCHER_ACTIVE.store(true, Ordering::SeqCst);
    let scripts_dir = app_dir().join("scripts");
    let _ = fs::create_dir_all(&scripts_dir);
    std::thread::spawn(move || {
        let mut last: Vec<(String, std::time::SystemTime)> = Vec::new();
        loop {
            if !SCRIPT_WATCHER_ACTIVE.load(Ordering::SeqCst) {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(1500));
            let mut snap: Vec<(String, std::time::SystemTime)> = fs::read_dir(&scripts_dir)
                .ok()
                .map(|e| {
                    e.filter_map(|e| e.ok())
                        .filter_map(|e| {
                            let n = e.file_name().to_string_lossy().to_string();
                            if n.ends_with(".lua") || n.ends_with(".luau") {
                                let m = e
                                    .metadata()
                                    .ok()
                                    .and_then(|m| m.modified().ok())
                                    .unwrap_or(std::time::UNIX_EPOCH);
                                Some((n, m))
                            } else {
                                None
                            }
                        })
                        .collect()
                })
                .unwrap_or_default();
            snap.sort_by(|a, b| a.0.cmp(&b.0));
            if snap != last {
                last = snap;
                let _ = handle.emit("scripts-changed", ());
            }
        }
        SCRIPT_WATCHER_ACTIVE.store(false, Ordering::SeqCst);
    });
}

fn parse_semver(v: &str) -> (u32, u32, u32) {
    let v = v.trim_start_matches('v');
    let mut parts = v.splitn(3, '.');
    let major = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0);
    let minor = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0);
    let patch = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0);
    (major, minor, patch)
}

#[derive(serde::Serialize)]
pub struct UpdateInfo {
    pub available: bool,
    pub version: String,
    pub url: String,
    pub notes: String,
}

#[tauri::command]
pub async fn check_app_update() -> Result<UpdateInfo, String> {
    let client = reqwest::Client::builder()
        .user_agent("Sentinel/1.0")
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let res: serde_json::Value = client
        .get("https://api.github.com/repos/xDodox/Sentinel/releases/latest")
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let latest = res["tag_name"]
        .as_str()
        .unwrap_or("0.0.0")
        .trim_start_matches('v')
        .to_string();

    let current = env!("CARGO_PKG_VERSION");
    let available = parse_semver(&latest) > parse_semver(current);

    let url = res["assets"]
        .as_array()
        .and_then(|a| {
            a.iter().find(|x| {
                x["name"]
                    .as_str()
                    .map(|n| n.ends_with(".exe"))
                    .unwrap_or(false)
            })
        })
        .and_then(|a| a["browser_download_url"].as_str())
        .unwrap_or("")
        .to_string();

    let notes: String = res["body"]
        .as_str()
        .unwrap_or("")
        .chars()
        .take(200)
        .collect();

    Ok(UpdateInfo {
        available,
        version: latest,
        url,
        notes,
    })
}
