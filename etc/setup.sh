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

    # Step 1: Install pnpm using standalone script
    log_info "📦 Step 1: Installing pnpm..."
    
    if command_exists pnpm; then
        local current_pnpm_version=$(pnpm --version 2>/dev/null || echo "unknown")
        log_info "pnpm is already installed (version: $current_pnpm_version)"
        
        # Check if we should update pnpm
        log_info "Checking for pnpm updates..."
        local latest_pnpm_version=$(curl -s https://registry.npmjs.org/pnpm/latest | grep -o '"version":"[^"]*' | cut -d'"' -f4 2>/dev/null || echo "unknown")
        
        if [[ "$latest_pnpm_version" != "unknown" ]] && [[ "$current_pnpm_version" != "unknown" ]]; then
            local version_cmp=$(version_compare "$current_pnpm_version" "$latest_pnpm_version")
            if [[ $version_cmp -lt 0 ]]; then
                log_warning "pnpm update available: $current_pnpm_version → $latest_pnpm_version"
                log_info "Updating pnpm to latest version..."
                curl -fsSL https://get.pnpm.io/install.sh | sh -
                
                # Source the updated path
                export PATH="$HOME/.local/share/pnpm:$PATH"
            else
                log_success "pnpm is up to date"
            fi
        else
            log_warning "Could not check for pnpm updates, proceeding with current version"
        fi
    else
        log_info "Installing pnpm using standalone script..."
        curl -fsSL https://get.pnpm.io/install.sh | sh -
        
        # Add pnpm to PATH for current session
        export PATH="$HOME/.local/share/pnpm:$PATH"
        
        # Verify installation
        if command_exists pnpm; then
            log_success "pnpm installed successfully (version: $(pnpm --version))"
        else
            log_error "pnpm installation failed"
            exit 1
        fi
    fi
    echo

    # Step 2: Install bun
    log_info "🥟 Step 2: Installing bun..."
    
    if command_exists bun; then
        local current_bun_version=$(bun --version 2>/dev/null || echo "unknown")
        log_info "bun is already installed (version: $current_bun_version)"
        
        # Check for bun updates
        log_info "Checking for bun updates..."
        if bun upgrade >/dev/null 2>&1; then
            local new_bun_version=$(bun --version 2>/dev/null || echo "unknown")
            if [[ "$current_bun_version" != "$new_bun_version" ]]; then
                log_success "bun updated: $current_bun_version → $new_bun_version"
            else
                log_success "bun is up to date"
            fi
        else
            log_warning "Could not update bun, proceeding with current version"
        fi
    else
        log_info "Installing bun..."
        curl -fsSL https://bun.sh/install | bash
        
        # Add bun to PATH for current session
        export PATH="$HOME/.bun/bin:$PATH"
        
        # Verify installation
        if command_exists bun; then
            log_success "bun installed successfully (version: $(bun --version))"
        else
            log_error "bun installation failed"
            exit 1
        fi
    fi
    echo

    # Step 3: Check and update Node.js version
    log_info "🟢 Step 3: Checking Node.js version..."
    
    if command_exists node; then
        local current_node_version=$(node --version | sed 's/v//')
        log_info "Node.js is installed (version: $current_node_version)"
        
        # Check for LTS version
        local lts_version=$(curl -s https://nodejs.org/dist/index.json | grep -o '"version":"v[^"]*' | head -1 | cut -d'v' -f2 | cut -d'"' -f1 2>/dev/null || echo "unknown")
        
        if [[ "$lts_version" != "unknown" ]]; then
            local version_cmp=$(version_compare "$current_node_version" "$lts_version")
            if [[ $version_cmp -lt 0 ]]; then
                log_warning "Node.js update available: $current_node_version → $lts_version"
                log_info "Consider updating Node.js to the latest LTS version"
                log_info "You can update using your preferred method (nvm, brew, etc.)"
            else
                log_success "Node.js is up to date"
            fi
        else
            log_warning "Could not check for Node.js updates"
        fi
    else
        log_warning "Node.js is not installed"
        log_info "Please install Node.js before continuing: https://nodejs.org/"
        wait_for_user "Install Node.js and then continue"
        
        # Re-check after user intervention
        if ! command_exists node; then
            log_error "Node.js is still not available. Please install it manually."
            exit 1
        fi
    fi
    echo

    # Step 4: Install project dependencies
    log_info "📚 Step 4: Installing project dependencies..."
    
    if [[ -f "package.json" ]]; then
        log_info "Running pnpm install..."
        pnpm install
        log_success "Dependencies installed successfully"
    else
        log_error "package.json not found. Make sure you're in the project root directory."
        exit 1
    fi
    echo

    # Final verification
    log_info "🔍 Verifying installation..."
    echo
    
    log_info "Installed versions:"
    echo "  • pnpm: $(pnpm --version 2>/dev/null || echo 'not found')"
    echo "  • bun: $(bun --version 2>/dev/null || echo 'not found')"
    echo "  • node: $(node --version 2>/dev/null || echo 'not found')"
    echo
    
    # Check if all required commands are available
    local missing_deps=()
    
    if ! command_exists pnpm; then
        missing_deps+=("pnpm")
    fi
    
    if ! command_exists bun; then
        missing_deps+=("bun")
    fi
    
    if ! command_exists node; then
        missing_deps+=("node")
    fi
    
    if [[ ${#missing_deps[@]} -eq 0 ]]; then
        log_success "🎉 Setup completed successfully!"
        echo
        log_info "Next steps:"
        echo "  1. Run 'pnpm dev' to start the development server"
        echo "  2. Visit http://localhost:5173/ to view the application"
        echo
        log_info "💡 Tip: You can also use 'make up' to start the development server"
    else
        log_error "Setup incomplete. Missing dependencies: ${missing_deps[*]}"
        exit 1
    fi
}

# Run main function
main "$@"
