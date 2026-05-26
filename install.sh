#!/usr/bin/env bash
# learnMe — local install script
#
# Installs Node.js (nvm) and Rust (rustup) in user space — no sudo required.
# System WebKitGTK libraries on Linux must be present; the script checks and
# tells you the exact sudo command if they are missing (one-time manual step).
#
# Usage:
#   bash install.sh      # from project root
#   ./install.sh         # after chmod +x

set -e

# ── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
BIN_DIR="$HOME/.local/bin"
NODE_VERSION="20"
NVM_VERSION="v0.40.3"

# Binary locations after build
LINUX_BIN="$SCRIPT_DIR/src-tauri/target/release/learnme"
MACOS_BIN="$SCRIPT_DIR/src-tauri/target/release/learnme"
MACOS_APP="$SCRIPT_DIR/src-tauri/target/release/bundle/macos/learnMe.app"

# ── Colours ───────────────────────────────────────────────────────────────────
BOLD='\033[1m'; DIM='\033[2m'
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

step()  { printf "\n${BOLD}${CYAN}▶${NC}${BOLD} %s${NC}\n" "$*"; }
ok()    { printf "  ${GREEN}✓${NC} %s\n" "$*"; }
info()  { printf "  ${DIM}→${NC} %s\n" "$*"; }
warn()  { printf "  ${YELLOW}⚠${NC} %s\n" "$*"; }
die()   { printf "\n  ${RED}✗${NC} %s\n\n" "$*" >&2; exit 1; }

OS="$(uname -s)"

# ── 1. System dependencies ────────────────────────────────────────────────────
check_system_deps() {
    step "Checking system dependencies"

    case "$OS" in
        Linux)
            local missing=()

            # pkg-config is the most reliable check for dev libraries
            for lib in "webkit2gtk-4.1" "librsvg-2.0" "appindicator3-0.1"; do
                if ! pkg-config --exists "$lib" 2>/dev/null; then
                    missing+=("$lib")
                fi
            done

            # Also need patchelf at build time — check separately
            if ! command -v patchelf &>/dev/null; then
                missing+=("patchelf")
            fi

            if [ ${#missing[@]} -gt 0 ]; then
                warn "Missing system libraries: ${missing[*]}"
                printf "\n  These require a one-time install with sudo:\n\n"
                printf "  %bUbuntu / Debian:%b\n" "$BOLD" "$NC"
                printf "    sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev \\\n"
                printf "                             librsvg2-dev patchelf\n\n"
                printf "  %bFedora / RHEL:%b\n" "$BOLD" "$NC"
                printf "    sudo dnf install -y webkit2gtk4.1-devel libappindicator-gtk3-devel \\\n"
                printf "                        librsvg2-devel patchelf\n\n"
                printf "  %bArch:%b\n" "$BOLD" "$NC"
                printf "    sudo pacman -S webkit2gtk-4.1 libappindicator-gtk3 librsvg patchelf\n\n"
                die "Install the libraries above, then re-run this script."
            fi

            ok "WebKitGTK 4.1, librsvg, libappindicator, patchelf — all present"
            ;;

        Darwin)
            if ! xcode-select -p &>/dev/null; then
                printf "\n  Xcode Command Line Tools are required on macOS.\n"
                printf "  Run: %bxcode-select --install%b  then re-run this script.\n\n" "$BOLD" "$NC"
                die "Xcode Command Line Tools not found."
            fi
            ok "Xcode Command Line Tools present"
            ;;

        *)
            warn "Unknown OS '$OS' — proceeding, expect possible failures"
            ;;
    esac
}

# ── 2. Node.js via nvm ────────────────────────────────────────────────────────
setup_node() {
    step "Setting up Node.js $NODE_VERSION"

    export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"

    # Load nvm if already installed
    if [ -s "$NVM_DIR/nvm.sh" ]; then
        # shellcheck source=/dev/null
        \. "$NVM_DIR/nvm.sh" --no-use
    fi

    if ! command -v nvm &>/dev/null; then
        info "Downloading nvm $NVM_VERSION..."
        curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/$NVM_VERSION/install.sh" | bash
        \. "$NVM_DIR/nvm.sh" --no-use
        ok "nvm installed"
    else
        ok "nvm $(nvm --version) already installed"
    fi

    # Install the required Node version if not present
    if ! nvm ls "$NODE_VERSION" 2>/dev/null | grep -qE "v${NODE_VERSION}\."; then
        info "Installing Node.js $NODE_VERSION..."
        nvm install "$NODE_VERSION"
        ok "Node.js $(node --version) installed"
    fi

    nvm use "$NODE_VERSION" --silent
    ok "Node.js $(node --version) active  (npm $(npm --version))"
}

