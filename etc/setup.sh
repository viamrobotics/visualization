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

# Check if a directory exists and is writable, or can be created
check_dir_writable() {
    local dir="$1"
    local description="$2"
    
    if [[ -d "$dir" ]]; then
        if [[ ! -w "$dir" ]]; then
            return 1
        fi
    else
        # Check if parent directory is writable (so we can create the dir)
        local parent_dir
        parent_dir="$(dirname "$dir")"
        if [[ -d "$parent_dir" ]] && [[ ! -w "$parent_dir" ]]; then
            return 1
        fi
    fi
    return 0
}

# Check permissions and provide fix instructions if there's an issue
check_permissions() {
    local dir="$1"
    local description="$2"
    local fix_command="$3"
    
    if ! check_dir_writable "$dir" "$description"; then
        log_error "Permission denied: Cannot write to $description"
        echo -e "   Directory: ${YELLOW}$dir${NC}"
        echo -e "   Fix with:  ${YELLOW}$fix_command${NC}"
        echo -e "   Then rerun: ${YELLOW}make setup${NC}"
        exit 1
    fi
}

# Fix permission issues for a directory by removing it if we can't write to it
fix_cache_permissions() {
    local dir="$1"
    local description="$2"
    
    if [[ -d "$dir" ]] && [[ ! -w "$dir" ]]; then
        log_warning "Permission issue detected with $description: $dir"
        log_info "Attempting to remove and recreate..."
        if rm -rf "$dir" 2>/dev/null; then
            log_success "Fixed $description permissions"
        else
            log_error "Cannot fix $description permissions automatically"
            echo -e "   Fix with:  ${YELLOW}sudo rm -rf $dir${NC}"
            echo -e "   Then rerun: ${YELLOW}make setup${NC}"
            exit 1
        fi
    fi
}

source_brew() {
    if [[ "$(uname)" == "Darwin" ]]; then
        if [[ "$(uname -m)" == "arm64" ]]; then
            eval "$(/opt/homebrew/bin/brew shellenv)"
        else
            eval "$(/usr/local/bin/brew shellenv)"
        fi
    elif [[ "$(uname)" == "Linux" ]]; then
        eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
    fi
}

install_brew() {
    if command_exists brew; then
        source_brew
        log_success "Homebrew is already installed (version: $(brew --version | head -n1))"
        return 0
    fi

    log_info "Installing Homebrew..."
    
    if [[ "$(uname)" == "Linux" ]]; then
        # Install Linux dependencies for Homebrew
        if command_exists apt-get; then
            sudo apt-get update
            sudo apt-get install -y build-essential procps curl file git
        elif command_exists pacman; then
            sudo pacman -Sy --needed --noconfirm base-devel procps-ng curl git
        elif command_exists yum; then
            sudo yum -y install procps-ng curl file git libxcrypt-compat
            sudo yum -y groupinstall 'Development Tools'
        else
            log_error "Unsupported Linux distribution. Please install build tools manually."
            exit 1
        fi
    fi

    bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    source_brew
    log_success "Homebrew installed successfully"
}

install_dependencies() {
    log_info "Installing dependencies from Brewfile..."

    # Run brew bundle with the Brewfile
    if brew bundle --file="$SCRIPT_DIR/Brewfile"; then
        log_success "Homebrew dependencies installed successfully"
    else
        log_error "Failed to install some dependencies"
        exit 1
    fi

    # Link node@22 since it's keg-only
    if ! brew link --overwrite --force node@22 2>/dev/null; then
        log_warning "node@22 linking skipped (may already be linked or conflict exists)"
    fi
}

verify_versions() {
    echo "Installed versions:"
    echo "  • Homebrew: $(brew --version | head -n1 || echo 'not found')"
    echo "  • Node.js: $(node --version 2>/dev/null || echo 'not found')"
    echo "  • pnpm: $(pnpm --version 2>/dev/null || echo 'not found')"
    echo "  • bun: $(bun --version 2>/dev/null || echo 'not found')"
    echo "  • Go: $(go version 2>/dev/null | sed 's/go version //' || echo 'not found')"
    echo "  • buf: $(buf --version 2>/dev/null || echo 'not found')"
    echo
}

install_go_tools() {
    log_info "Installing Go tools..."

    # Check Go bin directory permissions
    local go_bin_dir
    go_bin_dir="$(go env GOPATH)/bin"
    check_permissions "$go_bin_dir" "Go bin directory" "sudo chown -R \$(whoami) $go_bin_dir"

    go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
    go install github.com/princjef/gomarkdoc/cmd/gomarkdoc@latest

    log_success "Go tools installed successfully"
}

