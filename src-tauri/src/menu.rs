use tauri::{
  AppHandle, Emitter, Manager, Runtime, WebviewUrl, WebviewWindowBuilder,
  menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem, Submenu},
};

const APP_TITLE: &str = "ChatGPT";
const CONFIG_HASH: &str = "#/config";

/// Build the full Linux-only menubar.
pub fn build_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
  // ChatGPT (app) menu
  let chatgpt = Submenu::with_items(app, APP_TITLE, true, &[
    &MenuItem::with_id(app, "check-updates", "Check for Updates…", true, None::<&str>)?,
    &PredefinedMenuItem::separator(app)?,
    &PredefinedMenuItem::quit(app, Some("Quit"))?, // Linux label
  ])?;

  // Preferences
  let preferences = Submenu::with_items(app, "Preferences", true, &[
    &MenuItem::with_id(app, "pref-open-config", "Control Center",   true, Some("Shift+Ctrl+G"))?,
    &MenuItem::with_id(app, "pref-restart",     "Restart ChatGPT",  true, Some("Shift+Ctrl+R"))?,
    &MenuItem::with_id(app, "pref-awesome",     "Awesome ChatGPT",  true, Some("Shift+Ctrl+A"))?,
  ])?;

  // Edit
  let edit = Submenu::with_items(app, "Edit", true, &[
    &PredefinedMenuItem::undo(app, None::<&str>)?,
    &PredefinedMenuItem::redo(app, None::<&str>)?,
    &PredefinedMenuItem::separator(app)?,
    &PredefinedMenuItem::cut(app, None::<&str>)?,
    &PredefinedMenuItem::copy(app, None::<&str>)?,
    &PredefinedMenuItem::paste(app, None::<&str>)?,
    &PredefinedMenuItem::select_all(app, None::<&str>)?,
  ])?;

  // View
  let view = Submenu::with_items(app, "View", true, &[
    &MenuItem::with_id(app, "view-back",    "Go Back",                    true, Some("Ctrl+Left"))?,
    &MenuItem::with_id(app, "view-forward", "Go Forward",                 true, Some("Ctrl+Right"))?,
    &MenuItem::with_id(app, "view-top",     "Scroll to Top of Screen",    true, Some("Ctrl+Up"))?,
    &MenuItem::with_id(app, "view-bottom",  "Scroll to Bottom of Screen", true, Some("Ctrl+Down"))?,
    &PredefinedMenuItem::separator(app)?,
    &MenuItem::with_id(app, "reload",          "Reload",          true, Some("Ctrl+R"))?,
    &MenuItem::with_id(app, "toggle-devtools", "Toggle DevTools", true, Some("Ctrl+Shift+I"))?,
  ])?;

  // Window
  let window = Submenu::with_items(app, "Window", true, &[
    &MenuItem::with_id(app, "win-stay", "Stay On Top", true, Some("Ctrl+T"))?,
    &MenuItem::with_id(app, "win-tray", "System Tray", true, None::<&str>)?, // placeholder
  ])?;

  // Help
  let help = Submenu::with_items(app, "Help", true, &[
    &MenuItem::with_id(app, "help-log",         "ChatGPT Log",  true, None::<&str>)?,
    &MenuItem::with_id(app, "help-update-log",  "Update Log",   true, None::<&str>)?,
    &MenuItem::with_id(app, "help-report-bug",  "Report Bug",   true, None::<&str>)?,
  ])?;

  Menu::with_items(app, &[
    &chatgpt,
    &preferences,
    &edit,
    &view,
    &window,
    &help,
  ])
}

/// Open (or focus) the lencx-style Config window (hash route).
fn open_or_focus_config<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
  #[cfg(debug_assertions)]
  let url = {
    // Vite dev server with route path (no leading '#')
    let path = CONFIG_HASH.trim_start_matches('#').trim_start_matches('/');
    let full = format!("http://localhost:1420/{path}");
    WebviewUrl::External(full.parse().unwrap())
  };

  #[cfg(not(debug_assertions))]
  let url = {
    // bundled index.html + hash
    let full = format!("index.html{CONFIG_HASH}");
    WebviewUrl::App(full.into())
  };

  if app.get_webview_window("config").is_none() {
    WebviewWindowBuilder::new(app, "config", url)
      .title("Config")
      .resizable(true)
      .inner_size(760.0, 520.0)
      .build()?;
  }
  if let Some(cfg) = app.get_webview_window("config") {
    let _ = cfg.show();
    let _ = cfg.set_focus();
  }
  Ok(())
}

/// Handle menu actions.
pub fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, event: MenuEvent) {
  match event.id().as_ref() {
    // App
    "check-updates" => {
      let _ = app.emit("menu-check-updates", ());
    }

    // Preferences
    "pref-open-config" => {
      let _ = open_or_focus_config(app);
    }
    "pref-restart" => {
      tauri::process::restart(&app.env());
    }
    "pref-awesome" => {
      // New opener API: just pass the URL and None for "with"
      let _ = tauri_plugin_opener::open_url(
        "https://github.com/lencx/awesome-chatgpt-prompts",
        None::<&str>,
      );
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
    "view-back" => {
      if let Some(win) = app.get_webview_window("core") {
        let _ = win.eval("history.back()");
      }
    }
    "view-forward" => {
      if let Some(win) = app.get_webview_window("core") {
        let _ = win.eval("history.forward()");
      }
    }
    "view-top" => {
      if let Some(win) = app.get_webview_window("core") {
        let _ = win.eval("window.scrollTo(0,0)");
      }
    }
    "view-bottom" => {
      if let Some(win) = app.get_webview_window("core") {
        let _ = win.eval("window.scrollTo(0,document.body.scrollHeight)");
      }
    }

    // Window
    "win-stay" => {
      if let Some(win) = app.get_webview_window("core") {
        if let Ok(current) = win.is_always_on_top() {
          let _ = win.set_always_on_top(!current);
        } else {
          let _ = win.set_always_on_top(true);
        }
      }
    }
    "win-tray" => {
      // optional: toggle tray visibility; for now just notify frontend
      let _ = app.emit("menu-toggle-tray", ());
    }

    // Help
    "help-log" =>         { let _ = app.emit("open-chatgpt-log", ()); }
    "help-update-log" =>  { let _ = app.emit("open-update-log", ()); }
    "help-report-bug" => {
      let _ = tauri_plugin_opener::open_url(
        "https://github.com/SpellboundScents/ChatGPT/issues/new",
        None::<&str>,
      );
    }

    _ => {}
  }
}
