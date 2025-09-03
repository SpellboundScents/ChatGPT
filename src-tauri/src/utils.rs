use std::{
  env,
  fs,
  path::{Path, PathBuf},
};

use tauri::{AppHandle, Emitter, Manager, Theme};
use tauri::process;
use tauri_plugin_updater::UpdaterExt;

use crate::conf::ChatConfJson;

use serde::Serialize;

#[derive(Serialize)]
pub struct AppInfo {
  pub name: String,
  pub version: String,
}

#[tauri::command]
pub fn get_app_info(app: tauri::AppHandle) -> std::result::Result<AppInfo, String> {
  let pkg = app.package_info();
  Ok(AppInfo {
    name: pkg.name.clone(),
    version: pkg.version.to_string(),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// THEME: apply to all windows, broadcast to React, and persist to chat.conf.json
// ─────────────────────────────────────────────────────────────────────────────
#[tauri::command]
pub fn set_theme_all(app: AppHandle, theme: String) -> std::result::Result<(), String> {
  let t = theme.to_lowercase();

  let native: Option<Theme> = match t.as_str() {
    "dark" => Some(Theme::Dark),
    "light" => Some(Theme::Light),
    _ => None, // "system" -> follow OS
  };

  // 1) Native chrome on every window (core + config)
  for w in app.webview_windows().values() {
    let _ = w.set_theme(native);
  }

  // 2) Tell our React UIs to switch their AntD theme immediately
  for w in app.webview_windows().values() {
    let _ = w.emit("menu-set-theme", &t);
  }

  // 3) Persist to disk
  let mut conf = ChatConfJson::load();
  conf.theme = t;
  conf.save().map_err(|e| e.to_string())
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATER: check + download + install (+ restart)
// ─────────────────────────────────────────────────────────────────────────────
#[tauri::command]
pub async fn run_check_update(
  app: AppHandle,
  silent: bool,
  has_msg: Option<bool>,
) -> std::result::Result<(), String> {
  let show_msg = has_msg.unwrap_or(true) && !silent;

  let updater = app.updater().map_err(|e| e.to_string())?;
  let result = updater.check().await.map_err(|e| e.to_string())?;

  if let Some(update) = result {
    if show_msg {
      let _ = app.emit("notice", "Downloading update…");
    }

    update
      .download_and_install(
        |_chunk, _total| {
          // Optionally: let _ = app.emit("update-progress", (chunk, total));
        },
        || {
          // Optionally: let _ = app.emit("update-finished", ());
        },
      )
      .await
      .map_err(|e| e.to_string())?;

    if show_msg {
      let _ = app.emit("notice", "Update installed. Restarting…");
    }
    tauri::process::restart(&app.env());
  } else if show_msg {
    let _ = app.emit("notice", "You’re up to date.");
  }

  Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers used by conf.rs and frontend bits
// ─────────────────────────────────────────────────────────────────────────────

fn user_home() -> PathBuf {
  #[cfg(windows)]
  {
    PathBuf::from(env::var("USERPROFILE").unwrap_or_else(|_| "C:\\".into()))
  }
  #[cfg(not(windows))]
  {
    PathBuf::from(env::var("HOME").unwrap_or_else(|_| "/".into()))
  }
}

pub fn chat_root() -> PathBuf {
  user_home().join(".chatgpt")
}

pub fn exists<P: AsRef<Path>>(p: P) -> bool {
  p.as_ref().exists()
}

pub fn create_file<P: AsRef<Path>>(p: P, contents: &str) -> std::io::Result<()> {
  if let Some(parent) = p.as_ref().parent() {
    fs::create_dir_all(parent)?;
  }
  fs::write(p, contents)
}

pub fn notify_core(app: &AppHandle, title: &str, body: &str) {
  let _ = app.emit("notice", format!("{title}: {body}"));
}

pub fn restart(app: &AppHandle) {
  let _ = process::restart(&app.env());
}

#[tauri::command]
pub fn open_external(url: String) -> std::result::Result<(), String> {
  tauri_plugin_opener::open_url(&url, None::<&str>).map_err(|e| e.to_string())
}