# ── 3. Rust via rustup ────────────────────────────────────────────────────────
setup_rust() {
    step "Setting up Rust"

    # Bring cargo into PATH if already installed
    if [ -f "$HOME/.cargo/env" ]; then
        # shellcheck source=/dev/null
        \. "$HOME/.cargo/env"
    fi

    if command -v rustup &>/dev/null; then
        ok "rustup present — updating stable toolchain"
        rustup update stable --quiet --no-self-update
        ok "$(rustc --version)"
    else
        info "Downloading rustup..."
        # --no-modify-path: we handle PATH ourselves; avoids duplicate entries
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
            | sh -s -- -y --quiet --no-modify-path
        \. "$HOME/.cargo/env"
        ok "$(rustc --version) installed"
    fi
}

# ── 4. Build ──────────────────────────────────────────────────────────────────
build_app() {
    step "Building learnMe from source"
    cd "$SCRIPT_DIR"

    info "Installing npm packages..."
    npm install --silent

    info "Compiling (Rust + frontend) — first run takes 3–8 minutes..."
    npm run tauri:build

    local expected_bin="$LINUX_BIN"
    [ "$OS" = "Darwin" ] && expected_bin="$MACOS_BIN"

    [ -f "$expected_bin" ] || die "Binary not found at $expected_bin — check build output above."
    ok "Build complete"
}

# ── 5. Install the 'learnme' command ──────────────────────────────────────────
install_command() {
    step "Installing 'learnme' command to $BIN_DIR"
    mkdir -p "$BIN_DIR"

    case "$OS" in
        Darwin)
            if [ -d "$MACOS_APP" ]; then
                # Copy .app bundle for proper macOS integration (dock icon, menus, etc.)
                mkdir -p "$HOME/Applications"
                cp -r "$MACOS_APP" "$HOME/Applications/"
                ok "App bundle → ~/Applications/learnMe.app"

                # Wrapper script so 'learnme' works from any terminal
                cat > "$BIN_DIR/learnme" <<'EOF'
#!/usr/bin/env bash
open "$HOME/Applications/learnMe.app"
EOF
            else
                # Fallback: raw binary
                cp "$MACOS_BIN" "$BIN_DIR/learnme"
            fi
            ;;
        *)
            cp "$LINUX_BIN" "$BIN_DIR/learnme"
            ;;
    esac

    chmod +x "$BIN_DIR/learnme"
    ok "Installed: $BIN_DIR/learnme"

    # ── Add ~/.local/bin to PATH in .bashrc and .zshrc ────────────────────────
    local snippet='export PATH="$HOME/.local/bin:$PATH"'

    for rc in "$HOME/.bashrc" "$HOME/.zshrc"; do
        # Touch .zshrc into existence — it may not exist on fresh systems
        touch "$rc"
        if grep -qF '.local/bin' "$rc" 2>/dev/null; then
            ok "$(basename "$rc") — PATH entry already present"
        else
            printf '\n# learnMe\n%s\n' "$snippet" >> "$rc"
            ok "$(basename "$rc") — PATH entry added"
        fi
    done
}

# ── 6. Source shell configs ───────────────────────────────────────────────────
source_shells() {
    step "Sourcing shell configuration"

    # Update PATH for this script's own process — makes 'learnme' findable below
    export PATH="$BIN_DIR:$PATH"

    # Source both configs so the updated env is active for the launch step
    # shellcheck source=/dev/null
    [ -f "$HOME/.bashrc" ] && \. "$HOME/.bashrc" || true
    # shellcheck source=/dev/null
    [ -f "$HOME/.zshrc"  ] && \. "$HOME/.zshrc"  || true

    ok "Shell configs sourced — 'learnme' available in this session"
    ok "New terminals will load it automatically from .bashrc / .zshrc"
}

# ── 7. Launch ─────────────────────────────────────────────────────────────────
launch() {
    step "Launching learnMe"
    printf "\n  ${DIM}Type 'learnme' in any terminal to open the app again.${NC}\n\n"
    "$BIN_DIR/learnme"
}

# ── Entry point ───────────────────────────────────────────────────────────────
main() {
    printf "\n"
    printf "  ${BOLD}learnMe — installer${NC}\n"
    printf "  ──────────────────────────────────────────\n"
    printf "  Installs Node.js and Rust in user space.\n"
    printf "  System WebKitGTK libs checked (sudo only if missing).\n"
    printf "  ──────────────────────────────────────────\n"

    check_system_deps
    setup_node
    setup_rust
    build_app
    install_command
    source_shells
    launch
}

main "$@"
