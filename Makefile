.PHONY: help setup up

# Default target - show help when no target is specified
.DEFAULT_GOAL := help

help:
	@echo 'Motion Tools Development Setup'
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@echo '  setup  - Set up development environment (install pnpm, bun, dependencies)'
	@echo '  up     - Start development server'
	@echo '  help   - Show this help message'

setup:
	@./etc/setup.sh

up:
	pnpm dev
