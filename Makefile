.PHONY: help setup up clean

# Default target - show help when no target is specified
.DEFAULT_GOAL := help

# Find all source files that should trigger a rebuild
SRC_FILES := $(shell find src -type f 2>/dev/null) \
	package.json \
	pnpm-lock.yaml \
	svelte.config.js \
	vite.config.ts \
	tsconfig.json \
	tailwind.config.ts

help:
	@echo 'Motion Tools Development Setup'
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@echo '  setup - Set up development environment (install pnpm, bun, dependencies)'
	@echo '  up    - Build (if needed) and start a local server'
	@echo '  build - Build the application for production'
	@echo '  clean - Remove build artifacts'
	@echo '  help  - Show this help message'

setup:
	@./etc/setup.sh

# Regular production build
build:
	@echo 'Installing dependencies...'
	@pnpm install
	@echo 'Building application...'
	@pnpm run build

# Incremental build target (internal use by 'up')
# Marker file tracks when last build completed
.build-stamp: $(SRC_FILES)
	@echo 'Source files changed, rebuilding...'
	@echo 'Installing dependencies...'
	@pnpm install
	@echo 'Building application...'
	@BUN_SERVER_PORT=5173 pnpm run build
	@touch .build-stamp

up: .build-stamp
	@echo 'Starting server...'
	@bun run server/server.ts --production

clean:
	@echo 'Removing build artifacts...'
	@rm -rf build dist .build-stamp
