.DEFAULT_GOAL := help
WS_PORT ?= 3000
STATIC_PORT ?= 5173

define calculate_hash
	(find src -type f -exec cat {} \; 2>/dev/null; \
	 find static -type f -exec cat {} \; 2>/dev/null; \
	 cat package.json pnpm-lock.yaml svelte.config.js vite.config.ts tsconfig.json tailwind.config.ts 2>/dev/null) \
	 | shasum -a 256 | cut -d' ' -f1
endef

.PHONY: help
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

.PHONY: setup
setup:
	@./etc/setup.sh

.PHONY: up-build
up-build:
	@CURRENT_HASH=$$($(calculate_hash)); \
	STORED_HASH=$$(cat .build-stamp 2>/dev/null || echo "none"); \
	if [ "$$CURRENT_HASH" != "$$STORED_HASH" ]; then \
		echo 'Source files changed, rebuilding...'; \
		echo 'Installing dependencies...'; \
		pnpm install; \
		echo 'Building application...'; \
		WS_PORT=3000 STATIC_PORT=5173 pnpm run build; \
		echo "$$CURRENT_HASH" > .build-stamp; \
	else \
		echo 'Build is up to date, skipping rebuild...'; \
	fi

.PHONY: up
up: up-build
	@echo 'Starting server...'
	@WS_PORT=$(WS_PORT) STATIC_PORT=$(STATIC_PORT) bun run server/server.ts --production

.PHONY: build
build:
	@echo 'Installing dependencies...'
	@pnpm install
	@echo 'Building application...'
	@pnpm run build

.PHONY: clean
clean:
	@echo 'Removing build artifacts...'
	@rm -rf build dist .build-stamp
