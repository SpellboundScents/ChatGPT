#!/usr/bin/env bash
set -euo pipefail

# ChatGPT Desktop (Linux) – prerequisite installer
# Targets: Debian/Ubuntu/Zorin, Fedora/RHEL, Arch, openSUSE
# Installs: system build deps + Tauri GTK/WebKit deps, Rust (rustup), Node (nvm LTS), pnpm@9+

need_cmd() { command -v "$1" >/dev/null 2>&1; }

say() { printf "\033[1;32m==>\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m==>\033[0m %s\n" "$*"; }
die() { printf "\033[1;31m==>\033[0m %s\n" "$*" ; exit 1; }

# Detect distro family by package manager
if need_cmd apt; then
  PKG="apt"
elif need_cmd dnf; then
  PKG="dnf"
elif need_cmd yum; then
  PKG="yum"
elif need_cmd pacman; then
  PKG="pacman"
elif need_cmd zypper; then
  PKG="zypper"
else
  die "Unsupported distro: need apt/dnf/yum/pacman/zypper."
fi

# Require sudo for system packages (skip if already root)
SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  if need_cmd sudo; then
    SUDO="sudo"
  else
    die "This script needs root privileges to install system packages (install sudo or run as root)."
  fi
fi

say "Installing system build tools and Tauri WebKit/GTK dependencies…"
case "$PKG" in
  apt)
    $SUDO apt update -y
    $SUDO apt install -y \
      build-essential curl git pkg-config ca-certificates \
      libgtk-3-dev libwebkit2gtk-4.0-dev libayatana-appindicator3-dev librsvg2-dev
    ;;
  dnf)
    # Fedora / RHEL (with dnf)
    $SUDO dnf -y groupinstall "Development Tools"
    $SUDO dnf -y install curl git pkgconf-pkg-config ca-certificates \
      gtk3-devel webkit2gtk4.0-devel libappindicator-gtk3-devel librsvg2-devel
    ;;
  yum)
    # Older RHEL/CentOS
    $SUDO yum -y groupinstall "Development Tools"
    $SUDO yum -y install curl git pkgconfig ca-certificates \
      gtk3-devel webkit2gtk4.0-devel libappindicator-gtk3-devel librsvg2-devel || true
    ;;
  pacman)
    $SUDO pacman -Sy --noconfirm --needed \
      base-devel curl git pkgconf ca-certificates \
      gtk3 webkit2gtk libayatana-appindicator librsvg
    ;;
  zypper)
    $SUDO zypper -n refresh
    $SUDO zypper -n install -t pattern devel_basis || true
    $SUDO zypper -n install curl git pkg-config ca-certificates \
      gtk3-devel libwebkit2gtk-4_0-devel libayatana-appindicator3-devel librsvg-devel
    ;;
esac

say "Ensuring Rust (rustup) is installed…"
if ! need_cmd rustc; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  # shellcheck disable=SC1091
  source "$HOME/.cargo/env"
else
  say "Rust already installed: $(rustc --version)"
fi

say "Installing Node.js (LTS) via nvm…"
if ! need_cmd nvm; then
  # Install nvm to ~/.nvm
  export NVM_DIR="$HOME/.nvm"
  if [ ! -d "$NVM_DIR" ]; then
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  fi
  # shellcheck disable=SC1090
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
else
  # shellcheck disable=SC1090
  . "$NVM_DIR/nvm.sh"
fi

nvm install --lts
nvm use --lts
NODE_VER="$(node -v)"
say "Node version: $NODE_VER"

say "Installing pnpm (v9+)…"
# Prefer corepack if available; else fallback to npm -g
if need_cmd corepack; then
  corepack enable || true
  corepack prepare pnpm@latest --activate || npm install -g pnpm@^10
else
  npm install -g pnpm@^10
fi
PNPM_VER="$(pnpm -v)"
say "pnpm version: $PNPM_VER"

# Quick sanity print of critical tools
echo
say "Installed tool versions:"
printf "  - rustc:  %s\n" "$(rustc --version | awk '{print $2, $3}')"
printf "  - cargo:  %s\n" "$(cargo --version | awk '{print $2, $3}')"
printf "  - node:   %s\n" "$(node -v)"
printf "  - pnpm:   %s\n" "$(pnpm -v)"

echo
say "All set! System deps + Rust + Node + pnpm are installed."
say "Next steps (from your repo directory):"
echo "  pnpm install"
echo "  pnpm tauri build   # or: pnpm tauri dev"