use crate::{app_dir, Config, Session};
use std::fs;

#[tauri::command]
pub fn load_config() -> Config {
    let path = app_dir().join("config.json");
    fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str::<Config>(&s).ok())
        .unwrap_or_default()
}

#[tauri::command]
pub fn save_config(config: Config) -> Result<(), String> {
    let path = app_dir().join("config.json");
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_session() -> Session {
    let path = app_dir().join("session.json");
    fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str::<Session>(&s).ok())
        .unwrap_or_default()
}

#[tauri::command]
pub fn save_session(session: Session) -> Result<(), String> {
    let path = app_dir().join("session.json");
    let json = serde_json::to_string_pretty(&session).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())
}
