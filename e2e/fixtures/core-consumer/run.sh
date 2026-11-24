#!/usr/bin/env bash
# Packaging check for the ./core entry point.
#
# Packs the library with `pnpm pack`, which runs prepack (svelte-package and publint), installs the
# tarball into a copy of this fixture with only the peers listed in its package.json, and runs
# `vite build` on a page that mounts SceneView.
#
# The copy lives in a temp dir outside the repo. Inside the repo, module resolution walks up to the
# root node_modules, which holds every optional peer, so a banned import would resolve and pass.
#
# Exit codes: the `vite build` exit code, or 1 when an optional peer the scoped path must not need
# was installed. The build fails when the scoped path imports any optional peer the fixture did not
# install, through failOnMissingOptionalPeer.ts. Writes nothing to the repo, including no lockfile.
set -euo pipefail

FIXTURE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$FIXTURE_DIR/../../.." && pwd)"
BANNED_PACKAGES=(
	'@viamrobotics/test-widgets'
	'@viamrobotics/prime-core'
	'tailwindcss'
	'@viamrobotics/tweakpane-config'
	'svelte-tweakpane-ui'
)

work_dir="$(mktemp -d "${TMPDIR:-/tmp}/core-consumer.XXXXXX")"
trap 'rm -rf "$work_dir"' EXIT

echo "Packing @viamrobotics/visualization into $work_dir"
(cd "$REPO_ROOT" && pnpm pack --pack-destination "$work_dir")

app_dir="$work_dir/app"
mkdir "$app_dir"
cp "$FIXTURE_DIR/package.json" "$FIXTURE_DIR/vite.config.ts" "$FIXTURE_DIR/failOnMissingOptionalPeer.ts" \
	"$FIXTURE_DIR/index.html" "$app_dir/"
cp -R "$FIXTURE_DIR/src" "$app_dir/src"
mv "$work_dir"/viamrobotics-visualization-*.tgz "$app_dir/visualization.tgz"

cd "$app_dir"
# auto-install-peers is off so that only the peers the fixture lists get installed.
pnpm install --config.auto-install-peers=false --config.strict-peer-dependencies=false

for package in "${BANNED_PACKAGES[@]}"; do
	if compgen -G "node_modules/.pnpm/${package//\//+}@*" > /dev/null; then
		echo "FAIL: $package was installed, and the scoped path must not need it" >&2
		exit 1
	fi
done

set +e
pnpm exec vite build
build_status=$?
set -e

echo "vite build exited $build_status"
exit "$build_status"
