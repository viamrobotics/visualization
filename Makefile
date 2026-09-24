# Local workflows:
#
#   make setup   one-time: install Node, pnpm, bun, Go, buf, deps, and protos
#   make up      build (if needed) and start the dev server

.PHONY: setup up

setup:
	@./etc/setup.sh

up:
	@pnpm run up
