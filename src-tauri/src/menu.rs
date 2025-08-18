use tauri::{
    AppHandle, Manager, WebviewUrl, WebviewWindowBuilder,
    menu::{Menu, MenuItem, Submenu, PredefinedMenuItem, MenuEvent, MenuId, MenuItemBuilder}
};

pub fn build_menu(app: &AppHandle) -> Menu {
    let chatgpt_menu = Submenu::new(
        app,
        "ChatGPT",
        Menu::new()
            .add_item(MenuItem::About("About ChatGPT".into()))
            .add_item(PredefinedMenuItem::separator())
            .add_item(MenuItem::with_id("check-updates", "Check for Updates", true, None::<&str>))
            .add_item(MenuItem::with_id("hide", "Hide", true, Some("CmdOrCtrl+H")))
            .add_item(PredefinedMenuItem::quit())
    );

    let preferences_menu = Submenu::new(
        app,
        "Preferences",
        Menu::new()
            .add_item(MenuItem::with_id("pref-config", "Go to Config", true, Some("Shift+CmdOrCtrl+G")))
            .add_item(MenuItem::with_id("pref-clear", "Clear Config", true, Some("Shift+CmdOrCtrl+D")))
            .add_item(MenuItem::with_id("pref-restart", "Restart ChatGPT", true, Some("Shift+CmdOrCtrl+R")))
            .add_item(MenuItem::with_id("pref-awesome", "Awesome ChatGPT", true, Some("Shift+CmdOrCtrl+A")))
            .add_item(MenuItem::with_id("pref-buycoffee", "Buy lencx a coffee", true, None::<&str>))
    );

    let window_menu = Submenu::new(
        app,
        "Window",
        Menu::new()
            .add_item(MenuItem::with_id("win-stay", "Stay On Top", true, Some("CmdOrCtrl+T")))
            .add_item(MenuItem::with_id("win-tray", "System Tray", true, None::<&str>))
    );

    let edit_menu = Submenu::new(
        app,
        "Edit",
        Menu::new()
            .add_item(PredefinedMenuItem::undo())
            .add_item(PredefinedMenuItem::redo())
            .add_item(PredefinedMenuItem::separator())
            .add_item(PredefinedMenuItem::cut())
            .add_item(PredefinedMenuItem::copy())
            .add_item(PredefinedMenuItem::paste())
            .add_item(PredefinedMenuItem::select_all())
    );

    let view_menu = Submenu::new(
        app,
        "View",
        Menu::new()
            .add_item(MenuItem::with_id("view-back", "Go Back", true, Some("CmdOrCtrl+Left")))
            .add_item(MenuItem::with_id("view-forward", "Go Forward", true, Some("CmdOrCtrl+Right")))
            .add_item(MenuItem::with_id("view-top", "Scroll to Top of Screen", true, Some("CmdOrCtrl+Up")))
            .add_item(MenuItem::with_id("view-bottom", "Scroll to Bottom of Screen", true, Some("CmdOrCtrl+Down")))
            .add_item(MenuItem::with_id("view-refresh", "Refresh the Screen", true, Some("CmdOrCtrl+R")))
    );

    let help_menu = Submenu::new(
        app,
        "Help",
        Menu::new()
            .add_item(MenuItem::with_id("help-log", "ChatGPT Log", true, None::<&str>))
            .add_item(MenuItem::with_id("help-update", "Update Log", true, None::<&str>))
            .add_item(MenuItem::with_id("help-bug", "Report Bug", true, None::<&str>))
            .add_item(MenuItem::with_id("help-devtools", "Toggle Developer Tools", true, Some("Shift+CmdOrCtrl+I")))
    );

    Menu::new()
        .add_submenu(chatgpt_menu)
        .add_submenu(preferences_menu)
        .add_submenu(window_menu)
        .add_submenu(edit_menu)
        .add_submenu(view_menu)
        .add_submenu(help_menu)
}

pub fn handle_menu_event(app: &AppHandle, event: MenuEvent) {
    match event.id().as_ref() {
        "pref-config" => {
            // open or focus config window
            if app.get_webview_window("config").is_none() {
                let _ = WebviewWindowBuilder::new(
                    app,
                    "config",
                    WebviewUrl::App("config.html".into())
                )
                .title("Config")
                .inner_size(600.0, 400.0)
                .resizable(true)
                .build();
            } else if let Some(win) = app.get_webview_window("config") {
                let _ = win.set_focus();
            }
        }
        "help-devtools" => {
            if let Some(main) = app.get_webview_window("core") {
                let _ = main.open_devtools();
            }
        }
        "quit" => {
            app.exit(0);
        }
        _ => {}
    }
}
