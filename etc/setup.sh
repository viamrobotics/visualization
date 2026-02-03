#!/bin/bash

# Motion Tools Development Environment Setup Script

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Required versions
REQUIRED_NODE_VERSION="22"
REQUIRED_GO_VERSION="1.25"

log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✅${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}❌${NC} $1"
}

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Simple version comparison for major.minor versions
version_gte() {
    local current="$1"
    local required="$2"
    
    # Extract major.minor from version strings
    local current_major=$(echo "$current" | cut -d. -f1)
    local current_minor=$(echo "$current" | cut -d. -f2)
    local required_major=$(echo "$required" | cut -d. -f1)
    local required_minor=$(echo "$required" | cut -d. -f2)
    
    if [ "$current_major" -gt "$required_major" ]; then
        return 0
    elif [ "$current_major" -eq "$required_major" ] && [ "$current_minor" -ge "$required_minor" ]; then
        return 0
    else
        return 1
    fi
}

check_and_install_fnm() {
    if command_exists fnm; then
        log_success "fnm is already installed"
        return 0
    fi
    
    log_info "Installing fnm (Fast Node Manager)..."
    curl -fsSL https://fnm.vercel.app/install | bash
    
    # Source fnm for this session
    export FNM_DIR="$HOME/.local/share/fnm"
    if [ -d "$FNM_DIR" ]; then
        export PATH="$FNM_DIR:$PATH"
        eval "$(fnm env)"
    fi
    
    log_success "fnm installed successfully"
}

check_and_install_node() {
    # Make sure fnm is in PATH for this session
    if [ -d "$HOME/.local/share/fnm" ]; then
        export FNM_DIR="$HOME/.local/share/fnm"
        export PATH="$FNM_DIR:$PATH"
        eval "$(fnm env)" 2>/dev/null || true
    fi
    
    if command_exists node; then
        local current_version=$(node --version | sed 's/v//' | cut -d. -f1)
        if version_gte "$current_version.0" "$REQUIRED_NODE_VERSION.0"; then
            log_success "Node.js v$current_version is installed"
            return 0
        else
            log_warning "Node.js v$current_version is below required v$REQUIRED_NODE_VERSION"
        fi
    fi
    
    log_info "Installing Node.js v$REQUIRED_NODE_VERSION via fnm..."
    fnm install $REQUIRED_NODE_VERSION
    fnm use $REQUIRED_NODE_VERSION
    fnm default $REQUIRED_NODE_VERSION
    
    log_success "Node.js v$REQUIRED_NODE_VERSION installed successfully"
}

check_and_install_pnpm() {
    if command_exists pnpm; then
        log_success "pnpm is already installed (version: $(pnpm --version))"
        return 0
    fi
    
    log_info "Installing pnpm..."
    curl -fsSL https://get.pnpm.io/install.sh | sh -
    
    # Source pnpm for this session
    export PNPM_HOME="$HOME/.local/share/pnpm"
    export PATH="$PNPM_HOME:$PATH"
    
    log_success "pnpm installed successfully"
}

check_and_install_bun() {
    if command_exists bun; then
        log_success "bun is already installed (version: $(bun --version))"
        return 0
    fi
    
    log_info "Installing bun..."
    curl -fsSL https://bun.sh/install | bash
    
    # Source bun for this session
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
    
    log_success "bun installed successfully"
}

check_and_install_go() {
    if command_exists go; then
        local current_version=$(go version | sed 's/go version go//' | cut -d' ' -f1)
        if version_gte "$current_version" "$REQUIRED_GO_VERSION"; then
            log_success "Go $current_version is installed"
            return 0
        else
            log_warning "Go $current_version is below required $REQUIRED_GO_VERSION"
        fi
    fi
    
    log_info "Installing Go $REQUIRED_GO_VERSION..."
    
    local os=$(uname -s | tr '[:upper:]' '[:lower:]')
    local arch=$(uname -m)
    
    # Map architecture names
    case "$arch" in
        x86_64) arch="amd64" ;;
        aarch64) arch="arm64" ;;
        armv6l) arch="armv6l" ;;
        armv7l) arch="armv6l" ;;
    esac
    
    local go_version="1.25.1"
    local go_url="https://go.dev/dl/go${go_version}.${os}-${arch}.tar.gz"
    local tmp_file="/tmp/go${go_version}.tar.gz"
    
    log_info "Downloading Go from $go_url..."
    curl -fsSL "$go_url" -o "$tmp_file"
    
    # Remove old Go installation if it exists
    if [ -d "/usr/local/go" ]; then
        log_info "Removing old Go installation..."
        sudo rm -rf /usr/local/go
    fi
    
    log_info "Extracting Go to /usr/local..."
    sudo tar -C /usr/local -xzf "$tmp_file"
    rm "$tmp_file"
    
    # Add to PATH for this session
    export PATH="/usr/local/go/bin:$PATH"
    
    log_success "Go $go_version installed successfully"
}

