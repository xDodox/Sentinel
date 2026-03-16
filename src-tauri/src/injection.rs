use crate::app_dir;
use crate::init::{slog, INJECTED, WATCHER_ACTIVE};
use std::sync::atomic::Ordering;
use tauri::{Emitter, Manager};

#[tauri::command]
pub fn set_always_on_top(handle: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    if let Some(window) = handle.get_webview_window("main") {
        window
            .set_always_on_top(enabled)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn inject(handle: tauri::AppHandle) -> Result<(), String> {
    if WATCHER_ACTIVE.load(Ordering::SeqCst) {
        return Err("Injection already in progress.".into());
    }
    let processes = [
        "RobloxPlayerBeta.exe",
        "Euroblox.exe",
        "RobloxPlayerLauncher.exe",
    ];
    let mut found = false;
    let mut system = sysinfo::System::new_all();
    system.refresh_all();

    for process in system.processes().values() {
        let name = process.name().to_string_lossy().to_lowercase();
        if processes.iter().any(|&p| name.contains(&p.to_lowercase())) {
            found = true;
            break;
        }
    }

    if !found {
        return Err(
            "MAIN_STAGE_0\nMAIN_INIT_SKIP\nMAIN_STAGE_2\nNo Roblox processes are running."
                .to_string(),
        );
    }

    if let Ok(entries) = std::fs::read_dir(app_dir()) {
        for entry in entries.flatten() {
            if let Ok(ft) = entry.file_type() {
                if ft.is_file() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if name.starts_with("settings_") && name.ends_with(".txt") {
                        let _ = std::fs::remove_file(entry.path());
                    }
                }
            }
        }
    }

    let core_path = app_dir().join("sirhurt.exe");
    if !core_path.exists() {
        return Err(
            "sirhurt.exe not found. Please use Settings → Download Core to reinstall.".to_string(),
        );
    }

    let debug_log_path = dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("sirhurt")
        .join("sirhui")
        .join("sirh_debug_log.dat");
    let size_before_inject = std::fs::metadata(&debug_log_path)
        .map(|m| m.len())
        .unwrap_or(0);

    INJECTED.store(false, Ordering::SeqCst);
    WATCHER_ACTIVE.store(true, Ordering::SeqCst);

    let handle_watcher = handle.clone();
    std::thread::spawn(move || {
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(60);
        let mut sirhurt_seen_running = false;
        loop {
            if !WATCHER_ACTIVE.load(Ordering::SeqCst) {
                break;
            }
            if std::time::Instant::now() > deadline {
                if sirhurt_seen_running {
                    INJECTED.store(true, Ordering::SeqCst);
                    let _ = handle_watcher.emit("injection-status", true);
                    slog(&handle_watcher, "OK", "Injection confirmed (fast attach).");
                } else {
                    slog(
                        &handle_watcher,
                        "WARN",
                        "Injection timed out — try again if Roblox is fully loaded.",
                    );
                }
                WATCHER_ACTIVE.store(false, Ordering::SeqCst);
                break;
            }

            let current_size = std::fs::metadata(&debug_log_path)
                .map(|m| m.len())
                .unwrap_or(0);
            if current_size > size_before_inject {
                if WATCHER_ACTIVE.load(Ordering::SeqCst) {
                    INJECTED.store(true, Ordering::SeqCst);
                    let _ = handle_watcher.emit("injection-status", true);
                    slog(&handle_watcher, "OK", "Injection confirmed.");
                }
                WATCHER_ACTIVE.store(false, Ordering::SeqCst);
                break;
            }

            let mut sys = sysinfo::System::new();
            sys.refresh_processes(sysinfo::ProcessesToUpdate::All, false);
            let sirhurt_alive = sys.processes().values().any(|p| {
                p.name()
                    .to_string_lossy()
                    .to_lowercase()
                    .contains("sirhurt")
            });
            if sirhurt_alive {
                sirhurt_seen_running = true;
            } else if sirhurt_seen_running && !sirhurt_alive {
                let final_size = std::fs::metadata(&debug_log_path)
                    .map(|m| m.len())
                    .unwrap_or(0);
                if final_size > size_before_inject {
                    INJECTED.store(true, Ordering::SeqCst);
                    let _ = handle_watcher.emit("injection-status", true);
                    slog(&handle_watcher, "OK", "Injection confirmed.");
                } else {
                    INJECTED.store(true, Ordering::SeqCst);
                    let _ = handle_watcher.emit("injection-status", true);
                    slog(
                        &handle_watcher,
                        "OK",
                        "Injection confirmed (already attached).",
                    );
                }
                WATCHER_ACTIVE.store(false, Ordering::SeqCst);
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(200));
        }
    });

    #[cfg(target_os = "windows")]
    use std::os::windows::process::CommandExt;

    let mut cmd = std::process::Command::new(&core_path);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x00000010);

    let _child = cmd
        .current_dir(app_dir())
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::inherit())
        .stderr(std::process::Stdio::inherit())
        .spawn()
        .map_err(|e| {
            let code = e.raw_os_error().unwrap_or(0);
            match code {
                1392 => {
                    "sirhurt.exe is corrupted. Use Settings → Download Core to reinstall.".into()
                }
                225 => {
                    "Blocked by Windows Defender. Add an exclusion for %appdata%\\_Sentinel.".into()
                }
                5 => "Access denied (OS error 5). Try running Sentinel as Administrator.".into(),
                _ => format!("Failed to launch sirhurt.exe (OS error {code}): {e}"),
            }
        })?;

    Ok(())
}

#[derive(serde::Serialize)]
pub struct RobloxInstance {
    pub id: u32,
    pub name: String,
    pub status: String,
}

#[tauri::command]
pub fn get_roblox_instances() -> Result<Vec<RobloxInstance>, String> {
    let is_injected = INJECTED.load(Ordering::SeqCst);
    let mut sys = sysinfo::System::new();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, false);

    let mut instances = Vec::new();
    let mut count = 1;
    for (pid, process) in sys.processes() {
        let name = process.name().to_string_lossy().to_lowercase();
        if name.contains("roblox")
            && (name.contains("player") || name.contains("beta") || name.contains("euro"))
        {
            instances.push(RobloxInstance {
                id: pid.as_u32(),
                name: format!("Instance {}", count),
                status: if is_injected {
                    "running".to_string()
                } else {
                    "stopped".to_string()
                },
            });
            count += 1;
        }
    }
    Ok(instances)
}

#[tauri::command]
pub fn get_injection_status() -> Result<bool, String> {
    Ok(INJECTED.load(Ordering::SeqCst))
}
