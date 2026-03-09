# Default target - show help when no target is specified
.DEFAULT_GOAL := help

DRAW_DIR := draw
DRAW_FILES := $(shell find $(DRAW_DIR) -not -name "DOCS.md")

# Calculate hash of all source files that affect the build
define calculate_hash
	(find src -type f -exec cat {} \; 2>/dev/null; \
	 find static -type f -exec cat {} \; 2>/dev/null; \
	 find protos -type f -exec cat {} \; 2>/dev/null; \
	 cat package.json pnpm-lock.yaml svelte.config.js vite.config.ts tsconfig.json tailwind.config.ts 2>/dev/null) \
	 | shasum -a 256 | cut -d' ' -f1
endef

CURRENT_HASH := $(shell $(call calculate_hash))
STORED_HASH := $(shell cat .build-stamp 2>/dev/null)

.PHONY: help
help:
	@echo 'Motion Tools Development Setup'
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@echo '  setup          - Set up development environment (install pnpm, bun, dependencies)'
	@echo '  up             - Build (if needed) and start a local server'
	@echo '  build 			- Build the application for production'
	@echo '  proto          - Generate protobuf code'
	@echo '  docs           - Generate documentation'
	@echo '  bridge         - Build and run the Go SteamVR WebSocket bridge'
	@echo '  bridge-build   - Build the Go bridge binary only'
	@echo '  help           - Show this help message'

.PHONY: setup
setup:
	@./etc/setup.sh

.PHONY: up-build
up-build:
	@$(MAKE) proto
	@pnpm run build

.PHONY: up-check
up-check:
	@if [ "$(CURRENT_HASH)" != "$(STORED_HASH)" ]; then \
		$(MAKE) up-build; \
		echo "$(CURRENT_HASH)" > .build-stamp; \
	fi

.PHONY: up
up: up-check
	@WS_PORT=3000 STATIC_PORT=5173 bun run server/server.ts --production

.PHONY: build-clean
build-clean:
	@$(MAKE) proto-clean
	@rm -rf build dist .build-stamp

.PHONY: build
build: build-clean
	@$(MAKE) proto
	@pnpm run build

.PHONY: proto-clean
proto-clean:
	@rm -rf draw/v1 src/lib/common/v1 src/lib/draw/v1 protos/vendor

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

.PHONY: proto
proto: proto-clean proto-vendor 
	@pnpm exec buf dep update
	@$(MAKE) proto-lint
	@$(MAKE) proto-format
	@$(MAKE) proto-gen-go
	@$(MAKE) proto-gen-ts

GO             := $(shell which go 2>/dev/null || echo /usr/local/go/bin/go)
BRIDGE_BIN     := bridge/openvr_bridge
BRIDGE_PORT    ?= 9090
BRIDGE_HZ      ?= 90
OPENVR_VERSION ?= v2.5.1
OPENVR_SDK_DIR := bridge/openvr-sdk
OPENVR_SDK_URL := https://github.com/ValveSoftware/openvr/archive/refs/tags/$(OPENVR_VERSION).tar.gz

.PHONY: bridge-deps
bridge-deps:
	@if [ ! -f $(OPENVR_SDK_DIR)/headers/openvr_capi.h ]; then \
		echo '[bridge] Downloading OpenVR SDK $(OPENVR_VERSION)...'; \
		mkdir -p $(OPENVR_SDK_DIR); \
		curl -fsSL $(OPENVR_SDK_URL) \
			| tar -xz --strip-components=1 -C $(OPENVR_SDK_DIR) \
			    --wildcards \
			    '*/headers/openvr_capi.h' \
			    '*/lib/linux64/libopenvr_api.so'; \
		echo '[bridge] OpenVR SDK ready at $(OPENVR_SDK_DIR)'; \
	else \
		echo '[bridge] OpenVR SDK already present ($(OPENVR_SDK_DIR))'; \
	fi
	@echo '[bridge] Tidying Go modules...'
	@$(GO) mod tidy

.PHONY: bridge-build
bridge-build: bridge-deps
	@echo '[bridge] Building Go bridge...'
	@$(GO) build -o $(BRIDGE_BIN) ./bridge
	@cp -n bridge/actions.json bridge/bindings_vive_controller.json $(dir $(BRIDGE_BIN)) 2>/dev/null || true
	@echo '[bridge] Built: $(BRIDGE_BIN)'

.PHONY: bridge
bridge: bridge-build
	@echo '[bridge] Starting on port $(BRIDGE_PORT) at $(BRIDGE_HZ) Hz...'
	@LD_LIBRARY_PATH=$(PWD)/$(OPENVR_SDK_DIR)/lib/linux64:$$LD_LIBRARY_PATH \
		./$(BRIDGE_BIN) --port $(BRIDGE_PORT) --hz $(BRIDGE_HZ)

draw/DOCS.md: $(DRAW_FILES)
	@PATH="$(shell go env GOPATH)/bin:$$PATH" gomarkdoc ./draw -o ./draw/DOCS.md

.PHONY: docs
docs: draw/DOCS.md
