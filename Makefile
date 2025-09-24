.PHONY: help setup up build-wasm

# Default target - show help when no target is specified
.DEFAULT_GOAL := help

help:
	@echo 'Motion Tools Development Setup'
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@echo '  setup      - Set up development environment (install pnpm, bun, dependencies)'
	@echo '  up         - Start development server'
	@echo '  build-wasm - Build the WASM PCD processor module'
	@echo '  help       - Show this help message'

setup:
	@./etc/setup.sh

up:
	pnpm dev

build-wasm:
	@echo 'Building WASM PCD processor...'
	@if ! command -v wasm-pack >/dev/null 2>&1; then \
		echo 'Error: wasm-pack not found. Please run "make setup" first.'; \
		exit 1; \
	fi
	@cd src/lib/wasm/pcd-processor && \
		wasm-pack build --target web --out-dir pkg --release && \
		echo 'WASM build complete! Generated files in src/lib/wasm/pcd-processor/pkg/'
