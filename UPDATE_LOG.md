## v1.0
initial fork
- fixes most of the UI bugs, especially with code blocks in chat.
    - uses injected css
- some bugs still exist, but this is more tolerable.
- updated components to most recent updates for 2025.

## v1.1.0-rc.0
- Migration to Tauri 2
- Updated all core dependencies and plugins to the Tauri 2.x ecosystem
- Rewritten main.rs, menu.rs, and supporting modules for new API compatibility
- System Tray Improvements
- Tray icon click now brings the core window to the foreground
- Core window is automatically focused on launch
- Menu option to switch between Light, Dark, and System themes
- Current preference is remembered across sessions
- Auto-Updater Integration
- Linked to project’s GitHub repo for future update checks
- “Check for Updates…” menu item triggers updater flow
- GitHub “Report Issue” link included
- Cleaner startup sequence: core window shows and focuses automatically
- Refactored window/tray creation logic for stability on Linux
- Removed platform-specific (macOS/Windows) menu items for a Linux-focused build

## v1.1.0-rc.1
- Added page loading indicator
- Converted original configuration window to Tauri 2
- Chats only paint messages in viewport
- Messages now always nest at bottom
- Downloads go directly to ~/Downloads

## v1.1.0-rc.2
- Wired in updater
- Configured dark mode toggles