check_and_install_buf() {
    if command_exists buf; then
        log_success "buf is already installed (version: $(buf --version))"
        return 0
    fi
    
    log_info "Installing buf..."
    pnpm add -g @bufbuild/buf
    
    # Add to PATH for this session
    export PATH="$HOME/.buf/bin:$PATH"
    
    log_success "buf installed successfully"
}

install_go_tools() {
    # Ensure Go bin is in PATH
    export PATH="/usr/local/go/bin:$HOME/go/bin:$PATH"
    
    # Protobuf code generation (required by buf.gen.go.yaml)
    go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
    go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
    
    # Documentation generation
    go install github.com/princjef/gomarkdoc/cmd/gomarkdoc@latest
    
    log_success "Go tools installed successfully"
}

install_node_dependencies() {
    cd "$PROJECT_ROOT"
    
    # Ensure pnpm is in PATH
    if [ -d "$HOME/.local/share/pnpm" ]; then
        export PNPM_HOME="$HOME/.local/share/pnpm"
        export PATH="$PNPM_HOME:$PATH"
    fi
    
    if pnpm install --force; then
        log_success "Node.js dependencies installed successfully"
    else
        log_error "Failed to install Node.js dependencies"
        exit 1
    fi
}

print_shell_config() {
    echo
    echo -e "${GREEN}Shell Configuration${NC}"
    echo "Add the following to your ~/.zshrc or ~/.bashrc:"
    echo -e "${YELLOW}"
    echo '```'
    echo 'export FNM_DIR="$HOME/.local/share/fnm"'
    echo 'export PATH="$FNM_DIR:$PATH"'
    echo 'eval "$(fnm env)"'
    echo
    echo 'export PNPM_HOME="$HOME/.local/share/pnpm"'
    echo 'export PATH="$PNPM_HOME:$PATH"'
    echo
    echo 'export BUN_INSTALL="$HOME/.bun"'
    echo 'export PATH="$BUN_INSTALL/bin:$PATH"'
    echo
    echo 'export PATH="/usr/local/go/bin:$HOME/go/bin:$PATH"'
    echo
    echo 'export PATH="$HOME/.buf/bin:$PATH"'
    echo '```'
    echo -e "${NC}"
    echo "After adding these lines, restart your terminal or run:"
    echo -e "  ${YELLOW}source ~/.zshrc${NC} (or ${YELLOW}source ~/.bashrc${NC})"
    echo
}

main() {
    # Step 1: Install fnm
    check_and_install_fnm
    
    # Step 2: Install Node.js
    check_and_install_node
    
    # Step 3: Install pnpm
    check_and_install_pnpm
    
    # Step 4: Install bun
    check_and_install_bun
    
    # Step 5: Install Go
    check_and_install_go
    
    # Step 6: Install buf
    check_and_install_buf
    
    # Step 7: Install Go tools
    install_go_tools
    
    # Step 8: Install Node.js dependencies
    install_node_dependencies
    
    # Step 9: Generate protobuf code
    make proto

    echo 
    echo -e "🎉 ${GREEN}Setup completed successfully!${NC}"
    
    # Print shell configuration
    print_shell_config
    
    echo -e "  1. Follow the shell configuration instructions above"
    echo -e "  2. Run '${YELLOW}make up${NC}' to start the development server"
    echo -e "  3. Visit ${BLUE}http://localhost:5173/${NC} to view the application"
    echo
}

main "$@"
