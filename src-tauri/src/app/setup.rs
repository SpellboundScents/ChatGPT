use tauri::process;
// If you had global shortcuts, they are a plugin in v2:
// use tauri_plugin_global_shortcut::GlobalShortcutExt;

// Create or show the control window (replacing v1 WindowBuilder + WindowUrl)
pub fn open_control_window(app: &AppHandle) -> tauri::Result<()> {
  if app.get_webview_window("main").is_none() {
    let url = WebviewUrl::App("index.html".into());
    WebviewWindowBuilder::new(app, "main", url)
      .title("Control Center")
      .resizable(true)
      .inner_size(800.0, 600.0)
      .min_inner_size(800.0, 600.0)
      .build()?;
  } else if let Some(win) = app.get_webview_window("main") {
    let _ = win.show();
    let _ = win.set_focus();
  }
  Ok(())
}

// Example: process restart
pub fn restart(app: &AppHandle) {
  let _ = process::restart(&app.env());
}
