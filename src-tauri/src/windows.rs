use dpi::LogicalSize;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

#[tauri::command]
pub fn quit_app() {
    std::process::exit(0);
}

#[tauri::command]
pub fn resize_splash(app: AppHandle, width: f64, height: f64) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("splash") {
        win.set_size(LogicalSize::new(width, height))
            .map_err(|e| e.to_string())?;
        win.center().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn focus_or_open_settings(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("settings") {
        let _ = win.unminimize();
        win.show().map_err(|e| e.to_string())?;
        win.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }
    build_settings(&app)
}

fn build_settings(app: &AppHandle) -> Result<(), String> {
    WebviewWindowBuilder::new(
        app,
        "settings",
        WebviewUrl::App("index.html?w=settings".into()),
    )
    .title("Settings")
    .decorations(false)
    .inner_size(150.0, 240.0)
    .center()
    .resizable(false)
    .focused(true)
    .visible(true)
    .always_on_top(true)
    .build()
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn show_window(app: AppHandle, label: String) -> Result<(), String> {
    match label.as_str() {
        "settings" => {
            if let Some(win) = app.get_webview_window("settings") {
                let _ = win.unminimize();
                win.show().map_err(|e| e.to_string())?;
                win.set_focus().map_err(|e| e.to_string())?;
                return Ok(());
            }
            build_settings(&app)?;
        }
        "script-hub" => {
            if let Some(win) = app.get_webview_window("script-hub") {
                let _ = win.unminimize();
                win.show().map_err(|e| e.to_string())?;
                win.set_focus().map_err(|e| e.to_string())?;
                return Ok(());
            }
            WebviewWindowBuilder::new(
                &app,
                "script-hub",
                WebviewUrl::App("index.html?w=script-hub".into()),
            )
            .title("Script Hub")
            .decorations(false)
            .inner_size(475.0, 450.0)
            .center()
            .resizable(false)
            .focused(true)
            .visible(true)
            .always_on_top(true)
            .build()
            .map_err(|e| e.to_string())?;
        }
        _ => {
            if let Some(win) = app.get_webview_window(&label) {
                let _ = win.unminimize();
                win.show().map_err(|e| e.to_string())?;
                win.set_focus().map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn launch_main_window(app: AppHandle) -> Result<(), String> {
    if let Some(main_win) = app.get_webview_window("main") {
        let _ = main_win.unminimize();
        main_win.show().map_err(|e| e.to_string())?;
        main_win.set_focus().map_err(|e| e.to_string())?;
    } else {
        WebviewWindowBuilder::new(&app, "main", WebviewUrl::App("index.html".into()))
            .title("Sentinel")
            .decorations(false)
            .inner_size(650.0, 400.0)
            .center()
            .resizable(false)
            .focused(true)
            .visible(true)
            .build()
            .map_err(|e| e.to_string())?;
    }
    if let Some(splash) = app.get_webview_window("splash") {
        let _ = splash.hide();
    }
    Ok(())
}