install_node_dependencies() {
    log_info "Installing Node.js project dependencies..."

    cd "$PROJECT_ROOT"
    
    # Check node_modules directory permissions if it exists
    if [[ -d "$PROJECT_ROOT/node_modules" ]]; then
        check_permissions "$PROJECT_ROOT/node_modules" "node_modules directory" "sudo rm -rf $PROJECT_ROOT/node_modules"
    fi

    if pnpm install; then
        log_success "Node.js dependencies installed successfully"
    else
        log_error "Failed to install Node.js dependencies"
        exit 1
    fi
}

setup_shell_paths() {
    log_info "Ensuring shell paths are configured..."

    # The brew shellenv should handle PATH configuration
    # We just remind the user if needed
    if [[ "$(uname)" == "Linux" ]]; then
        local shellrc=""
        if [[ -f "$HOME/.zshrc" ]]; then
            shellrc="$HOME/.zshrc"
        elif [[ -f "$HOME/.bashrc" ]]; then
            shellrc="$HOME/.bashrc"
        fi

        if [[ -n "$shellrc" ]] && ! grep -q "linuxbrew" "$shellrc" 2>/dev/null; then
            log_warning "Add the following to your shell config ($shellrc):"
            echo '  eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"'
        fi
    fi
}

check_proto_permissions() {
    log_info "Checking protobuf generation permissions..."

    # Check buf cache directory - this is a common source of permission issues
    local buf_cache_dir="${HOME}/.cache/buf"
    fix_cache_permissions "$buf_cache_dir" "buf cache"

    # Check generated proto directories in the project
    local proto_dirs=(
        "$PROJECT_ROOT/draw/v1"
        "$PROJECT_ROOT/src/lib/common/v1"
        "$PROJECT_ROOT/src/lib/draw/v1"
        "$PROJECT_ROOT/protos/vendor"
    )

    for dir in "${proto_dirs[@]}"; do
        if [[ -d "$dir" ]] && [[ ! -w "$dir" ]]; then
            log_warning "Permission issue with generated proto directory: $dir"
            if rm -rf "$dir" 2>/dev/null; then
                log_success "Removed $dir (will be regenerated)"
            else
                log_error "Cannot remove generated proto directory: $dir"
                echo -e "   Fix with:  ${YELLOW}sudo rm -rf $PROJECT_ROOT/draw/v1 $PROJECT_ROOT/src/lib/common/v1 $PROJECT_ROOT/src/lib/draw/v1 $PROJECT_ROOT/protos/vendor${NC}"
                echo -e "   Then rerun: ${YELLOW}make setup${NC}"
                exit 1
            fi
        fi
    done
}

main() {
    echo
    log_info "🚀 Starting motion-tools development environment setup..."
    echo

    # Check for Xcode CLI tools on macOS
    if [[ "$(uname)" == "Darwin" ]]; then
        if ! xcode-select -p &>/dev/null; then
            log_info "Installing Xcode Command Line Tools..."
            xcode-select --install
            log_warning "Please complete the Xcode CLI tools installation and rerun this script."
            exit 1
        fi
    fi

    # Step 1: Install/verify Homebrew
    log_info "🍺 Step 1: Setting up Homebrew..."
    install_brew
    echo

    # Step 2: Install dependencies from Brewfile
    log_info "🍻 Step 2: Installing dependencies from Brewfile..."
    install_dependencies
    echo

    # Step 3: Install Go tools
    log_info "🔨 Step 3: Installing Go tools..."
    install_go_tools
    echo

    # Step 4: Install Node.js dependencies
    log_info "📚 Step 4: Installing Node.js project dependencies..."
    install_node_dependencies
    echo

    # Step 5: Setup shell paths (for Linux)
    log_info "🐚 Step 5: Setting up shell paths..."
    setup_shell_paths
    echo

    # Step 6: Generate protobuf code
    log_info "💪 Step 6: Generating protobuf code..."
    check_proto_permissions
    make proto
    log_success "Protobuf code generated successfully"
    echo

    # Final verification
    verify_versions

    echo -e "🎉 ${GREEN}Setup completed successfully!${NC}"
    echo
    log_info "Next steps:"
    echo -e "  1. Run '${YELLOW}make up${NC}' to start the development server"
    echo -e "  2. Visit ${BLUE}http://localhost:5173/${NC} to view the application"
    echo
}

main "$@"
