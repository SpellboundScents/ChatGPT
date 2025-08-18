use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

// Ensure windows exist / create them as needed
pub fn ensure_windows(app: &AppHandle) -> tauri::Result<()> {
  // dalle2 window example
  if app.get_webview_window("dalle2").is_none() {
    let url = WebviewUrl::App("index.html".into());
    WebviewWindowBuilder::new(app, "dalle2", url)
      .title("DALL·E")
      .resizable(true)
      .build()?;
  }

  // main window
  if app.get_webview_window("main").is_none() {
    let url = WebviewUrl::App("index.html".into());
    WebviewWindowBuilder::new(app, "main", url)
      .title("Main")
      .resizable(true)
      .build()?;
  }

  Ok(())
}
