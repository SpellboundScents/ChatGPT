<p align="center">
  <img width="180" src="./public/project-logo.png" alt="ChatGPT">
  <h1 align="center">ChatGPT Desktop (Modern Fork)</h1>
  <p align="center">An updated ChatGPT desktop client for Linux — forked from earlier community builds.</p>
</p>

![License](https://img.shields.io/badge/License-Apache%202-green.svg) ![ChatGPT Desktop](https://img.shields.io/badge/ChatGPT%20Desktop-Linux-yellow?style=flat&labelColor=555555&logo=https://raw.githubusercontent.com/SpellboundScents/ChatGPT/refs/heads/master/public/chatgpt.svg&logoWidth=20) [![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-chirv-orange?logo=buy-me-a-coffee&logoColor=white)](https://www.buymeacoffee.com/chirv)

---

## 📖 About This Fork

This repository is originally a **modernized fork** of [lencx/ChatGPT](https://github.com/lencx/ChatGPT). It has been re-written in Tauri 2, and most of the original features are being re-implemented.

The upstream forks created excellent cross-platform desktop clients for [OpenAI’s ChatGPT](https://chat.openai.com).  
This fork carries that lineage forward with a **Linux-only focus** and these goals:

- 🔄 **Stay compatible with the latest ChatGPT models and web features**  
- 🛠 **Improve stability and performance on Linux**  
- 📦 **Modernize the build system and updater** (signed releases from this repo only)  
- 🧹 **Remove legacy dependencies and cross-platform code** no longer needed  

---

## ✨ Current Progress

Recent changes include:

- Migrated codebase into a new fork with its own identity  
- Updated package metadata, app identifiers, and build configuration  
- Rewired the Tauri auto-updater to point at **this repo’s releases**  
- Generated a **new updater signing keypair** so only builds from this fork are trusted  
- Began revising the documentation (this README)  
- Fixed many **UI bugs**, especially in chats with large code blocks  
- **Upgraded from Tauri 1.x → 2.x**  
- Revised the **Menubar**  
- **Removed Windows and macOS code** (Linux only; OpenAI has official apps for other OSes)  
- Everything is built & tested on **Zorin/Ubuntu with VS Code**  
- Added **loading icon** during startup  
- Optimized rendering (only messages in viewport render → boosts performance)

---

## 🚀 Roadmap

- ✅ Updater infrastructure (GitHub Actions + signed releases)  
- ✅ Migrated internals for **latest ChatGPT models & UI changes**  
- ✅ Improved Linux build workflows  
- ✅ Migrated to **Tauri 2**  
- ⏳ Refresh app branding & assets  
- ⏳ Continue squashing UI bugs  
- ⏳ Speed up loading times  
- ⏳ Rework configuration menu  
- ⏳ Fix dark mode toggle  
- ⏳ Fix scroll bar bugs
---

## 📦 Installation

Releases will be published under [Releases](https://github.com/SpellboundScents/ChatGPT/releases).  
Download the Linux installer of your choice once available.

---

## 🛠 Development Setup

### Prerequisites
- [Rust](https://www.rust-lang.org/)  
- [Node.js](https://nodejs.org/)  
- [pnpm (v9 or newer)](https://pnpm.io/)  
- [Tauri dependencies](https://tauri.app/v1/guides/getting-started/prerequisites) for Linux:  
  - `libgtk-3-dev`  
  - `libwebkit2gtk-4.0-dev`  
  - `libayatana-appindicator3-dev`  
  - `librsvg2-dev`  

  ```bash
  bash prereq.sh
  ```

### 🚀 Run Locally
```bash
git clone https://github.com/SpellboundScents/ChatGPT.git
cd ChatGPT
pnpm install
```
