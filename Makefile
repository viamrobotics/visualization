.PHONY: help setup up proto-generate proto-lint proto-format proto-clean docs-generate docs-install

# Default target - show help when no target is specified
.DEFAULT_GOAL := help

help:
	@echo 'Motion Tools Development Setup'
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@echo '  setup          - Set up development environment (install pnpm, bun, dependencies)'
	@echo '  up             - Start development server'
	@echo '  proto-generate - Generate Go and TypeScript code from protobuf definitions'
	@echo '  proto-lint     - Lint protobuf files'
	@echo '  proto-format   - Format protobuf files'
	@echo '  proto-clean    - Clean generated protobuf code'
	@echo '  proto-vendor   - Vendor protobuf dependencies'
	@echo '  docs-install   - Install gomarkdoc tool for documentation generation'
	@echo '  docs-generate  - Generate API documentation for Go packages'
	@echo '  help           - Show this help message'

setup:
	@./etc/setup.sh

up:
	pnpm dev

proto-clean:
	@echo 'Cleaning generated protobuf code...'
	@rm -rf draw/v1 src/lib/draw/v1
	@echo 'Clean complete!'

proto-gen-go:
	@echo 'Generating Go code...'
	@PATH="$(shell go env GOPATH)/bin:$(shell pnpm bin):$$PATH" pnpm exec buf generate --template buf.gen.go.yaml

proto-gen-ts:
	@echo 'Generating TypeScript code...'
	@PATH="$(shell go env GOPATH)/bin:$(shell pnpm bin):$$PATH" pnpm exec buf generate --template buf.gen.typescript.yaml

proto-vendor:
	@echo 'Vendoring buf dependencies...'
	@pnpm exec buf export buf.build/viamrobotics/api --output protos/vendor

proto-gen: proto-clean proto-vendor
	@echo 'Generating protobuf code...'
	@echo 'Updating buf dependencies...'
	@pnpm exec buf dep update
	@echo 'Installing protoc-gen-go...'
	@go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
	@make proto-gen-go
	@make proto-gen-ts
	@echo 'Protobuf code generation complete!'

proto-lint:
	@pnpm exec buf lint

proto-format:
	@pnpm exec buf format -w

docs-install:
	@echo 'Installing gomarkdoc...'
	@go install github.com/princjef/gomarkdoc/cmd/gomarkdoc@latest
	@echo 'gomarkdoc installed successfully!'

docs-generate:
	@echo 'Generating API documentation...'
	@if ! command -v gomarkdoc &> /dev/null; then \
		echo 'gomarkdoc not found. Installing...'; \
		$(MAKE) docs-install; \
	fi
	@PATH="$(shell go env GOPATH)/bin:$$PATH" gomarkdoc ./draw -o ./draw/DOCS.md
	@echo 'API documentation generated at draw/DOCS.md'
