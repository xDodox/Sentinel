use crate::init::slog;
use crate::{app_dir, StatusResult};
use serde::Deserialize;
use std::fs;

#[derive(Deserialize)]
struct SirHurtApiResponse {
    #[serde(rename = "SirHurt V5")]
    sirhurt_v5: SirHurtStatus,
}

#[derive(Deserialize, Clone)]
struct SirHurtStatus {
    exploit_version: String,
    roblox_version: String,
}

#[derive(Deserialize)]
struct RobloxVersion {
    #[serde(rename = "clientVersionUpload")]
    client_version_upload: String,
}

const SH_STATUS_URL: &str = "https://sirhurt.net/status/fetch.php?exploit=SirHurt%20V5";
const SH_ZIP_URL: &str =
    "https://sirhurt.net/asshurt/update/v5/ProtectFile.php?customversion=LIVE&file=sirhurt.zip";
const SH_DLL_URL: &str =
    "https://sirhurt.net/asshurt/update/v5/fetch_version.php?customversion=LIVE";

fn decode_sirhurt_zip(hex_text: &str) -> Result<Vec<u8>, String> {
    let reversed: String = hex_text.trim().chars().rev().collect();
    if reversed.len() % 2 != 0 {
        return Err("Invalid hex data (odd length).".into());
    }
    (0..reversed.len())
        .step_by(2)
        .map(|i| {
            u8::from_str_radix(&reversed[i..i + 2], 16).map_err(|_| format!("Bad hex byte at {i}"))
        })
        .collect()
}

#[tauri::command]
pub async fn reinstall_core(handle: tauri::AppHandle) -> Result<String, String> {
    let base = app_dir();
    fs::create_dir_all(&base).map_err(|e| format!("Dir error: {e}"))?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .user_agent("Sentinel/1.0")
        .build()
        .map_err(|e| e.to_string())?;

    slog(
        &handle,
        "INFO",
        "Checking SirHurt version from sirhurt.net...",
    );
    let status_val: serde_json::Value = client
        .get(SH_STATUS_URL)
        .send()
        .await
        .map_err(|e| format!("Status check failed: {e}"))?
        .json()
        .await
        .map_err(|e| format!("Status parse failed: {e}"))?;

    let sh = status_val
        .get(0)
        .and_then(|item| item.get("SirHurt V5"))
        .ok_or("Unexpected API response format.")?;
    let remote_version = sh
        .get("exploit_version")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();
    let updated = sh.get("updated").and_then(|v| v.as_bool()).unwrap_or(true);
    let core_already_exists = base.join("sirhurt.exe").exists();

    if !updated && core_already_exists {
        slog(
            &handle,
            "WARN",
            "SirHurt hasn't updated for the current Roblox version yet. Try again later.",
        );
        return Err("SirHurt not updated for current Roblox yet.".into());
    }
    if !updated {
        slog(
            &handle,
            "WARN",
            "SirHurt not yet updated for latest Roblox — installing anyway.",
        );
    }

    slog(
        &handle,
        "INFO",
        &format!("Downloading SirHurt {remote_version}..."),
    );
    let hex = client
        .get(SH_ZIP_URL)
        .send()
        .await
        .map_err(|e| format!("Zip download failed: {e}"))?
        .text()
        .await
        .map_err(|e| format!("Zip read failed: {e}"))?;

    slog(&handle, "INFO", "Decoding archive...");
    let zip_bytes = decode_sirhurt_zip(&hex)?;

    slog(&handle, "INFO", "Extracting...");
    let cursor = std::io::Cursor::new(zip_bytes);
    let mut archive = zip::ZipArchive::new(cursor).map_err(|e| format!("Zip open failed: {e}"))?;
    archive
        .extract(&base)
        .map_err(|e| format!("Extract failed: {e}"))?;

    slog(&handle, "INFO", "Downloading sirhurt.dll...");
    let dll_bytes = {
        let mut last_err = String::new();
        let mut result = None;
        for attempt in 1u8..=3 {
            let fetch_result = async {
                let dll_url = client
                    .get(SH_DLL_URL)
                    .send()
                    .await
                    .map_err(|e| format!("DLL URL failed: {e}"))?
                    .text()
                    .await
                    .map_err(|e| format!("DLL URL read: {e}"))?;
                let url = dll_url.trim().to_string();
                if url.is_empty() {
                    return Err("DLL URL empty".into());
                }
                let b = client
                    .get(&url)
                    .send()
                    .await
                    .map_err(|e| format!("DLL download failed: {e}"))?
                    .bytes()
                    .await
                    .map_err(|e| format!("DLL read failed: {e}"))?;
                if b.len() < 1024 {
                    return Err("DLL too small".into());
                }
                Ok(b)
            }
            .await;
            match fetch_result {
                Ok(b) => {
                    result = Some(b);
                    break;
                }
                Err(e) => {
                    last_err = e;
                    if attempt < 3 {
                        slog(
                            &handle,
                            "WARN",
                            &format!("DLL attempt {attempt} failed — retrying..."),
                        );
                        tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                    }
                }
            }
        }
        result.ok_or(last_err)?
    };
    fs::write(base.join("sirhurt.dll"), &dll_bytes)
        .map_err(|e| format!("DLL write failed: {e}"))?;

    fs::write(base.join("version.txt"), &remote_version)
        .map_err(|e| format!("Version write failed: {e}"))?;

    slog(
        &handle,
        "OK",
        &format!("SirHurt {remote_version} installed successfully."),
    );
    Ok(format!("SirHurt {remote_version} installed."))
}

