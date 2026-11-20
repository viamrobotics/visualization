#!/usr/bin/env bash
# Bumps go.viam.com/rdk to <version> in every Go module that depends on it, then tidies each one.
#
# A module whose bump fails is recorded and left as it was rather than aborting the rest, so the
# verification sweep and the fix agent see every module's state in one run. A module already ahead
# of <version> is never downgraded.
#
# Usage: bump.sh <version>
# Prints a markdown table of each module's RDK version before and after to stdout. Go's own output
# goes to stderr. The Status column is one of: bumped, current, ahead, failed.
set -uo pipefail

version=$1
script_dir=$(cd "$(dirname "$0")" && pwd)
cd "$(git rev-parse --show-toplevel)"

rdk_version_in() {
	(cd "$1" && go list -m -f '{{.Version}}' go.viam.com/rdk)
}

echo '| Module | Before | After | Status |'
echo '| --- | --- | --- | --- |'

for module_dir in $("$script_dir/list-modules.sh"); do
	before=$(rdk_version_in "$module_dir")
	newest=$(printf '%s\n%s\n' "$before" "$version" | sort -V | tail -n1)

	if [ "$before" = "$version" ]; then
		status=current
	elif [ "$newest" = "$before" ]; then
		status=ahead
	else
		echo "::group::Bump $module_dir from $before to $version" >&2
		if (cd "$module_dir" && go get "go.viam.com/rdk@$version" && go mod tidy) >&2; then
			status=bumped
		else
			status=failed
		fi
		echo '::endgroup::' >&2
	fi

	echo "| \`$module_dir\` | \`$before\` | \`$(rdk_version_in "$module_dir")\` | $status |"
done
