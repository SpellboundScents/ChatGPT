#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]

mod menu;

use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri::tray::{TrayIcon, TrayIconBuilder};
use tauri_plugin_autostart::MacosLauncher;

fn build_tray(app: &tauri::AppHandle) -> tauri::Result<TrayIcon> {
  let tray = TrayIconBuilder::new()
    .on_tray_icon_event(|tray, event| {
      // Single-click to show/focus the core window
      if let tauri::tray::TrayIconEvent::Click { .. } = event {
        let app = tray.app_handle();
        if let Some(core) = app.get_webview_window("core") {
          let _ = core.show();
          let _ = core.set_focus();
        }
      }
    })
    .build(app)?;
  Ok(tray)
}

fn main() {
  let builder = tauri::Builder::default()
    // ---- plugins you actually use ----
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_single_instance::init(|_, _, _| {}))
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
    .plugin(tauri_plugin_opener::init())
    // ---- menubar ----
    .menu(|app| menu::build_menu(app))
    .on_menu_event(|app, event| menu::handle_menu_event(app, event))
    // ---- windows/tray ----
    .setup(|app| {
      // dev vs prod URL
      #[cfg(debug_assertions)]
      let url = WebviewUrl::External("http://localhost:1420".parse().unwrap());
      #[cfg(not(debug_assertions))]
      let url = WebviewUrl::External("https://chatgpt.com".parse().unwrap());

      if app.get_webview_window("core").is_none() {
        WebviewWindowBuilder::new(app, "core", url)
          .title("ChatGPT")
          .resizable(true)
          .visible(true) // ensure it shows during dev
          .build()?;
      }

      // Make sure it’s visible & focused
      if let Some(core) = app.get_webview_window("core") {
        let _ = core.show();
        let _ = core.set_focus();
      }

      // Tray
      let _tray = build_tray(&app.handle())?;

      Ok(())
    });

  builder
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
