#!/usr/bin/env bash
# Run ESLint with a live elapsed-time indicator. The type-aware pass
# (projectService) is silent for ~30-60s, which looks like a hang in plain
# scripts such as `pnpm format`.
set -uo pipefail

# Resolve eslint from the repo's node_modules whether invoked via pnpm or directly.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="$ROOT/node_modules/.bin:$PATH"

if [ ! -t 1 ]; then
	exec eslint "$@"
fi

out="$(mktemp)"
trap 'rm -f "$out"' EXIT

eslint "$@" --color >"$out" 2>&1 &
pid=$!

start=$SECONDS
while kill -0 "$pid" 2>/dev/null; do
	printf '\r\033[36m⏳ ESLint (no output until done)…\033[0m %ds ' "$((SECONDS - start))"
	sleep 1
done
printf '\r\033[2K'

wait "$pid"
code=$?
cat "$out"
exit "$code"
