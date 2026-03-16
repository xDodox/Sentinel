use crate::app_dir;
use std::fs;

#[tauri::command]
pub fn execute_script(code: String) -> Result<(), String> {
    let sirhurt_dir = dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("sirhurt")
        .join("sirhui");
    let path = if sirhurt_dir.exists() {
        sirhurt_dir.join("sirhurt.dat")
    } else {
        app_dir().join("sirhurt.dat")
    };
    fs::write(&path, &code).map_err(|e| format!("Write error: {e}"))
}

#[tauri::command]
pub fn save_script(name: String, code: String) -> Result<(), String> {
    let path = app_dir().join("scripts").join(format!("{name}.lua"));
    fs::write(&path, &code).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_local_scripts() -> Vec<String> {
    let dir = app_dir().join("scripts");
    fs::read_dir(&dir)
        .ok()
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .filter_map(|e| {
                    let n = e.file_name().to_string_lossy().to_string();
                    if n.ends_with(".lua") {
                        Some(n[..n.len() - 4].to_string())
                    } else if n.ends_with(".luau") {
                        Some(n[..n.len() - 5].to_string())
                    } else {
                        None
                    }
                })
                .collect()
        })
        .unwrap_or_default()
}

#[tauri::command]
pub fn load_script(name: String) -> Result<String, String> {
    let base = app_dir().join("scripts");
    for ext in &["lua", "luau"] {
        let path = base.join(format!("{name}.{ext}"));
        if path.exists() {
            return fs::read_to_string(&path).map_err(|e| e.to_string());
        }
    }
    Err(format!("Script '{name}' not found"))
}

#[tauri::command]
pub fn delete_script(name: String) -> Result<(), String> {
    let base = app_dir().join("scripts");
    for ext in &["lua", "luau"] {
        let path = base.join(format!("{name}.{ext}"));
        if path.exists() {
            return fs::remove_file(&path).map_err(|e| e.to_string());
        }
    }
    Err(format!("Script '{name}' not found"))
}

#[tauri::command]
pub fn rename_script(old_name: String, new_name: String) -> Result<(), String> {
    let base = app_dir().join("scripts");
    for ext in &["lua", "luau"] {
        let old_path = base.join(format!("{old_name}.{ext}"));
        if old_path.exists() {
            let new_path = base.join(format!("{new_name}.{ext}"));
            return fs::rename(&old_path, &new_path).map_err(|e| e.to_string());
        }
    }
    Err(format!("Script '{old_name}' not found"))
}

#[tauri::command]
pub fn get_autoexec_scripts() -> Vec<String> {
    let dir = app_dir().join("autoexe");
    fs::read_dir(&dir)
        .ok()
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .filter_map(|e| {
                    let n = e.file_name().to_string_lossy().to_string();
                    if n.ends_with(".lua") {
                        Some(n[..n.len() - 4].to_string())
                    } else if n.ends_with(".luau") {
                        Some(n[..n.len() - 5].to_string())
                    } else {
                        None
                    }
                })
                .filter(|n| !n.starts_with("_sentinel_console"))
                .collect()
        })
        .unwrap_or_default()
}

#[tauri::command]
pub fn load_autoexec_script(name: String) -> Result<String, String> {
    let base = app_dir().join("autoexe");
    for ext in &["lua", "luau"] {
        let path = base.join(format!("{name}.{ext}"));
        if path.exists() {
            return fs::read_to_string(&path).map_err(|e| e.to_string());
        }
    }
    Err("Script not found".into())
}

#[tauri::command]
pub fn save_autoexec_script(name: String, code: String) -> Result<(), String> {
    let path = app_dir().join("autoexe").join(format!("{name}.lua"));
    fs::write(&path, &code).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_autoexec_script(name: String) -> Result<(), String> {
    if name.contains("_sentinel_console") {
        return Err("Protected script cannot be deleted".into());
    }
    let base = app_dir().join("autoexe");
    for ext in &["lua", "luau"] {
        let path = base.join(format!("{name}.{ext}"));
        if path.exists() {
            let _ = fs::remove_file(path);
        }
    }
    Ok(())
}
