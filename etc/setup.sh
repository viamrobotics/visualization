#!/bin/bash

# Motion Tools Development Environment Setup Script

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

source_nvm() {
    export NVM_DIR="$HOME/.nvm"
    if [[ -s "$NVM_DIR/nvm.sh" ]]; then
        source "$NVM_DIR/nvm.sh"
    fi
}

read_package_json_versions() {
    if [[ ! -f "package.json" ]]; then
        log_error "package.json not found. Make sure you're in the project root directory."
        exit 1
    fi
    
    REQUIRED_NODE_VERSION=$(node -p "require('./package.json').engines.node" 2>/dev/null)
    REQUIRED_PNPM_VERSION=$(node -p "require('./package.json').packageManager" 2>/dev/null)
    REQUIRED_PNPM_VERSION=$(echo "$REQUIRED_PNPM_VERSION" | sed 's/.*@//')
}

version_ge() {
    local v1="$1"
    local v2="$2"
    
    # Use sort -V to find the higher version
    local higher=$(printf '%s\n%s\n' "$v1" "$v2" | sort -V | tail -n1)
    
    # Return true if v1 is the higher version or equal
    [[ "$higher" == "$v1" ]]
}

node_version_satisfies() {
    local current_version="$1"
    local required_version="$2"
    
    # Remove 'v' prefix if present from current version
    current_version=$(echo "$current_version" | sed 's/^v//')
    
    # Check if the required version has a >= prefix
    if [[ "${required_version:0:2}" == ">=" ]]; then
        local min_version=$(echo "$required_version" | sed 's/^>=//')
        version_ge "$current_version" "$min_version"
    else
        # Check if the current version is exactly the required version
        [[ "$current_version" == "$required_version" ]]
    fi
}

pnpm_version_satisfies() {
    local current_version="$1"
    local required_version="$2"
    
    # Check if the current version is greater than or equal to the required version
    version_ge "$current_version" "$required_version"
}

main() {
    echo
    log_info "🚀 Starting motion-tools development environment setup..."
    echo

    if [[ "$OSTYPE" != "darwin"* ]] && [[ "$OSTYPE" != "linux-gnu"* ]]; then
        log_error "This script only supports macOS and Linux systems"
        exit 1
    fi

    log_info "Detected OS: $OSTYPE"
    echo

    log_info "📋 Reading version requirements from package.json..."
    read_package_json_versions
    log_info "Required Node.js version: $REQUIRED_NODE_VERSION"
    log_info "Required pnpm version: $REQUIRED_PNPM_VERSION"
    echo

    # Step 1: Check/install nvm
    log_info "🗂️ Step 1: Checking nvm..."
    
    if [[ ! -s "$HOME/.nvm/nvm.sh" ]]; then
        log_info "Installing nvm..."
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
        source_nvm
        log_success "nvm installed successfully"
    else
        source_nvm
        log_success "nvm is already installed (version: $(nvm --version))"
    fi
    echo

    # Step 2: Check/install Node.js
    log_info "⚙️ Step 2: Checking Node.js..."
    
    source_nvm
    local current_node_version=""
    
    if command_exists node; then
        current_node_version=$(node --version)
        log_info "Current Node.js version: $current_node_version"
        
        log_info "Checking if $current_node_version satisfies $REQUIRED_NODE_VERSION..."
        if node_version_satisfies "$current_node_version" "$REQUIRED_NODE_VERSION"; then
            log_success "Node.js version satisfies requirement ($REQUIRED_NODE_VERSION)"
        else
            # Extract the minimum version from the requirement (e.g., >=22.0.0 -> 22.0.0)
            local min_version=$(echo "$REQUIRED_NODE_VERSION" | sed 's/^>=//')
            log_info "Installing Node.js $min_version..."
            nvm install "$min_version"
            nvm use "$min_version"
            nvm alias default "$min_version"
            log_success "Node.js updated to $(node --version)"
        fi
    else
        # Extract the minimum version from the requirement (e.g., >=22.0.0 -> 22.0.0)
        local min_version=$(echo "$REQUIRED_NODE_VERSION" | sed 's/^>=//')
        log_info "Installing Node.js $min_version..."
        nvm install "$min_version"
        nvm use "$min_version"
        nvm alias default "$min_version"
        log_success "Node.js installed: $(node --version)"
    fi
    echo

    # Step 3: Check/install pnpm
    log_info "📦 Step 3: Checking pnpm..."
    
    local current_pnpm_version=""
    
    if command_exists pnpm; then
        current_pnpm_version=$(pnpm --version)
        log_info "Current pnpm version: $current_pnpm_version"
        
        if pnpm_version_satisfies "$current_pnpm_version" "$REQUIRED_PNPM_VERSION"; then
            log_success "pnpm version satisfies requirement ($REQUIRED_PNPM_VERSION)"
        else
            log_info "Updating pnpm to $REQUIRED_PNPM_VERSION..."
            npm install -g "pnpm@$REQUIRED_PNPM_VERSION"
            log_success "pnpm updated to $(pnpm --version)"
        fi
    else
        log_info "Installing pnpm $REQUIRED_PNPM_VERSION..."
        npm install -g "pnpm@$REQUIRED_PNPM_VERSION"
        log_success "pnpm installed: $(pnpm --version)"
    fi
    echo

    # Step 4: Check/install bun
    log_info "🥟 Step 4: Checking bun..."
    
    if command_exists bun; then
        log_success "bun is already installed (version: $(bun --version))"
    else
        log_info "Installing bun..."
        curl -fsSL https://bun.sh/install | bash
        export PATH="$HOME/.bun/bin:$PATH"
        log_success "bun installed: $(bun --version)"
    fi
    echo

    # Install dependencies
    log_info "📚 Installing project dependencies..."
    
    log_info "Running pnpm install..."
    if pnpm install; then
        log_success "Dependencies installed successfully"
    else
        log_error "Failed to install dependencies"
        exit 1
    fi
    echo

    # Final verification
    log_info "🔍 Verifying installation..."
    echo
    log_info "Installed versions:"
    echo "  • nvm: $(nvm --version 2>/dev/null || echo 'not found')"
    echo "  • node: $(node --version 2>/dev/null || echo 'not found')"
    echo "  • pnpm: $(pnpm --version 2>/dev/null || echo 'not found')"
    echo "  • bun: $(bun --version 2>/dev/null || echo 'not found')"
    echo

    echo -e "🎉 ${GREEN}Setup completed successfully!${NC}"
    echo
    log_info "Next steps:"
    echo -e "  1. Run '${YELLOW}make up${NC}' to start the development server"
    echo -e "  2. Visit ${BLUE}http://localhost:5173/${NC} to view the application"
}

main "$@"