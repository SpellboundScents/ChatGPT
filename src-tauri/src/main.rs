#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

mod menu;

use tauri::{
  Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
  tray::{TrayIcon, TrayIconBuilder, TrayIconEvent},
};

use tauri_plugin_autostart::MacosLauncher;

// ===== Tray =====
fn build_tray(app: &tauri::AppHandle) -> tauri::Result<TrayIcon> {
  TrayIconBuilder::new()
    .on_tray_icon_event(|tray, event| {
      if let TrayIconEvent::Click { .. } = event {
        let app = tray.app_handle();
        if let Some(core) = app.get_webview_window("core") {
          let _ = core.show();
          let _ = core.set_focus();
        }
      }
    })
    .build(app)
}

// ===== Create (or focus) the main window =====
fn ensure_core_window(app: &tauri::AppHandle) -> tauri::Result<WebviewWindow> {
  // dev vs prod URL for the main window
  #[cfg(debug_assertions)]
  let url = WebviewUrl::External("http://localhost:1420".parse().unwrap());
  #[cfg(not(debug_assertions))]
  let url = WebviewUrl::External("https://chatgpt.com".parse().unwrap());

  let win = if let Some(w) = app.get_webview_window("core") {
    w
  } else {
    WebviewWindowBuilder::new(app, "core", url)
      .title("ChatGPT")
      .resizable(true)
      .visible(true)
      .build()?
  };

  let _ = win.show();
  let _ = win.set_focus();
  Ok(win)
}

#[tokio::main]
async fn main() {
  tauri::Builder::default()
    // ---- plugins you’re using ----
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_single_instance::init(|_, _, _| {}))
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
    .plugin(tauri_plugin_opener::init()) // <— for opening external URLs

    // ---- menubar + click handling ----
    .menu(|handle| menu::build_menu(handle))
    .on_menu_event(menu::handle_menu_event)

    // ---- window + tray boot ----
    .setup(|app| {
      let _core = ensure_core_window(&app.handle())?;
      let _tray = build_tray(&app.handle())?;
      Ok(())
    })

    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
