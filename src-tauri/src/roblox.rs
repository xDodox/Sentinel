#[tauri::command]
pub async fn fetch_rscripts(page: u32, query: String) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .user_agent("SirHurtV5/1.0")
        .build()
        .map_err(|e| format!("Client error: {e}"))?;

    let mut url = format!("https://rscripts.net/api/v2/scripts?page={page}");
    if !query.is_empty() {
        url = format!("{url}&q={}", query);
    }

    let json = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Request failed: {e}"))?
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("Parse failed: {e}"))?;
    Ok(json)
}

#[tauri::command]
pub fn kill_roblox() -> Result<String, String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        std::process::Command::new("taskkill")
            .args(["/F", "/IM", "RobloxPlayerBeta.exe"])
            .creation_flags(0x08000000)
            .output()
            .map_err(|e| e.to_string())?;
        Ok("Roblox process terminated.".into())
    }
    #[cfg(not(windows))]
    {
        Ok("Not supported on this OS.".into())
    }
}

#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn fetch_url_content(url: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .user_agent("SirHurtV5/1.0")
        .build()
        .map_err(|e| format!("Client build error: {e}"))?;

    let res = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Request failed: {e}"))?;
    if !res.status().is_success() {
        return Err(format!("Server returned error: {}", res.status()));
    }
    res.text().await.map_err(|e| format!("Read failed: {e}"))
}
