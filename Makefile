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
	@echo '  proto - Generate protobuf code'
	@echo '  docs  - Generate documentation'
	@echo '  help  - Show this help message'

.PHONY: setup
setup:
	@./etc/setup.sh
	@go install github.com/princjef/gomarkdoc/cmd/gomarkdoc@latest

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
.PHONY: up
up:
	pnpm dev

## Protobuf commands

.PHONY: proto-clean
proto-clean:
	@echo 'Cleaning generated protobuf code...'
	@rm -rf draw/v1 src/lib/draw/v1
	@echo 'Clean complete!'

.PHONY: proto-gen-go
proto-gen-go:
	@echo 'Generating Go code...'
	@PATH="$(shell go env GOPATH)/bin:$(shell pnpm bin):$$PATH" pnpm exec buf generate --template buf.gen.go.yaml

.PHONY: proto-gen-ts
proto-gen-ts:
	@echo 'Generating TypeScript code...'
	@PATH="$(shell go env GOPATH)/bin:$(shell pnpm bin):$$PATH" pnpm exec buf generate --template buf.gen.typescript.yaml

.PHONY: proto-vendor
proto-vendor:
	@echo 'Vendoring buf dependencies...'
	@pnpm exec buf export buf.build/viamrobotics/api --output protos/vendor

.PHONY: proto-lint
proto-lint:
	@pnpm exec buf lint

.PHONY: proto-format
proto-format:
	@pnpm exec buf format -w

.PHONY: proto
proto: proto-clean proto-lint proto-format proto-vendor
	@echo 'Generating protobuf code...'
	@echo 'Updating buf dependencies...'
	@pnpm exec buf dep update
	@echo 'Installing protoc-gen-go...'
	@go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
	@make proto-gen-go
	@make proto-gen-ts
	@echo 'Protobuf code generation complete!'

DRAW_DIR := draw
DRAW_FILES := $(shell find $(DRAW_DIR) -not -name "DOCS.md")

.PHONY: gomarkdoc
gomarkdoc:
	@echo 'Installing gomarkdoc...'
	@go install github.com/princjef/gomarkdoc/cmd/gomarkdoc@latest
	@echo 'gomarkdoc installed'

draw/DOCS.md: gomarkdoc $(DRAW_FILES)
	@echo 'Generating Draw API documentation...'
	@PATH="$(shell go env GOPATH)/bin:$$PATH" gomarkdoc ./draw -o ./draw/DOCS.md
	@echo 'Draw API documentation generated at draw/DOCS.md'

.PHONY: docs
docs: draw/DOCS.md
	@echo 'All documentation generated'
