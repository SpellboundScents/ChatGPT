#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use tauri::{
  Manager, WebviewUrl, WebviewWindowBuilder,
  menu::{Menu, MenuItem, Submenu, PredefinedMenuItem},
  tray::{TrayIcon, TrayIconBuilder, TrayIconEvent},
};
use tauri_plugin_autostart::MacosLauncher;
use tauri::Emitter; // <- for app.emit(...)


// ----- tray -----
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

// ----- main -----
#[tokio::main]
async fn main() {
  tauri::Builder::default()
    // plugins
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_single_instance::init(|_, _, _| {}))
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))

    // app menubar
    .menu(|handle| {
      Menu::with_items(handle, &[
        // ChatGPT
        &Submenu::with_items(handle, "ChatGPT", true, &[
          #[cfg(target_os = "macos")]
          &PredefinedMenuItem::about(handle, None)?,
          &PredefinedMenuItem::separator(handle)?,
          &MenuItem::with_id(handle, "check-updates", "Check for Updates…", true, None::<&str>)?,
          &PredefinedMenuItem::separator(handle)?,
          &PredefinedMenuItem::quit(handle, None)?,
        ])?,

        // Preferences (includes “Go to Config” window)
        &Submenu::with_items(handle, "Preferences", true, &[
          &MenuItem::with_id(
            handle,
            "pref-open-config",
            "Go to Config",
            true,
            Some("Shift+Ctrl+G"),
          )?,
          &MenuItem::with_id(
            handle,
            "pref-restart",
            "Restart ChatGPT",
            true,
            Some("Shift+Ctrl+R"),
          )?,
        ])?,

        // View
        &Submenu::with_items(handle, "View", true, &[
          &MenuItem::with_id(handle, "reload", "Reload", true, Some("CmdOrCtrl+R"))?,
          &MenuItem::with_id(handle, "toggle-devtools", "Toggle DevTools", true, Some("CmdOrCtrl+Shift+I"))?,
        ])?,
      ])
    })

    // menu actions
    .on_menu_event(|app, event| {
      match event.id().as_ref() {
        "reload" => {
          if let Some(win) = app.get_webview_window("core") {
            let _ = win.eval("location.reload()");
          }
        }
        "toggle-devtools" => {
          #[cfg(debug_assertions)]
          if let Some(win) = app.get_webview_window("core") {
            let _ = win.open_devtools();   // <- was toggle_devtools()
          }

        }
        "check-updates" => {
          // If you expose a frontend handler, you can emit here:
          let _ = app.emit("menu-check-updates", ());
        }
        "pref-open-config" => {
          // open/focus your custom config window
          if app.get_webview_window("config").is_none() {
            let _ = WebviewWindowBuilder::new(
              app,
              "config",
              WebviewUrl::App("config.html".into())
            )
            .title("Config")
            .inner_size(600.0, 420.0)
            .resizable(true)
            .build();
          } else if let Some(cfg) = app.get_webview_window("config") {
            let _ = cfg.set_focus();
            let _ = cfg.show();
          }
        }
        "pref-restart" => {
          tauri::process::restart(&app.env());
        }
        _ => {}
      }
    })

    // create window + tray
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
          .visible(true)
          .build()?;
      }

      if let Some(core) = app.get_webview_window("core") {
        let _ = core.show();
        let _ = core.set_focus();
      }

      let _tray = build_tray(&app.handle())?;
      Ok(())
    })

    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}