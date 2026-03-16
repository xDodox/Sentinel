use crate::app_dir;
use crate::init::slog;
use std::fs;
use std::sync::atomic::{AtomicBool, Ordering};

static CONSOLE_RELAY_RUNNING: AtomicBool = AtomicBool::new(false);

#[tauri::command]
pub fn start_console_server(handle: tauri::AppHandle) -> Result<(), String> {
    if CONSOLE_RELAY_RUNNING.load(Ordering::SeqCst) {
        return Ok(());
    }
    CONSOLE_RELAY_RUNNING.store(true, Ordering::SeqCst);

    let relay_path = dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("_Sentinel")
        .join("workspace")
        .join("sentinel_relay.log");
    let _ = fs::create_dir_all(relay_path.parent().unwrap());
    let _ = fs::write(&relay_path, "");

    let lua = include_str!("scripts/_sentinel_console.lua");

    let autoexec_dir = app_dir().join("autoexe");
    let _ = fs::create_dir_all(&autoexec_dir);
    fs::write(autoexec_dir.join("_sentinel_console.lua"), lua)
        .map_err(|e| format!("Could not write console relay script: {e}"))?;

    std::thread::spawn(move || run_relay_watcher(handle, relay_path));
    Ok(())
}

fn run_relay_watcher(handle: tauri::AppHandle, relay_path: std::path::PathBuf) {
    let mut last_pos: u64 = 0;

    loop {
        std::thread::sleep(std::time::Duration::from_millis(200));

        if !relay_path.exists() {
            continue;
        }

        let size = match fs::metadata(&relay_path) {
            Ok(m) => m.len(),
            Err(_) => continue,
        };

        if size < last_pos {
            last_pos = 0;
        }
        if size == last_pos {
            continue;
        }

        let content = match fs::read_to_string(&relay_path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let new_text = if last_pos == 0 {
            &content[..]
        } else {
            let pos = last_pos as usize;
            if pos >= content.len() {
                last_pos = size;
                continue;
            }
            let safe_pos = content
                .char_indices()
                .map(|(i, _)| i)
                .find(|&i| i >= pos)
                .unwrap_or(content.len());
            &content[safe_pos..]
        };

        for line in new_text.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            if let Some(pipe) = line.find('|') {
                let level = &line[..pipe];
                let msg = &line[pipe + 1..];
                if !msg.is_empty() {
                    slog(&handle, level, msg);
                }
            }
        }

        last_pos = size;
    }
}
