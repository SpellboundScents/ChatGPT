use std::{env, fs, path::{Path, PathBuf}};
use tauri::{AppHandle, Manager, Theme};
use tauri::process;
use tauri_plugin_updater::UpdaterExt;
use tauri::Emitter; 
use std::result::Result;
use crate::conf::ChatConfJson; 

#[tauri::command]
pub fn set_theme_all(app: AppHandle, theme: String) -> Result<(), String> {
  let t = theme.to_lowercase();

  // Map to native theme; "system" => None (follow system)
  let native: Option<Theme> = match t.as_str() {
    "dark" => Some(Theme::Dark),
    "light" => Some(Theme::Light),
    _ => None, // "system" or anything else
  };

  // 1) Apply native theme to every window (core + config)
  for w in app.webview_windows().values() {
    let _ = w.set_theme(native);
  }

  // 2) Broadcast to all webviews so React UIs flip immediately
  for w in app.webview_windows().values() {
    let _ = w.emit("menu-set-theme", &t);
  }

  // 3) Persist to disk
  let mut conf = ChatConfJson::load();
  conf.theme = t.clone(); // "light" | "dark" | "system"
  conf.save().map_err(|e| e.to_string())
}

// HOME dir (portable)
fn user_home() -> PathBuf {
  #[cfg(windows)]
  { PathBuf::from(env::var("USERPROFILE").unwrap_or_else(|_| "C:\\".into())) }
  #[cfg(not(windows))]
  { PathBuf::from(env::var("HOME").unwrap_or_else(|_| "/".into())) }
}

// === helpers expected by conf.rs ===
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

// (optional) show notice: emit to frontend instead of Rust-dialogs for now
pub fn notify_core(app: &AppHandle, title: &str, body: &str) {
  let _ = app.emit("notice", format!("{title}: {body}"));
}

// Updater: supply callbacks to download_and_install
pub async fn run_check_update(app: AppHandle, silent: bool, _has_msg: Option<bool>) {
  if let Ok(updater) = app.updater() {
    match updater.check().await {
      Ok(Some(info)) => {
        if !silent {
          notify_core(&app, "Update", "Downloading update…");
        }
        let on_chunk = |_received: usize, _total: Option<u64>| { /* progress hook if you want */ };
        let on_finish = || { /* download finished hook */ };
        if let Err(e) = info.download_and_install(on_chunk, on_finish).await {
          notify_core(&app, "Update", &format!("Failed: {e}"));
        }
      }
      Ok(None) => {
        if !silent { notify_core(&app, "Update", "You are up to date."); }
      }
      Err(_) => {
        if !silent { notify_core(&app, "Update", "Updater unavailable."); }
      }
    }
  }
}

pub fn restart(app: &AppHandle) {
  let _ = process::restart(&app.env());
}
#[tauri::command]
pub fn open_external(url: String) -> Result<(), String> {
  tauri_plugin_opener::open_url(&url, None::<&str>).map_err(|e| e.to_string())
}
