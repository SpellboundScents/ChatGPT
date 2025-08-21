use tauri::{
  menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem, Submenu},
  AppHandle, Emitter, Manager, Runtime, Theme, WebviewUrl, WebviewWindowBuilder,
};
use tauri_plugin_opener::open_url;

// ----- helpers ---------------------------------------------------------------

// Apply a native theme to all open windows.
fn apply_theme_to_all<R: Runtime>(app: &AppHandle<R>, theme: Theme) {
  for w in app.webview_windows().values() {
    let _ = w.set_theme(Some(theme));
  }
}

// Open (or focus) the lencx-style Config window (hash route).
fn open_or_focus_config<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
  #[cfg(debug_assertions)]
  let url = {
    let full = "http://localhost:1420/#/config";
    WebviewUrl::External(full.parse().unwrap())
  };

  #[cfg(not(debug_assertions))]
  let url = WebviewUrl::App("index.html#/config".into());

  if app.get_webview_window("config").is_none() {
  let win = WebviewWindowBuilder::new(app, "config", url)
    .title("Config")
    .resizable(true)
    .inner_size(760.0, 520.0)
    .build()?;

  #[cfg(debug_assertions)]
  {
    let _ = win.open_devtools();
    let _ = win.show();
    let _ = win.set_focus();
  }
}
}

// ----- menu builders ---------------------------------------------------------

pub fn build_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
  // ChatGPT
  let chatgpt = Submenu::with_items(app, "ChatGPT", true, &[
    &PredefinedMenuItem::separator(app)?,
    &MenuItem::with_id(app, "check-updates", "Check for Updates…", true, None::<&str>)?,
    &MenuItem::with_id(app, "donate", "☕ Buy Me a Coffee", true, None::<&str>)?,
    &PredefinedMenuItem::quit(app, None::<&str>)?,
  ])?;

  // View
  let view = Submenu::with_items(app, "View", true, &[
    &MenuItem::with_id(app, "reload", "Reload", true, Some("Ctrl+R"))?,
    &MenuItem::with_id(app, "toggle-devtools", "Toggle DevTools", true, Some("Ctrl+Shift+I"))?,
    &MenuItem::with_id(app, "toggle-darkmode", "Toggle Dark Mode", true, None::<&str>)?,
  ])?;

  // Preferences
  let preferences = Submenu::with_items(app, "Preferences", true, &[
    &MenuItem::with_id(app, "pref-open-config", "Control Center",  true, Some("Shift+Ctrl+G"))?,
    &MenuItem::with_id(app, "pref-restart",     "Restart ChatGPT", true, Some("Shift+Ctrl+R"))?,
    &MenuItem::with_id(app, "pref-awesome",     "Awesome ChatGPT", true, Some("Shift+Ctrl+A"))?,
  ])?;

  // Help
  let help = Submenu::with_items(app, "Help", true, &[
    &MenuItem::with_id(app, "help-log",         "ChatGPT Log",  true, None::<&str>)?,
    &MenuItem::with_id(app, "help-update-log",  "Update Log",   true, None::<&str>)?,
    &MenuItem::with_id(app, "help-report-bug",  "Report Bug",   true, None::<&str>)?,
  ])?;

  Menu::with_items(app, &[&chatgpt, &preferences, &view, &help])
}

pub fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, event: MenuEvent) {
  match event.id().as_ref() {
    // ChatGPT
    "check-updates" => {
      let _ = app.emit("menu-check-updates", ());
    }
    "donate" => {
      let _ = open_url("https://buymeacoffee.com/chirv", None::<&str>);
    }

    // Preferences
    "pref-open-config" => {
      let _ = open_or_focus_config(app);
    }
    "pref-restart" => {
      tauri::process::restart(&app.env());
    }
    "pref-awesome" => {
      let _ = open_url("https://github.com/lencx/awesome-chatgpt-prompts", None::<&str>);
    }

    // View
    "reload" => {
      if let Some(win) = app.get_webview_window("core") {
        let _ = win.eval("location.reload()");
      }
    }
    "toggle-devtools" => {
      #[cfg(debug_assertions)]
      if let Some(win) = app.get_webview_window("core") {
        let _ = win.open_devtools();
      }
    }
    "toggle-darkmode" => {
      // Get current theme from "core" window (Result -> Option via .ok()).
      let current = app
        .get_webview_window("core")
        .and_then(|w| w.theme().ok());

      // Theme is non-exhaustive; handle Light/Dark explicitly, fallback otherwise.
      let next = match current {
        Some(Theme::Dark) => Theme::Light,
        Some(Theme::Light) => Theme::Dark,
        _ => Theme::Dark, // treat None/System/others as Light->Dark toggle start
      };

      // Apply to all open windows (native chrome).
      apply_theme_to_all(app, next);

      // If your local Config SPA listens for a CSS switch, you can still tell it:
      let _ = app.emit("menu-toggle-dark", ());
    }

    // Help
    "help-log" =>        { let _ = app.emit("open-chatgpt-log", ()); }
    "help-update-log" => { let _ = app.emit("open-update-log", ()); }
    "help-report-bug" => {
      let _ = open_url("https://github.com/SpellboundScents/ChatGPT/issues/new", None::<&str>);
    }

    _ => {}
  }
}
