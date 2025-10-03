#!/bin/bash

# Motion Tools Development Environment Setup Script
# This script sets up the development environment for motion-tools
# Compatible with macOS and Linux systems

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Utility functions
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

wait_for_user() {
    echo
    echo -e "${YELLOW}$1${NC}"
    read -p "Press [enter] to continue..."
    echo
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Compare version numbers
version_compare() {
    if [[ $1 == $2 ]]; then
        echo "0"
    elif [[ $1 =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] && [[ $2 =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        # Use sort with version comparison
        local higher=$(printf '%s\n%s\n' "$1" "$2" | sort -V | tail -n1)
        if [[ $higher == $1 ]]; then
            echo "1"
        else
            echo "-1"
        fi
    else
        # Fallback to string comparison
        if [[ $1 > $2 ]]; then
            echo "1"
        elif [[ $1 < $2 ]]; then
            echo "-1"
        else
            echo "0"
        fi
    fi
}
    
source_nvm() {
    export NVM_DIR="$HOME/.nvm"
    if [[ -s "$NVM_DIR/nvm.sh" ]]; then
        source "$NVM_DIR/nvm.sh"
    fi
    if [[ -s "$NVM_DIR/bash_completion" ]]; then
        source "$NVM_DIR/bash_completion"
    fi
}

# Main setup function
main() {
    echo
    log_info "🚀 Starting motion-tools development environment setup..."
    echo

    # Check OS compatibility
    if [[ "$OSTYPE" != "darwin"* ]] && [[ "$OSTYPE" != "linux-gnu"* ]]; then
        log_error "This script only supports macOS and Linux systems"
        exit 1
    fi

    log_info "Detected OS: $OSTYPE"
    echo

    log_info "🗂️ Step 1: Installing nvm..."

    # Get latest NVM version from GitHub API
    local latest_nvm_version="unknown"
    if command_exists curl; then
        latest_nvm_version=$(curl -s https://api.github.com/repos/nvm-sh/nvm/releases/latest | grep -o '"tag_name": *"[^"]*"' | cut -d'"' -f4 | sed 's/^v//' 2>/dev/null || echo "unknown")
    fi

    if [[ "$latest_nvm_version" == "unknown" ]] || [[ -z "$latest_nvm_version" ]]; then
        if command_exists wget; then
            latest_nvm_version=$(wget -qO- https://api.github.com/repos/nvm-sh/nvm/releases/latest | grep -o '"tag_name": *"[^"]*"' | cut -d'"' -f4 | sed 's/^v//' 2>/dev/null || echo "unknown")
        fi
    fi
    
    if [[ "$latest_nvm_version" == "unknown" ]] || [[ -z "$latest_nvm_version" ]]; then
        log_error "Please install curl or wget, or check your internet connection"
        exit 1
    fi

    # Check if NVM is installed
    if [[ ! -s "$HOME/.nvm/nvm.sh" ]]; then
        local install_success=false
        if command_exists curl; then
            if curl -o- "https://raw.githubusercontent.com/nvm-sh/nvm/v${latest_nvm_version}/install.sh" | bash; then
                install_success=true
            fi
        fi
        
        if [[ "$install_success" != "true" ]] && command_exists wget; then
            if wget -qO- "https://raw.githubusercontent.com/nvm-sh/nvm/v${latest_nvm_version}/install.sh" | bash; then
                install_success=true
            fi
        fi
        
        if [[ "$install_success" != "true" ]]; then
            log_error "Failed to download or execute NVM installation script"
            exit 1
        fi
        
        source_nvm
        
        if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
            log_success "NVM installed successfully (version: $(nvm --version 2>/dev/null || echo 'unknown'))"
        else
            log_error "NVM installation failed"
            exit 1
        fi
    else
        source_nvm
        
        if command -v nvm >/dev/null 2>&1; then
            local current_nvm_version=$(nvm --version 2>/dev/null || echo "unknown")
            
            if [[ "$current_nvm_version" != "unknown" ]] && [[ "$latest_nvm_version" != "unknown" ]]; then
                log_info "nvm is already installed (version: $current_nvm_version)"
                local version_cmp=$(version_compare "$current_nvm_version" "$latest_nvm_version")
                if [[ $version_cmp -lt 0 ]]; then
                    echo
                    log_warning "nvm update available: $current_nvm_version → $latest_nvm_version"
                    
                    local update_success=false
                    if command_exists curl; then
                        if curl -o- "https://raw.githubusercontent.com/nvm-sh/nvm/v${latest_nvm_version}/install.sh" | bash; then
                            update_success=true
                        fi
                    fi
                    
                    if [[ "$update_success" != "true" ]] && command_exists wget; then
                        if wget -qO- "https://raw.githubusercontent.com/nvm-sh/nvm/v${latest_nvm_version}/install.sh" | bash; then
                            update_success=true
                        fi
                    fi
                    
                    if [[ "$update_success" != "true" ]]; then
                        log_error "Failed to download or execute nvm update script"
                        exit 1
                    fi
                    
                    source_nvm
                    echo
                    local new_nvm_version=$(nvm --version 2>/dev/null || echo "unknown")
                    if [[ "$new_nvm_version" != "$current_nvm_version" ]]; then
                        log_success "nvm updated: $current_nvm_version → $new_nvm_version"
                    fi
                else
                    log_success "nvm is up to date (version: $current_nvm_version)"
                fi
            else
                log_warning "Could not compare nvm versions, skipping update check"
                log_info "current nvm version: $current_nvm_version"
            fi
        else
            log_error "nvm command not available after installation"
            exit 1
        fi
    fi
    
    echo
    log_info "⚙️ Step 2: Installing Node.js..."

    source_nvm
    
    local current_node_version=""
    if command_exists node; then
        current_node_version=$(node --version 2>/dev/null || echo "")
        log_info "Current Node.js version: $current_node_version"
    else
        log_info "Node.js is not currently installed"
    fi
    
    # Install latest LTS with better error handling
    log_info "Installing/updating to latest LTS version..."
    local install_output
    if install_output=$(nvm install --lts 2>&1); then
        # Use the LTS version
        if ! nvm use --lts >/dev/null 2>&1; then
            log_error "Failed to switch to LTS version"
            log_error "Output: $install_output"
            exit 1
        fi
        
        if ! nvm alias default lts/* >/dev/null 2>&1; then
            log_warning "Could not set default alias, but continuing..."
        fi
        
        local new_node_version=$(node --version 2>/dev/null || echo "unknown")
        
        if [[ "$current_node_version" != "$new_node_version" ]] && [[ "$current_node_version" != "" ]]; then
            log_success "Node.js updated: $current_node_version → $new_node_version"
        elif [[ "$current_node_version" == "" ]]; then
            log_success "Node.js installed: $new_node_version"
        else
            log_success "Node.js is already at latest LTS: $new_node_version"
        fi
        
    else
        log_error "Failed to install Node.js LTS via NVM"
        log_error "Error output:"
        echo "$install_output" | sed 's/^/  /'
        log_info "Please ensure nvm is properly installed and try again"
        exit 1
    fi
    echo

    log_info "📦 Step 3: Installing pnpm..."
    
    # Ensure pnpm directory is in PATH
    export PNPM_HOME="$HOME/.local/share/pnpm"
    export PATH="$PNPM_HOME:$PATH"
    
    if command_exists pnpm; then
        local current_pnpm_version=$(pnpm --version 2>/dev/null || echo "unknown")
        log_info "pnpm is already installed (version: $current_pnpm_version)"
        
        local update_output
        if update_output=$(pnpm add -g pnpm@latest 2>&1); then
            # Reload pnpm after potential update
            hash -r 2>/dev/null || true
            local new_pnpm_version=$(pnpm --version 2>/dev/null || echo "unknown")
            
            if [[ "$current_pnpm_version" != "$new_pnpm_version" ]]; then
                log_success "pnpm updated: $current_pnpm_version → $new_pnpm_version"
            else
                log_success "pnpm is already up to date (version: $current_pnpm_version)"
            fi
        else
            log_warning "Could not update pnpm using self-update, trying standalone installer..."
            log_info "Self-update error: ${update_output:0:200}"
            
            if curl -fsSL https://get.pnpm.io/install.sh | sh -; then
                # Reload pnpm after install
                hash -r 2>/dev/null || true
                
                local new_pnpm_version=$(pnpm --version 2>/dev/null || echo "unknown")
                if [[ "$current_pnpm_version" != "$new_pnpm_version" ]]; then
                    log_success "pnpm updated via standalone installer: $current_pnpm_version → $new_pnpm_version"
                else
                    log_success "pnpm is available (version: $new_pnpm_version)"
                fi
            else
                log_error "Failed to update pnpm via standalone installer"
                log_warning "Continuing with existing pnpm version: $current_pnpm_version"
            fi
        fi
    else
        log_info "Installing pnpm using standalone script..."
        local pnpm_install_output
        if pnpm_install_output=$(curl -fsSL https://get.pnpm.io/install.sh | sh - 2>&1); then
            # Reload pnpm after install
            hash -r 2>/dev/null || true
            
            if command_exists pnpm; then
                log_success "pnpm installed successfully (version: $(pnpm --version))"
            else
                log_error "pnpm installation completed but command not found"
                log_error "Please add the following to your shell profile and restart:"
                echo "  export PNPM_HOME=\"\$HOME/.local/share/pnpm\""
                echo "  export PATH=\"\$PNPM_HOME:\$PATH\""
                exit 1
            fi
        else
            log_error "pnpm installation failed"
            log_error "Error output:"
            echo "$pnpm_install_output" | sed 's/^/  /'
            exit 1
        fi
    fi
    echo

    log_info "🥟 Step 4: Installing bun..."
    
    if command_exists bun; then
        local current_bun_version=$(bun --version 2>/dev/null || echo "unknown")
        log_info "bun is already installed (version: $current_bun_version)"
        
        local upgrade_output
        if upgrade_output=$(bun upgrade 2>&1); then
            local new_bun_version=$(bun --version 2>/dev/null || echo "unknown")
            
            # Check if version actually changed
            if [[ "$current_bun_version" != "$new_bun_version" ]]; then
                log_success "bun updated: $current_bun_version → $new_bun_version"
            else
                log_success "bun is already up to date (version: $current_bun_version)"
            fi
        else
            log_warning "Could not check for bun updates, proceeding with current version"
            log_info "You can manually update bun later with: bun upgrade"
        fi
    else
        log_info "Installing bun..."
        curl -fsSL https://bun.sh/install | bash
        
        # Add bun to PATH for current session
        export PATH="$HOME/.bun/bin:$PATH"
        
        if command_exists bun; then
            log_success "bun installed successfully (version: $(bun --version))"
        else
            log_error "bun installation failed"
            exit 1
        fi
    fi
    echo

    log_info "📚 Step 5: Installing project dependencies..."
    
    if [[ -f "package.json" ]]; then
        log_info "Running pnpm install..."
        # Use --force to automatically rebuild if Node.js version changed
        if pnpm install --force; then
            log_success "Dependencies installed successfully"
        else
            local exit_code=$?
            echo
            log_error "Failed to install dependencies (exit code: $exit_code)"
            log_info "Try running 'pnpm install' manually to investigate the issue"
            exit 1
        fi
    else
        log_error "package.json not found. Make sure you're in the project root directory."
        exit 1
    fi
    echo

    log_info "🔍 Verifying installation..."
    echo
    
    log_info "Installed versions:"
    echo "  • nvm: $(nvm --version 2>/dev/null || echo 'not found')"
    echo "  • node: $(node --version 2>/dev/null || echo 'not found')"
    echo "  • pnpm: $(pnpm --version 2>/dev/null || echo 'not found')"
    echo "  • bun: $(bun --version 2>/dev/null || echo 'not found')"
    echo
    
    local missing_deps=()
    
    if ! command -v nvm >/dev/null 2>&1; then
        missing_deps+=("nvm")
    fi
    
    if ! command_exists node; then
        missing_deps+=("node")
    fi
    
    if ! command_exists pnpm; then
        missing_deps+=("pnpm")
    fi
    
    if ! command_exists bun; then
        missing_deps+=("bun")
    fi
    
    if [[ ${#missing_deps[@]} -eq 0 ]]; then
        echo -e "🎉 ${GREEN}Setup completed successfully!${NC}"
        echo
        log_info "Next steps:"
        echo -e "  1. Run '${YELLOW}make up${NC}' to start the development server"
        echo -e "  2. Visit ${BLUE}http://localhost:5173/${NC} to view the application"
    else
        log_error "Setup incomplete. Missing dependencies: ${missing_deps[*]}"
        exit 1
    fi
}

main "$@"
