use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

pub fn open_control_center(app: &AppHandle) {
  if app.get_webview_window("control").is_none() {
    let _ = WebviewWindowBuilder::new(
      app,
      "control",
      WebviewUrl::App("index.html#/settings".into()),
    )
    .title("Control Center")
    .resizable(true)
    .inner_size(800.0, 600.0)
    .min_inner_size(800.0, 600.0)
    .build();
  } else if let Some(win) = app.get_webview_window("control") {
    let _ = win.show();
    let _ = win.set_focus();
  }
}
