pub mod config;
pub mod console;
pub mod discord;
pub mod init;
pub mod injection;
pub mod roblox;
pub mod scripts;
pub mod status;
pub mod updater;
pub mod windows;

use serde::{Deserialize, Serialize};

use std::path::PathBuf;

pub fn app_dir() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("_Sentinel")
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    pub font_size: u8,
    pub font_family: String,
    pub line_numbers: bool,
    pub minimap: bool,
    pub word_wrap: bool,
    pub auto_inject: bool,
    pub inject_delay: u32,
    pub top_most: bool,
    pub accent_color: String,
    pub allow_reinject: bool,
    pub discord_rpc: bool,
    pub confirm_tab_delete: bool,
    pub folding: bool,
    pub ui_radius: u8,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            font_size: 13,
            font_family: "JetBrains Mono".into(),
            line_numbers: true,
            minimap: true,
            word_wrap: false,
            auto_inject: false,
            inject_delay: 500,
            top_most: true,
            accent_color: "#c0392b".into(),
            allow_reinject: true,
            discord_rpc: false,
            confirm_tab_delete: true,
            folding: true,
            ui_radius: 8,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct TabEntry {
    pub name: String,
    pub code: String,
    pub active: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub tabs: Vec<TabEntry>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusResult {
    pub sirhurt_version: String,
    pub supported_roblox: String,
    pub current_roblox: String,
    pub local_version: String,
    pub core_files_exist: bool,
    pub sirhurt_roblox_compatible: bool,
    pub sirhurt_local_compatible: bool,
    pub roblox_ahead: bool,
    pub roblox_installed: bool,
    pub message: String,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                if let Err(e) = init::init_sentinel(handle) {
                    eprintln!("init_sentinel error: {e}");
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            windows::launch_main_window,
            windows::resize_splash,
            windows::quit_app,
            windows::show_window,
            windows::focus_or_open_settings,
            status::reinstall_core,
            config::load_config,
            config::save_config,
            config::load_session,
            config::save_session,
            status::check_status,
            scripts::execute_script,
            scripts::save_script,
            scripts::get_local_scripts,
            scripts::load_script,
            scripts::delete_script,
            scripts::rename_script,
            scripts::get_autoexec_scripts,
            scripts::load_autoexec_script,
            scripts::save_autoexec_script,
            scripts::delete_autoexec_script,
            injection::set_always_on_top,
            injection::inject,
            injection::get_injection_status,
            injection::get_roblox_instances,
            roblox::fetch_rscripts,
            status::launch_sirstrap,
            roblox::kill_roblox,
            roblox::open_url,
            roblox::fetch_url_content,
            discord::set_discord_rpc,
            console::start_console_server,
            updater::open_scripts_folder,
            updater::open_autoexec_folder,
            updater::start_script_watcher,
            updater::check_app_update,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
