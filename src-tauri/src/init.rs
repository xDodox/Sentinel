use crate::{app_dir, Config, Session};
use std::fs;
use std::io::BufRead;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Emitter;

pub(crate) static INJECTED: AtomicBool = AtomicBool::new(false);
pub(crate) static WATCHER_ACTIVE: AtomicBool = AtomicBool::new(false);

pub(crate) fn slog(handle: &tauri::AppHandle, level: &str, msg: &str) {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let s = secs % 60;
    let m = (secs / 60) % 60;
    let h24 = (secs / 3600) % 24;
    let (h12, ampm) = if h24 == 0 {
        (12, "AM")
    } else if h24 < 12 {
        (h24, "AM")
    } else if h24 == 12 {
        (12, "PM")
    } else {
        (h24 - 12, "PM")
    };
    let _ = handle.emit(
        "sirhurt-log",
        format!("[{h12}:{m:02}:{s:02} {ampm}][{level}] {msg}"),
    );
}

#[tauri::command]
pub fn init_sentinel(handle: tauri::AppHandle) -> Result<(), String> {
    let base = app_dir();

    if let Ok(entries) = fs::read_dir(&base) {
        for entry in entries.flatten() {
            if let Ok(ft) = entry.file_type() {
                if ft.is_file() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if name.starts_with("settings_") && name.ends_with(".txt") {
                        let _ = fs::remove_file(entry.path());
                    }
                }
            }
        }
    }

    for sub in &[
        "scripts",
        "cache",
        "cache/rscripts",
        "autoexe",
        "logs",
        "workspace",
        "bin",
    ] {
        fs::create_dir_all(base.join(sub)).map_err(|e| format!("Failed to create {sub}: {e}"))?;
    }

    let sirstrap_exe = base.join("Sirstrap.exe");
    let sirstrap_no_ext = base.join("Sirstrap");
    if sirstrap_exe.exists() && !sirstrap_no_ext.exists() {
        let _ = fs::copy(&sirstrap_exe, &sirstrap_no_ext);
    }

    let iy_path = base.join("scripts").join("Infinite Yield.lua");
    if !iy_path.exists() {
        let _ = fs::write(&iy_path, "loadstring(game:HttpGet('https://raw.githubusercontent.com/EdgeIY/infiniteyield/master/source'))()");
    }
    let clover_path = base.join("scripts").join("CloverHub.lua");
    if !clover_path.exists() {
        let _ = fs::write(
            &clover_path,
            "loadstring(game:HttpGet('https://cloverhub.fun/api/loader'))()",
        );
    }

    let cfg_path = base.join("config.json");
    if !cfg_path.exists() {
        let json = serde_json::to_string_pretty(&Config::default()).map_err(|e| e.to_string())?;
        fs::write(&cfg_path, json).map_err(|e| e.to_string())?;
    }
    let ses_path = base.join("session.json");
    if !ses_path.exists() {
        let json = serde_json::to_string_pretty(&Session::default()).map_err(|e| e.to_string())?;
        fs::write(&ses_path, json).map_err(|e| e.to_string())?;
    }

    let debug_log_path = dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("sirhurt")
        .join("sirhui")
        .join("sirh_debug_log.dat");

    slog(&handle, "INFO", "Terminal ready.");

    let handle_log = handle.clone();
    std::thread::spawn(move || {
        let mut last_pos: u64 = std::fs::metadata(&debug_log_path)
            .map(|m| m.len())
            .unwrap_or(0);
        let skip = [
            "Core files missing",
            "MAIN_STAGE_",
            "MAIN_INIT_",
            "MAIN_P1_",
            "EXE_ENGINE_START_",
            "Defining ",
            "Calculating Hash",
            "Build Hash:",
            "Checksum:",
            "Decrypting ",
            "Username ",
            "Checking Checksum",
            "Validating OF_AUTH_DATA",
            "OF_AUTH_DATA_VALID",
            "Auth Host Response",
            "Reading Response",
            "Log Timestamp:",
            "SirHurt Build Updated",
            "Waiting for User To Join",
            "CheckScriptQueue",
            "Script Detected in Script Queue, Preparing",
            "Executor Thread Passed Integ Checks",
            "Running Script detected in queue",
            "Queue Size:",
            "Init Script Queuing",
            "Waiting for OK to continue",
            "(INTERNAL) Init Script Stage",
            "(INTERNAL) Located certain",
            "(INTERNAL) Init Script Running",
            "(INTERNAL) Init Script Starting",
            "Starting Main Initilization",
            "Web Initlization",
            "Found Set Workspace",
            "SC_1",
            "SC_2",
            "Env Defined",
            "Creating Enviornment",
            "Detected Queued Script",
            "Adding to Queue",
            "Script Detected in Script Queue Successfully ran",
            "Script Queue Successfully",
            "Tick Handler: Game Frozen or Teleported. Verifying..",
        ];
        loop {
            if let Ok(meta) = std::fs::metadata(&debug_log_path) {
                let new_size = meta.len();
                if new_size > last_pos {
                    if let Ok(mut file) = std::fs::File::open(&debug_log_path) {
                        if std::io::Seek::seek(&mut file, std::io::SeekFrom::Start(last_pos))
                            .is_ok()
                        {
                            let mut buf = String::new();
                            if std::io::Read::read_to_string(&mut file, &mut buf).is_ok() {
                                for line in buf.split('\n') {
                                    let line = line.trim_end_matches('\r').trim();
                                    if line.is_empty() {
                                        continue;
                                    }
                                    if skip.iter().any(|p| line.contains(p)) {
                                        continue;
                                    }
                                    let _ = handle_log.emit("sirhurt-log", format!("[SH] {line}"));
                                }
                            }
                        }
                    }
                    last_pos = new_size;
                } else if new_size < last_pos {
                    last_pos = 0;
                }
            }
            std::thread::sleep(std::time::Duration::from_millis(300));
        }
    });

    let handle_heartbeat = handle.clone();
    std::thread::spawn(move || {
        let mut roblox_was_running = false;
        let mut first_tick = true;
        let mut sys = sysinfo::System::new();

        INJECTED.store(false, Ordering::SeqCst);

        loop {
            sys.refresh_processes(sysinfo::ProcessesToUpdate::All, false);
            let roblox_running = sys.processes().values().any(|p| {
                let name = p.name().to_string_lossy().to_lowercase();
                name.contains("roblox")
                    && (name.contains("player") || name.contains("beta") || name.contains("euro"))
            });

            if roblox_running {
                roblox_was_running = true;
            } else if roblox_was_running {
                WATCHER_ACTIVE.store(false, Ordering::SeqCst);
                let was_injected = INJECTED.swap(false, Ordering::SeqCst);
                let _ = handle_heartbeat.emit("injection-status", false);
                if was_injected {
                    slog(
                        &handle_heartbeat,
                        "INFO",
                        "Injection ended (Roblox closed).",
                    );
                } else {
                    slog(&handle_heartbeat, "INFO", "Roblox process terminated.");
                }
                roblox_was_running = false;
            } else if first_tick && INJECTED.load(Ordering::SeqCst) {
                WATCHER_ACTIVE.store(false, Ordering::SeqCst);
                INJECTED.store(false, Ordering::SeqCst);
                let _ = handle_heartbeat.emit("injection-status", false);
            }

            first_tick = false;
            std::thread::sleep(std::time::Duration::from_millis(500));
        }
    });

    let handle_boot = handle.clone();
    let boot_log = base.join("bootstrapper_debug.txt");
    std::thread::spawn(move || {
        let mut last_pos = 0;
        loop {
            if boot_log.exists() {
                if let Ok(file) = std::fs::File::open(&boot_log) {
                    let mut reader = std::io::BufReader::new(file);
                    if let Ok(metadata) = std::fs::metadata(&boot_log) {
                        let len = metadata.len();
                        if len < last_pos {
                            last_pos = 0;
                        }
                    }
                    if std::io::Seek::seek(&mut reader, std::io::SeekFrom::Start(last_pos)).is_ok()
                    {
                        for line in (&mut reader).lines().flatten() {
                            if line.contains("] [") || line.starts_with('[') {
                                let _ = handle_boot.emit("sirhurt-log", line);
                            } else {
                                let _ =
                                    handle_boot.emit("sirhurt-log", format!("[DEBUG] {}", line));
                            }
                        }
                        if let Ok(pos) = std::io::Seek::stream_position(&mut reader) {
                            last_pos = pos;
                        }
                    }
                }
            }
            std::thread::sleep(std::time::Duration::from_millis(1000));
        }
    });

    Ok(())
}
