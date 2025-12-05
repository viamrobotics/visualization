# Default target - show help when no target is specified
.DEFAULT_GOAL := help

.PHONY: help
help:
	@echo 'Motion Tools Development Setup'
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@echo '  setup          - Set up development environment (install pnpm, bun, dependencies)'
	@echo '  up             - Start development server'
	@echo '  proto          - Generate protobuf code'
	@echo '  docs           - Generate documentation'
	@echo '  help           - Show this help message'

.PHONY: setup
setup:
	@./etc/setup.sh
	@go install github.com/princjef/gomarkdoc/cmd/gomarkdoc@latest

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

.PHONY: docs
docs:
	@echo 'Generating API documentation...'
	@if ! command -v gomarkdoc &> /dev/null; then \
		echo 'gomarkdoc not found. Installing...'; \
		go install github.com/princjef/gomarkdoc/cmd/gomarkdoc@latest; \
	fi
	@PATH="$(shell go env GOPATH)/bin:$$PATH" gomarkdoc ./draw -o ./draw/DOCS.md
	@echo 'API documentation generated at draw/DOCS.md'
