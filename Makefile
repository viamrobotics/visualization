# Default target - show help when no target is specified
.DEFAULT_GOAL := help

DRAW_DIR := draw
DRAW_FILES := $(shell find $(DRAW_DIR) -name "*.go" -not -name "*_test.go")

# Calculate hash of protobuf files that affect the build
define calculate_proto_hash
	(find protos -type f -exec cat {} \; 2>/dev/null) \
	 | shasum -a 256 | cut -d' ' -f1
endef

# Calculate hash of all app source files that affect the build
define calculate_app_hash
	(find src -type f -exec cat {} \; 2>/dev/null; \
	 find static -type f -exec cat {} \; 2>/dev/null; \
	 find protos -type f -exec cat {} \; 2>/dev/null; \
	 cat package.json pnpm-lock.yaml svelte.config.js vite.config.ts tsconfig.json tailwind.config.ts 2>/dev/null) \
	 | shasum -a 256 | cut -d' ' -f1
endef

# Calculate hash of all server source files that affect the build
define calculate_server_hash
	(find client -type f -exec cat {} \; 2>/dev/null; \
	 find draw -type f -exec cat {} \; 2>/dev/null; \
	 find protos -type f -exec cat {} \; 2>/dev/null; \
	 find cmd/draw-server -type f -exec cat {} \; 2>/dev/null; \
	 cat go.mod go.sum 2>/dev/null) \
	 | shasum -a 256 | cut -d' ' -f1
endef

CURRENT_PROTO_HASH := $(shell $(call calculate_proto_hash))
STORED_PROTO_HASH := $(shell cat .bin/.proto-build-stamp 2>/dev/null)

CURRENT_APP_HASH := $(shell $(call calculate_app_hash))
STORED_APP_HASH := $(shell cat .bin/.app-build-stamp 2>/dev/null)

CURRENT_SERVER_HASH := $(shell $(call calculate_server_hash))
STORED_SERVER_HASH := $(shell cat .bin/.server-build-stamp 2>/dev/null)

.PHONY: help
help:
	@echo 'Motion Tools Development Setup'
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@echo '  setup          - Set up development environment (install pnpm, bun, dependencies)'
	@echo '  up             - Build (if needed) and start the draw server'
	@echo '  build          - Build the application for production'
	@echo '  proto          - Generate protobuf code'
	@echo '  docs           - Generate documentation'
	@echo '  help           - Show this help message'

.PHONY: setup
setup:
	@./etc/setup.sh

.PHONY: up-check
up-check:
	@if [ ! -d ".bin" ]; then \
		mkdir -p .bin; \
	fi
	@if [ "$(CURRENT_PROTO_HASH)" != "$(STORED_PROTO_HASH)" ]; then \
		$(MAKE) proto; \
		echo "$(CURRENT_PROTO_HASH)" > .bin/.proto-build-stamp; \
	fi
	@if [ "$(CURRENT_APP_HASH)" != "$(STORED_APP_HASH)" ]; then \
		pnpm build; \
		echo "$(CURRENT_APP_HASH)" > .bin/.app-build-stamp; \
	fi
	@if [ "$(CURRENT_SERVER_HASH)" != "$(STORED_SERVER_HASH)" ]; then \
		go build -o .bin/draw-server ./cmd/draw-server; \
		echo "$(CURRENT_SERVER_HASH)" > .bin/.server-build-stamp; \
	fi

.PHONY: up
up: up-check
	@WS_PORT=3000 STATIC_PORT=5173 bun run server/server.ts --production

.PHONY: up-next
up-next: up-check
	@WS_PORT=3000 STATIC_PORT=5173 bun run server/server.ts --production > /dev/null 2>&1 &
	@.bin/draw-server -port 3030 

.PHONY: build-clean
build-clean:
	@$(MAKE) proto-clean
	@rm -rf build dist .build-stamp

.PHONY: build
build: build-clean
	@$(MAKE) proto
	@go build -o .bin/draw-server ./cmd/draw-server
	@pnpm build

.PHONY: proto-clean
proto-clean:
	@rm -rf draw/v1 src/lib/buf protos/vendor

.PHONY: proto-gen-go
proto-gen-go:
	@PATH="$(shell go env GOPATH)/bin:$(shell pnpm bin):$$PATH" pnpm exec buf generate --template buf.gen.go.yaml

.PHONY: proto-gen-ts
proto-gen-ts:
	@PATH="$(shell go env GOPATH)/bin:$(shell pnpm bin):$$PATH" pnpm exec buf generate --template buf.gen.typescript.yaml

.PHONY: proto-vendor
proto-vendor:
	@pnpm exec buf export buf.build/viamrobotics/api --output protos/vendor

.PHONY: proto-lint
proto-lint:
	@pnpm exec buf lint

.PHONY: proto-format
proto-format:
	@pnpm exec buf format -w

.PHONY: proto-format-check
proto-format-check:
	@pnpm exec buf format --diff --exit-code

.PHONY: proto
proto: proto-clean proto-vendor 
	@pnpm exec buf dep update
	@$(MAKE) proto-lint
	@$(MAKE) proto-format
	@$(MAKE) proto-gen-go
	@$(MAKE) proto-gen-ts

draw/DOCS.md: $(DRAW_FILES)
	@PATH="$(shell go env GOPATH)/bin:$$PATH" gomarkdoc ./draw -o ./draw/DOCS.md

.PHONY: docs
docs: draw/DOCS.md
