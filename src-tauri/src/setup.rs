use tauri::{App, Manager};
use crate::menu::{build_menu, handle_menu_event};

pub fn init(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    let menu = build_menu(&app.handle());
    app.set_menu(menu)?;
    app.on_menu_event(move |app, event| {
        handle_menu_event(app, event);
    });
    Ok(())
}
