<p align="center">
  <img width="180" src="./public/project-logo.png" alt="ChatGPT">
  <h1 align="center">ChatGPT Desktop (Modern Fork)</h1>
  <p align="center">An updated ChatGPT desktop client for Linux— forked from earlier community builds.</p>
</p>

![License](https://img.shields.io/badge/License-Apache%202-green.svg) ![ChatGPT Desktop](https://img.shields.io/badge/ChatGPT%20Desktop-Linux-yellow?style=flat&labelColor=555555&logo=https://raw.githubusercontent.com/SpellboundScents/ChatGPT/refs/heads/master/public/chatgpt.svg&logoWidth=20) [![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-chirv-orange?logo=buy-me-a-coffee&logoColor=white)](https://www.buymeacoffee.com/chirv)
---

## 📖 About This Fork

This project is a **modern fork** of [isaccanedo/ChatGPT](https://github.com/isaccanedo/ChatGPT), which itself was forked from the original [lencx/ChatGPT](https://github.com/lencx/ChatGPT) project.  

Both upstream forks did excellent work building a cross-platform desktop wrapper for [OpenAI’s ChatGPT](https://chat.openai.com).  
This fork continues that lineage with the goal of:

- 🔄 **Bringing the project up-to-date with the latest ChatGPT models and features**  
- 🛠 **Maintaining compatibility** with current OpenAI web features  
- 📦 **Modernizing the build system & updater** so future releases come directly from this repository  
- 🧹 **Cleaning up legacy dependencies and update feeds** from previous forks  

---

## ✨ Current Progress

So far, the following changes have been made:

- Migrated codebase into a new fork (`this repository`) with its own identity.  
- Updated package metadata, app identifiers, and build configuration.  
- Re-wired the Tauri auto-updater to point at **this repo’s releases** (instead of lencx’s).  
- Generated a **new updater signing keypair** (so only builds from this fork are trusted).  
- Began revising the documentation (this README) to reflect the new direction.
- Fixed a lot of UI bugs, especially in chats with code blocks
- Upgraded from Tauri 1.x to 2.x
- Revised Menubar
- Removed code for Windows and Mac. 
  - OpenAI has their own desktop apps for these OSes so I will keep this Linux only.
    - Everything is built & tested on Zorin/Ubuntu using VSC.

---

## 🚀 Roadmap

- ✅ Set up updater infrastructure (GitHub Actions + signed releases).  
- ✅ Update app internals for **latest ChatGPT models & UI changes**.  
- ✅ Improve build workflows for Linux.
- ✅ Migrated to Tauri 2
- ⏳ Refresh app branding & assets to distinguish from upstream.  
- ⏳ Continue squashing UI bugs
- ⏳ Speed Up Loading Times
- ⏳ Re-work Configuration Menu
- ⏳ Fix Dark Mode toggle

---

## 📦 Installation

Releases available under [Releases](https://github.com/SpellboundScents/ChatGPT/releases). Choose your installer, and install accordingly.

---

## 🛠 Development Setup

### Prerequisites
- [Rust](https://www.rust-lang.org/)  
- [Node.js](https://nodejs.org/)  
- [pnpm (v9 or newer)](https://pnpm.io/)
- [Tauri dependencies for your system](https://tauri.app/v1/guides/getting-started/prerequisites)
  - Linux: [libgtk-3-dev], [libwebkit2gtk-4.0-dev], [libayatana-appindicator3-dev], [librsvg2-dev]

### 🚀 Run Locally
```bash
git clone https://github.com/SpellboundScents/ChatGPT.git
cd ChatGPT
```
```bash
pnpm install
```
Start front-end in dev mode:
```bash
pnpm dev:fe
```
Run Tauri app in dev mode:
```bash
pnpm dev
```

### 🛠️ Build

Build the front-end only:
```bash
pnpm build:fe
```
Build the full Tauri app (all platforms):
```bash
pnpm build
```
Build with signing (requires TAURI_PRIVATE_KEY + TAURI_KEY_PASSWORD):
```bash
pnpm tauri build
```

---


### 🙏 Acknowledgements

This project builds on the work of:

- lencx/ChatGPT – the original desktop client implementation

- isaccanedo/ChatGPT – fork lineage

- f/awesome-chatgpt-prompts – inspiration for prompt commands

Thanks also to the Tauri and OpenAI communities for tooling and APIs.

---

### 📜 License

This project is licensed under the Apache License 2.0.

Copyright [2025] [Your Name]

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the [LICENSE] file for the full text.

