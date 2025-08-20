#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]

mod menu;

use tauri::{
  AppHandle, Builder, Manager, PhysicalPosition, Result,
  WebviewUrl, WebviewWindow, WebviewWindowBuilder, Wry,
};
use tauri::tray::{TrayIcon, TrayIconBuilder};
use tauri::webview::PageLoadEvent;
use tauri_plugin_autostart::MacosLauncher;

// ===== Loader overlay injectors (in-window, no extra windows) ===============
const LOADER_INJECT_JS: &str = r#"
(function(){
  if (window.__nick_loader_init) return; window.__nick_loader_init = true;

  function ensureStyle(){
    if (document.getElementById('nick-loader-style')) return;
    const s = document.createElement('style'); s.id='nick-loader-style';
    s.textContent = `
      #nick-loader{
        position:fixed;top:24px;left:50%;transform:translateX(-50%);
        padding:.55rem .8rem;border-radius:999px;
        background:color-mix(in oklab, Canvas, CanvasText 6%);
        color:CanvasText;box-shadow:0 6px 24px rgba(0,0,0,.18);
        display:inline-flex;align-items:center;gap:.5rem;
        font:600 13px system-ui,ui-sans-serif,Segoe UI,Roboto,Arial; z-index:2147483647
      }
      #nick-loader svg{display:block}
      #nick-loader .arc{transform-origin:8.5px 9px;animation:nick-rotate 1s linear infinite}
      @keyframes nick-rotate{to{transform:rotate(360deg)}}
      @media (prefers-reduced-motion:reduce){#nick-loader .arc{animation:none}}
    `;
    document.head.appendChild(s);
  }

  function ensureNode(){
    if (document.getElementById('nick-loader')) return;
    const d = document.createElement('div'); d.id='nick-loader'; d.setAttribute('aria-busy','true'); d.setAttribute('aria-live','polite');
    d.innerHTML = '<svg width="28" height="28" viewBox="0 0 18 18" role="img" aria-label="Loading">'
      + '<circle cx="9" cy="9" r="7" fill="none" stroke="currentColor" stroke-width="2" opacity=".15"/>'
      + '<path class="arc" d="M9 2 a7 7 0 0 1 0 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
      + '<span>Loading…</span>';
    document.documentElement.appendChild(d);
  }

  window.__loaderShow = function(){
    try{ ensureStyle(); ensureNode(); const n=document.getElementById('nick-loader'); if(n) n.style.display='inline-flex'; }catch(e){}
  };
  window.__loaderHide = function(){
    try{ const n=document.getElementById('nick-loader'); if(n) n.style.display='none'; }catch(e){}
  };
})();
"#;

const LOADER_SHOW_JS: &str = "try{(window.__loaderShow||new Function)()}catch(e){}";
const LOADER_HIDE_JS: &str = "try{(window.__loaderHide||new Function)()}catch(e){}";

// your injected scripts for the main webview
const VIRTUALIZER_JS: &str = include_str!("../injected/virtualizer.js");
const VIRTUALIZER_LOADER_JS: &str = include_str!("../injected/virtualizer-loader.js");

// ---- tray -------------------------------------------------------------------
fn build_tray(app: &tauri::AppHandle) -> tauri::Result<TrayIcon> {
  let tray = TrayIconBuilder::new()
    .on_tray_icon_event(|tray, event| {
      if let tauri::tray::TrayIconEvent::Click { .. } = event {
        let app = tray.app_handle();
        // focus the first app window we can find
        for w in app.webview_windows().values() {
          let _ = w.show();
          let _ = w.set_focus();
          break;
        }
      }
    })
    .build(app)?;
  Ok(tray)
}

// ---- helpers ----------------------------------------------------------------
fn any_app_window(app: &AppHandle) -> Option<WebviewWindow<Wry>> {
  // just pick the first window (works even if label isn't "core")
  app.webview_windows().values().next().cloned()
}

// ---- app entry --------------------------------------------------------------
fn main() -> Result<()> {
  Builder::default()
    // plugins
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_single_instance::init(|_, _, _| {}))
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
    .plugin(tauri_plugin_opener::init())

    // menubar
    .menu(|app| menu::build_menu(app))
    .on_menu_event(|app, event| menu::handle_menu_event(app, event))

    // in-window loader: inject on every navigation start, hide on finish
    .on_page_load(|window, payload| {
      match payload.event() {
        PageLoadEvent::Started => {
          // re-inject (fresh docs on navigation) and show
          let _ = window.eval(LOADER_INJECT_JS);
          let _ = window.eval(LOADER_SHOW_JS);
        }
        PageLoadEvent::Finished => {
          // ensure window is visible/focused, then hide loader
          let _ = window.show();
          let _ = window.set_focus();
          let _ = window.eval(LOADER_HIDE_JS);
        }
      }
    })

    .setup(|app| {
      // reuse existing window (from config) or create one
      let main = if let Some(existing) = any_app_window(&app.handle()) {
        // make sure overlays exist right now
        let _ = existing.eval(LOADER_INJECT_JS);
        let _ = existing.eval(LOADER_SHOW_JS);
        let _ = existing.eval(VIRTUALIZER_JS);
        let _ = existing.eval(VIRTUALIZER_LOADER_JS);
        // show the window (visible in taskbar/dock) — content will hide loader when first Finished fires
        let _ = existing.show();
        existing
      } else {
        // create our own
        #[cfg(debug_assertions)]
        let url = WebviewUrl::External("http://localhost:1420".parse().unwrap());
        #[cfg(not(debug_assertions))]
        let url = WebviewUrl::External("https://chatgpt.com".parse().unwrap());

        WebviewWindowBuilder::new(app, "core", url)
          .title("ChatGPT")
          .resizable(true)
          .visible(true) // visible immediately so user sees a window
          .initialization_script(LOADER_INJECT_JS) // present at very first load
          .initialization_script(LOADER_SHOW_JS)   // show immediately
          .initialization_script(VIRTUALIZER_JS)
          .initialization_script(VIRTUALIZER_LOADER_JS)
          .build()?
      };

      // small nicety: center the loader horizontally relative to window (in case of DPI/layout changes)
      if let (Ok(pos), Ok(size)) = (main.outer_position(), main.outer_size()) {
        // just log for debugging; overlay itself is CSS-centered
        println!("[core] window at ({}, {}), size {}x{}", pos.x, pos.y, size.width, size.height);
      }

      // tray
      let _tray = build_tray(&app.handle())?;
      Ok(())
    })
    .run(tauri::generate_context!())
}