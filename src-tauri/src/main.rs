#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]
use tauri::tray::{TrayIcon, TrayIconBuilder};
use tauri::{Manager};
use tauri_plugin_autostart::MacosLauncher;
// Build a tray icon (all inside a function — no stray leading dots)
fn build_tray(app: &tauri::AppHandle) -> tauri::Result<TrayIcon> {
  let tray = TrayIconBuilder::new()
    .on_tray_icon_event(|tray, event| {
      match event {
        tauri::tray::TrayIconEvent::Click { .. } => {
          let app = tray.app_handle(); // <- get the AppHandle here
          if let Some(core) = app.get_webview_window("core") {
            let _ = core.show();
            let _ = core.set_focus();
          }
        }
        _ => {}
      }
    })
    .build(app)?;
  Ok(tray)
}

#[tokio::main]
async fn main() {
  let builder = tauri::Builder::default()
    // plugins you actually use:
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_single_instance::init(|_, _, _| {}))
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None));

  let builder = builder.setup(|app| {
  // Pick URL: vite dev server in debug, production URL otherwise
  #[cfg(debug_assertions)]
  let url = tauri::WebviewUrl::External("http://localhost:1420".parse().unwrap());
  #[cfg(not(debug_assertions))]
  let url = tauri::WebviewUrl::External("https://chatgpt.com".parse().unwrap());

  // Create (or reuse) the window
  if app.get_webview_window("core").is_none() {
    tauri::WebviewWindowBuilder::new(app, "core", url)
      .title("ChatGPT")
      .resizable(true)
      .visible(true)                // <-- make it visible in dev
      .build()?;
  }

  // Ensure it’s shown & focused (even if it already existed)
  if let Some(core) = app.get_webview_window("core") {
    let _ = core.show();
    let _ = core.set_focus();
  }

  // (keep your tray creation if you want)
  let _tray = build_tray(&app.handle())?;

  Ok(())
});

  builder
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
