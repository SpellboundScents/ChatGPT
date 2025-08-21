use tauri::{
  menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem, Submenu},
  AppHandle, Manager, Runtime, Theme, WebviewUrl, WebviewWindowBuilder,
};

// ---------- helpers ----------
fn open_or_focus_config<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
  #[cfg(debug_assertions)]
  let url = tauri::WebviewUrl::External("http://localhost:1420/#/config".parse().unwrap());
  #[cfg(not(debug_assertions))]
  let url = tauri::WebviewUrl::App("index.html#/config".into());

  if app.get_webview_window("config").is_none() {
    let win = WebviewWindowBuilder::new(app, "config", url)
      .title("Config")
      .resizable(true)
      .inner_size(900.0, 830.0)
      .min_inner_size(720.0, 620.0)
      .build()?;
    // #[cfg(debug_assertions)]
    // { let _ = win.open_devtools(); }
    let _ = win.show();
    let _ = win.set_focus();
  } else if let Some(win) = app.get_webview_window("config") {
    let _ = win.show();
    let _ = win.set_focus();
  }
  Ok(())
}

fn apply_theme_to_all<R: Runtime>(app: &AppHandle<R>, theme: Theme) {
  for w in app.webview_windows().values() {
    let _ = w.set_theme(Some(theme));
  }
}

// ---------- UI: visible menu ----------
pub fn build_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
  // ChatGPT
  let chatgpt = Submenu::with_items(app, "ChatGPT", true, &[
    &PredefinedMenuItem::separator(app)?,
    &MenuItem::with_id(app, "check-updates", "Check for Updates…", true, None::<&str>)?,
    &MenuItem::with_id(app, "donate", "☕ Buy Me a Coffee", true, None::<&str>)?,
    &PredefinedMenuItem::quit(app, None::<&str>)?,
  ])?;

  // Preferences
  let preferences = Submenu::with_items(app, "Preferences", true, &[
    &MenuItem::with_id(app, "pref-open-config", "Control Center",  true, Some("Shift+Ctrl+G"))?,
    &MenuItem::with_id(app, "pref-restart",     "Restart ChatGPT", true, Some("Shift+Ctrl+R"))?,
    &MenuItem::with_id(app, "pref-awesome",     "Awesome ChatGPT", true, Some("Shift+Ctrl+A"))?,
  ])?;

  // View
  let view = Submenu::with_items(app, "View", true, &[
    &MenuItem::with_id(app, "reload", "Reload", true, Some("Ctrl+R"))?,
    &MenuItem::with_id(app, "toggle-devtools", "Toggle DevTools", cfg!(debug_assertions), Some("Ctrl+Shift+I"))?,
    &MenuItem::with_id(app, "toggle-darkmode", "Toggle Dark Mode", true, None::<&str>)?,
  ])?;

  // Help
  let help = Submenu::with_items(app, "Help", true, &[
    &MenuItem::with_id(app, "help-log",         "ChatGPT Log",  true, None::<&str>)?,
    &MenuItem::with_id(app, "help-update-log",  "Update Log",   true, None::<&str>)?,
    &MenuItem::with_id(app, "help-report-bug",  "Report Bug",   true, None::<&str>)?,
  ])?;

  Menu::with_items(app, &[&chatgpt, &preferences, &view, &help])
}

// ---------- handlers: UI-only today ----------
pub fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, event: MenuEvent) {
  match event.id().as_ref() {
    "pref-open-config" => { let _ = open_or_focus_config(app); }
    "toggle-darkmode" => {
      let current = app.get_webview_window("core").and_then(|w| w.theme().ok());
      let next = match current {
        Some(Theme::Dark) => Theme::Light,
        _ => Theme::Dark,
      };
      apply_theme_to_all(app, next);
    }
    // keep the rest as visual-only (no-op for now)
    _ => {}
  }
}
