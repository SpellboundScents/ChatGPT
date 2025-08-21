// src-tauri/src/conf.rs  (Linux-only, Tauri 2.x)

use crate::utils::{chat_root, create_file, exists};
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};

// ---------- Default config (JSON written when file is missing/corrupt) ----------
pub const DEFAULT_CHAT_CONF: &str = r#"{
  "theme": "system",
  "auto_update": true,
  "tray": true,
  "popup_search": false,
  "stay_on_top": false,
  "default_origin": "https://chatgpt.com",
  "origin": "https://chatgpt.com",
  "ua_window": "",
  "ua_tray": "",
  "global_shortcut": "",
  "titlebar": false,
  "hide_dock_icon": false
}"#;

// ---------- Strongly-typed config ----------
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)] // tolerate missing fields in older user files
pub struct ChatConfJson {
  pub theme: String,
  pub auto_update: bool,
  pub tray: bool,
  pub popup_search: bool,
  pub stay_on_top: bool,
  pub default_origin: String,
  pub origin: String,
  pub ua_window: String,
  pub ua_tray: String,
  pub global_shortcut: String,
  pub titlebar: bool,
  pub hide_dock_icon: bool,
}

impl ChatConfJson {
  pub fn conf_path() -> PathBuf {
    chat_root().join("chat.conf.json")
  }

  pub fn load() -> Self {
    let path = Self::conf_path();

    if !exists(&path) {
      let _ = create_file(&path, DEFAULT_CHAT_CONF);
      return serde_json::from_str(DEFAULT_CHAT_CONF).unwrap_or_default();
    }

    let raw = fs::read_to_string(&path).unwrap_or_else(|_| DEFAULT_CHAT_CONF.to_string());
    serde_json::from_str(&raw).unwrap_or_else(|_| {
      let _ = create_file(&path, DEFAULT_CHAT_CONF);
      serde_json::from_str(DEFAULT_CHAT_CONF).unwrap_or_default()
    })
  }

  pub fn save(&self) -> anyhow::Result<()> {
    let path = Self::conf_path();
    let s = serde_json::to_string_pretty(self)?;
    create_file(&path, &s)?;
    Ok(())
  }

  pub fn reset_to_defaults() -> anyhow::Result<Self> {
    let conf: ChatConfJson = serde_json::from_str(DEFAULT_CHAT_CONF)?;
    conf.save()?;
    Ok(conf)
  }
}

// ---------- Tauri commands ----------
#[tauri::command]
pub fn get_chat_conf() -> ChatConfJson {
  ChatConfJson::load()
}

#[tauri::command]
pub fn set_chat_conf(conf: ChatConfJson) -> Result<(), String> {
  conf.save().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn reset_chat_conf() -> Result<ChatConfJson, String> {
  ChatConfJson::reset_to_defaults().map_err(|e| e.to_string())
}
