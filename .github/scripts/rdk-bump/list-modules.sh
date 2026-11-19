#!/usr/bin/env bash
# Prints the directory of every tracked Go module whose build graph includes go.viam.com/rdk,
# one per line, repo root first.
#
# Root first because the modules under docs/ and e2e/ replace github.com/viamrobotics/visualization
# with the repo root, so they inherit its requirements and have to be tidied after it.
#
# Usage: list-modules.sh   (run from anywhere inside the repo)
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# `git ls-files` rather than `find`: gitignored trees such as .wireit/ cache copies of modules.
for module_dir in . $(git ls-files -- '*/go.mod' | xargs -n1 dirname | sort); do
	if (cd "$module_dir" && go list -m go.viam.com/rdk > /dev/null 2>&1); then
		echo "$module_dir"
	fi
done
