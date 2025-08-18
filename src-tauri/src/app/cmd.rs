use tauri::{AppHandle, Manager};
use tauri::process;
use tauri_plugin_dialog as dialog;
use tauri_plugin_shell::ShellExt;

#[tauri::command]
pub fn show_message(_app: tauri::AppHandle, _title: &str, _msg: &str, _label: &str) {
  // TODO: emit to frontend and show @tauri-apps/plugin-dialog there
}

#[tauri::command]
pub fn ask_user(_app: tauri::AppHandle, _label: &str, _title: &str, _question: &str) -> bool {
  // TODO: call ask() on the frontend; for now return false (or true) to unblock build
  false
}

