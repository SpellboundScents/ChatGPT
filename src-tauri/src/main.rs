#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod app;
mod conf;
mod utils;

use app::{cmd, fs_extra, menu, setup};
use conf::ChatConfJson;
use tauri::api::path;
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_log::{
    fern::colors::{Color, ColoredLevelConfig},
    LogTarget, LoggerBuilder,
};

#[tokio::main]
async fn main() {
    ChatConfJson::init();
    // If the file does not exist, creating the file will block menu synchronization
    utils::create_chatgpt_prompts();
    let context = tauri::generate_context!();
    let colors = ColoredLevelConfig {
        error: Color::Red,
        warn: Color::Yellow,
        debug: Color::Blue,
        info: Color::BrightGreen,
        trace: Color::Cyan,
    };

    cmd::download_list("chat.download.json", "download", None, None);
    cmd::download_list("chat.notes.json", "notes", None, None);

    let chat_conf = ChatConfJson::get_chat_conf();

    let mut builder = tauri::Builder::default()
        // https://github.com/tauri-apps/tauri/pull/2736
        .plugin(
            LoggerBuilder::new()
                .level(log::LevelFilter::Debug)
                .with_colors(colors)
                .targets([
                    // LogTarget::LogDir,
                    // LOG PATH: ~/.chatgpt/ChatGPT.log
                    LogTarget::Folder(path::home_dir().unwrap().join(".chatgpt")),
                    LogTarget::Stdout,
                    LogTarget::Webview,
                ])
                .build(),
        )
        .plugin(tauri_plugin_positioner::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .invoke_handler(tauri::generate_handler![
            cmd::drag_window,
            cmd::fullscreen,
            cmd::download,
            cmd::save_file,
            cmd::open_link,
            cmd::get_chat_conf,
            cmd::get_theme,
            cmd::reset_chat_conf,
            cmd::run_check_update,
            cmd::form_cancel,
            cmd::form_confirm,
            cmd::form_msg,
            cmd::open_file,
            cmd::get_chat_model_cmd,
            cmd::parse_prompt,
            cmd::sync_prompts,
            cmd::sync_user_prompts,
            cmd::window_reload,
            cmd::dalle2_window,
            cmd::cmd_list,
            cmd::download_list,
            cmd::get_download_list,
            fs_extra::metadata,
        ])
        .setup(setup::init)
        .menu(menu::init());

    if chat_conf.tray {
    builder = builder.system_tray(menu::tray_menu());
}

// Inject CSS + fix clipping in the chat area (messages & code blocks)
builder = builder.on_page_load(|window, _payload| {
    // 1) Load our scoped CSS at compile-time
    let css: &str = include_str!("../injected.css");
    let css_json = serde_json::to_string(css).unwrap();

    // 2) JS: inject CSS (document + shadow roots), tag chat container,
    //    and permanently unclip code blocks only inside the chat area.
    let js = format!(r#"
      (function () {{
        const CSS = {css_json};

        // --- helpers ---
        function ensureStyle(root, key) {{
          try {{
            const doc = (root && root.ownerDocument) ? root.ownerDocument : document;
            const q   = (root && root.querySelector) ? root.querySelector.bind(root) : document.querySelector.bind(document);
            let style = q('style[data-injected-by=\"' + key + '\"]');
            if (!style) {{
              style = doc.createElement('style');
              style.setAttribute('data-injected-by', key);
              (root === document ? (document.head || document.documentElement) : root).appendChild(style);
            }}
            if (style.textContent !== CSS) style.textContent = CSS;
          }} catch (_) {{}}
        }}

        function tagMain() {{
          const main = document.querySelector('[role=\"main\"]') || document.querySelector('main');
          if (main && !main.hasAttribute('data-nick-fix')) main.setAttribute('data-nick-fix','');
          return main;
        }}

        function injectAll() {{
          // document head
          ensureStyle(document, 'tauri');
          // all open shadow roots
          document.querySelectorAll('*').forEach(el => {{
            if (el && el.shadowRoot) ensureStyle(el.shadowRoot, 'tauri-shadow');
          }});
          tagMain();
        }}

        function startObserver() {{
          const target = document.documentElement || document.body;
          if (!target) return;
          const obs = new MutationObserver(() => injectAll());
          obs.observe(target, {{ childList: true, subtree: true }});
          markEmptyParas(document);
        }}

        // --- code block unclipping only inside chat area ---
        function unclipWithinChat() {{
          const chatRoot = tagMain();
          if (!chatRoot) return;

          function relax(el) {{
            try {{
              el.style.overflowY = 'visible';
              el.style.maxHeight = 'none';
              el.style.WebkitMaskImage = 'none';
              el.style.maskImage = 'none';
            }} catch (_){{
            }}
          }}

          function preparePre(pre) {{
            Object.assign(pre.style, {{
              whiteSpace: 'pre',
              overflowX: 'auto',
              overflowY: 'visible',
              maxHeight: 'none',
              WebkitMaskImage: 'none',
              maskImage: 'none',
              display: 'block',
              contain: 'paint',
            }});
          }}

          function fixBlock(pre) {{
            preparePre(pre);
            let p = pre.parentElement, hops = 0;
            while (p && p !== chatRoot && hops++ < 6) {{
              const s = getComputedStyle(p);
              const clips = (
                s.overflow !== 'visible' || s.overflowY !== 'visible' || s.overflowX !== 'visible' ||
                (s.maxHeight && s.maxHeight !== 'none') ||
                (s.webkitMaskImage && s.webkitMaskImage !== 'none') ||
                (s.maskImage && s.maskImage !== 'none')
              );
              if (clips) relax(p);
              p = p.parentElement;
            }}
          }}

          function sweep(root) {{
            root.querySelectorAll?.('[data-nick-fix] pre, pre').forEach(fixBlock);
          }}

          // Mark paragraphs that are effectively empty so CSS can collapse them
function markEmptyParas(root) {{
  const SQUEEZE = /[\\s\\u200b\\u200c\\u200d\\u2060\\ufeff]/g;
  (root.querySelectorAll ? root.querySelectorAll('[data-nick-fix] p, main p, [role="main"] p') : []).forEach(p => {{
    try {{
      // Treat <br> only as empty too
      const html = (p.innerHTML || '').replace(/<br\\s*\\/?>(\\s|&nbsp;)*$/i, '');
      const txt  = html.replace(/<[^>]*>/g, '').replace(SQUEEZE, '');
      if (!txt && !p.hasAttribute('data-nick-empty')) {{
        p.setAttribute('data-nick-empty', '');
      }} else if (txt && p.hasAttribute('data-nick-empty')) {{
        p.removeAttribute('data-nick-empty');
      }}
    }} catch (_){{
    }}
  }});
}}

          // run once now
          sweep(chatRoot);

          // keep fixing as new messages stream in
          const mo = new MutationObserver(muts => {{
            for (const m of muts) {{
              for (const n of m.addedNodes) {{
                if (n.nodeType === 1) sweep(n);
              }}
            }}
          }});
          mo.observe(chatRoot, {{ childList: true, subtree: true }});
          markEmptyParas(document);
        }}

        // --- boot (DOM-safe) ---
        function boot() {{
          injectAll();
          startObserver();
          unclipWithinChat();
          markEmptyParas(document);
        }}
        if (document.readyState === 'loading') {{
          document.addEventListener('DOMContentLoaded', boot, {{ once: true }});
        }} else {{
          boot();
        }}
      }})();
    "#);

    let _ = window.eval(&js);
});


builder
    .on_menu_event(menu::menu_handler)
    .on_system_tray_event(menu::tray_handler)
        .on_window_event(|event| {
            // https://github.com/tauri-apps/tauri/discussions/2684
            if let tauri::WindowEvent::CloseRequested { api, .. } = event.event() {
                let win = event.window();
                if win.label() == "core" {
                    // TODO: https://github.com/tauri-apps/tauri/issues/3084
                    // event.window().hide().unwrap();
                    // https://github.com/tauri-apps/tao/pull/517
                    #[cfg(target_os = "macos")]
                    event.window().minimize().unwrap();

                    // fix: https://github.com/lencx/ChatGPT/issues/93
                    #[cfg(not(target_os = "macos"))]
                    event.window().hide().unwrap();
                } else {
                    win.close().unwrap();
                }
                api.prevent_close();
            }
        })
        .run(context)
        .expect("error while running ChatGPT application");
}
