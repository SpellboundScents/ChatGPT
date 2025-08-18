use tauri::{AppHandle, Manager};
use tauri::menu::{Menu, MenuItem, Submenu, MenuEvent};
use tauri::tray::{TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri_plugin_shell::ShellExt;

// Build an application menu
pub fn app_menu(app: &AppHandle) -> tauri::Result<Menu> {
  let app_items = Menu::new(app)?
    .add_item(MenuItem::About(String::from("About ChatGPT")))
    .add_item(MenuItem::Separator)
    .add_item(MenuItem::Quit);

  let menu = Menu::new(app)?
    .add_submenu(Submenu::new(app, "ChatGPT", true, app_items)?);

  Ok(menu)
}

// Create a tray icon (v2 style)
pub fn tray(app: &AppHandle) -> tauri::Result<TrayIcon> {
  let tray = TrayIconBuilder::new()
    .on_tray_icon_event(|app, event| match event {
      TrayIconEvent::LeftClick { .. } => {
        if let Some(win) = app.get_webview_window("core") {
          let _ = win.show();
          let _ = win.set_focus();
        }
      }
      _ => {}
    })
    .build(app)?;
  Ok(tray)
}

// v2 menu event handler signature
pub fn menu_handler(app: &AppHandle, event: MenuEvent) {
  match event.id().as_ref() {
    "quit" => {
      let _ = app.exit(0);
    }
    // example: open a URL using the shell plugin
    "open_homepage" => {
      let _ = app.shell().open("https://chatgpt.com", None);
    }
    _ => {}
  }
}