#[tauri::command]
pub async fn launch_sirstrap() -> Result<(), String> {
    let dest = app_dir().join("Sirstrap.CLI.zip");
    let exe = app_dir().join("Sirstrap.exe");

    if !exe.exists() {
        let bytes = reqwest::get(
            "https://github.com/massimopaganigh/Sirstrap/releases/latest/download/Sirstrap.CLI.zip",
        )
        .await
        .map_err(|e| format!("Download failed: {e}"))?
        .bytes()
        .await
        .map_err(|e| format!("Read failed: {e}"))?;
        fs::write(&dest, &bytes).map_err(|e| format!("Write failed: {e}"))?;

        let file = fs::File::open(&dest).map_err(|e| e.to_string())?;
        let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
        archive.extract(app_dir()).map_err(|e| e.to_string())?;
        let _ = fs::remove_file(&dest);
    }

    let mut actual_exe = if exe.exists() { Some(exe) } else { None };
    if actual_exe.is_none() {
        if let Ok(entries) = fs::read_dir(app_dir()) {
            for entry in entries.flatten() {
                if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                    let sub_exe = entry.path().join("Sirstrap.exe");
                    if sub_exe.exists() {
                        actual_exe = Some(sub_exe);
                        break;
                    }
                }
            }
        }
    }

    let final_exe =
        actual_exe.ok_or_else(|| "Sirstrap.exe not found after extraction.".to_string())?;

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        std::process::Command::new(&final_exe)
            .current_dir(app_dir())
            .creation_flags(0x00000010)
            .spawn()
            .map_err(|e| format!("Launch failed: {e}"))?;
        Ok(())
    }
    #[cfg(not(windows))]
    {
        std::process::Command::new(&final_exe)
            .current_dir(app_dir())
            .spawn()
            .map_err(|e| format!("Launch failed: {e}"))?;
        Ok(())
    }
}

#[tauri::command]
pub async fn check_status(
    _handle: tauri::AppHandle,
    bootstrapper: Option<String>,
) -> Result<StatusResult, String> {
    let client = reqwest::Client::builder()
        .user_agent("SirHurtV5/1.0")
        .build()
        .map_err(|e| format!("Client build error: {e}"))?;

    let sh_text = client
        .get("https://sirhurt.net/status/fetch.php?exploit=SirHurt%20V5")
        .send()
        .await
        .map_err(|e| format!("SirHurt API: {e}"))?
        .text()
        .await
        .map_err(|e| format!("SirHurt read: {e}"))?;
    let sh_raw: Vec<SirHurtApiResponse> = serde_json::from_str(&sh_text)
        .map_err(|e| format!("SirHurt parse: {e} | Raw: {sh_text}"))?;
    let sh = sh_raw
        .first()
        .ok_or_else(|| "SirHurt API: Empty response".to_string())?
        .sirhurt_v5
        .clone();

    let rb_text = client
        .get("https://clientsettingscdn.roblox.com/v2/client-version/WindowsPlayer")
        .send()
        .await
        .map_err(|e| format!("Roblox API: {e}"))?
        .text()
        .await
        .map_err(|e| format!("Roblox read: {e}"))?;
    let rb: RobloxVersion = serde_json::from_str(&rb_text)
        .map_err(|e| format!("Roblox parse: {e} | Raw: {rb_text}"))?;

    let version_path = app_dir().join("version.txt");
    let exe_path = app_dir().join("sirhurt.exe");
    let core_files_exist = exe_path.exists();

    let mut local_version =
        fs::read_to_string(&version_path).unwrap_or_else(|_| "0.0.0".to_string());
    if !core_files_exist {
        local_version = "0.0.0".to_string();
    } else if local_version == "0.0.0" {
        local_version = sh.exploit_version.clone();
        let _ = fs::write(&version_path, &local_version);
    }

    let sirhurt_roblox_compatible = sh.roblox_version == rb.client_version_upload;
    let sirhurt_local_compatible = sh.exploit_version == local_version;
    let roblox_ahead = rb.client_version_upload > sh.roblox_version;

    let localappdata = std::env::var("LOCALAPPDATA").unwrap_or_default();
    let official_path = std::path::Path::new(&localappdata)
        .join("Roblox")
        .join("Versions");
    let pf_path = std::path::Path::new("C:\\Program Files (x86)\\Roblox\\Versions");
    let sirstrap_path = std::path::Path::new(&localappdata)
        .join("Sirstrap")
        .join("Versions");

    let roblox_installed = match bootstrapper.as_deref() {
        Some("sirstrap") => sirstrap_path.exists() || official_path.exists() || pf_path.exists(),
        Some("official") => official_path.exists() || pf_path.exists() || sirstrap_path.exists(),
        _ => official_path.exists() || pf_path.exists() || sirstrap_path.exists(),
    };

    Ok(StatusResult {
        sirhurt_version: sh.exploit_version,
        supported_roblox: sh.roblox_version,
        current_roblox: rb.client_version_upload,
        local_version,
        core_files_exist,
        sirhurt_roblox_compatible,
        sirhurt_local_compatible,
        roblox_ahead,
        roblox_installed,
        message: if sirhurt_roblox_compatible && sirhurt_local_compatible {
            "Working".into()
        } else if roblox_ahead {
            "Sentinel updating...".into()
        } else {
            "Update required".into()
        },
    })
}
