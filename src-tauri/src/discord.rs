use crate::init::slog;
use std::sync::atomic::{AtomicBool, Ordering};

static RPC_ENABLED: AtomicBool = AtomicBool::new(false);
static RPC_RUNNING: AtomicBool = AtomicBool::new(false);

#[tauri::command]
pub fn set_discord_rpc(enabled: bool, handle: tauri::AppHandle) {
    RPC_ENABLED.store(enabled, Ordering::SeqCst);
    if enabled && !RPC_RUNNING.load(Ordering::SeqCst) {
        RPC_RUNNING.store(true, Ordering::SeqCst);
        std::thread::spawn(move || {
            run_discord_rpc(&handle);
            RPC_RUNNING.store(false, Ordering::SeqCst);
        });
    }
}

fn discord_write(pipe: &mut std::fs::File, op: u32, json: &str) -> bool {
    use std::io::Write;
    let b = json.as_bytes();
    let mut f = Vec::with_capacity(8 + b.len());
    f.extend_from_slice(&op.to_le_bytes());
    f.extend_from_slice(&(b.len() as u32).to_le_bytes());
    f.extend_from_slice(b);
    pipe.write_all(&f).is_ok()
}

fn discord_read(pipe: &mut std::fs::File) -> Option<(u32, String)> {
    use std::io::Read;
    let mut hdr = [0u8; 8];
    pipe.read_exact(&mut hdr).ok()?;
    let op = u32::from_le_bytes([hdr[0], hdr[1], hdr[2], hdr[3]]);
    let len = u32::from_le_bytes([hdr[4], hdr[5], hdr[6], hdr[7]]) as usize;
    if len > 65536 {
        return None;
    }
    let mut body = vec![0u8; len];
    pipe.read_exact(&mut body).ok()?;
    Some((op, String::from_utf8_lossy(&body).into_owned()))
}

fn run_discord_rpc(handle: &tauri::AppHandle) {
    #[cfg(windows)]
    {
        let client_id = "1482036320078659677";
        let mut connected_pipe: Option<std::fs::File> = None;

        for i in 0..10u8 {
            let path = format!("\\\\.\\pipe\\discord-ipc-{i}");
            let Ok(mut pipe) = std::fs::OpenOptions::new()
                .read(true)
                .write(true)
                .open(&path)
            else {
                continue;
            };

            let hs = format!(r#"{{"v":1,"client_id":"{client_id}"}}"#);
            if !discord_write(&mut pipe, 0, &hs) {
                continue;
            }

            let mut got_ready = false;
            for _ in 0..5 {
                match discord_read(&mut pipe) {
                    Some((_op, body)) if body.contains("\"READY\"") => {
                        got_ready = true;
                        break;
                    }
                    Some(_) => continue,
                    None => break,
                }
            }

            if got_ready {
                connected_pipe = Some(pipe);
                break;
            }
        }

        let mut pipe = match connected_pipe {
            Some(p) => p,
            None => {
                slog(
                    handle,
                    "WARN",
                    "Discord RPC: Could not connect (Discord not running, or all IPC slots busy).",
                );
                return;
            }
        };

        let pid = std::process::id();
        let start_ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);

        let make_activity = |nonce: &str| {
            format!(
                r#"{{"cmd":"SET_ACTIVITY","args":{{"pid":{pid},"activity":{{"details":"Exploiting in Roblox","state":"Powered by SirHurt V5","timestamps":{{"start":{start_ts}}},"assets":{{"large_image":"sentinel","large_image_text":"Sentinel — SirHurt V5"}},"buttons":[{{"label":"Get SirHurt","url":"https://sirhurt.net"}}]}}}},"nonce":"{nonce}"}}"#
            )
        };

        if !discord_write(&mut pipe, 1, &make_activity("sentinel-1")) {
            slog(handle, "WARN", "Discord RPC: failed to send activity.");
            return;
        }

        if let Some((_op, body)) = discord_read(&mut pipe) {
            if body.contains("\"ERROR\"") {
                let preview: String = body.chars().take(200).collect();
                slog(handle, "WARN", &format!("Discord RPC error: {preview}"));
                return;
            }
        }

        slog(handle, "OK", "Discord RPC active.");

        let mut tick = 0u32;
        loop {
            std::thread::sleep(std::time::Duration::from_secs(15));

            if !RPC_ENABLED.load(Ordering::SeqCst) {
                let clear = format!(
                    r#"{{"cmd":"SET_ACTIVITY","args":{{"pid":{pid},"activity":null}},"nonce":"sentinel-clr"}}"#
                );
                discord_write(&mut pipe, 1, &clear);
                discord_read(&mut pipe);
                slog(handle, "INFO", "Discord RPC cleared.");
                return;
            }

            tick += 1;
            let nonce = format!("sentinel-{tick}");
            if !discord_write(&mut pipe, 1, &make_activity(&nonce)) {
                slog(handle, "WARN", "Discord RPC: connection dropped.");
                RPC_ENABLED.store(false, Ordering::SeqCst);
                return;
            }
            discord_read(&mut pipe);
        }
    }

    #[cfg(not(windows))]
    slog(handle, "WARN", "Discord RPC only supported on Windows.");
}
